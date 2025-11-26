import React, {useEffect, useState} from 'react'
import {useGit} from '../GitCore/GitContext'
import {api} from '../API'
import { getUserDisplayName } from '../../utils/userDisplay.js'
import CreatePullRequestModal from '../../components/Modal/CreatePullRequestModal.jsx'
import TutorialOverlay from '../../components/Tutorial/TutorialOverlay'
import ButtonTooltip from '../../components/Tooltip/ButtonTooltip'

export default function PullRequestListView() {
    const {state, dispatch} = useGit()
    const {selectedRepoId, prList, prCreateModalOpen, workflowGuide, suggestedWorkflowSteps} = state
    const [loading, setLoading] = useState(prList.length === 0)
    const [error, setError] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)
    
    // GitContext에서 PR 생성 모달 상태를 동기화
    useEffect(() => {
        if (prCreateModalOpen && !modalOpen) {
            setModalOpen(true);
        }
    }, [prCreateModalOpen, modalOpen]);

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
            {/* 워크플로우 가이드 표시 */}
            {workflowGuide && workflowGuide.steps.length > 0 && (
                <div className="process-alert info" style={{ marginBottom: "16px" }}>
                    <div className="process-alert-header">
                        <div>
                            <strong className="process-alert-title">현재 단계</strong>
                            <span className="process-alert-step">Pull Request 만들기</span>
                        </div>
                    </div>
                    <p className="process-alert-body">변경사항을 코드 리뷰를 받기 위해 Pull Request를 만들어주세요.</p>
                    
                    <div className="workflow-guide-box" style={{ marginTop: "12px" }}>
                        <div className="workflow-guide-title">🤖 추천된 워크플로우</div>
                        <div className="workflow-guide-steps">
                            {workflowGuide.steps.map((stepInfo, idx) => {
                                const isActive = stepInfo.step === "pr";
                                return (
                                    <div key={idx} className={`workflow-guide-step ${isActive ? "active" : ""}`}>
                                        <span className="workflow-guide-step-number">{stepInfo.index}</span>
                                        <span className="workflow-guide-step-icon">{stepInfo.icon}</span>
                                        <span className="workflow-guide-step-label">{stepInfo.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="workflow-guide-hint">순서대로 진행하시면 됩니다. 현재 단계가 강조 표시됩니다.</div>
                    </div>
                    
                    <div className="process-alert-message info" style={{ marginTop: "12px" }}>
                        위의 <strong>'+ 새 Pull Request'</strong> 버튼을 클릭하여 PR을 생성하세요. 버튼이 강조 표시되어 있습니다.
                    </div>
                </div>
            )}
            
            {!workflowGuide && prCreateModalOpen && (
                <div className="process-alert info" style={{ marginBottom: "16px" }}>
                    <div className="process-alert-header">
                        <div>
                            <strong className="process-alert-title">현재 단계</strong>
                            <span className="process-alert-step">Pull Request 만들기</span>
                        </div>
                    </div>
                    <p className="process-alert-body">변경사항을 코드 리뷰를 받기 위해 Pull Request를 만들어주세요.</p>
                    <div className="process-alert-message info">
                        위의 <strong>'+ 새 Pull Request'</strong> 버튼을 클릭하여 PR을 생성하세요. 버튼이 강조 표시되어 있습니다.
                    </div>
                </div>
            )}
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                <h3>Pull Requests</h3>
                <button 
                    id="tutorial-pr-btn"
                    className={`btn btn-primary ${(prCreateModalOpen || (workflowGuide && suggestedWorkflowSteps.includes("pr"))) ? "ai-suggested" : ""}`}
                    data-ai-suggested={(prCreateModalOpen || (workflowGuide && suggestedWorkflowSteps.includes("pr"))) ? "true" : undefined}
                    onClick={() => {
                        setModalOpen(true);
                        dispatch({ type: "CLOSE_PR_CREATE_MODAL" });
                    }}
                >
                    {(prCreateModalOpen || (workflowGuide && suggestedWorkflowSteps.includes("pr"))) && "🤖 "}+ 새 Pull Request
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
                onClose={() => {
                    setModalOpen(false);
                    dispatch({ type: "CLOSE_PR_CREATE_MODAL" });
                }}
                onCreated={() => {
                    setModalOpen(false);
                    dispatch({ type: "CLOSE_PR_CREATE_MODAL" });
                    // PR 생성 완료 시 워크플로우 완료 처리
                    dispatch({ type: "CLEAR_SUGGESTED_WORKFLOW_STEPS" });
                    dispatch({ type: "SET_WORKFLOW_GUIDE", payload: null });
                    dispatch({type: 'GRAPH_DIRTY'});
                    fetchPRs(); // PR 목록 새로고침
                }}
            />
            
            {/* PR 버튼 툴팁 */}
            {(workflowGuide && suggestedWorkflowSteps.includes("pr")) && (
                <ButtonTooltip
                    targetElementId="tutorial-pr-btn"
                    message="변경사항을 코드 리뷰를 받기 위해 Pull Request를 만듭니다"
                    position="bottom"
                    show={true}
                />
            )}
        </div>
    )
}