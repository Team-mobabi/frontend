import { DEFAULT_DIFF_THEME, diffLineKind, type DiffLineTheme } from "./diffLineStyle";

interface DiffLinesProps {
    text: string;
    theme?: DiffLineTheme;
}

// 여러 줄 diff 텍스트를 줄 단위로 색칠해 렌더링 (<pre>/<code> 안에 넣어 사용)
export default function DiffLines({ text, theme = DEFAULT_DIFF_THEME }: DiffLinesProps) {
    return (
        <>
            {text.split("\n").map((line, index) => (
                <span key={index} style={{ ...theme[diffLineKind(line)], ...theme.base }}>
                    {line || " "}
                </span>
            ))}
        </>
    );
}
