import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useGit } from '../GitCore/GitContext'
import { api } from '../API'
import { getUserDisplayName } from '../../utils/userDisplay.js'

export default function PullRequestDetailView() {
    const { state, dispatch } = useGit()
    const { selectedRepoId, selectedPrId } = state

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [details, setDetails] = useState(null)
    const [diff, setDiff] = useState(null)
    const [diffFiles, setDiffFiles] = useState([])
    const [reviews, setReviews] = useState([])
    const [newReviewText, setNewReviewText] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [expandedFiles, setExpandedFiles] = useState(new Set()) // diff 파일 접기/펼치기 상태

    const fetchData = useCallback(() => {
        if (!selectedRepoId || !selectedPrId) return

        setLoading(true)
        setError(null)
        Promise.all([
            api.변경요청.조회(selectedRepoId, selectedPrId),
            api.변경요청.비교(selectedRepoId, selectedPrId),
            api.변경요청.리뷰목록(selectedRepoId, selectedPrId)
        ]).then(([detailsData, diffData, reviewsData]) => {
            setDetails(detailsData)
            // diff 응답 정규화: 문자열 또는 파일 배열 모두 처리
            setDiff(diffData)
            try {
                const files = Array.isArray(diffData?.files)
                    ? diffData.files
                    : Array.isArray(diffData?.changedFiles)
                        ? diffData.changedFiles
                        : Array.isArray(diffData)
                            ? diffData
                            : [];
                const normalized = files.map((f, idx) => ({
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
            let normalizedReviews = [];
            if (Array.isArray(reviewsData)) {
                normalizedReviews = reviewsData;
            } else if (reviewsData && Array.isArray(reviewsData.reviews)) {
                normalizedReviews = reviewsData.reviews;
            } else if (reviewsData && reviewsData.data && Array.isArray(reviewsData.data)) {
                normalizedReviews = reviewsData.data;
            } else if (reviewsData && reviewsData.items && Array.isArray(reviewsData.items)) {
                normalizedReviews = reviewsData.items;
            }
            setReviews(normalizedReviews)
        }).catch(e => {
            setError(e.message || '변경 요청 정보를 불러오는 데 실패했습니다.')
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

    const normalizedPrState = useMemo(() => {
        const stateSource = details?.state ?? details?.status ?? '';
        return String(stateSource || '').trim().toUpperCase();
    }, [details]);

    const isPrOpen = useMemo(() => {
        if (!normalizedPrState) return true;
        return normalizedPrState === 'OPEN';
    }, [normalizedPrState]);

    const isPrMerged = useMemo(() => normalizedPrState === 'MERGED', [normalizedPrState]);

    const toggleFileExpanded = (fileId) => {
        setExpandedFiles(prev => {
            const next = new Set(prev);
            if (next.has(fileId)) {
                next.delete(fileId);
            } else {
                next.add(fileId);
            }
            return next;
        });
    };

    const handleSubmitReview = async (status) => {
        const comment = newReviewText.trim();
        if (status === 'COMMENTED' && !comment) {
            alert('댓글 내용을 입력해주세요.');
            return;
        }

        setIsSubmitting(true)
        try {
            await api.변경요청.리뷰생성(selectedRepoId, selectedPrId, {
                comment: comment || (status === 'APPROVED' ? '승인합니다.' : '리뷰를 남깁니다.'),
                status: status
            })
            setNewReviewText('')
            fetchData()
        } catch (e) {
            alert(`리뷰 작성 실패: ${e.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleMerge = async () => {
        if (!isApproved) {
            alert('합치려면 최소 1개 이상의 "승인(Approve)" 리뷰가 필요합니다.');
            return;
        }
        if (isPrMerged) {
            alert('이미 합쳐진 변경 요청입니다.');
            return;
        }
        if (!window.confirm(`변경 요청 #${details.id}를 합치시겠습니까?`)) return

        setIsSubmitting(true)
        try {
            await api.변경요청.합치기(selectedRepoId, selectedPrId)
            await fetchData()
            dispatch({ type: 'GRAPH_DIRTY' })
            dispatch({ type: 'SET_VIEW', payload: 'prs' })
        } catch (e) {
            alert(`합치기 실패: ${e.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClosePr = async () => {
        if (!window.confirm(`변경 요청 #${details.id}를 닫으시겠습니까?\n합쳐지지 않은 변경사항은 사라집니다.`)) return;
        setIsSubmitting(true);
        try {
            await api.변경요청.닫기(selectedRepoId, selectedPrId);
            dispatch({ type: 'GRAPH_DIRTY' });
            dispatch({ type: 'SET_VIEW', payload: 'prs' });
        } catch (e) {
            alert(`변경 요청 닫기에 실패: ${e.message}`);
            if (e.status === 409) {
                fetchData();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderDiffPatch = (patch) => {
        if (!patch) {
            return <code style={{ color: 'var(--sub)' }}>이 파일에 대한 차이가 없습니다.</code>;
        }

        const lines = patch.split('\n');
        return (
            <code>
                {lines.map((line, index) => {
                    let style = {};
                    if (line.startsWith('+')) {
                        style.color = 'var(--success)'; // 녹색
                        style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
                    } else if (line.startsWith('-')) {
                        style.color = 'var(--danger)'; // 빨간색
                        style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
                    } else if (line.startsWith('@@')) {
                        style.color = 'var(--info)'; // 파란색 (파일 위치)
                    }

                    return (
                        <span key={index} style={{ ...style, display: 'block', whiteSpace: 'pre-wrap' }}>
                            {line || ' '}
                        </span>
                    );
                })}
            </code>
        );
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
                            <span className="pr-state-chip" style={{textTransform: 'uppercase'}}>{details.status || details.state}</span>
                        )}
                    </div>
                    <p className="panel-sub">{details.description || "설명이 없습니다."}</p>
                    <div className="pr-meta">
                        {getUserDisplayName(details.author)}가
                        <span className="branch-chip">{details.sourceBranch}</span>
                        →
                        <span className="branch-chip">{details.targetBranch}</span>
                        가지로 합치기를 요청합니다.
                    </div>

                    <h3 className="pr-section-title">변경 사항 (Diff)</h3>
                    {diffFiles.length > 0 ? (
                        <div className="pr-diff-file-list" style={{ display: 'grid', gap: 12 }}>
                            {diffFiles.map(file => {
                                const fileId = file.id || file.path;
                                const isExpanded = expandedFiles.has(fileId);
                                return (
                                    <div key={fileId} className="pr-diff-file">
                                        <div 
                                            className="pr-diff-file-header" 
                                            style={{
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'space-between',
                                                background: 'var(--panel-2)', 
                                                border: '1px solid var(--line)', 
                                                borderBottom: isExpanded ? 'none' : '1px solid var(--line)',
                                                padding: '8px 12px', 
                                                borderTopLeftRadius: 8, 
                                                borderTopRightRadius: 8,
                                                borderBottomLeftRadius: isExpanded ? 0 : 8,
                                                borderBottomRightRadius: isExpanded ? 0 : 8,
                                                cursor: 'pointer',
                                                userSelect: 'none'
                                            }}
                                            onClick={() => toggleFileExpanded(fileId)}
                                        >
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                                                <span style={{ fontSize: '14px', color: 'var(--sub)' }}>
                                                    {isExpanded ? '▼' : '▶'}
                                                </span>
                                                <span className="file-path" style={{ fontFamily: 'var(--font-mono)' }}>{file.path}</span>
                                                {file.status && (
                                                    <span className="file-status" style={{ textTransform: 'uppercase', fontSize: 12, color: 'var(--sub)' }}>
                                                        {file.status}
                                                    </span>
                                                )}
                                            </div>
                                            {(file.additions || file.deletions) ? (
                                                <div className="file-stats" style={{ fontSize: 12, color: 'var(--sub)' }}>
                                                    +{file.additions || 0} −{file.deletions || 0}
                                                </div>
                                            ) : null}
                                        </div>
                                        {isExpanded && (
                                            <pre className="pr-diff" style={{
                                                margin: 0, 
                                                border: '1px solid var(--line)', 
                                                borderTop: 'none',
                                                borderBottomLeftRadius: 8, 
                                                borderBottomRightRadius: 8, 
                                                overflowX: 'auto',
                                                padding: '8px 12px', 
                                                background: 'var(--panel-bg)'
                                            }}>
                                                {renderDiffPatch(file.patch)}
                                            </pre>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        // [수정됨] 폴백 Diff 렌더링
                        <pre className="pr-diff" style={{ padding: '8px 12px', background: 'var(--panel-bg)', borderRadius: 8 }}>
                            {renderDiffPatch((typeof diff === 'string' ? diff : diff?.diff))}
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
                                rows="3"
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