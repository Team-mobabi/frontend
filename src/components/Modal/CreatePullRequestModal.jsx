import React, { useState, useEffect } from 'react'
import { useGit } from '../../features/GitCore/GitContext.jsx'
import { api } from '../../features/API.js'

export default function CreatePullRequestModal({ open, onClose, onCreated }) {
    const { state } = useGit()
    const { selectedRepoId } = state

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('') // [수정] 'body' -> 'description'
    const [sourceBranch, setSourceBranch] = useState('')
    const [targetBranch, setTargetBranch] = useState('main')
    const [branches, setBranches] = useState([])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (open && selectedRepoId) {
            api.가지.목록(selectedRepoId)
                .then(list => {
                    const branchNames = (list.branches || list || []).map(b => b.name || b);
                    setBranches(branchNames);
                    setSourceBranch(branchNames.find(b => b !== 'main') || '');
                })
                .catch(e => setError('가지 목록을 불러올 수 없습니다.'));
        } else {
            setTitle('')
            setDescription('')
            setError('')
            setBusy(false)
        }
    }, [open, selectedRepoId])

    const handleSubmit = async () => {
        const finalTitle = title.trim() || "변경 요청";
        const finalSourceBranch = sourceBranch || "main";
        const finalTargetBranch = targetBranch || "main";
        setBusy(true);
        setError('');
        try {
            await api.변경요청.생성(selectedRepoId, {
                title: finalTitle,
                description: description.trim(), // [수정] 'body' -> 'description'
                sourceBranch: finalSourceBranch,
                targetBranch: finalTargetBranch
            });
            onCreated();
        } catch (e) {
            setError(e.data?.message || e.message || '변경 요청 생성에 실패했습니다.');
        } finally {
            setBusy(false);
        }
    }

    if (!open) return null

    const availableTargets = branches.filter(b => b !== sourceBranch);
    const availableSources = branches.filter(b => b !== targetBranch);

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                    <h4>새 변경 요청 생성</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body" style={{ display: 'grid', gap: '12px' }}>
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
                        rows="4"
                        value={description} // [수정] 'body' -> 'description'
                        onChange={e => setDescription(e.target.value)} // [수정] 'body' -> 'description'
                        style={{ resize: 'vertical' }}
                    />
                    {error && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{error}</div>}
                </div>
                <div className="modal-actions">
                    <button className="btn" onClick={onClose}>취소</button>
                    <button className="btn btn-primary" onClick={handleSubmit}>
                        {busy ? '생성 중...' : '변경 요청 생성'}
                    </button>
                </div>
            </div>
        </div>
    )
}