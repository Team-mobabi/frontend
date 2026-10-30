import { useState, useEffect } from 'react'
import { useGit } from '../../features/GitCore/GitContext'
import { api, errorMessage } from '../../lib/api'
import { branchNamesOf } from '../../lib/normalize'
import Modal from './Modal'
import ErrorText from '../common/ErrorText'

interface CreatePullRequestModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
}

export default function CreatePullRequestModal({ open, onClose, onCreated }: CreatePullRequestModalProps) {
    const { state } = useGit()
    const { selectedRepoId } = state

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [sourceBranch, setSourceBranch] = useState('')
    const [targetBranch, setTargetBranch] = useState('main')
    const [branches, setBranches] = useState<string[]>([])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (open && selectedRepoId) {
            api.branches.list(selectedRepoId)
                .then(list => {
                    const branchNames = branchNamesOf(list);
                    setBranches(branchNames);
                    setSourceBranch(branchNames.find(b => b !== 'main') || '');
                })
                .catch(() => setError('가지 목록을 불러올 수 없습니다.'));
        } else {
            setTitle('')
            setDescription('')
            setError('')
            setBusy(false)
        }
    }, [open, selectedRepoId])

    const handleSubmit = async () => {
        if (!selectedRepoId) return;
        const finalTitle = title.trim() || "변경 요청";
        const finalSourceBranch = sourceBranch || "main";
        const finalTargetBranch = targetBranch || "main";
        setBusy(true);
        setError('');
        try {
            await api.pullRequests.create(selectedRepoId, {
                title: finalTitle,
                description: description.trim(),
                sourceBranch: finalSourceBranch,
                targetBranch: finalTargetBranch
            });
            onCreated();
        } catch (e) {
            setError(errorMessage(e, '변경 요청 생성에 실패했습니다.'));
        } finally {
            setBusy(false);
        }
    }

    const availableTargets = branches.filter(b => b !== sourceBranch);
    const availableSources = branches.filter(b => b !== targetBranch);

    return (
        <Modal
            open={open}
            title="새 변경 요청 생성"
            onClose={onClose}
            bodyStyle={{ display: 'grid', gap: '12px' }}
            footer={
                <>
                    <button className="btn" onClick={onClose}>취소</button>
                    <button className="btn btn-primary" onClick={handleSubmit}>
                        {busy ? '생성 중...' : '변경 요청 생성'}
                    </button>
                </>
            }
        >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select className="select" style={{ flex: 1 }} value={sourceBranch} onChange={e => setSourceBranch(e.target.value)}>
                    <option value="">원본 가지 선택...</option>
                    {availableSources.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <span>→</span>
                <select className="select" style={{ flex: 1 }} value={targetBranch} onChange={e => setTargetBranch(e.target.value)}>
                    <option value="">대상 가지 선택...</option>
                    {availableTargets.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
            </div>
            <input
                className="input"
                placeholder="제목"
                value={title}
                onChange={e => setTitle(e.target.value)}
            />
            <textarea
                className="input"
                placeholder="설명 (선택 사항)"
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ resize: 'vertical' }}
            />
            <ErrorText style={{ marginTop: 4 }}>{error}</ErrorText>
        </Modal>
    )
}