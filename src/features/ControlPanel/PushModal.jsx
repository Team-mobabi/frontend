import React, { useMemo, useState } from 'react';
import Modal from '../../components/Modal/Modal';

export default function PushModal({ open, onCancel, onConfirm, localRepo, remoteRepo }){
    const current = localRepo.currentBranch;
    const localList = localRepo.branches[current] || [];
    const remoteList = remoteRepo.branches[current] || [];
    const remoteSet = useMemo(()=>new Set(remoteList.map(c=>c.hash)), [remoteList]);

    const candidates = useMemo(
        ()=> localList.filter(c=>!remoteSet.has(c.hash)),
        [localList, remoteSet]
    );

    const [checked, setChecked] = useState(()=>new Set(candidates.map(c=>c.hash)));

    const toggle = (h) => {
        const n = new Set(checked);
        if (n.has(h)) n.delete(h); else n.add(h);
        setChecked(n);
    };

    const all = () => setChecked(new Set(candidates.map(c=>c.hash)));
    const none = () => setChecked(new Set());

    return (
        <Modal open={open} title="올릴 버전 고르기" onClose={onCancel}>
            <div className="push-list">
                {candidates.length === 0 && <div className="empty">올릴 버전이 없어요</div>}
                {candidates.map(c=>(
                    <label key={c.hash} className="push-row">
                        <input type="checkbox" checked={checked.has(c.hash)} onChange={()=>toggle(c.hash)} />
                        <span className="push-hash">{c.hash}</span>
                        <span className="push-msg">{c.message}</span>
                    </label>
                ))}
            </div>
            <div className="modal-actions">
                <button className="btn" onClick={none}>전체 해제</button>
                <button className="btn" onClick={all}>전체 선택</button>
                <div style={{flex:1}} />
                <button className="btn" onClick={onCancel}>취소</button>
                <button className="btn btn-primary" onClick={()=>onConfirm(Array.from(checked))} disabled={checked.size===0}>올리기</button>
            </div>
        </Modal>
    );
}
