import React, { useEffect, useRef, useState } from 'react';

export default function BranchActionButton({
                                               items = [],
                                               value,
                                               onSelect,
                                               onAction,
                                               suffix,
                                               disabled,
                                               primary
                                           }) {
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);

    useEffect(() => {
        const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('click', h);
        return () => document.removeEventListener('click', h);
    }, []);

    const actionCls = `btn ${primary ? 'btn-primary' : ''} btn-combo`;

    const toggleMenu = (e) => {
        e.stopPropagation();
        setOpen((v) => !v);
    };

    const pick = (b) => {
        onSelect?.(b);
        setOpen(false);
    };

    return (
        <div className="combo-wrap" ref={boxRef}>
            <button className={actionCls} disabled={disabled} onClick={() => onAction?.(value)}>
        <span className="branch-pill" onClick={toggleMenu} aria-haspopup="listbox" aria-expanded={open}>
          <span className="branch-pill-label">{value}</span>
          <span className="branch-caret">▾</span>
        </span>
                <span className="combo-text">{suffix}</span>
            </button>

            {open && (
                <div className="combo-menu" role="listbox">
                    {items.map((b) => (
                        <button
                            key={b}
                            className={`combo-item ${b === value ? 'active' : ''}`}
                            onClick={() => pick(b)}
                            role="option"
                            aria-selected={b === value}
                        >
                            {b}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
