import React from "react";
import StagedDiffView from "../../features/Diff/StagedDiffView";

export default function CommitConfirmModal({ open, onClose, onConfirm, message, onMessageChange }) {
    if (!open) return null;

    const isMessageEmpty = !message.trim();

    return (
        <div className="modal-backdrop">
            <div className="modal" style={{ width: "60vw", minWidth: 600, maxWidth: 900 }}>
                <div className="modal-head">
                    <h4>버전 저장 (커밋)</h4>
                    <button className="btn-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                        <label htmlFor="commitMessage" style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
                            커밋 메시지
                        </label>
                        <textarea
                            id="commitMessage"
                            className="input"
                            placeholder="변경 내용을 요약해주세요..."
                            value={message}
                            onChange={(e) => onMessageChange(e.target.value)}
                            rows={3}
                            style={{ width: "100%", resize: "vertical" }}
                        />
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
                            올릴 예정인 변경사항 (Staged)
                        </label>
                        <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #ddd", borderRadius: 4 }}>
                            <StagedDiffView />
                        </div>
                    </div>
                </div>
                <div className="modal-actions">
                    <button className="btn" onClick={onClose}>
                        취소
                    </button>
                    <button
                        className="btn btn-success"
                        onClick={onConfirm}
                        disabled={isMessageEmpty}
                    >
                        {isMessageEmpty ? "메시지를 입력하세요" : "커밋하기"}
                    </button>
                </div>
            </div>
        </div>
    );
}