import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useGit } from '../GitCore/GitContext'
import { api } from '../API'

export default function PullRequestDetailView() {
    const { state, dispatch } = useGit()
    const { selectedRepoId, selectedPrId } = state

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [details, setDetails] = useState(null)
    const [diff, setDiff] = useState(null)
    const [reviews, setReviews] = useState([])
    const [newReviewText, setNewReviewText] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const fetchData = useCallback(() => {
        if (!selectedRepoId || !selectedPrId) return

        setLoading(true)
        setError(null)
        Promise.all([
            api.pullRequests.get(selectedRepoId, selectedPrId),
            api.pullRequests.diff(selectedRepoId, selectedPrId),
            api.pullRequests.listReviews(selectedRepoId, selectedPrId)
        ]).then(([detailsData, diffData, reviewsData]) => {
            setDetails(detailsData)
            setDiff(diffData)
            setReviews(reviewsData.reviews || reviewsData || [])
        }).catch(e => {
            setError(e.message || 'PR 정보를 불러오는 데 실패했습니다.')
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

    // [신규] PR이 열려있는지 확인 (대소문자 무관)
    const isPrOpen = useMemo(() => {
        return details?.state?.toUpperCase() === 'OPEN';
    }, [details]);

    const handleSubmitReview = async (status) => {
        const comment = newReviewText.trim();
        if (status === 'COMMENTED' && !comment) {
            alert('댓글 내용을 입력해주세요.');
            return;
        }

        setIsSubmitting(true)
        try {
            await api.pullRequests.createReview(selectedRepoId, selectedPrId, {
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
            alert('병합하려면 최소 1개 이상의 "승인(Approve)" 리뷰가 필요합니다.');
            return;
        }
        if (!window.confirm(`PR #${details.id}를 병합하시겠습니까?`)) return

        setIsSubmitting(true)
        try {
            await api.pullRequests.merge(selectedRepoId, selectedPrId)
            dispatch({ type: 'GRAPH_DIRTY' })
            dispatch({ type: 'SET_VIEW', payload: 'prs' })
        } catch (e) {
            alert(`병합 실패: ${e.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    // [신규] PR 닫기 핸들러
    const handleClosePr = async () => {
        if (!window.confirm(`PR #${details.id}를 닫으시겠습니까?\n병합되지 않은 변경사항은 사라집니다.`)) return;
        setIsSubmitting(true);
        try {
            await api.pullRequests.close(selectedRepoId, selectedPrId);
            dispatch({ type: 'GRAPH_DIRTY' });
            dispatch({ type: 'SET_VIEW', payload: 'prs' });
        } catch (e) {
            alert(`PR 닫기에 실패: ${e.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="panel pr-detail-view">
            <button className="btn btn-ghost" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'prs' })}>
                &larr; 목록으로 돌아가기
            </button>

            {loading && <div><span className="spinner" /> PR 정보를 불러오는 중...</div>}
            {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

            {!loading && details && (
                <>
                    <div className="pr-detail-header">
                        <h2>#{details.id} {details.title}</h2>
                        {/* [수정] isPrOpen 변수 사용 */}
                        {isPrOpen ? (
                            <div className="pr-detail-actions">
                                <button className="btn" onClick={handleClosePr} disabled={isSubmitting}>
                                    PR 닫기
                                </button>
                                <button
                                    className={`btn ${isApproved ? 'btn-success' : 'btn-locked'}`}
                                    onClick={handleMerge}
                                    disabled={isSubmitting || !isApproved}
                                    title={!isApproved ? '병합하려면 "승인" 리뷰가 필요합니다.' : ''}
                                >
                                    {isSubmitting ? '병합 중...' : '병합하기'}
                                </button>
                            </div>
                        ) : (
                            <span className="pr-state-chip" style={{textTransform: 'uppercase'}}>{details.state}</span>
                        )}
                    </div>
                    <p className="panel-sub">{details.description || "설명이 없습니다."}</p>
                    <div className="pr-meta">
                        {details.author?.username || 'user'}가
                        <span className="branch-chip">{details.sourceBranch}</span>
                        →
                        <span className="branch-chip">{details.targetBranch}</span>
                        브랜치로 병합을 요청합니다.
                    </div>

                    <h3 className="pr-section-title">변경 사항 (Diff)</h3>
                    <pre className="pr-diff">
                        <code>{diff?.diff || "변경 사항이 없거나 불러올 수 없습니다."}</code>
                    </pre>

                    <h3 className="pr-section-title">리뷰 ({reviews.length})</h3>
                    <div className="review-list">
                        {reviews.length === 0 && <div className="empty">아직 리뷰가 없습니다.</div>}
                        {reviews.map(review => (
                            <div key={review.id} className="review-item">
                                <strong className="review-author">{review.author?.username || 'user'}</strong>
                                <p className="review-comment">{review.comment}</p>
                                <span className={`review-status ${review.status?.toLowerCase()}`}>
                                    {review.status}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* [수정] isPrOpen 변수 사용 */}
                    {isPrOpen && (
                        <div className="review-form">
                            <textarea
                                className="input"
                                rows="3"
                                placeholder="리뷰를 작성하세요..."
                                value={newReviewText}
                                onChange={e => setNewReviewText(e.target.value)}
                                disabled={isSubmitting}
                            />
                            <div className="review-form-actions">
                                <button
                                    className="btn"
                                    onClick={() => handleSubmitReview('COMMENTED')}
                                    disabled={isSubmitting || !newReviewText.trim()}
                                >
                                    댓글
                                </button>
                                <button
                                    className="btn btn-success"
                                    onClick={() => handleSubmitReview('APPROVED')}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? '등록 중...' : '승인'}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}