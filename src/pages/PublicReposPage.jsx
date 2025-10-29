import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header/Header';
import { api } from '../features/API';
import { useGit } from '../features/GitCore/GitContext';

export default function PublicReposPage() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { dispatch } = useGit();

    const [repos, setRepos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [forkingId, setForkingId] = useState(null);
    const [ownerEmail, setOwnerEmail] = useState(''); // [신규] 소유자 이메일 상태

    useEffect(() => {
        setLoading(true);
        setError('');
        setOwnerEmail(''); // [신규] 이메일 초기화

        const fetchRepos = userId
            ? api.repos.listUserPublic(userId)
            : api.repos.listPublic();

        fetchRepos
            .then(data => {
                const repoList = Array.isArray(data) ? data : (Array.isArray(data?.repositories) ? data.repositories : (Array.isArray(data?.items) ? data.items : []));
                setRepos(repoList);

                // [신규] 목록을 받은 후, 첫 번째 레포에서 소유자 이메일을 추출
                if (userId && repoList.length > 0) {
                    const firstRepo = repoList[0];
                    if (firstRepo.owner && firstRepo.owner.email) {
                        setOwnerEmail(firstRepo.owner.email);
                    }
                }
            })
            .catch(err => {
                setError(err.message || '레포지토리 목록을 불러오는 데 실패했습니다.');
            })
            .finally(() => {
                setLoading(false);
            });
    }, [userId]);

    const handleFork = async (repoToFork) => {
        console.log("Attempting to fork:", repoToFork);
        const repoId = repoToFork?.id || repoToFork?._id || repoToFork?.repoId;
        if (!repoId) {
            setError('포크할 레포지토리 ID를 찾을 수 없습니다.');
            return;
        }

        setForkingId(repoId);
        setError('');
        try {
            const forkedRepo = await api.repos.fork(repoId);
            alert(`'${repoToFork.name}' 레포지토리를 성공적으로 포크했습니다!`);
            navigate('/app');
        } catch (err) {
            const specificError = err.data?.message || err.message;
            console.error("Fork failed:", err);
            setError(`포크 실패: ${specificError}`);
            setForkingId(null);
        }
    };

    return (
        <div className="public-repos-page">
            <Header />
            <div className="page-content">
                {/* [수정됨] userId 대신 ownerEmail을 표시 (없으면 userId를 폴백으로 사용) */}
                <h2>{userId ? `${ownerEmail || userId}의 공개 레포지토리` : '공개 레포지토리'}</h2>
                <p className="page-description">
                    다른 사용자들이 공개한 레포지토리를 둘러볼 수 있습니다.
                    <br />
                    Fork 🍴 버튼을 누르면 해당 레포지토리를 내 계정으로 복제하여 자유롭게 수정하고 관리할 수 있습니다.
                </p>

                {loading && <div><span className="spinner" /> 목록 로딩 중...</div>}
                {error && <div style={{
                    color: 'var(--danger)',
                    marginBottom: '16px',
                    padding: '10px',
                    border: '1px solid var(--danger)',
                    borderRadius: '8px',
                    background: 'var(--danger-light)'
                }}>{error}</div>}

                {!loading && (
                    <div className="repo-list-public">
                        {repos.length === 0 && !error && (
                            <div className="empty">공개된 레포지토리가 없습니다.</div>
                        )}
                        {repos.map(repo => {
                            const repoDisplayId = repo?.id || repo?._id || repo?.repoId;
                            const ownerEmail = repo.owner?.email || '알 수 없음';
                            // const ownerId = repo.owner?.id || repo.ownerId || '';

                            return (
                                <div key={repoDisplayId || repo.name} className="repo-item-public">
                                    <div className="repo-info">
                                        <h4 className="repo-name-public">
                                            {repo.name}
                                        </h4>
                                        <p className="repo-description">{repo.description || '설명 없음'}</p>
                                        <span className="repo-owner">
                                            소유자: {ownerEmail}
                                            {/* {ownerId && ` (${ownerId.substring(0, 8)}...)`} */}
                                        </span>
                                    </div>
                                    <div className="repo-actions">
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleFork(repo)}
                                            disabled={forkingId === repoDisplayId}
                                        >
                                            {forkingId === repoDisplayId ? '포크 중...' : 'Fork 🍴'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}