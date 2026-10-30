import {useEffect, useState, type MouseEvent} from 'react'
import {useGit} from '../GitCore/GitContext'
import {api, errorMessage} from '../../lib/api'
import type {Id} from '../../types/api'
import { normalizePrState } from '../PullRequest/prState'
import PrStateChip from '../PullRequest/PrStateChip'
import PrBranchMeta from '../PullRequest/PrBranchMeta'
import CreatePullRequestModal from '../../components/Modal/CreatePullRequestModal'
import ButtonTooltip from '../../components/Tooltip/ButtonTooltip'
import WorkflowGuideBox from '../Workflow/WorkflowGuideBox'
import { STEP_LABELS } from '../Workflow/workflowSteps'
import type { WorkflowGuide } from '../../types/git'

function PrStepAlert({ guide }: { guide: WorkflowGuide | null }) {
    return (
        <div className="process-alert info" style={{ marginBottom: "16px" }}>
            <div className="process-alert-header">
                <div>
                    <strong className="process-alert-title">현재 단계</strong>
                    <span className="process-alert-step">{STEP_LABELS.pr}</span>
                </div>
            </div>
            <p className="process-alert-body">변경사항을 코드 리뷰를 받기 위해 변경 요청을 만들어주세요.</p>
            {guide && (
                <WorkflowGuideBox
                    guide={guide}
                    isActive={(s) => s.step === "pr"}
                    title="🤖 추천된 워크플로우"
                    showProgress={false}
                    hint="순서대로 진행하시면 됩니다. 현재 단계가 강조 표시됩니다."
                    style={{ marginTop: "12px" }}
                />
            )}
            <div className="process-alert-message info" style={guide ? { marginTop: "12px" } : undefined}>
                위의 <strong>'+ 새 변경 요청'</strong> 버튼을 클릭하여 변경 요청을 생성하세요. 버튼이 강조 표시되어 있습니다.
            </div>
        </div>
    )
}

export default function PullRequestListView() {
    const {state, dispatch} = useGit()
    const {selectedRepoId, prList, prCreateModalOpen, workflowGuide, suggestedWorkflowSteps} = state
    const [loading, setLoading] = useState(prList.length === 0)
    const [error, setError] = useState<string | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    
    // GitContext에서 변경 요청 생성 모달 상태를 동기화
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
                dispatch({type: 'SET_PRS', payload: Array.isArray(data) ? data : data?.pullRequests || []})
                setError(null)
            })
            .catch((e: unknown) => setError(errorMessage(e)))
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
    const openDetail = (prId: Id, e?: MouseEvent) => {
        if (e) e.stopPropagation();
        dispatch({type: 'SELECT_PR', payload: prId})
    }

    return (
        <div className="panel">
            {/* 워크플로우 진행 중이거나 변경 요청 생성을 유도할 때 현재 단계 안내 */}
            {(workflowGuide?.steps.length || (!workflowGuide && prCreateModalOpen)) ? (
                <PrStepAlert guide={workflowGuide?.steps.length ? workflowGuide : null} />
            ) : null}

            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                <h3>변경 요청</h3>
                <button 
                    id="tutorial-pr-btn"
                    className={`btn btn-primary ${(prCreateModalOpen || (workflowGuide && suggestedWorkflowSteps.includes("pr"))) ? "ai-suggested" : ""}`}
                    data-ai-suggested={(prCreateModalOpen || (workflowGuide && suggestedWorkflowSteps.includes("pr"))) ? "true" : undefined}
                    onClick={() => {
                        setModalOpen(true);
                        dispatch({ type: "CLOSE_PR_CREATE_MODAL" });
                    }}
                >
                    {(prCreateModalOpen || (workflowGuide && suggestedWorkflowSteps.includes("pr"))) && "🤖 "}+ 새 변경 요청
                </button>
            </div>

            {loading && <div><span className="spinner"/> 목록을 불러오는 중...</div>}
            {error && <div style={{color: 'var(--danger)'}}>{error}</div>}

            {!loading && !error && (
                <div className="pr-list">
                    {prList.length === 0 && (
                        <div className="empty" style={{padding: '40px 0'}}>열려있는 변경 요청이 없습니다.</div>
                    )}
                    {prList.map(pr => {
                        const normalizedState = normalizePrState(pr);

                        return (
                            <div
                                key={pr.id}
                                className="pr-item"
                                onClick={() => dispatch({type: 'SELECT_PR', payload: pr.id})}
                            >
                                <div className="pr-info">
                                    <h4 className="pr-title"># {pr.title}</h4>
                                    <PrBranchMeta pr={pr} />
                                </div>
                                <div className="pr-actions">
                                    {/* 합치기는 상세 화면에서 승인 리뷰가 있어야 가능 */}
                                    {normalizedState === 'OPEN' ? (
                                        <button className="btn btn-primary" onClick={(e) => openDetail(pr.id, e)}>
                                            검토/합치기
                                        </button>
                                    ) : (
                                        <PrStateChip pr={pr} />
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
                    // 변경 요청 생성 완료 시 워크플로우 완료 처리
                    dispatch({ type: "CLEAR_SUGGESTED_WORKFLOW_STEPS" });
                    dispatch({ type: "SET_WORKFLOW_GUIDE", payload: null });
                    dispatch({type: 'GRAPH_DIRTY'});
                    fetchPRs(); // 변경 요청 목록 새로고침
                }}
            />
            
            {/* 변경 요청 버튼 툴팁 */}
            {(workflowGuide && suggestedWorkflowSteps.includes("pr")) && (
                <ButtonTooltip
                    targetElementId="tutorial-pr-btn"
                    message="변경사항을 코드 리뷰를 받기 위해 변경 요청을 만듭니다"
                    position="bottom"
                    show={true}
                />
            )}
        </div>
    )
}