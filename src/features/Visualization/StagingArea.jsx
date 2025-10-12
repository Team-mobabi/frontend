import React from 'react';

export default function StagingArea({ files, animationClass }) {
    if (files.length === 0) return null;

    return (
        <div className={`staging-area ${animationClass}`}>
            <div className="staging-title">Staging Area</div>
            <div className="staging-files">
                {files.map(file => (
                    <div key={file} className="chip-pill">
                        {file}
                    </div>
                ))}
            </div>
        </div>
    );
}