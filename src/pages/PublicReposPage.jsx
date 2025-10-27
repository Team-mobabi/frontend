import React, {useState, useEffect} from 'react';
import {Link, useParams, useNavigate} from 'react-router-dom';
import Header from '../components/Header/Header'; // 경로 확인!
import {api} from '../features/API'; // 경로 확인!
import {useGit} from '../features/GitCore/GitContext'; // 경로 확인!

export default function PublicReposPage() {
    const {userId} = useParams();
    const navigate = useNavigate();
    const {dispatch} = useGit();

    const [repos, setRepos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [forkingId, setForkingId] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError('');
        const fetchRepos = userId
            ? api.repos.listUserPublic(userId)
            : api.repos.listPublic();

        fetchRepos
            .then(data => {
                setRepos(Array.isArray(data) ? data : (Array.isArray(data?.repositories) ? data.repositories : (Array.isArray(data?.items) ? data.items : [])));
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
            // [수정] API.js가 수정되었으므로 repoId만 전달
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
            <Header/>
            <div className="page-content">
                <h2>{userId ? `사용자 (${userId})의 공개 레포지토리` : '공개 레포지토리'}</h2>
                <p className="page-description">
                    다른 사용자들이 공개한 레포지토리를 둘러볼 수 있습니다.
                    <br/>
                    Fork 🍴 버튼을 누르면 해당 레포지토리를 내 계정으로 복제하여 자유롭게 수정하고 관리할 수 있습니다.

                </p>

                {loading && <div><span className="spinner"/> 목록 로딩 중...</div>}
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
                            // [수정] 소유자 정보 추출 (owner 객체가 있는지, 그 안에 email이 있는지 확인)
                            const ownerEmail = repo.owner?.email || '알 수 없음';
                            // [수정] 사용자 ID도 표시할 수 있도록 준비 (필요시 주석 해제)
                            // const ownerId = repo.owner?.id || repo.ownerId || '';

                            return (
                                <div key={repoDisplayId || repo.name} className="repo-item-public">
                                    <div className="repo-info">
                                        <h4 className="repo-name-public">
                                            {repo.name}
                                        </h4>
                                        <p className="repo-description">{repo.description || '설명 없음'}</p>
                                        {/* [수정] 소유자 이메일 표시 */}
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