import Modal from './Modal';
import type { GraphCommit } from '../../types/api';

// 서버/그래프 버전에 따라 message 대신 msg, author 대신 committer로 올 수 있다
export type PushCommit = Partial<GraphCommit> & {
    msg?: string;
    committer?: string;
};

interface PushConfirmModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    branch: string;
    commits?: PushCommit[];
    isDiverged?: boolean;
}

export default function PushConfirmModal({ open, onClose, onConfirm, branch, commits = [], isDiverged = false }: PushConfirmModalProps) {
    const isForcePush = isDiverged && commits.length === 0;

    return (
        <Modal
            open={open}
            title={`'${branch}' 가지 올리기 확인`}
            onClose={onClose}
            footer={
                <>
                    <button className="btn" onClick={onClose}>취소</button>
                    <button className={`btn ${isForcePush ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
                        {isForcePush ? '강제 올리기 실행' : '올리기 실행'}
                    </button>
                </>
            }
        >
            {isForcePush ? (
                <>
                    <p style={{ color: 'var(--danger)', fontWeight: 'bold' }}>⚠️ 강제 올리기 작업</p>
                    <p>내 저장소가 서버보다 뒤처져 있습니다. 강제 올리기를 실행하면 서버의 저장이 삭제됩니다.</p>
                    <div className="push-list" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--danger)', borderRadius: '8px', marginBottom: '10px', padding: '15px', backgroundColor: 'rgba(220, 53, 69, 0.1)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--danger)' }}>
                            <strong>위험:</strong> 이 작업은 서버 저장소의 기록을 내 저장소 상태로 덮어씁니다.
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <p>다음 {commits.length}개의 저장을 서버 저장소로 올립니다:</p>
                    <div className="push-list" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', marginBottom: '10px' }}>
                        {commits.length === 0 ? (
                            <div className="empty">올릴 새 저장이 없습니다.</div>
                        ) : (
                            commits.map((commit, idx) => {
                                const hash = commit?.hash || commit?.shortHash || `commit-${idx}`;
                                const message = commit?.message || commit?.msg || "(메시지 없음)";
                                const author = commit?.author || commit?.committer || "알 수 없음";

                                return (
                                    <div key={hash} className="push-row">
                                        <div className="push-hash" title={hash}>{hash.substring(0, 7)}</div>
                                        <div className="push-msg">{message}</div>
                                        <div className="push-author">{author}</div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    {commits.length > 0 && <p style={{fontSize: '12px', color: 'var(--sub)'}}>서버 저장소의 '{branch}' 가지가 업데이트됩니다.</p>}
                </>
            )}
        </Modal>
    );
}
