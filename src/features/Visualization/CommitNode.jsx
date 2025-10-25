import React from "react";

export default function CommitNode({
                                       position,
                                       isHead,
                                       className,
                                       color,
                                       isMerge,
                                       recent,
                                       onClick,
                                       onMouseEnter,
                                       onMouseLeave,
                                       title,
                                   }) {
    const style = {
        left: position.x,
        top: position.y,
        transform: `translate(-50%, -50%)`,
        backgroundImage: color ? `linear-gradient(135deg, ${color}, ${color})` : undefined,
    };

    return (
        <div
            className={`commit-node ${isHead ? "head" : ""} ${isMerge ? "merge" : ""} ${recent ? "recent" : ""} ${className || ""}`}
            style={style}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            title={title}
        />
    );
}
