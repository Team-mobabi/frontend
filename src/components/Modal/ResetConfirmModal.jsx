import React from "react";
import "./ResetConfirmModal.css";

export default function ResetConfirmModal({ open, onClose, onConfirm, commitHash, commitMessage }) {
    if (!open) return null;

    const handleResetClick = (mode) => {
        const warnings = {
            soft: {
                title: "Soft Reset",
                message: `현재 브랜치를 이 커밋(${commitHash.slice(0, 7)})으로 되돌리시겠습니까?\n\n` +
                         `✅ 커밋 기록만 취소됩니다\n` +
                         `✅ 변경된 파일은 "담긴 상태(Staged)"로 유지됩니다\n` +
                         `✅ 파일 내용은 그대로 남아있습니다\n\n` +
                         `💡 커밋 메시지를 수정하거나 다시 커밋할 때 유용합니다.`
            },
            hard: {
                title: "Hard Reset",
                message: `⚠️ 경고: 현재 브랜치를 이 커밋(${commitHash.slice(0, 7)})으로 되돌리시겠습니까?\n\n` +
                         `❌ 커밋 기록이 취소됩니다\n` +
                         `❌ 변경된 파일도 모두 삭제됩니다\n` +
                         `❌ 작업 디렉토리가 해당 커밋 시점으로 완전히 되돌아갑니다\n\n` +
                         `🚨 이 작업은 되돌릴 수 없습니다!`
            }
        };

        if (window.confirm(warnings[mode].message)) {
            onConfirm(mode);
        }
    };

    const modeDescriptions = {
        soft: {
            title: "Soft Reset",
            description: "커밋만 취소하고 파일은 Staged 상태로 유지",
            icon: "📝",
            details: [
                "커밋 기록만 되돌림",
                "파일은 '담긴 상태(Staged)'로 유지",
                "파일 내용은 그대로 유지",
                "커밋 메시지 수정 시 유용"
            ]
        },
        hard: {
            title: "Hard Reset",
            description: "커밋과 파일을 모두 삭제 (되돌릴 수 없음)",
            icon: "⚠️",
            details: [
                "커밋 기록 완전히 삭제",
                "변경된 파일도 모두 삭제",
                "작업 디렉토리를 해당 커밋으로 완전히 되돌림",
                "🚨 복구 불가능 - 신중히 선택하세요"
            ],
            danger: true
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal reset-modal">
                <div className="modal-head">
                    <h4>커밋 되돌리기 (Reset)</h4>
                    <button className="btn-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <div className="reset-commit-info">
                        <div className="commit-hash">
                            <strong>커밋:</strong> <code>{commitHash.slice(0, 7)}</code>
                        </div>
                        <div className="commit-message">
                            <strong>메시지:</strong> {commitMessage}
                        </div>
                    </div>

                    <div className="reset-mode-selector">
                        <p className="reset-instruction">되돌리기 방식을 선택하세요:</p>

                        <div className="reset-buttons">
                            {Object.entries(modeDescriptions).map(([mode, info]) => (
                                <div
                                    key={mode}
                                    className={`reset-option ${info.danger ? 'danger' : ''}`}
                                >
                                    <button
                                        className={`btn reset-btn ${info.danger ? 'btn-danger' : 'btn-primary'}`}
                                        onClick={() => handleResetClick(mode)}
                                    >
                                        <span className="reset-icon">{info.icon}</span>
                                        <span className="reset-title">{info.title}</span>
                                    </button>
                                    <p className="reset-description">{info.description}</p>

                                    <div className="reset-details">
                                        <ul>
                                            {info.details.map((detail, idx) => (
                                                <li key={idx}>{detail}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="modal-actions">
                    <button className="btn" onClick={onClose}>
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
}