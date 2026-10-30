import type { CSSProperties, MouseEvent } from "react";
import type { Point } from "./BranchLine";

interface CommitNodeProps {
    position: Point;
    isHead?: boolean;
    className?: string;
    color?: string;
    isMerge?: boolean;
    recent?: boolean;
    onClick?: (e: MouseEvent<HTMLDivElement>) => void;
    onMouseEnter?: (e: MouseEvent<HTMLDivElement>) => void;
    onMouseLeave?: (e: MouseEvent<HTMLDivElement>) => void;
    title?: string;
}

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
                                   }: CommitNodeProps) {
    const style: CSSProperties = {
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
