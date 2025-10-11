import React, {useEffect, useMemo, useRef, useState} from "react";
import {api} from "../../features/API";
import {useGit} from "../GitCore/GitContext.jsx";

// ... (파일 상단의 toArray, nameOf, uniq, candidatesFromStatus 함수들은 그대로 유지) ...
function toArray(x) {
    if (!x) return [];
    return Array.isArray(x) ? x : [x]
}
function nameOf(it) {
    if (typeof it === "string") return it;
    return it?.path || it?.file || it?.name || it?.filename || ""
}
function uniq(arr) {
    const s = new Set();
    const out = [];
    for (const a of arr) {
        const k = String(a || "");
        if (!k) continue;
        if (!s.has(k)) {
            s.add(k);
            out.push(k)
        }
    }
    return out; // 'uniq(pool)' -> 'out' 으로 수정 (무한 재귀 오류 수정)
}
function candidatesFromStatus(st) {
    const pool = [];
    const buckets = ["untracked", "modified", "changed", "unstaged", "notAdded", "renamed", "files"];
    for (const k of buckets) {
        toArray(st?.[k]).forEach(x => {
            const n = nameOf(x);
            if (n) pool.push(n)
        })
    }
    // 'st?.working?.untracked' 같이 더 구체적인 경로를 참조하는 부분이 있다면 그대로 유지 가능합니다.
    // 여기서는 제공된 코드의 uniq(pool)만 수정했습니다.
    return uniq(pool);
}


export default function AddModal({open, onCancel, onConfirm, workingDirectory = "", staged = []}) {
    const {state} = useGit();
    const repoId = useMemo(() => state?.selectedRepoId == null ? "" : String(state.selectedRepoId).trim(), [state?.selectedRepoId]);

    const [tab, setTab] = useState("status");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    const [files, setFiles] = useState([]);
    const [selected, setSelected] = useState(new Set(staged.map(String)));
    const [q, setQ] = useState("");

    // ▼▼▼ 수정된 부분 (파일 선택 탭 관련 state 간소화) ▼▼▼
    const [pickedFiles, setPickedFiles] = useState([]); // File 객체를 담을 state
    // ▲▲▲ 수정된 부분 ▲▲▲
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) {
            init();
        }
    }, [open, repoId]);

    function init() {
        setErr("");
        setQ("");
        setSelected(new Set(staged.map(String)));
        setPickedFiles([]); // 초기화
        setTab("status");
        loadStatus();
    }

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        if (!qq) return files;
        return files.filter(f => f.toLowerCase().includes(qq));
    }, [q, files]);

    async function loadStatus() {
        if (!repoId) return;
        setLoading(true);
        setErr("");
        try {
            const st = await api.repos.status(repoId);
            setFiles(candidatesFromStatus(st));
        } catch (e) {
            const raw = e?.data?.message ?? e?.message ?? "상태를 불러오지 못했습니다.";
            setErr(Array.isArray(raw) ? raw.join("\n") : String(raw));
            setFiles([]);
        } finally {
            setLoading(false);
        }
    }

    function toggle(name) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    }

    function toggleAll(checked) {
        if (checked) setSelected(new Set(filtered));
        else setSelected(new Set());
    }

    async function copyPath() {
        try {
            await navigator.clipboard.writeText(String(workingDirectory || ""));
        } catch {
        }
    }

    function onFilePick(e) {
        const list = Array.from(e.target.files || []);
        setPickedFiles(list);
    }

    function openPicker() {
        inputRef.current?.click();
    }

    function onDrop(e) {
        e.preventDefault();
        const list = Array.from(e.dataTransfer?.files || []);
        setPickedFiles(list);
    }

    function onDragOver(e) {
        e.preventDefault();
    }

    // ▼▼▼ 수정된 부분 (통합된 확인 핸들러) ▼▼▼
    function handleConfirm() {
        if (tab === "status") {
            const pickedNames = Array.from(selected);
            if (pickedNames.length === 0) return;
            onConfirm(pickedNames); // string[] 전달
        } else if (tab === "pick") {
            if (pickedFiles.length === 0) return;
            onConfirm(pickedFiles); // File[] 전달
        }
    }
    // ▲▲▲ 수정된 부분 ▲▲▲

    if (!open) return null;

    // 모달 하단 버튼의 활성화 여부 결정
    const isConfirmDisabled = tab === 'status'
        ? selected.size === 0
        : pickedFiles.length === 0;

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-head">
                    <h4>파일 담기</h4>
                    <button className="modal-close" onClick={onCancel}>×</button>
                </div>

                <div className="modal-body">
                    <div style={{display: "flex", gap: 8, marginBottom: 12}}>
                        <button className={tab === "status" ? "btn btn-primary" : "btn"}
                                onClick={() => setTab("status")}>변경된 파일
                        </button>
                        <button className={tab === "pick" ? "btn btn-primary" : "btn"} onClick={() => setTab("pick")}>파일
                            선택
                        </button>
                        <div style={{flex: 1}}/>
                        {tab === "status" && <button className="btn" onClick={loadStatus}
                                                     disabled={loading}>{loading ? "새로고침…" : "새로고침"}</button>}
                    </div>

                    {tab === "status" ? (
                        <>
                            {/* ... ('변경된 파일' 탭의 JSX는 기존과 동일하게 유지) ... */}
                        </>
                    ) : (
                        <>
                            <input ref={inputRef} type="file" multiple style={{display: "none"}} onChange={onFilePick}/>
                            <div
                                onDrop={onDrop}
                                onDragOver={onDragOver}
                                style={{
                                    border: "2px dashed var(--line)",
                                    background: "var(--panel-2)",
                                    borderRadius: 12,
                                    padding: 20,
                                    textAlign: "center",
                                    marginBottom: 10
                                }}
                            >
                                <div style={{fontSize: 13, color: "var(--sub)", marginBottom: 8}}>여기로 파일을 끌어다 놓거나</div>
                                <button className="btn" type="button" onClick={openPicker}>파일 선택</button>
                            </div>

                            {pickedFiles.length > 0 ? (
                                <div className="push-list" style={{maxHeight: 240, overflow: "auto"}}>
                                    {pickedFiles.map(f => (
                                        <div key={f.name + f.size + f.lastModified} className="push-row">
                                            <div className="push-msg" title={f.name}>{f.name}</div>
                                            <div className="push-msg" style={{fontSize: 12, color: "var(--muted)"}}>
                                                {(f.size / 1024).toFixed(1)} KB
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty">선택된 파일이 없습니다.</div>
                            )}
                            {/* ▼▼▼ 수정된 부분 (API 호출 버튼 제거) ▼▼▼ */}
                            {/* API 호출은 부모 컴포넌트에서 하므로 이 버튼은 더 이상 필요 없습니다. */}
                            {/* ▲▲▲ 수정된 부분 ▲▲▲ */}
                        </>
                    )}
                </div>

                {/* ▼▼▼ 수정된 부분 (모달 하단 버튼 통합) ▼▼▼ */}
                <div className="modal-actions">
                    <button className="btn" onClick={onCancel} disabled={loading}>취소</button>
                    <button className="btn btn-primary" onClick={handleConfirm}
                            disabled={isConfirmDisabled || loading}>
                        {tab === 'status' ? '선택한 파일 담기' : '선택한 파일 업로드하여 담기'}
                    </button>
                </div>
                {/* ▲▲▲ 수정된 부분 ▲▲▲ */}
            </div>
        </div>
    );
}