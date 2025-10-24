import React from 'react';

// 간단한 시간 포맷 함수 (필요시 라이브러리 사용)
function formatTimeAgo(dateString) {
    // ... (시간 표시 로직 구현) ...
    return dateString; // 임시
}

export default function PushConfirmModal({ open, onClose, onConfirm, branch, commits = [] }) {
    if (!open) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-head">
                    <h4>'{branch}' 브랜치 Push 확인</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
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
                </div>
                <div className="modal-actions">
                    <button className="btn" onClick={onClose}>취소</button>
                    <button className="btn btn-primary" onClick={onConfirm} disabled={commits.length === 0}>
                        Push 실행
                    </button>
                </div>
            </div>
        </div>
    );
}