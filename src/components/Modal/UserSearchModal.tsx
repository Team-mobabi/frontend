import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import { createLogger } from '../../lib/logger';
import { listOf } from '../../lib/normalize';
import type { User } from '../../types/api';
import Modal from './Modal';
import ErrorText from '../common/ErrorText';

const log = createLogger("UserSearchModal");

const MODAL_STYLE = { maxHeight: '70vh' } as const;
// 검색창은 고정하고 결과 목록만 스크롤되도록 본문 패딩을 직접 관리한다
const BODY_STYLE = { padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } as const;
const RESULTS_STYLE = { overflowY: 'auto', flexGrow: 1, padding: '0 16px 14px' } as const;

interface UserSearchModalProps {
    open: boolean;
    onClose: () => void;
}

export default function UserSearchModal({ open, onClose }: UserSearchModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSearch = async (e?: KeyboardEvent<HTMLInputElement> | MouseEvent) => {
        // Enter 키나 클릭이 아니면 무시
        if (e && "key" in e && e.key !== 'Enter') return;
        if (!searchTerm.trim()) {
            setError('검색할 이메일을 입력하세요.');
            return;
        }

        setIsSearching(true);
        setError('');
        setSearchResults([]);
        try {
            const results = await api.users.search({ q: searchTerm.trim() });
            const users = listOf<User>(results, ['users']);
            setSearchResults(users);
            if (users.length === 0) {
                setError('검색 결과가 없습니다.');
            }
        } catch (err) {
            log.error("Search failed", err);
            setError(errorMessage(err, '검색 중 오류가 발생했습니다.'));
        } finally {
            setIsSearching(false);
        }
    };

    const handleClose = () => {
        setSearchTerm('');
        setSearchResults([]);
        setIsSearching(false);
        setError('');
        onClose();
    };

    const handleSelectUser = (user: User) => {
        handleClose();
        navigate(`/users/${user.id}/public-repos`);
    };

    return (
        <Modal
            open={open}
            title="사용자 검색 (이메일)"
            onClose={handleClose}
            width="min(450px, 90vw)"
            style={MODAL_STYLE}
            bodyStyle={BODY_STYLE}
        >
            <div className="modal-search-input">
                <input
                    type="email"
                    className="input"
                    placeholder="검색할 사용자 이메일 입력 후 Enter"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearch}
                    autoFocus
                />
                {isSearching && <div className="spinner" style={{ width: '16px', height: '16px' }}></div>}
            </div>

            <div style={RESULTS_STYLE}>
                <ErrorText empty>{error}</ErrorText>

                {!error && searchResults.length > 0 && (
                    <div className="user-search-list">
                        {searchResults.map(user => (
                            <div
                                key={user.id}
                                className="user-search-item"
                                onClick={() => handleSelectUser(user)}
                            >
                                <span className="user-email">{user.email}</span>
                            </div>
                        ))}
                    </div>
                )}
                {/* 초기 상태 또는 검색 결과 없을 때 안내 (에러 없을 때만) */}
                {!error && searchResults.length === 0 && !isSearching && (
                    <div className="empty">검색 결과가 여기에 표시됩니다.</div>
                )}
            </div>
        </Modal>
    );
}
