import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../features/API";
import { useGit } from "../GitCore/GitContext.jsx";

function toArray(x){if(!x)return[];return Array.isArray(x)?x:[x]}
function nameOf(it){if(typeof it==="string")return it;return it?.path||it?.file||it?.name||it?.filename||""}
function uniq(arr){const s=new Set();const out=[];for(const a of arr){const k=String(a||"");if(!k)continue;if(!s.has(k)){s.add(k);out.push(k)}}return out}
function candidatesFromStatus(st){const pool=[];const buckets=["untracked","modified","changed","unstaged","notAdded","renamed","files"];for(const k of buckets){toArray(st?.[k]).forEach(x=>{const n=nameOf(x);if(n)pool.push(n)})}toArray(st?.working?.untracked).forEach(x=>{const n=nameOf(x);if(n)pool.push(n)});return uniq(pool)}

export default function AddModal({ open, onCancel, onConfirm, workingDirectory="", staged=[] }) {
    const { state } = useGit();
    const repoId = useMemo(()=> state?.selectedRepoId==null?"":String(state.selectedRepoId).trim(),[state?.selectedRepoId]);

    const [tab,setTab]=useState("status");
    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState("");

    const [files,setFiles]=useState([]);
    const [selected,setSelected]=useState(new Set(staged.map(String)));
    const [q,setQ]=useState("");

    const [pickErr,setPickErr]=useState("");
    const [picked,setPicked]=useState([]);
    const [dirHandle,setDirHandle]=useState(null);
    const inputRef=useRef(null);

    useEffect(()=>{ if(open){ init(); } },[open,repoId]);
    function init(){ setErr(""); setPickErr(""); setQ(""); setSelected(new Set(staged.map(String))); setPicked([]); setDirHandle(null); setTab("status"); loadStatus(); }

    const filtered = useMemo(()=>{
        const qq=q.trim().toLowerCase();
        if(!qq) return files;
        return files.filter(f=>f.toLowerCase().includes(qq));
    },[q,files]);

    async function loadStatus(){
        if(!repoId) return;
        setLoading(true); setErr("");
        try{
            const st=await api.repos.status(repoId);
            setFiles(candidatesFromStatus(st));
        }catch(e){
            const raw=e?.data?.message??e?.message??"상태를 불러오지 못했습니다.";
            setErr(Array.isArray(raw)?raw.join("\n"):String(raw));
            setFiles([]);
        }finally{ setLoading(false); }
    }

    function toggle(name){
        setSelected(prev=>{const next=new Set(prev); if(next.has(name)) next.delete(name); else next.add(name); return next;});
    }
    function toggleAll(checked){
        if(checked) setSelected(new Set(filtered));
        else setSelected(new Set());
    }
    async function copyPath(){ try{ await navigator.clipboard.writeText(String(workingDirectory||"")); }catch{} }

    function onFilePick(e){
        setPickErr("");
        const list = Array.from(e.target.files||[]);
        setPicked(list);
    }
    function openPicker(){ inputRef.current?.click(); }

    async function chooseDir(){
        try{
            if(!("showDirectoryPicker" in window)){ setPickErr("브라우저가 디렉터리 선택을 지원하지 않습니다."); return; }
            const handle = await window.showDirectoryPicker({mode:"readwrite"});
            setDirHandle(handle);
            setPickErr("");
        }catch(e){
            if(e?.name!=="AbortError") setPickErr("작업 폴더 선택이 취소되었거나 거부되었습니다.");
        }
    }

    async function saveToDirAndStage(){
        if(!repoId){ setPickErr("레포지토리를 먼저 선택하세요."); return; }
        if(picked.length===0){ setPickErr("업로드할 파일을 선택하세요."); return; }
        if(!dirHandle){ setPickErr("작업 폴더를 선택하세요."); return; }
        setLoading(true); setPickErr("");
        const savedNames=[];
        try{
            for(const f of picked){
                const fileHandle = await dirHandle.getFileHandle(f.name,{create:true});
                const writable = await fileHandle.createWritable();
                const buf = await f.arrayBuffer();
                await writable.write(buf);
                await writable.close();
                savedNames.push(f.name);
            }
            onConfirm && onConfirm(savedNames);
        }catch(e){
            const raw=e?.message||"작업 폴더에 저장하지 못했습니다.";
            setPickErr(String(raw));
        }finally{
            setLoading(false);
        }
    }

    function onDrop(e){
        e.preventDefault();
        const list = Array.from(e.dataTransfer?.files||[]);
        setPicked(list);
    }
    function onDragOver(e){ e.preventDefault(); }

    function handleConfirmStatus(){
        const pickedNames = Array.from(selected);
        if(pickedNames.length===0) return;
        onConfirm && onConfirm(pickedNames);
    }

    if(!open) return null;

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
                <div className="modal-head">
                    <h4>파일 담기</h4>
                    <button className="modal-close" onClick={onCancel}>×</button>
                </div>

                <div className="modal-body">
                    <div style={{display:"flex",gap:8,marginBottom:12}}>
                        <button className={tab==="status"?"btn btn-primary":"btn"} onClick={()=>setTab("status")}>변경된 파일</button>
                        <button className={tab==="pick"?"btn btn-primary":"btn"} onClick={()=>setTab("pick")}>파일 선택</button>
                        <div style={{flex:1}}/>
                        {tab==="status" && <button className="btn" onClick={loadStatus} disabled={loading}>{loading?"새로고침…":"새로고침"}</button>}
                    </div>

                    {tab==="status" ? (
                        <>
                            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                                <div className="branch-pill" style={{maxWidth:"100%",overflow:"hidden"}}>
                                    <span className="branch-pill-label" title={workingDirectory||""}>{workingDirectory||"작업 폴더 경로 미확인"}</span>
                                </div>
                                <button className="btn btn-ghost" onClick={copyPath}>경로 복사</button>
                                <div style={{flex:1}}/>
                                <label className="branch-pill" style={{gap:8,cursor:"pointer"}}>
                                    <input type="checkbox" checked={filtered.length>0 && selected.size===filtered.length} onChange={e=>toggleAll(e.target.checked)} style={{margin:0}}/>
                                    <span className="branch-pill-label">전체 선택</span>
                                </label>
                            </div>

                            {err && <div className="error" style={{color:"var(--danger)",fontSize:12,marginBottom:10}}>{err}</div>}

                            {filtered.length===0 ? (
                                <div className="empty">추가할 파일이 없습니다. 파일 선택 탭을 사용하거나 작업 폴더에 파일을 복사한 뒤 새로고침하세요.</div>
                            ) : (
                                <div className="push-list">
                                    {filtered.map(name=>{
                                        const checked=selected.has(name);
                                        return (
                                            <label key={name} className="push-row" style={{cursor:"pointer"}}>
                                                <input type="checkbox" checked={checked} onChange={()=>toggle(name)} style={{margin:0}}/>
                                                <div className="push-msg" title={name} style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name}</div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <input ref={inputRef} type="file" multiple style={{display:"none"}} onChange={onFilePick}/>
                            <div
                                onDrop={onDrop}
                                onDragOver={onDragOver}
                                style={{border:"2px dashed var(--line)",background:"var(--panel-2)",borderRadius:12,padding:20,textAlign:"center",marginBottom:10}}
                            >
                                <div style={{fontSize:13,color:"var(--sub)",marginBottom:8}}>여기로 파일을 끌어다 놓거나</div>
                                <button className="btn" type="button" onClick={openPicker}>파일 선택</button>
                            </div>

                            {picked.length>0 ? (
                                <div className="push-list" style={{maxHeight:240,overflow:"auto"}}>
                                    {picked.map(f=>(
                                        <div key={f.name+f.size+f.lastModified} className="push-row">
                                            <div className="push-msg" title={f.name} style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{f.name}</div>
                                            <div className="push-msg" style={{fontSize:12,color:"var(--muted)"}}>{(f.size/1024).toFixed(1)} KB</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty">선택된 파일이 없습니다.</div>
                            )}

                            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10}}>
                                <button type="button" className="btn" onClick={chooseDir}>작업 폴더 선택</button>
                                <div className="branch-pill" style={{maxWidth:"100%",overflow:"hidden"}}>
                                    <span className="branch-pill-label" title={dirHandle?.name||""}>{dirHandle?.name || "선택된 폴더 없음"}</span>
                                </div>
                                <div style={{flex:1}}/>
                                <button className="btn btn-primary" onClick={saveToDirAndStage} disabled={picked.length===0 || !dirHandle || loading}>
                                    {loading ? "저장 중…" : "작업 폴더에 저장하여 담기"}
                                </button>
                            </div>

                            {pickErr && <div className="error" style={{color:"var(--danger)",fontSize:12,marginTop:10}}>{pickErr}</div>}
                        </>
                    )}
                </div>

                <div className="modal-actions">
                    <button className="btn" onClick={onCancel} disabled={loading}>취소</button>
                    {tab==="status" && (
                        <button className="btn btn-primary" onClick={handleConfirmStatus} disabled={selected.size===0 || loading}>선택 담기</button>
                    )}
                </div>
            </div>
        </div>
    );
}
