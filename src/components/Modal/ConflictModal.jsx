import React, { useState, useEffect } from 'react'
import { useGit } from '../../features/GitCore/GitContext.jsx'
import { api } from '../../features/API.js'

export default function ConflictModal() {
    const { state, dispatch } = useGit()
    // [수정] state.conflictInfo가 없을 경우 대비
    const open = state.conflictInfo?.open || false
    const repoId = state.selectedRepoId

    const [status, setStatus] = useState('loadingList') // loadingList, fileSelection, loadingSuggestion, suggestionReady, resolving, aborting, done, error
    const [error, setError] = useState('')
    const [conflicts, setConflicts] = useState([])
    const [selectedFile, setSelectedFile] = useState(null)
    const [suggestion, setSuggestion] = useState(null)

    useEffect(() => {
        if (open && repoId) {
            fetchConflictList()
        } else {
            // 모달이 닫히거나 repoId가 없으면 상태 초기화
            setStatus('loadingList'); setError(''); setConflicts([]); setSuggestion(null); setSelectedFile(null);
        }
    }, [open, repoId])

    const fetchConflictList = async () => {
        try {
            setStatus('loadingList'); setError('');
            const conflictData = await api.repos.conflicts(repoId);
            // [수정] conflictData.conflicts가 배열인지 확인
            const conflictFiles = Array.isArray(conflictData?.conflicts) ? conflictData.conflicts : [];
            setConflicts(conflictFiles);
            if (conflictFiles.length > 0) {
                setStatus('fileSelection');
            } else {
                // 충돌 파일이 없으면 성공적으로 해결된 것으로 간주하고 모달 닫기
                setError(''); // 에러 메시지 초기화
                dispatch({ type: 'CLOSE_CONFLICT_modal' });
                // 선택사항: 토스트 메시지 표시
                // dispatch({ type: 'SHOW_TOAST', payload: '모든 충돌이 해결되었습니다!' });
            }
        } catch (e) {
            setError(e.message || '충돌 정보를 가져오는 데 실패했습니다.');
            setStatus('error');
        }
    }

    const handleFileSelect = async (filePath) => {
        setSelectedFile(filePath); setSuggestion(null); setStatus('loadingSuggestion'); setError('');
        try {
            const aiData = await api.repos.aiSuggest(repoId, filePath);
            setSuggestion(aiData);
            setStatus('suggestionReady');
        } catch (e) {
            setError(`'${filePath}' 파일 분석 중 오류: ${e.message}`);
            setStatus('fileSelection');
        }
    }

    const handleResolve = async () => {
        if (!suggestion || !selectedFile) return;
        setStatus('resolving'); setError('');
        try {
            await api.repos.resolve(repoId, {
                filePath: selectedFile, resolution: 'manual', manualContent: suggestion.suggestion,
            });
            // [수정] status를 done으로 바꾸지 않고, fetchConflictList가 알아서 처리하도록 함
            dispatch({ type: 'GRAPH_DIRTY' });
            setSelectedFile(null); // 해결 후 선택 해제
            setSuggestion(null); // 해결 후 제안 내용 지우기
            fetchConflictList(); // 남은 충돌 확인
        } catch (e) {
            setError(e.message || '충돌 해결에 실패했습니다.');
            setStatus('suggestionReady');
        }
    }

    const handleAbortMerge = async () => {
        if (!window.confirm('병합 작업을 중단하고 이전 상태로 되돌리시겠습니까?')) return;
        setStatus('aborting'); setError('');
        try {
            await api.repos.abortMerge(repoId);
            dispatch({ type: 'GRAPH_DIRTY' });
            dispatch({ type: 'CLOSE_CONFLICT_MODAL' });
        } catch (e) {
            setError(e.message || '병합 중단에 실패했습니다.');
            // [수정] 실패 시 에러 상태로 변경
            setStatus('error');
        }
    }

    const handleClose = () => {
        if (status !== 'resolving' && status !== 'aborting') {
            dispatch({ type: 'CLOSE_CONFLICT_MODAL' });
        }
    }

    if (!open) return null

    return (
        <div className="modal-backdrop" onClick={handleClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 92vw)'}}>
                <div className="modal-head">
                    <h4>🚨 병합 충돌 발생! (AI 해결사)</h4>
                    <button className="modal-close" onClick={handleClose}>×</button>
                </div>

                <div className="modal-body">
                    {/* [수정] 주석을 실제 UI로 복원 */}
                    {status === 'loadingList' && (
                        <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            <div className="spinner" /> 충돌 파일 목록을 불러오는 중...
                        </div>
                    )}
                    {/* [수정] 주석을 실제 UI로 복원 */}
                    {status === 'error' && (
                        <div style={{ color: "var(--danger)", minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{error}</div>
                    )}
                    {(status !== 'loadingList' && status !== 'error') && (
                        <div className="conflict-solver-layout">
                            <div className="conflict-file-list">
                                <h5 className="conflict-title">충돌 파일 ({conflicts.length})</h5>
                                {conflicts.map(file => (
                                    <button
                                        key={file}
                                        className={`conflict-file-item ${file === selectedFile ? 'active' : ''}`}
                                        onClick={() => handleFileSelect(file)}
                                        disabled={status === 'loadingSuggestion' || status === 'resolving' || status === 'aborting'}
                                    >
                                        {file}
                                    </button>
                                ))}
                            </div>
                            <div className="ai-suggestion-area">
                                <h5 className="conflict-title">AI 해결 제안</h5>
                                {/* [수정] 주석을 실제 UI로 복원 */}
                                {status === 'fileSelection' && (
                                    <div className="empty" style={{padding: '40px 0'}}>
                                        왼쪽 목록에서 파일을 선택하면<br/> AI가 해결책을 제안합니다.
                                    </div>
                                )}
                                {/* [수정] 주석을 실제 UI로 복원 */}
                                {status === 'loadingSuggestion' && (
                                    <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                        <div className="spinner" /> <strong>{selectedFile}</strong> 분석 중...
                                    </div>
                                )}
                                {/* [수정] 주석을 실제 UI로 복원 */}
                                {status === 'suggestionReady' && suggestion && (
                                    <div className="ai-chat-bubble">
                                        <p><strong>🤖 AI (신뢰도: {Math.round((suggestion.confidence || 0) * 100)}%)</strong></p>
                                        <p>{suggestion.explanation || "설명이 없습니다."}</p>
                                    </div>
                                )}
                                {suggestion && (
                                    <pre className="pr-diff">
                                        <code>{suggestion.suggestion || "제안 내용이 없습니다."}</code>
                                    </pre>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-actions">
                    <button
                        className="btn"
                        onClick={handleAbortMerge}
                        disabled={status === 'resolving' || status === 'aborting'}
                        style={{ marginRight: 'auto' }}
                    >
                        {status === 'aborting' ? '중단 중...' : '병합 중단'}
                    </button>

                    <button className="btn" onClick={handleClose}>나중에 해결</button>
                    <button
                        className="btn btn-success"
                        onClick={handleResolve}
                        // [수정] suggestionReady 상태일 때만 활성화
                        disabled={status !== 'suggestionReady' || status === 'resolving' || status === 'aborting'}
                    >
                        {status === 'resolving' ? '적용 중...' : '이 제안 적용하기'}
                    </button>
                </div>
            </div>
        </div>
    )
}