import React, { useEffect, useState } from 'react'
import { useGit } from '../GitCore/GitContext'
import { api } from '../API'
import CreatePullRequestModal from '../../components/Modal/CreatePullRequestModal.jsx'

export default function PullRequestListView() {
    const { state, dispatch } = useGit()
    const { selectedRepoId, prList } = state
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)

    const fetchPRs = () => {
        if (!selectedRepoId) return

        setLoading(true)
        api.pullRequests.list(selectedRepoId)
            .then(data => {
                dispatch({ type: 'SET_PRS', payload: data.pullRequests || data || [] })
                setError(null)
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        fetchPRs()
    }, [selectedRepoId, dispatch, state.graphVersion])

    const handleMerge = async (prId, e) => {
        e.stopPropagation();
        if (!window.confirm(`PR #${prId}를 병합하시겠습니까?`)) return
        try {
            await api.pullRequests.merge(selectedRepoId, prId)
            dispatch({ type: 'GRAPH_DIRTY' })
        } catch (e) {
            alert(`병합 실패: ${e.message}`)
        }
    }

    return (
        <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>Pull Requests</h3>
                <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                    + 새 Pull Request
                </button>
            </div>

            {loading && <div><span className="spinner" /> 목록을 불러오는 중...</div>}
            {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

            {!loading && !error && (
                <div className="pr-list">
                    {prList.length === 0 && (
                        <div className="empty" style={{ padding: '40px 0' }}>열려있는 Pull Request가 없습니다.</div>
                    )}
                    {prList.map(pr => (
                        <div key={pr.id} className="pr-item" onClick={() => dispatch({ type: 'SELECT_PR', payload: pr.id })}>
                            <div className="pr-info">
                                <h4 className="pr-title">#{pr.id} {pr.title}</h4>
                                <div className="pr-meta">
                                    {pr.author?.username || 'user'}가
                                    <span className="branch-chip">{pr.sourceBranch}</span>
                                    →
                                    <span className="branch-chip">{pr.targetBranch}</span>
                                    브랜치로 병합을 요청합니다.
                                </div>
                            </div>
                            <div className="pr-actions">
                                {/* [수정] pr.state가 'open' (소문자)이어도 인식하도록 .toUpperCase() 추가 */}
                                {pr.state?.toUpperCase() === 'OPEN' ? (
                                    <button className="btn btn-success" onClick={(e) => handleMerge(pr.id, e)}>
                                        병합하기
                                    </button>
                                ) : (
                                    <span className="pr-state-chip" style={{textTransform: 'uppercase'}}>{pr.state}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CreatePullRequestModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onCreated={() => {
                    setModalOpen(false)
                    dispatch({ type: 'GRAPH_DIRTY' })
                }}
            />
        </div>
    )
}