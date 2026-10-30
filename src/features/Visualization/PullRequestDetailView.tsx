import { useState, useEffect, useCallback, useMemo } from 'react'
import { useGit } from '../GitCore/GitContext'
import { api, ApiError, errorMessage } from '../../lib/api'
import type { PullRequest, PullRequestReview, User } from '../../types/api'
import { getUserDisplayName } from '../../utils/userDisplay'
import { useToast } from '../../components/Toast/ToastProvider'
import { normalizePrState } from '../PullRequest/prState'
import PrStateChip from '../PullRequest/PrStateChip'
import PrBranchMeta from '../PullRequest/PrBranchMeta'
import CollapsibleDiffFile, { PrPatch } from '../PullRequest/CollapsibleDiffFile'

// 서버 버전에 따라 diff 파일 필드명이 달라 후보를 모두 열어둔다
interface RawDiffFile {
    id?: string | number
    path?: string
    file?: string
    filename?: string
    name?: string
    status?: string
    changeType?: string
    patch?: string
    diff?: string
    additions?: number
    added?: number
    deletions?: number
    removed?: number
}

interface PrDiffResponse {
    diff?: string
    files?: RawDiffFile[]
    changedFiles?: RawDiffFile[]
}

interface DiffFile {
    id: string | number
    path: string
    status: string
    patch: string
    additions: number
    deletions: number
}

interface PrReview extends Omit<PullRequestReview, 'id'> {
    id?: string
    _id?: string
    state?: string
    body?: string
    message?: string
    text?: string
    content?: string
    author?: User | string
}

type RawReviews = PrReview[] | { reviews?: unknown; data?: unknown; items?: unknown } | null

export default function PullRequestDetailView() {
    const { state, dispatch } = useGit()
    const toast = useToast()
    const { selectedRepoId, selectedPrId } = state

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [details, setDetails] = useState<PullRequest | null>(null)
    const [diff, setDiff] = useState<PrDiffResponse | string | null>(null)
    const [diffFiles, setDiffFiles] = useState<DiffFile[]>([])
    const [reviews, setReviews] = useState<PrReview[]>([])
    const [newReviewText, setNewReviewText] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [expandedFiles, setExpandedFiles] = useState<Set<string | number>>(new Set()) // diff 파일 접기/펼치기 상태

    const fetchData = useCallback(() => {
        if (!selectedRepoId || !selectedPrId) return

        setLoading(true)
        setError(null)
        Promise.all([
            api.pullRequests.get(selectedRepoId, selectedPrId),
            api.pullRequests.diff(selectedRepoId, selectedPrId),
            api.pullRequests.listReviews(selectedRepoId, selectedPrId)
        ]).then(([detailsData, diffResponse, reviewsResponse]) => {
            setDetails(detailsData)
            // diff 응답 정규화: 문자열 또는 파일 배열 모두 처리
            const diffData = diffResponse as unknown as PrDiffResponse | RawDiffFile[] | string | null
            setDiff(Array.isArray(diffData) ? null : diffData)
            try {
                const diffObj = diffData && typeof diffData === 'object' && !Array.isArray(diffData) ? diffData : null
                const files: RawDiffFile[] = Array.isArray(diffObj?.files)
                    ? diffObj.files
                    : Array.isArray(diffObj?.changedFiles)
                        ? diffObj.changedFiles
                        : Array.isArray(diffData)
                            ? diffData
                            : [];
                const normalized = files.map((f, idx): DiffFile => ({
                    id: f.id || idx,
                    path: f.path || f.file || f.filename || f.name || 'unknown',
                    status: (f.status || f.changeType || '').toLowerCase(),
                    patch: f.patch || f.diff || '',
                    additions: f.additions || f.added || 0,
                    deletions: f.deletions || f.removed || 0,
                }));
                setDiffFiles(normalized);
            } catch {
                setDiffFiles([]);
            }
            // 리뷰 데이터 정규화: 다양한 응답 구조 지원
            const reviewsData = reviewsResponse as unknown as RawReviews
            let normalizedReviews: PrReview[] = [];
            if (Array.isArray(reviewsData)) {
                normalizedReviews = reviewsData;
            } else if (reviewsData && Array.isArray(reviewsData.reviews)) {
                normalizedReviews = reviewsData.reviews;
            } else if (reviewsData && Array.isArray(reviewsData.data)) {
                normalizedReviews = reviewsData.data;
            } else if (reviewsData && Array.isArray(reviewsData.items)) {
                normalizedReviews = reviewsData.items;
            }
            setReviews(normalizedReviews)
        }).catch((e: unknown) => {
            setError(errorMessage(e, '변경 요청 정보를 불러오는 데 실패했습니다.'))
        }).finally(() => {
            setLoading(false)
        })
    }, [selectedRepoId, selectedPrId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const isApproved = useMemo(() => {
        return reviews.some(review => review.status?.toUpperCase() === 'APPROVED');
    }, [reviews]);

    const normalizedPrState = normalizePrState(details);
    const isPrOpen = normalizedPrState === 'OPEN';
    const isPrMerged = normalizedPrState === 'MERGED';

    const toggleFileExpanded = (fileId: string | number) => {
        setExpandedFiles(prev => {
            const next = new Set(prev);
            if (next.has(fileId)) next.delete(fileId);
            else next.add(fileId);
            return next;
        });
    };

    const handleSubmitReview = async (status: 'commented' | 'approved') => {
        if (!selectedRepoId || !selectedPrId) return;
        const comment = newReviewText.trim();
        const isApproval = status.toUpperCase() === 'APPROVED';
        if (status.toUpperCase() === 'COMMENTED' && !comment) {
            toast.show('댓글 내용을 입력해주세요.', 'error');
            return;
        }

        setIsSubmitting(true)
        try {
            await api.pullRequests.createReview(selectedRepoId, selectedPrId, {
                comment: comment || (isApproval ? '승인합니다.' : '리뷰를 남깁니다.'),
                status: status
            })
            setNewReviewText('')
            fetchData()
        } catch (e) {
            toast.show(`리뷰 작성 실패: ${errorMessage(e)}`, 'error')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleMerge = async () => {
        if (!selectedRepoId || !selectedPrId || !details) return;
        if (!isApproved) {
            toast.show('합치려면 최소 1개 이상의 "승인(Approve)" 리뷰가 필요합니다.', 'error');
            return;
        }
        if (isPrMerged) {
            toast.show('이미 합쳐진 변경 요청입니다.', 'info');
            return;
        }
        if (!window.confirm(`변경 요청 #${details.id}를 합치시겠습니까?`)) return

        setIsSubmitting(true)
        try {
            await api.pullRequests.merge(selectedRepoId, selectedPrId)
            await fetchData()
            dispatch({ type: 'GRAPH_DIRTY' })
            dispatch({ type: 'SET_VIEW', payload: 'prs' })
        } catch (e) {
            toast.show(`합치기 실패: ${errorMessage(e)}`, 'error')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClosePr = async () => {
        if (!selectedRepoId || !selectedPrId || !details) return;
        if (!window.confirm(`변경 요청 #${details.id}를 닫으시겠습니까?\n합쳐지지 않은 변경사항은 사라집니다.`)) return;
        setIsSubmitting(true);
        try {
            await api.pullRequests.close(selectedRepoId, selectedPrId);
            dispatch({ type: 'GRAPH_DIRTY' });
            dispatch({ type: 'SET_VIEW', payload: 'prs' });
        } catch (e) {
            toast.show(`변경 요청 닫기에 실패: ${errorMessage(e)}`, 'error');
            if (e instanceof ApiError && e.status === 409) {
                fetchData();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="panel pr-detail-view">
            <button className="btn btn-ghost" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'prs' })}>
                &larr; 목록으로 돌아가기
            </button>

            {loading && <div><span className="spinner" /> 변경 요청 정보를 불러오는 중...</div>}
            {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

            {!loading && details && (
                <>
                    <div className="pr-detail-header">
                        <h2># {details.title}</h2>
                        {isPrOpen ? (
                            <div className="pr-detail-actions">
                                <button className="btn" onClick={handleClosePr}>
                                    변경 요청 닫기
                                </button>
                                <button
                                    className={`btn ${isApproved ? 'btn-success' : ''}`}
                                    onClick={handleMerge}
                                    title={!isApproved ? '합치려면 "승인" 리뷰가 필요합니다.' : (isPrMerged ? '이미 합치기가 완료된 변경 요청입니다.' : '')}
                                >
                                    {isSubmitting ? '합치는 중...' : '합치기'}
                                </button>
                            </div>
                        ) : (
                            <PrStateChip pr={details} />
                        )}
                    </div>
                    <p className="panel-sub">{details.description || "설명이 없습니다."}</p>
                    <PrBranchMeta pr={details} />

                    <h3 className="pr-section-title">변경 사항 (Diff)</h3>
                    {diffFiles.length > 0 ? (
                        <div className="pr-diff-file-list" style={{ display: 'grid', gap: 12 }}>
                            {diffFiles.map(file => {
                                const fileId = file.id || file.path;
                                return (
                                    <CollapsibleDiffFile
                                        key={fileId}
                                        path={file.path}
                                        status={file.status}
                                        additions={file.additions}
                                        deletions={file.deletions}
                                        patch={file.patch}
                                        expanded={expandedFiles.has(fileId)}
                                        onToggle={() => toggleFileExpanded(fileId)}
                                    />
                                );
                            })}
                        </div>
                    ) : (
                        // [수정됨] 폴백 Diff 렌더링
                        <pre className="pr-diff" style={{ padding: '8px 12px', background: 'var(--panel-bg)', borderRadius: 8 }}>
                            <PrPatch patch={typeof diff === 'string' ? diff : diff?.diff} />
                        </pre>
                    )}

                    <h3 className="pr-section-title">리뷰 ({reviews.length})</h3>
                    <div className="review-list">
                        {reviews.length === 0 && <div className="empty">아직 리뷰가 없습니다.</div>}
                        {reviews.map(review => {
                            // 리뷰 댓글 필드 정규화: 다양한 필드명 지원
                            const reviewComment = review.comment || review.body || review.message || review.text || review.content || '';
                            const reviewStatus = review.status || review.state || '';
                            
                            return (
                                <div key={review.id || review._id || Math.random()} className="review-item">
                                    <strong className="review-author">{getUserDisplayName(review.author)}</strong>
                                    {reviewComment && (
                                        <p className="review-comment">{reviewComment}</p>
                                    )}
                                    {reviewStatus && (
                                        <span className={`review-status ${reviewStatus.toLowerCase()}`}>
                                            {reviewStatus}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 리뷰 작성 섹션: 승인/댓글 작성 (열린 PR에서만 작성 가능) */}
                    {isPrOpen && (
                        <div className="review-form">
                            <textarea
                                className="input"
                                rows={3}
                                placeholder="리뷰를 작성하세요..."
                                value={newReviewText}
                                onChange={e => setNewReviewText(e.target.value)}
                            />
                            <div className="review-form-actions">
                                <button
                                    className="btn"
                                    onClick={() => handleSubmitReview('commented')}
                                >
                                    댓글
                                </button>
                                <button
                                    className="btn btn-success"
                                    onClick={() => handleSubmitReview('approved')}
                                >
                                    {isSubmitting ? '등록 중...' : '승인'}
                                </button>
                            </div>
                            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--sub)' }}>
                                합치려면 최소 1개의 승인 리뷰가 필요합니다.
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}