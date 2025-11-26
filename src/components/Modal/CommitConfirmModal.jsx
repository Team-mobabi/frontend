import React, { useRef, useEffect, useMemo } from "react";
import StagedDiffView from "../../features/Diff/StagedDiffView";

const CommitConfirmModal = React.memo(function CommitConfirmModal({ open, onClose, onConfirm, message, onMessageChange }) {
    // 모달이 열릴 때만 새로운 key 생성 (안정적인 key 유지)
    const stagedDiffKeyRef = useRef(0);
    
    useEffect(() => {
        if (open) {
            stagedDiffKeyRef.current += 1;
        }
    }, [open]);
    
    // isMessageEmpty를 메모이제이션하여 불필요한 재계산 방지
    const isMessageEmpty = useMemo(() => !message.trim(), [message]);
    
    // StagedDiffView를 메모이제이션하여 message 변경 시 리렌더링 방지
    // open이 변경될 때만 새로운 인스턴스 생성
    const stagedDiffView = useMemo(() => {
        if (!open) return null;
        return <StagedDiffView key={`staged-diff-${stagedDiffKeyRef.current}`} />;
    }, [open]);
    
    if (!open) return null;

    return (
        <div className="modal-backdrop">
            <div className="modal" style={{ width: "60vw", minWidth: 600, maxWidth: 900 }}>
                <div className="modal-head">
                    <h4>현재 상태 저장 (커밋)</h4>
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
                            {stagedDiffView}
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
                        {isMessageEmpty ? "메시지를 입력하세요" : "현재 상태 저장"}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default CommitConfirmModal;