import { useState, useEffect, useCallback } from 'react';
import { api, errorMessage } from '../../lib/api';
import { useGit } from '../../features/GitCore/GitContext';
import { repoIdOf } from '../../features/GitCore/gitUtils';
import { listOf } from '../../lib/normalize';
import type { Collaborator, CollaboratorRole, Id, User } from '../../types/api';
import Modal from './Modal';
import CopyableId from '../common/CopyableId';
import ErrorText from '../common/ErrorText';

// 서버 버전에 따라 userId 대신 id로 오거나 { collaborators } 로 감싸져 올 수 있다
type CollaboratorRow = Collaborator & { id?: Id };

interface CollaboratorModalProps {
    open: boolean;
    onClose: () => void;
}

export default function CollaboratorModal({ open, onClose }: CollaboratorModalProps) {
    const { state } = useGit();
    const repoId = state.collaboratorModal?.repoId || state.selectedRepoId;
    const repositories = state.repositories || [];
    const repoInfo = repositories.find((repo) => repoIdOf(repo) === String(repoId));
    const repoName = repoInfo?.name || (repoId ? `ID ${repoId}` : "선택된 저장소 없음");

    const [collaborators, setCollaborators] = useState<CollaboratorRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<CollaboratorRole>('read');
    const [isAdding, setIsAdding] = useState(false);

    const fetchCollaborators = useCallback(async () => {
        if (!repoId) return;
        setLoading(true);
        setError('');
        try {
            const data = await api.collaborators.list(repoId);
            setCollaborators(listOf<CollaboratorRow>(data, ['collaborators']));
        } catch (err) {
            setError(errorMessage(err, '목록을 불러오는 데 실패했습니다.'));
        } finally {
            setLoading(false);
        }
    }, [repoId]);

    // 모달이 열릴 때 목록을 불러오고, 닫힐 때 상태 초기화
    useEffect(() => {
        if (open && repoId) {
            fetchCollaborators();
        } else {
            setCollaborators([]);
            setError('');
            setNewEmail('');
            setNewRole('read');
        }
    }, [open, repoId, fetchCollaborators]);

    // 이메일로 사용자 ID를 찾은 뒤 협업자로 추가
    const handleAdd = async () => {
        if (!repoId) return;
        const emailToSearch = newEmail.trim();
        setIsAdding(true);
        setError('');

        try {
            const searchResults = await api.users.search({ q: emailToSearch });
            const users = listOf<User>(searchResults, ['users']);

            if (users.length === 0) {
                setError(`'${emailToSearch}' 이메일을 가진 사용자를 찾을 수 없습니다.`);
                setIsAdding(false);
                return;
            }

            await api.collaborators.add(repoId, { userId: users[0].id, role: newRole });

            setNewEmail('');
            setNewRole('read');
            fetchCollaborators();
        } catch (err) {
            setError(errorMessage(err, '추가에 실패했습니다. (이미 협업자이거나 권한이 없을 수 있습니다)'));
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemove = async (user: CollaboratorRow) => {
        if (!repoId) {
            setError('협업자를 관리할 저장소가 없습니다.');
            return;
        }

        // API 응답에 따라 userId 또는 id 사용
        const userIdToRemove = user.userId || user.id || '';
        if (!window.confirm(`'${user.email}' 님을 협업자에서 제거하시겠습니까?`)) {
            return;
        }
        setError('');
        try {
            await api.collaborators.remove(repoId, userIdToRemove);
            fetchCollaborators();
        } catch (err) {
            setError(errorMessage(err, '제거에 실패했습니다.'));
        }
    };

    return (
        <Modal open={open} title="협업자 관리" onClose={onClose} width="min(500px, 90vw)">
            <div className="panel-sub" style={{ marginTop: 0, marginBottom: 16 }}>
                <div style={{ fontWeight: 600 }}>{repoName}</div>
                {repoId ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                        저장소 ID: <CopyableId value={repoId} copyLabel="저장소 ID" />
                    </div>
                ) : (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                        협업자를 관리할 저장소가 선택되지 않았습니다.
                    </div>
                )}
            </div>

            <h5 style={{ marginTop: 0, marginBottom: 8 }}>새 협업자 추가</h5>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <input
                    type="email"
                    className="input"
                    style={{ flexGrow: 1 }}
                    placeholder="초대할 사용자 이메일"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                />
                <select
                    className="input"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    style={{ flexBasis: '120px' }}
                >
                    <option value="read">읽기 (Read)</option>
                    <option value="write">쓰기 (Write)</option>
                    <option value="admin">관리자 (Admin)</option>
                </select>
                <button className="btn btn-primary" onClick={handleAdd}>
                    {isAdding ? <span className="spinner" style={{ width: 16, height: 16 }}></span> : '추가'}
                </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '20px 0' }} />

            <h5 style={{ marginTop: 0, marginBottom: 12 }}>현재 협업자 ({collaborators.length})</h5>
            {loading && <div><span className="spinner" /> 목록 로딩 중...</div>}
            <ErrorText empty>{error}</ErrorText>

            {!loading && collaborators.length === 0 && !error && (
                <div className="empty">현재 협업자가 없습니다.</div>
            )}

            {!loading && collaborators.length > 0 && (
                <div className="collaborator-list">
                    {collaborators.map(user => (
                        <div key={user.userId || user.id} className="collaborator-item">
                            <div className="collaborator-info">
                                {/* 서버 버전에 따라 email이 user.user.email 에만 있을 수 있다 */}
                                <strong className="collaborator-email">{user.email || user.user?.email || '이메일 없음'}</strong>
                                <span className="collaborator-role">{user.role || 'Unknown'}</span>
                            </div>
                            <button
                                className="btn btn-sm btn-danger-outline"
                                onClick={() => handleRemove(user)}
                            >
                                제거
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
}
