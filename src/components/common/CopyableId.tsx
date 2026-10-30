import { useToast } from "../Toast/ToastProvider";
import { createLogger } from "../../lib/logger";

const log = createLogger("CopyableId");

const CHIP_STYLE = { fontSize: 12, padding: "2px 6px", background: "rgba(15,23,42,0.08)", borderRadius: 4 } as const;
const COPY_BUTTON_STYLE = { padding: "2px 8px", fontSize: 12 } as const;

interface CopyableIdProps {
    value: string | null | undefined;
    /** 지정하면 복사 버튼을 보여주고, 복사 결과를 "{label}를 복사했어요." 토스트로 알린다 */
    copyLabel?: string;
}

// 저장소 ID 등을 코드 칩으로 보여주고 클립보드 복사 버튼을 붙인다
export default function CopyableId({ value, copyLabel }: CopyableIdProps) {
    const toast = useToast();

    const handleCopy = async () => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            toast.show(`${copyLabel}를 복사했어요.`, "success");
        } catch (err) {
            log.warn("클립보드 복사 실패", err);
            toast.show("클립보드 복사에 실패했습니다. 직접 복사해주세요.", "error");
        }
    };

    return (
        <>
            <code style={CHIP_STYLE}>{value || "-"}</code>
            {value && copyLabel && (
                <button className="btn btn-ghost" style={COPY_BUTTON_STYLE} onClick={handleCopy}>
                    복사
                </button>
            )}
        </>
    );
}
