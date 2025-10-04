import React, { useState } from 'react';

export default function CommitNode({ commit, position, isHead }) {
    const [open, setOpen] = useState(false);
    const style = { left: position.x, top: position.y };

    return (
        <>
            <div
                className={`commit-node ${isHead ? 'head' : ''}`}
                style={style}
                onClick={() => setOpen(v => !v)}
            >
                <span className="commit-hash">{commit.hash}</span>
                <span className="commit-message">{commit.message}</span>
            </div>
            {open && (
                <div
                    className="commit-pop"
                    style={{ left: position.x, top: position.y - 70 }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="pop-title">담은 파일</div>
                    {commit.files && commit.files.length ? (
                        <ul className="pop-list">
                            {commit.files.map(f => (
                                <li key={f}>{f}</li>
                            ))}
                        </ul>
                    ) : (
                        <div className="pop-empty">파일 없음</div>
                    )}
                </div>
            )}
        </>
    );
}
