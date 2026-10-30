interface ToggleSwitchProps {
    checked: boolean;
    onChange: (next: boolean) => void;
    label?: string;
}

// .toggle-switch 스타일 체크박스 + 옆 라벨 (부모 flex 레이아웃에 그대로 끼워 넣도록 Fragment 반환)
export default function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
    return (
        <>
            <label className="toggle-switch">
                <input type="checkbox" checked={checked} onChange={() => onChange(!checked)} />
                <span className="slider"></span>
            </label>
            {label && <span>{label}</span>}
        </>
    );
}
