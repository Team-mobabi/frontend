import React from 'react';
import { useGit } from '../GitCore/GitContext.jsx';
import { removeFromStaging } from '../GitCore/gitActions';

export default function StagingSummary({ files }) {
    const { dispatch } = useGit();

    const onRemove = (name) => {
        dispatch(removeFromStaging(name));
    };

    return (
        <div className="staging-panel">
            <div className="staging-head">
                <span className="staging-title">담은 파일</span>
            </div>
            {files.length === 0 ? (
                <div className="staging-empty">아직 담은 파일이 없어요</div>
            ) : (
                <div className="staging-bar">
                    {files.map((name) => (
                        <span key={name} className="chip-pill">
              {name}
                            <button
                                className="chip-x"
                                onClick={() => onRemove(name)}
                                aria-label="remove"
                            >
                ✕
              </button>
            </span>
                    ))}
                </div>
            )}
        </div>
    );
}
