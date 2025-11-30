import React, { useState, useMemo, useEffect } from "react";

// diff 내용을 파일별로 파싱하는 함수
function parseDiffByFiles(diffContent) {
    if (!diffContent) return [];
    
    const lines = diffContent.split('\n');
    const files = [];
    let currentFile = null;
    let currentFileLines = [];
    let currentFilePath = null;
    let isFirstLine = true;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 새 파일 시작 감지 - 여러 패턴 지원
        const isNewFileStart = 
            line.startsWith('diff --git') ||
            line.startsWith('new file mode') ||
            line.startsWith('deleted file mode') ||
            line.startsWith('similarity index') ||
            line.startsWith('rename from') ||
            line.startsWith('rename to') ||
            (line.startsWith('index ') && i === 0) ||
            (line.match(/^Binary files/) && !currentFile);
        
        if (isNewFileStart) {
            // 이전 파일 저장
            if (currentFile && currentFileLines.length > 0) {
                files.push({
                    path: currentFilePath || '파일',
                    content: currentFileLines.join('\n'),
                    lineCount: currentFileLines.length,
                    additions: currentFile.additions,
                    deletions: currentFile.deletions
                });
            }
            
            // 새 파일 시작
            if (line.startsWith('diff --git')) {
                const fileMatch = line.match(/diff --git a\/(.+?) b\/(.+?)$/);
                currentFilePath = fileMatch ? (fileMatch[2] || fileMatch[1]) : null;
            }
            
            currentFile = {
                additions: 0,
                deletions: 0
            };
            currentFileLines = [line];
            isFirstLine = false;
        } 
        // '---' 또는 '+++'로 시작하면서 파일 경로를 추출하는 경우
        else if (line.startsWith('---') || line.startsWith('+++')) {
            if (currentFile || isFirstLine) {
                if (!currentFile) {
                    currentFile = { additions: 0, deletions: 0 };
                    currentFileLines = [];
                    isFirstLine = false;
                }
                currentFileLines.push(line);
                
                // 파일 경로 추출 (+++ b/... 또는 --- a/...)
                if (line.startsWith('+++')) {
                    const pathMatch = line.match(/\+\+\+ b\/(.+)$/) || line.match(/\+\+\+ \/dev\/null/) || line.match(/\+\+\+ (.+)$/);
                    if (pathMatch && !currentFilePath) {
                        currentFilePath = pathMatch[1] === '/dev/null' ? null : pathMatch[1];
                    }
                } else if (line.startsWith('---')) {
                    const pathMatch = line.match(/--- a\/(.+)$/) || line.match(/--- \/dev\/null/) || line.match(/--- (.+)$/);
                    if (pathMatch && !currentFilePath) {
                        currentFilePath = pathMatch[1] === '/dev/null' ? null : pathMatch[1];
                    }
                }
            }
        } 
        // 'Binary files' 또는 'new file mode' 등을 통해 파일 경로 추출
        else if (line.includes('Binary files') || line.includes('differ')) {
            if (currentFile) {
                currentFileLines.push(line);
                // Binary files /dev/null and b/path/to/file.png differ 형식
                const binaryMatch = line.match(/b\/([^\s]+)/);
                if (binaryMatch && !currentFilePath) {
                    currentFilePath = binaryMatch[1];
                }
            }
        }
        else {
            if (currentFile || isFirstLine) {
                if (!currentFile) {
                    currentFile = { additions: 0, deletions: 0 };
                    currentFileLines = [];
                    isFirstLine = false;
                }
                currentFileLines.push(line);
                
                // 변경 통계 계산 (단, +++, ---, @@로 시작하는 헤더는 제외)
                if (line.startsWith('+') && !line.startsWith('+++')) {
                    currentFile.additions++;
                } else if (line.startsWith('-') && !line.startsWith('---') && !line.startsWith('@@')) {
                    currentFile.deletions++;
                }
            }
        }
    }
    
    // 마지막 파일 저장
    if (currentFile && currentFileLines.length > 0) {
        files.push({
            path: currentFilePath || '파일',
            content: currentFileLines.join('\n'),
            lineCount: currentFileLines.length,
            additions: currentFile.additions,
            deletions: currentFile.deletions
        });
    }
    
    // 파싱 실패 시 전체를 하나의 파일로 처리
    if (files.length === 0 && diffContent.trim()) {
        const additions = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
        const deletions = lines.filter(l => l.startsWith('-') && !l.startsWith('---') && !l.startsWith('@@')).length;
        files.push({
            path: '변경 사항',
            content: diffContent,
            lineCount: lines.length,
            additions,
            deletions
        });
    }
    
    return files;
}

function DiffFile({ file, defaultExpanded = false, compact = false }) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [hasBeenToggled, setHasBeenToggled] = useState(false);
    
    // defaultExpanded가 변경되고 사용자가 수동으로 토글하지 않은 경우에만 상태 업데이트
    useEffect(() => {
        if (!hasBeenToggled) {
            setExpanded(defaultExpanded);
        }
    }, [defaultExpanded, hasBeenToggled]);
    
    const handleToggle = () => {
        setExpanded(prev => !prev);
        setHasBeenToggled(true);
    };
    
    const contentLines = file.content.split('\n');
    // compact 모드에서는 미리보기 없이 전체를 보여주되 스크롤 가능하게
    const previewLines = contentLines;
    const hasMore = false; // compact 모드에서도 전체 표시
    
    const renderLine = (line, index) => {
        let style = {};
        if (line.startsWith('+')) {
            style.color = "green";
            style.backgroundColor = "#e6ffed";
        } else if (line.startsWith('-')) {
            style.color = "red";
            style.backgroundColor = "#ffeef0";
        } else if (line.startsWith('@@')) {
            style.color = "#007acc";
            style.backgroundColor = "#f0f8ff";
        } else if (line.startsWith('diff --git') || line.startsWith('index')) {
            style.color = "#888";
            style.fontWeight = "bold";
        }
        return (
            <span key={index} style={{ ...style, display: "block" }}>
                {line || ' '}
            </span>
        );
    };
    
    return (
        <div style={{ border: "1px solid #ddd", borderRadius: 4, marginBottom: 8, overflow: "hidden" }}>
            <div
                onClick={handleToggle}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
                role="button"
                tabIndex={0}
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    backgroundColor: "#f8f9fa",
                    cursor: "pointer",
                    borderBottom: expanded ? "1px solid #ddd" : "none"
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <span style={{ fontSize: "14px", fontWeight: "bold" }}>{expanded ? "▼" : "▶"}</span>
                    <span style={{ fontFamily: "monospace", fontSize: "13px" }}>{file.path}</span>
                    {(file.additions > 0 || file.deletions > 0) && (
                        <span style={{ fontSize: "12px", color: "#666" }}>
                            (+{file.additions} -{file.deletions})
                        </span>
                    )}
                </div>
                {!expanded && (
                    <span style={{ fontSize: "12px", color: "#999" }}>
                        {file.lineCount}줄
                    </span>
                )}
            </div>
            {expanded && (
                <div style={{
                    backgroundColor: "#f5f5f5",
                    margin: 0,
                    overflowX: "auto",
                    overflowY: "visible",
                    borderTop: "1px solid #ddd"
                }}>
                    <pre style={{ 
                        fontFamily: "monospace", 
                        whiteSpace: "pre", 
                        padding: 12, 
                        margin: 0
                    }}>
                        {previewLines.map((line, index) => renderLine(line, index))}
                    </pre>
                </div>
            )}
        </div>
    );
}

export default function DiffContentDisplay({ diffContent, compact = false, collapsible = true }) {
    const files = useMemo(() => parseDiffByFiles(diffContent), [diffContent]);
    
    if (!diffContent) return null;
    
    // collapsible이 false인 경우 기존 방식으로 표시
    if (!collapsible) {
        return (
            <pre className="diff-container" style={{ fontFamily: "monospace", whiteSpace: "pre", backgroundColor: "#f5f5f5", padding: 16, borderRadius: 8, overflowX: "auto" }}>
                {diffContent.split('\n').map((line, index) => {
                    let style = {};
                    if (line.startsWith('+')) {
                        style.color = "green";
                        style.backgroundColor = "#e6ffed";
                    } else if (line.startsWith('-')) {
                        style.color = "red";
                        style.backgroundColor = "#ffeef0";
                    } else if (line.startsWith('@@')) {
                        style.color = "#007acc";
                        style.backgroundColor = "#f0f8ff";
                    } else if (line.startsWith('diff --git') || line.startsWith('index')) {
                        style.color = "#888";
                        style.fontWeight = "bold";
                    }
                    return (
                        <span key={index} style={{ ...style, display: "block" }}>
                            {line || ' '}
                        </span>
                    );
                })}
            </pre>
        );
    }
    
    // 파일별로 접을 수 있는 형태로 표시 (파일이 1개여도 collapsible 모드 사용)
    // 파일이 많을 때는 기본적으로 접혀있고, 적을 때만 펼침
    const shouldExpandByDefault = files.length <= 3;
    
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {files.map((file, index) => (
                <DiffFile 
                    key={`${file.path}-${index}`} 
                    file={file} 
                    defaultExpanded={shouldExpandByDefault}
                    compact={compact}
                />
            ))}
        </div>
    );
}