import React, {useEffect, useState} from 'react'
import {useGit} from '../GitCore/GitContext'
import {api} from '../API'
import { getUserDisplayName } from '../../utils/userDisplay.js'
import CreatePullRequestModal from '../../components/Modal/CreatePullRequestModal.jsx'

export default function PullRequestListView() {
    const {state, dispatch} = useGit()
    const {selectedRepoId, prList} = state
    const [loading, setLoading] = useState(prList.length === 0)
    const [error, setError] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)

    const fetchPRs = () => {
        if (!selectedRepoId) return

        setLoading(true)
        api.pullRequests.list(selectedRepoId)
            .then(data => {
                dispatch({type: 'SET_PRS', payload: data.pullRequests || data || []})
                setError(null)
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        fetchPRs()
    }, [selectedRepoId, dispatch, state.graphVersion])

    useEffect(() => {
        if (prList.length > 0) {
            setLoading(false)
        }
    }, [prList])

    // 병합은 상세 화면에서만 가능 (리뷰 승인 필요)
    const openDetail = (prId, e) => {
        if (e) e.stopPropagation();
        dispatch({type: 'SELECT_PR', payload: prId})
    }

    return (
        <div className="panel">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                <h3>Pull Requests</h3>
                <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                    + 새 Pull Request
                </button>
            </div>

            {loading && <div><span className="spinner"/> 목록을 불러오는 중...</div>}
            {error && <div style={{color: 'var(--danger)'}}>{error}</div>}

            {!loading && !error && (
                <div className="pr-list">
                    {prList.length === 0 && (
                        <div className="empty" style={{padding: '40px 0'}}>열려있는 Pull Request가 없습니다.</div>
                    )}
                    {prList.map(pr => {
                        const normalizedState = String(pr.state || pr.status || '').trim().toUpperCase() || 'OPEN';
                        const statusLabel = pr.status || pr.state || 'OPEN';
                        const authorName = getUserDisplayName(pr.author);

                        return (
                            <div
                                key={pr.id}
                                className="pr-item"
                                onClick={() => dispatch({type: 'SELECT_PR', payload: pr.id})}
                            >
                                <div className="pr-info">
                                    <h4 className="pr-title"># {pr.title}</h4>
                                    <div className="pr-meta">


                                        {authorName}가
                                        <span className="branch-chip">{pr.sourceBranch}</span>
                                        →
                                        <span className="branch-chip">{pr.targetBranch}</span>
                                        브랜치로 병합을 요청합니다.
                                    </div>
                                </div>
                                <div className="pr-actions">
                                    {/* 병합은 상세 화면에서 승인 리뷰가 있어야 가능 */}
                                    {normalizedState === 'OPEN' ? (
                                        <button className="btn btn-primary" onClick={(e) => openDetail(pr.id, e)}>
                                            검토/병합
                                        </button>
                                    ) : (
                                        <span className="pr-state-chip" style={{textTransform: 'uppercase'}}>
                                            {statusLabel}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <CreatePullRequestModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onCreated={() => {
                    setModalOpen(false)
                    dispatch({type: 'GRAPH_DIRTY'})
                }}
            />
        </div>
    )
}