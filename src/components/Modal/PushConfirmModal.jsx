import React from 'react';

// 간단한 시간 포맷 함수 (필요시 라이브러리 사용)
function formatTimeAgo(dateString) {
    // ... (시간 표시 로직 구현) ...
    return dateString; // 임시
}

export default function PushConfirmModal({ open, onClose, onConfirm, branch, commits = [], isDiverged = false }) {
    if (!open) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-head">
                    <h4>'{branch}' 브랜치 Push 확인</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    {isDiverged && commits.length === 0 ? (
                        <>
                            <p style={{ color: 'var(--danger)', fontWeight: 'bold' }}>⚠️ Force Push 작업</p>
                            <p>로컬 저장소가 원격보다 뒤처져 있습니다. Force Push를 실행하면 원격의 커밋이 삭제됩니다.</p>
                            <div className="push-list" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--danger)', borderRadius: '8px', marginBottom: '10px', padding: '15px', backgroundColor: 'rgba(220, 53, 69, 0.1)' }}>
                                <div style={{ fontSize: '13px', color: 'var(--danger)' }}>
                                    <strong>위험:</strong> 이 작업은 원격 저장소의 히스토리를 로컬 상태로 덮어씁니다.
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <p>다음 {commits.length}개의 커밋을 원격 저장소로 Push합니다:</p>
                            <div className="push-list" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', marginBottom: '10px' }}>
                                {commits.length === 0 ? (
                                    <div className="empty">Push할 새 커밋이 없습니다.</div>
                                ) : (
                                    commits.map(commit => (
                                        <div key={commit.hash} className="push-row">
                                            <div className="push-hash" title={commit.hash}>{commit.hash.substring(0, 7)}</div>
                                            <div className="push-msg">{commit.message}</div>
                                            <div className="push-author">{commit.author}</div>
                                            {/* <div className="push-time">{formatTimeAgo(commit.committedAt)}</div> */}
                                        </div>
                                    ))
                                )}
                            </div>
                            {commits.length > 0 && <p style={{fontSize: '12px', color: 'var(--sub)'}}>원격 저장소의 '{branch}' 브랜치가 업데이트됩니다.</p>}
                        </>
                    )}
                </div>
                <div className="modal-actions">
                    <button className="btn" onClick={onClose}>취소</button>
                    <button
                        className={`btn ${isDiverged && commits.length === 0 ? 'btn-danger' : 'btn-primary'}`}
                        onClick={onConfirm}
                        disabled={commits.length === 0 && !isDiverged}
                    >
                        {isDiverged && commits.length === 0 ? 'Force Push 실행' : 'Push 실행'}
                    </button>
                </div>
            </div>
        </div>
    );
}