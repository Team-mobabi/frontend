import React from 'react';

export default function Modal({ open, title, children, onClose }){
    if (!open) return null;
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
                <div className="modal-head">
                    <h4>{title}</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">{children}</div>
            </div>
        </div>
    );
}
