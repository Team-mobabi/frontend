import React from "react";

export default function BeginnerHelp({ onClose }) {
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e)=>e.stopPropagation()} style={{width:"min(520px,92vw)"}}>
                <div className="modal-head">
                    <h4>도움말</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <ol style={{lineHeight:1.7, paddingLeft:18}}>
                        <li><strong>왼쪽(Local)</strong>은 내 컴퓨터, <strong>오른쪽(Remote)</strong>는 원격 저장소예요.</li>
                        <li>파란 원이 <strong>커밋</strong>, 초록 원은 <strong>현재 브랜치의 머리(HEAD)</strong>입니다.</li>
                        <li>실선은 로컬, <span style={{borderBottom:"2px dotted #9aa3b2"}}>점선</span>은 원격 추적 선입니다.</li>
                        <li>브랜치 칩(초록)을 누르면 <strong>병합</strong>할 수 있어요. 충돌 나면 AI가 해결 제안을 보여줍니다.</li>
                    </ol>
                </div>
                <div className="modal-actions">
                    <button className="btn btn-primary" onClick={onClose}>알겠습니다</button>
                </div>
            </div>
        </div>
    );
}
