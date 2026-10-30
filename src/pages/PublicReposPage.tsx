import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header/Header';
import { api, errorMessage } from '../lib/api';
import { createLogger } from '../lib/logger';
import { repoIdOf } from '../features/GitCore/gitUtils';
import { listOf } from '../lib/normalize';
import { useToast } from '../components/Toast/ToastProvider';
import type { Repo } from '../types/api';

const log = createLogger("PublicReposPage");

export default function PublicReposPage() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [repos, setRepos] = useState<Repo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [forkingId, setForkingId] = useState<string | null>(null);
    const [ownerEmail, setOwnerEmail] = useState('');

    useEffect(() => {
        setLoading(true);
        setError('');
        setOwnerEmail('');

        const fetchRepos = userId
            ? api.repos.listPublicByUser(userId)
            : api.repos.listPublic();

        fetchRepos
            .then(data => {
                // 서버 버전에 따라 목록이 repositories / items 등으로 감싸져 올 수 있다
                const repoList = listOf<Repo>(data, ["repositories", "items", "repos", "data"]);

                // 공개 저장소 목록 API가 이미 공개된 저장소만 반환하므로 ID가 있는 저장소만 남긴다
                const validRepos = repoList.filter(repo => !!repoIdOf(repo));

                setRepos(validRepos);

                // 목록을 받은 후, 첫 번째 저장소에서 소유자 이메일을 추출
                if (userId && validRepos.length > 0) {
                    const firstRepo = validRepos[0];
                    if (firstRepo.owner?.email) {
                        setOwnerEmail(firstRepo.owner.email);
                    }
                }
            })
            .catch((err: unknown) => {
                setError(errorMessage(err, '저장소 목록을 불러오는 데 실패했습니다.'));
            })
            .finally(() => {
                setLoading(false);
            });
    }, [userId]);

    const handleFork = async (repoToFork: Repo) => {
        const repoId = repoIdOf(repoToFork);
        if (!repoId) {
            setError('가져올 저장소 ID를 찾을 수 없습니다.');
            return;
        }

        setForkingId(repoId);
        setError('');
        try {
            await api.repos.fork(repoId);
            toast.show(`'${repoToFork.name}' 저장소를 성공적으로 내 저장소로 가져왔습니다!`, "success");
            navigate('/app');
        } catch (err) {
            log.error("Fork failed", err);
            setError(`가져오기 실패: ${errorMessage(err)}`);
            setForkingId(null);
        }
    };

    return (
        <div className="public-repos-page">
            <Header />
            <div className="page-content">
                {/* 소유자 이메일을 표시하고, 없으면 userId로 대체 */}
                <h2>{userId ? `${ownerEmail || userId}의 공개 저장소` : '공개 저장소'}</h2>
                <p className="page-description">
                    다른 사용자들이 공개한 저장소를 둘러볼 수 있습니다.
                    <br />
                    내 저장소로 가져오기 버튼을 누르면 해당 저장소를 내 계정으로 복제하여 자유롭게 수정하고 관리할 수 있습니다.
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
                            <div className="empty">공개된 저장소가 없습니다.</div>
                        )}
                        {repos.map(repo => {
                            const repoDisplayId = repoIdOf(repo);
                            const repoOwnerEmail = repo.owner?.email || '알 수 없음';

                            return (
                                <div key={repoDisplayId || repo.name} className="repo-item-public">
                                    <div className="repo-info">
                                        <h4 className="repo-name-public">
                                            {repo.name}
                                        </h4>
                                        <p className="repo-description">{repo.description || '설명 없음'}</p>
                                        <span className="repo-owner">
                                            소유자: {repoOwnerEmail}
                                        </span>
                                    </div>
                                    <div className="repo-actions">
                                        {repoDisplayId && (
                                            <Link
                                                className="btn btn-ghost"
                                                to={`/public-repos/${repoDisplayId}`}
                                                state={{ repo }}
                                            >
                                                자세히 보기
                                            </Link>
                                        )}
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleFork(repo)}
                                        >
                                            {forkingId === repoDisplayId ? '가져오는 중...' : '내 저장소로 가져오기'}
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