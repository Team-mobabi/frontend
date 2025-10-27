import React from "react";

export default function DiffContentDisplay({ diffContent }) {
    if (!diffContent) return null;

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