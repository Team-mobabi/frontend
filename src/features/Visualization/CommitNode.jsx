import React from 'react';

export default function CommitNode({ position, isHead, className, color, isMerge }) {
    const style = {
        left: position.x,
        top: position.y,
        transform: `translate(-50%, -50%)`,
        backgroundImage: color ? `linear-gradient(135deg, ${color}, ${color})` : undefined,
    };

    return (
        <div
            className={`commit-node ${isHead ? 'head' : ''} ${isMerge ? 'merge' : ''} ${className || ''}`}
            style={style}
        />
    );
}