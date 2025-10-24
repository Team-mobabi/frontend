import React, { useState } from 'react'
import { api } from '../../features/API' // [신규] api 임포트
import { useNavigate } from 'react-router-dom';

export default function UserSearchModal({ open, onClose }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // [신규] 모달 내부 검색 실행 함수
    const handleSearch = async (e) => {
        // Enter 키가 아니거나 검색어가 없으면 무시
        if (e && e.key !== 'Enter' && e.type !== 'click') return;
        if (!searchTerm.trim()) {
            setError('검색할 이메일을 입력하세요.');
            return;
        }

        setIsSearching(true);
        setError('');
        setSearchResults([]);
        try {
            const results = await api.users.search({ q: searchTerm.trim() });
            setSearchResults(results.users || results || []);
            if ((results.users || results || []).length === 0) {
                setError('검색 결과가 없습니다.');
            }
        } catch (err) {
            console.error("Search failed:", err);
            setError(err.message || '검색 중 오류가 발생했습니다.');
        } finally {
            setIsSearching(false);
        }
    };

    // [신규] 모달 닫을 때 상태 초기화
    const handleClose = () => {
        setSearchTerm('');
        setSearchResults([]);
        setIsSearching(false);
        setError('');
        onClose();
    }

    // [신규] 사용자 선택 시 처리 (지금은 콘솔 로그만)
    const handleSelectUser = (user) => {
        console.log("Selected user:", user);
        handleClose();
        navigate(`/users/${user.id}/public-repos`);
    };


    if (!open) return null

    return (
        <div className="modal-backdrop" onClick={handleClose}>
            {/* [수정]stopPropagation 추가 */}
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(450px, 90vw)', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-head">
                    <h4>사용자 검색 (이메일)</h4>
                    <button className="modal-close" onClick={handleClose}>×</button>
                </div>
                {/* [신규] 모달 내 검색 입력 영역 */}
                <div className="modal-search-input">
                    <input
                        type="email" // 이메일 형식 유도
                        className="input"
                        placeholder="검색할 사용자 이메일 입력 후 Enter"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleSearch}
                        disabled={isSearching}
                        autoFocus // 모달 열리면 바로 입력 가능하도록
                    />
                    {/* 로딩 스피너 */}
                    {isSearching && <div className="spinner" style={{width: '16px', height: '16px'}}></div>}
                </div>

                <div className="modal-body" style={{ overflowY: 'auto', flexGrow: 1, paddingTop: 0 }}>
                    {error && <div className="empty" style={{color: 'var(--danger)'}}>{error}</div>}

                    {!error && searchResults.length > 0 && (
                        <div className="user-search-list">
                            {searchResults.map(user => (
                                <div
                                    key={user.id}
                                    className="user-search-item"
                                    onClick={() => handleSelectUser(user)}
                                >
                                    <span className="user-email">{user.email}</span>
                                    {/* <span className="user-id">({user.id})</span> */}
                                </div>
                            ))}
                        </div>
                    )}
                    {/* 초기 상태 또는 검색 결과 없을 때 안내 (에러 없을 때만) */}
                    {!error && searchResults.length === 0 && !isSearching && (
                        <div className="empty">검색 결과가 여기에 표시됩니다.</div>
                    )}
                </div>
            </div>
        </div>
    )
}