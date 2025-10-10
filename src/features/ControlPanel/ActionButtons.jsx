import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGit } from "../../features/GitCore/GitContext";
import { api } from "../../features/API";
import AddModal from "./AddModal";
import StagingSummary from "./StagingSummary";
import RemoteConnectModal from "./RemoteConnectModal";
import { getRemoteMem, setRemoteMem } from "../../features/GitCore/remoteMemory";

const STEP_LABEL = { 1: "원격에서 받아오기", 2: "파일 담기", 3: "메시지 쓰고 저장", 4: "원격으로 올리기" };

function normalizeBranchList(list) {
    return Array.isArray(list) ? list : Object.keys(list || {});
}
function fileListOf(c) {
    const a = c?.files || c?.changed || c?.paths || [];
    if (Array.isArray(a) && a.length) return a.map(String);
    const fromObj = c?.changes && typeof c.changes === "object" ? Object.keys(c.changes) : [];
    return fromObj;
}
function findMissingCommits(graph, branch, direction) {
    const local = graph?.local ?? graph?.workspace ?? graph?.localRepo ?? {};
    const remote = graph?.remote ?? graph?.origin ?? graph?.remoteRepo ?? {};
    const lb = local?.branches?.[branch] || [];
    const rb = remote?.branches?.[branch] || [];
    const lhashes = lb.map(c => c?.hash || c?.id || c?.sha || c?.oid || "");
    const rhashes = rb.map(c => c?.hash || c?.id || c?.sha || c?.oid || "");
    if (direction === "push") {
        const base = rhashes[rhashes.length - 1];
        if (!base) return lb;
        const idx = lhashes.lastIndexOf(base);
        return idx >= 0 ? lb.slice(idx + 1) : lb;
    } else {
        const base = lhashes[lhashes.length - 1];
        if (!base) return rb;
        const idx = rhashes.lastIndexOf(base);
        return idx >= 0 ? rb.slice(idx + 1) : rb;
    }
}
function summarizeFiles(commits) {
    const set = new Set();
    commits.forEach(c => fileListOf(c).forEach(f => set.add(String(f))));
    return Array.from(set);
}

export default function ActionButtons() {
    const { state, dispatch } = useGit();
    const selectedRepoId = state.selectedRepoId;
    const safeRepoId = useMemo(() => {
        if (selectedRepoId === null || selectedRepoId === undefined) return "";
        return String(selectedRepoId).trim();
    }, [selectedRepoId]);
    const repoIdRef = useRef("");
    useEffect(() => { repoIdRef.current = safeRepoId; }, [safeRepoId]);
    const hasRepo = safeRepoId !== "";

    const [step, setStep] = useState(1);
    const [pullOpen, setPullOpen] = useState(false);
    const [pushOpen, setPushOpen] = useState(false);
    const [msg, setMsg] = useState("");
    const [openAdd, setOpenAdd] = useState(false);
    const [toast, setToast] = useState("");
    const [busy, setBusy] = useState(false);
    const [remoteModalOpen, setRemoteModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);

    const [branches, setBranches] = useState(["main"]);
    const [selPull, setSelPull] = useState("main");
    const [selPush, setSelPush] = useState("main");

    const refreshBranches = async () => {
        const rid = repoIdRef.current;
        if (!rid) return;
        try {
            const list = await api.branches.list(rid);
            const names = normalizeBranchList(list);
            setBranches(names.length ? names : ["main"]);
            if (!names.includes(selPull)) setSelPull(names[0] || "main");
            if (!names.includes(selPush)) setSelPush(names[0] || "main");
        } catch {}
    };

    useEffect(() => {
        if (!hasRepo) return;
        refreshBranches();
    }, [hasRepo, selectedRepoId]);

    useEffect(() => {
        setStep(1);
        setMsg("");
        setPullOpen(false);
        setPushOpen(false);
    }, [selectedRepoId]);

    const guard = (targetStep, fn) => {
        if (!hasRepo) {
            setToast("레포지토리를 먼저 선택해주세요.");
            setTimeout(() => setToast(""), 1500);
            return;
        }
        if (step !== targetStep) {
            setToast(`먼저 “${STEP_LABEL[step]}”를 진행해주세요!`);
            setTimeout(() => setToast(""), 1600);
            return;
        }
        if (busy) return;
        fn();
    };

    const fail = (e, fb) => {
        const raw = e?.data?.message ?? e?.message ?? fb ?? "오류가 발생했어요.";
        const msgText = Array.isArray(raw) ? raw.join("\n") : String(raw);
        setToast(msgText);
        setTimeout(() => setToast(""), 2200);
    };

    const switchOrCreateBranch = async (rid, branchName) => {
        const br = String(branchName || "main").trim();
        if (!br) throw new Error("브랜치 이름이 비어있습니다.");
        try {
            const res = await api.branches.switch(rid, br);
            return { created: false, switched: true, message: res?.message || "" };
        } catch (e) {
            if (e?.status === 404) {
                await api.branches.create(rid, br);
                const res2 = await api.branches.switch(rid, br);
                return { created: true, switched: true, message: res2?.message || "" };
            }
            throw e;
        }
    };

    const ensureRemote = async () => {
        const rid = repoIdRef.current;
        if (!rid) throw new Error("레포지토리를 먼저 선택해주세요.");
        try {
            const st = await api.repos.status(rid);
            if (st?.remote) return true;
        } catch {}
        const mem = getRemoteMem(rid);
        if (mem && mem.url && mem.name) {
            try {
                await api.repos.connectRemote(rid, { url: mem.url, name: mem.name });
                return true;
            } catch {}
        }
        setRemoteModalOpen(true);
        setToast("원격 저장소가 아직 연결되지 않아 연결 창을 열었어요.");
        setTimeout(() => setToast(""), 1600);
        throw new Error("원격 저장소가 연결되지 않았습니다.");
    };

    const ensureRemoteThenBranch = async (branchName) => {
        await ensureRemote();
        const result = await switchOrCreateBranch(repoIdRef.current, branchName || "main");
        if (result?.message) {
            setToast(result.message);
            setTimeout(() => setToast(""), 1200);
        }
        return result?.switched === true;
    };

    const computeTransfer = async (rid, branch, type) => {
        const g = await api.repos.graph(rid);
        const missing = findMissingCommits(g, branch, type);
        const commits = missing.map(c => ({
            hash: c?.hash || c?.id || c?.sha || c?.oid || "",
            message: c?.message || c?.msg || c?.title || "",
            files: fileListOf(c)
        })).filter(c => c.hash);
        const files = summarizeFiles(missing);
        return { type, branch, commits, files };
    };

    const handlePull = async (branchName) => {
        if (!hasRepo) return;
        setBusy(true);
        try {
            const rid = repoIdRef.current;
            const br = branchName || "main";
            const switched = await ensureRemoteThenBranch(br);
            if (!switched) setToast("브랜치 전환에 문제가 있어 현재 브랜치로 받아옵니다.");
            await refreshBranches();

            try {
                const transfer = await computeTransfer(rid, br, "pull");
                if (transfer.commits.length || transfer.files.length) {
                    dispatch({ type: "SET_TRANSFER", payload: transfer });
                    dispatch({ type: "SET_ANIMATION", payload: "pull" });
                }
                await api.repos.pull(rid);
                dispatch({ type: "GRAPH_DIRTY" });
                setStep(2);
            } catch (e) {
                if (e?.status === 409) {
                    setToast("원격이 비어있거나 브랜치가 없습니다. 먼저 파일을 담고 커밋한 뒤 올려주세요.");
                    setTimeout(() => setToast(""), 1600);
                    setStep(2);
                } else {
                    throw e;
                }
            }
        } catch (e) {
            if (e?.message === "원격 저장소가 연결되지 않았습니다.") {
                setPendingAction({ type: "pull", branch: branchName || "main" });
            } else {
                fail(e, "받아오기에 실패했어요.");
            }
        } finally {
            setBusy(false);
            setPullOpen(false);
        }
    };


    const handleAddConfirm = async (names) => {
        setOpenAdd(false);
        const rid = repoIdRef.current;
        if (!rid) return;
        let list = Array.isArray(names) ? names.filter(Boolean).map(String) : [];
        if (list.length === 0) {
            try {
                const st = await api.repos.status(rid);
                const pools = [st?.staged, st?.added, st?.created, st?.changes?.staged, st?.index, st?.cached].filter(Boolean);
                const flat = [];
                const toArray = (x)=>Array.isArray(x)?x:(x?[x]:[]);
                const nameOf = (it)=> typeof it==="string" ? it : (it?.path||it?.file||it?.name||it?.filename||"");
                for (const p of pools) toArray(p).forEach(x => { const n=nameOf(x); if(n) flat.push(n); });
                list = Array.from(new Set(flat));
            } catch {}
        }
        if (list.length === 0) {
            setToast("담을 파일이 확인되지 않았어요.");
            setTimeout(()=>setToast(""),1200);
            return;
        }
        setBusy(true);
        try {
            try { await api.repos.add(rid, list); } catch {}
            dispatch({ type: "ADD_SELECTED", payload: list });
            setStep(3);
            setToast(`${list.length}개 파일을 담았어요.`);
            setTimeout(()=>setToast(""),1200);
        } catch (e) {
            fail(e, "파일 담기에 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    const handleCommit = async () => {
        const text = msg.trim();
        if (!hasRepo || !text) return;
        if (state.stagingArea.length === 0) {
            setToast("담은 파일이 없어요.");
            setTimeout(() => setToast(""), 1200);
            return;
        }
        setBusy(true);
        try {
            const rid = repoIdRef.current;
            await api.repos.commit(rid, text);
            dispatch({ type: "COMMIT_SUCCESS", message: text });
            dispatch({ type: "GRAPH_DIRTY" });
            setMsg("");
            setStep(4);
        } catch (e) {
            fail(e, "버전 저장에 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    const handlePush = async (branchName) => {
        if (!hasRepo) return;
        setBusy(true);
        try {
            const rid = repoIdRef.current;
            const br = branchName || "main";
            const switched = await ensureRemoteThenBranch(br);
            if (!switched) setToast("브랜치 전환에 문제가 있어 현재 브랜치로 올립니다.");
            await refreshBranches();
            const transfer = await computeTransfer(rid, br, "push");
            dispatch({ type: "SET_TRANSFER", payload: transfer });
            dispatch({ type: "SET_ANIMATION", payload: "push" });
            await api.repos.push(rid);
            dispatch({ type: "GRAPH_DIRTY" });
            setStep(1);
            setToast("원격으로 올렸어요.");
            setTimeout(() => setToast(""), 1200);
        } catch (e) {
            if (e?.message === "원격 저장소가 연결되지 않았습니다.") {
                setPendingAction({ type: "push", branch: branchName || "main" });
            } else {
                fail(e, "올리기에 실패했어요.");
            }
        } finally {
            setBusy(false);
            setPushOpen(false);
        }
    };

    const lock1 = step !== 1 || !hasRepo;
    const lock2 = step !== 2 || !hasRepo;
    const lock3 = step !== 3 || !hasRepo;
    const lock4 = step !== 4 || !hasRepo;

    return (
        <>
            <div className="panel">
                <h3>동작</h3>
                <p className="panel-sub">① 원격에서 받아오기 → ② 파일 담기 → ③ 메시지 쓰고 저장 → ④ 원격으로 올리기</p>

                <div className="controls">
                    <div className="combo-wrap">
                        <button
                            className={`btn btn-primary btn-combo ${lock1 ? "btn-locked" : ""}`}
                            onClick={() => guard(1, () => setPullOpen(!pullOpen))}
                        >
                            <span className="combo-text">{selPull}</span>
                            <span className="split-suffix">에서 받아오기</span>
                        </button>
                        {pullOpen && step === 1 && (
                            <div className="combo-menu">
                                {branches.map((b) => (
                                    <button
                                        key={b}
                                        className={`combo-item ${b === selPull ? "active" : ""}`}
                                        onClick={() => {
                                            setSelPull(b);
                                            handlePull(b);
                                        }}
                                    >
                                        {b}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button className={`btn ${lock2 ? "btn-locked" : ""}`} onClick={() => guard(2, () => setOpenAdd(true))}>
                        파일 담기
                    </button>

                    <div style={{ position: "relative" }}>
                        <input
                            className="input"
                            placeholder="커밋 메시지"
                            value={msg}
                            onChange={(e) => setMsg(e.target.value)}
                            style={{ flex: 1, minWidth: 220, maxWidth: 320 }}
                            readOnly={lock3}
                        />
                        {lock3 && <div onClick={() => guard(3, () => {})} style={{ position: "absolute", inset: 0, cursor: "not-allowed", borderRadius: 10 }} />}
                    </div>

                    <button
                        className={`btn btn-success ${lock3 || state.stagingArea.length === 0 || !msg.trim() ? "btn-locked" : ""}`}
                        onClick={() => guard(3, handleCommit)}
                    >
                        버전 저장
                    </button>

                    <div className="combo-wrap">
                        <button
                            className={`btn btn-primary btn-combo ${lock4 ? "btn-locked" : ""}`}
                            onClick={() => guard(4, () => setPushOpen(!pushOpen))}
                        >
                            <span className="combo-text">{selPush}</span>
                            <span className="split-suffix">으로 올리기</span>
                        </button>
                        {pushOpen && step === 4 && (
                            <div className="combo-menu">
                                {branches.map((b) => (
                                    <button
                                        key={b}
                                        className={`combo-item ${b === selPush ? "active" : ""}`}
                                        onClick={() => {
                                            setSelPush(b);
                                            handlePush(b);
                                        }}
                                    >
                                        {b}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <StagingSummary
                    files={state.stagingArea}
                    onRemove={(name) => dispatch({ type: "REMOVE_FROM_STAGING", payload: name })}
                />
            </div>

            <AddModal
                open={openAdd}
                onCancel={() => setOpenAdd(false)}
                onConfirm={handleAddConfirm}
                workingDirectory={state.workingDirectory}
                staged={state.stagingArea}
            />

            <RemoteConnectModal
                open={remoteModalOpen}
                onClose={() => setRemoteModalOpen(false)}
                repoId={safeRepoId}
                onConnected={async (info) => {
                    setRemoteModalOpen(false);
                    if (info?.url && info?.name) setRemoteMem(repoIdRef.current, info);
                    const act = pendingAction;
                    setPendingAction(null);
                    if (!act) return;
                    if (act.type === "pull") {
                        await handlePull(act.branch || "main");
                    } else if (act.type === "push") {
                        await handlePush(act.branch || "main");
                    }
                }}
            />

            {toast && <div className="step-toast">{toast}</div>}
        </>
    );
}
