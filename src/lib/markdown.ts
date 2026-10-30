const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * 아주 가벼운 markdown-lite 렌더 (번호/불릿/제목/볼드/줄바꿈).
 * 신뢰할 수 없는 AI 응답을 렌더링하므로 반드시 먼저 HTML 이스케이프한 뒤 변환한다.
 */
export function mdLite(text = ""): string {
    const esc = (s: string) => s.replace(/[&<>"']/g, (m) => HTML_ESCAPES[m]);
    const lines = esc(text).split(/\r?\n/);

    const out: string[] = [];
    let inUl = false, inOl = false;

    const flush = () => {
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (inOl) { out.push("</ol>"); inOl = false; }
    };

    for (const raw of lines) {
        const line = raw.trim();

        // 제목 (#, ##, ###)
        const h = line.match(/^(#{1,3})\s+(.*)$/);
        if (h) { flush(); out.push(`<h${h[1].length}>${h[2]}</h${h[1].length}>`); continue; }

        // 번호 목록: "1. " 또는 "1) "
        if (/^\d+[.)]\s+/.test(line)) {
            if (!inOl) { flush(); out.push("<ol>"); inOl = true; }
            out.push(`<li>${line.replace(/^\d+[.)]\s+/, "")}</li>`);
            continue;
        }

        // 불릿 목록: "- " 또는 "* "
        if (/^[-*]\s+/.test(line)) {
            if (!inUl) { flush(); out.push("<ul>"); inUl = true; }
            out.push(`<li>${line.replace(/^[-*]\s+/, "")}</li>`);
            continue;
        }

        // 빈 줄 → 단락 구분
        if (line === "") { flush(); out.push("<br/>"); continue; }

        // **bold**
        const bold = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        out.push(`<p>${bold}</p>`);
    }
    flush();
    return out.join("\n");
}
