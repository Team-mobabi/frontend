import React, {useEffect, useMemo, useRef, useState} from "react";
import {api} from "../../features/API";
import {useGit} from "../GitCore/GitContext.jsx";

// --- Helper Functions ---
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
    return out;
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
    return uniq(pool);
}

// --- Component ---
export default function AddModal({open, onCancel, onConfirm, workingDirectory = "", staged = []}) {
    const {state} = useGit();
    const repoId = useMemo(() => state?.selectedRepoId == null ? "" : String(state.selectedRepoId).trim(), [state?.selectedRepoId]);

    const [tab, setTab] = useState("status");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    const [files, setFiles] = useState([]);
    const [selected, setSelected] = useState(new Set(staged.map(String)));
    const [q, setQ] = useState("");

    const [pickedFiles, setPickedFiles] = useState([]);
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
        setPickedFiles([]);
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
        } catch {}
    }

    function onFilePick(e) {
        const list = Array.from(e.target.files || []);
        setPickedFiles(list);
        // input 값 초기화 (동일한 폴더/파일을 다시 선택할 수 있도록)
        if (inputRef.current) {
            inputRef.current.value = null;
        }
    }

    function openPicker() {
        inputRef.current?.click();
    }

    function onDrop(e) {
        e.preventDefault();
        const list = Array.from(e.dataTransfer?.files || []);

        // 폴더 드롭 시도 감지 (간단한 체크)
        let hasDirectory = false;
        try {
            if (e.dataTransfer.items) {
                for (let i = 0; i < e.dataTransfer.items.length; i++) {
                    const item = e.dataTransfer.items[i];
                    if (item.kind === 'file' && item.webkitGetAsEntry()?.isDirectory) {
                        hasDirectory = true;
                        break;
                    }
                }
            }
        } catch (err) { /* 무시 */ }

        if (hasDirectory) {
            setErr("폴더 끌어다 놓기는 지원되지 않습니다. '파일 / 폴더 선택' 버튼을 이용해주세요.");
            setPickedFiles([]);
        } else {
            setErr("");
            setPickedFiles(list);
        }
    }

    function onDragOver(e) {
        e.preventDefault();
    }

    function handleConfirm() {
        console.log("모달 확인 버튼 클릭됨!"); // 로그 추가
        if (tab === "status") {
            const pickedNames = Array.from(selected);
            if (pickedNames.length === 0) return;
            onConfirm(pickedNames);
        } else if (tab === "pick") {
            if (pickedFiles.length === 0) return;
            onConfirm(pickedFiles);
        }
    }

    if (!open) return null;

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
                            {/* [복원] '변경된 파일' 탭 UI */}
                            <input
                                className="input"
                                placeholder="필터..."
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                style={{ marginBottom: 12 }}
                            />
                            {loading && <div><span className="spinner" /> 파일 목록 로딩 중...</div>}
                            {err && <div style={{ color: "var(--danger)" }}>{err}</div>}
                            {!loading && !err && (
                                <div style={{ maxHeight: 300, overflow: "auto" }}>
                                    {filtered.length > 0 ? (
                                        <div className="file-list">
                                            <div className="file-item file-item-header">
                                                <input
                                                    type="checkbox"
                                                    onChange={e => toggleAll(e.target.checked)}
                                                    checked={filtered.length > 0 && selected.size === filtered.length}
                                                />
                                                <span>파일 경로</span>
                                            </div>
                                            {filtered.map(name => (
                                                <div key={name} className="file-item" onClick={() => toggle(name)}>
                                                    <input
                                                        type="checkbox"
                                                        readOnly
                                                        checked={selected.has(name)}
                                                    />
                                                    <span title={name}>{name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty">변경된 파일이 없습니다.</div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {/* [수정] input 태그에 webkitdirectory 속성 추가 */}
                            <input
                                ref={inputRef}
                                type="file"
                                multiple
                                style={{ display: "none" }}
                                onChange={onFilePick}
                                webkitdirectory=""
                            />
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
                                {/* [수정] 안내 문구 변경 */}
                                <div style={{fontSize: 13, color: "var(--sub)", marginBottom: 8}}>여기로 파일을 끌어다 놓거나<br/>아래 버튼으로 파일 **또는 폴더**를 선택하세요.</div>
                                <button className="btn" type="button" onClick={openPicker}>파일 / 폴더 선택</button>
                            </div>

                            {/* [추가] 폴더 드롭 시 에러 메시지 표시 */}
                            {err && <div style={{ color: "var(--danger)", marginBottom: '10px' }}>{err}</div>}

                            {pickedFiles.length > 0 ? (
                                <div className="push-list" style={{maxHeight: 240, overflow: "auto"}}>
                                    {pickedFiles.map(f => (
                                        <div key={f.name + f.size + f.lastModified} className="push-row">
                                            {/* [수정] 폴더 선택 시 상대 경로 표시 */}
                                            <div className="push-msg" title={f.webkitRelativePath || f.name}>
                                                {f.webkitRelativePath || f.name}
                                            </div>
                                            <div className="push-msg" style={{fontSize: 12, color: "var(--muted)"}}>
                                                {(f.size / 1024).toFixed(1)} KB
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty">선택된 파일이 없습니다.</div>
                            )}
                        </>
                    )}
                </div>

                <div className="modal-actions">
                    <button className="btn" onClick={onCancel} disabled={loading}>취소</button>
                    {/* [수정] 버튼 텍스트 변경 */}
                    <button className="btn btn-primary" onClick={handleConfirm}
                            disabled={isConfirmDisabled || loading}>
                        {tab === 'status' ? '선택한 파일 담기' : '선택한 파일/폴더 업로드하여 담기'}
                    </button>
                </div>
            </div>
        </div>
    );
}