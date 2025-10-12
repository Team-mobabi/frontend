import React from "react";

export default function MergeBranchModal({ open, onClose, sourceBranch, targetOptions, onConfirm }) {
    if (!open) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-head">
                    <h4>브랜치 병합</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <p className="panel-sub" style={{ margin: 0, marginBottom: '16px' }}>
                        <b>'{sourceBranch}'</b> 브랜치를 어떤 브랜치로 병합할까요?
                    </p>
                    {targetOptions.length > 0 ? (
                        <div className="repo-list">
                            {targetOptions.map(branchName => (
                                <div
                                    key={branchName}
                                    className="repo-item"
                                    onClick={() => onConfirm(branchName)}
                                    title={`'${sourceBranch}' → '${branchName}' 병합`}
                                >
                                    <div className="repo-dot" />
                                    <div className="repo-name">Merge into <b>{branchName}</b></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty">병합할 수 있는 다른 브랜치가 없습니다.</div>
                    )}
                </div>
            </div>
        </div>
    );
}