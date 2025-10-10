import React from 'react';
import { useGit } from '../GitCore/GitContext.jsx';

const fmt = (ts) => {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');
    return `${hh}:${mm}:${ss}`;
};

const EventLog = () => {
    const { state } = useGit();
    return (
        <div className="panel" style={{marginTop:16}}>
            <h3>무슨 일이 일어났나요?</h3>
            <div className="panel-sub">최근 순서대로 보여드려요</div>
            <div style={{maxHeight:180, overflow:'auto', border:'1px solid var(--line)', borderRadius:12, padding:8}}>
                {state.events.length === 0 && <div style={{color:'var(--sub)', fontSize:12}}>아직 기록이 없어요</div>}
                {state.events.map(e => (
                    <div key={e.id} className="repo-item" style={{marginBottom:8}}>
                        <div className="repo-dot" />
                        <div className="repo-name" style={{fontWeight:600}}>{e.text}</div>
                        <div className="repo-branch" style={{marginLeft:'auto'}}>{fmt(e.ts)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EventLog;
