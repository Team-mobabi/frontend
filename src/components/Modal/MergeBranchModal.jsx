import React from "react";

export default function MergeBranchModal({ open, onClose, sourceBranch, targetOptions, onConfirm }) {
    if (!open) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-head">
                    <h4>가지 합치기</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <p className="panel-sub" style={{ margin: 0, marginBottom: '16px' }}>
                        <b>'{sourceBranch}'</b> 가지를 어떤 가지로 합칠까요?
                    </p>
                    {targetOptions.length > 0 ? (
                        <div className="repo-list">
                            {targetOptions.map(branchName => (
                                <div
                                    key={branchName}
                                    className="repo-item"
                                    onClick={() => onConfirm(branchName)}
                                    title={`'${sourceBranch}' → '${branchName}' 합치기`}
                                >
                                    <div className="repo-dot" />
                                    <div className="repo-name"><b>{branchName}</b>로 합치기</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty">합칠 수 있는 다른 가지가 없습니다.</div>
                    )}
                </div>
            </div>
        </div>
    );
}