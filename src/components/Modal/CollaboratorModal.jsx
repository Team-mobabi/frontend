import React, { useState, useEffect } from 'react';
import { api } from '../../features/API';
import { useGit } from '../../features/GitCore/GitContext';

// 모달 컴포넌트
export default function CollaboratorModal({ open, onClose }) {
    const { state } = useGit();
    const repoId = state.selectedRepoId;

    const [collaborators, setCollaborators] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [newEmail, setNewEmail] = useState(''); // '추가' 입력 필드
    const [newRole, setNewRole] = useState('read'); // [수정] 소문자 'read'가 기본값
    const [isAdding, setIsAdding] = useState(false); // '추가' 버튼 로딩

    // 모달이 열릴 때 협업자 목록을 불러옵니다.
    useEffect(() => {
        if (open && repoId) {
            fetchCollaborators();
        } else {
            // 닫힐 때 상태 초기화
            setCollaborators([]);
            setError('');
            setNewEmail('');
            setNewRole('read'); // [수정] 소문자 'read'로 초기화
        }
    }, [open, repoId]);

    // 협업자 목록 (GET)
    const fetchCollaborators = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api.collaborators.list(repoId);
            setCollaborators(data.collaborators || data || []);
        } catch (err) {
            setError(err.message || '목록을 불러오는 데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // [수정됨] 협업자 추가 (POST)
    const handleAdd = async () => {
        const emailToSearch = newEmail.trim();
        if (!emailToSearch) {
            setError('추가할 사용자의 이메일을 입력하세요.');
            return;
        }
        setIsAdding(true);
        setError('');

        try {
            // 1. 이메일로 사용자 ID 검색 (api.users.search 호출)
            const searchResults = await api.users.search({ q: emailToSearch });
            const users = searchResults.users || searchResults || [];

            if (users.length === 0) {
                setError(`'${emailToSearch}' 이메일을 가진 사용자를 찾을 수 없습니다.`);
                setIsAdding(false);
                return;
            }

            const userId = users[0].id; // 찾은 사용자의 ID

            // 2. email 대신 찾은 userId로 협업자 추가
            const payload = {
                userId: userId, // [수정] email 대신 userId 전송
                role: newRole   // 'read', 'write', 'admin'
            };

            await api.collaborators.add(repoId, payload);

            setNewEmail('');       // 입력 필드 비우기
            setNewRole('read');    // 권한 선택 초기화
            fetchCollaborators(); // 목록 새로고침
        } catch (err) {
            setError(err.message || '추가에 실패했습니다. (이미 협업자이거나 권한이 없을 수 있습니다)');
        } finally {
            setIsAdding(false);
        }
    };

    // 협업자 제거 (DELETE)
    const handleRemove = async (user) => {
        const userIdToRemove = user.userId || user.id; // API 응답에 따라 userId 또는 id 사용
        if (!window.confirm(`'${user.email}' 님을 협업자에서 제거하시겠습니까?`)) {
            return;
        }
        setError('');
        try {
            await api.collaborators.remove(repoId, userIdToRemove);
            fetchCollaborators(); // 목록 새로고침
        } catch (err) {
            setError(err.message || '제거에 실패했습니다.');
        }
    };

    if (!open) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(500px, 90vw)' }}>
                <div className="modal-head">
                    <h4>협업자 관리</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {/* --- 1. 협업자 추가 섹션 --- */}
                    <h5 style={{ marginTop: 0, marginBottom: 8 }}>새 협업자 추가</h5>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                        <input
                            type="email"
                            className="input"
                            style={{ flexGrow: 1 }}
                            placeholder="초대할 사용자 이메일"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            disabled={isAdding}
                        />
                        {/* [수정] 권한 선택 (소문자 value) */}
                        <select
                            className="input"
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            disabled={isAdding}
                            style={{ flexBasis: '120px' }}
                        >
                            <option value="read">읽기 (Read)</option>
                            <option value="write">쓰기 (Write)</option>
                            <option value="admin">관리자 (Admin)</option>
                        </select>
                        <button className="btn btn-primary" onClick={handleAdd} disabled={isAdding}>
                            {isAdding ? <span className="spinner" style={{width: 16, height: 16}}></span> : '추가'}
                        </button>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '20px 0' }} />

                    {/* --- 2. 현재 협업자 목록 --- */}
                    <h5 style={{ marginTop: 0, marginBottom: 12 }}>현재 협업자 ({collaborators.length})</h5>
                    {loading && <div><span className="spinner" /> 목록 로딩 중...</div>}
                    {error && <div className="empty" style={{ color: 'var(--danger)' }}>{error}</div>}

                    {!loading && collaborators.length === 0 && !error && (
                        <div className="empty">현재 협업자가 없습니다.</div>
                    )}

                    {!loading && collaborators.length > 0 && (
                        <div className="collaborator-list">
                            {/* [수정] key와 handleRemove에 사용되는 id를 user.id 또는 user.userId로 수정 */}
                            {collaborators.map(user => (
                                <div key={user.userId || user.id} className="collaborator-item">
                                    <div className="collaborator-info">
                                        {/* [수정] user 객체 안에 user.email이 없을 수 있으므로 user.user.email도 확인 */}
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
                </div>
            </div>
        </div>
    );
}