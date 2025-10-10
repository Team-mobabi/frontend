import React, { useEffect, useRef, useState } from "react";
import { useGit } from "../../features/GitCore/GitContext";
import { api } from "../../features/API";
import StagingSummary from "./StagingSummary";
import RemoteConnectModal from "../../features/ControlPanel/RemoteConnectModal.jsx";

const STEP_LABEL = { 1: "원격에서 받아오기", 2: "파일 담기", 3: "메시지 쓰고 저장", 4: "원격으로 올리기" };

export default function ActionButtons() {
    const { state, dispatch } = useGit();
    const repoId = state.selectedRepoId;

    const [step, setStep] = useState(1);
    const [pullOpen, setPullOpen] = useState(false);
    const [pushOpen, setPushOpen] = useState(false);
    const [showRemote, setShowRemote] = useState(false);

    const [msg, setMsg] = useState("");
    const [toast, setToast] = useState("");
    const [busy, setBusy] = useState(false);

    const [branches, setBranches] = useState(["main"]);
    const [selPull, setSelPull] = useState("main");
    const [selPush, setSelPush] = useState("main");

    const [pendingAfterRemote, setPendingAfterRemote] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!repoId) return;
        (async () => {
            try {
                const list = await api.branches.list(repoId);
                const names = Array.isArray(list) ? list : Object.keys(list || { main: [] });
                setBranches(names.length ? names : ["main"]);
                if (!names.includes(selPull)) setSelPull(names[0] || "main");
                if (!names.includes(selPush)) setSelPush(names[0] || "main");
            } catch {
                setBranches(["main"]);
                setSelPull("main");
                setSelPush("main");
            }
        })();
    }, [repoId]);

    useEffect(() => {
        setStep(1);
        setMsg("");
        setPullOpen(false);
        setPushOpen(false);
    }, [repoId]);

    const showToast = (t, ms = 1600) => {
        setToast(t);
        setTimeout(() => setToast(""), ms);
    };

    const guard = (targetStep, fn) => {
        if (!repoId) {
            showToast("레포지토리를 먼저 선택해주세요.", 1500);
            return;
        }
        if (step !== targetStep) {
            showToast(`먼저 “${STEP_LABEL[step]}”를 진행해주세요!`, 1600);
            return;
        }
        if (busy) return;
        fn();
    };

    const fail = (e, fb) => {
        const m = e?.data?.message || e?.message || fb || "오류가 발생했어요.";
        showToast(m, 2200);
    };

    const ensureBranch = async (branchName) => {
        const list = await api.branches.list(repoId);
        const names = Array.isArray(list) ? list : Object.keys(list || {});
        if (!names.includes(branchName)) await api.branches.create(repoId, branchName);
        await api.branches.switch(repoId, branchName);
    };

    const handlePull = async (branchName) => {
        if (!repoId) return;
        setBusy(true);
        try {
            const st = await api.repos.status(repoId);
            if (!st?.remote) {
                setPendingAfterRemote({ type: "pull", branch: branchName || "main" });
                setShowRemote(true);
                return;
            }
            await ensureBranch(branchName || "main");
            await api.repos.pull(repoId);
            setStep(2);
        } catch (e) {
            fail(e, "받아오기에 실패했어요.");
        } finally {
            setBusy(false);
            setPullOpen(false);
        }
    };

    const openFilePicker = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
        }
    };

    const onFilesChosen = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length || !repoId) return;
        setBusy(true);
        try {
            const fd = new FormData();
            for (const f of files) fd.append("files", f, f.name);
            const up = await api.request("POST", `/repos/${repoId}/add`, fd);
            let saved = Array.isArray(up) ? up : (up?.saved || up?.paths || up?.files || up?.savedPaths || up?.added || []);
            if (!Array.isArray(saved)) saved = [];
            if (!saved.length) { showToast("업로드된 파일이 없어요."); return; }
            dispatch({ type: "ADD_SELECTED", payload: saved });
            showToast(`${saved.length}개 파일을 담았어요.`);
            setStep(3);
        } catch (err) {
            fail(err, "파일 업로드/담기에 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    const handleCommit = async () => {
        const text = msg.trim();
        if (!repoId || !text) return;
        if (state.stagingArea.length === 0) {
            showToast("담은 파일이 없어요.", 1200);
            return;
        }
        setBusy(true);
        try {
            await api.repos.commit(repoId, text);
            dispatch({ type: "COMMIT_SUCCESS", message: text });
            setMsg("");
            setStep(4);
        } catch (e) {
            fail(e, "버전 저장에 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    const handlePush = async (branchName) => {
        if (!repoId) return;
        setBusy(true);
        try {
            const st = await api.repos.status(repoId);
            if (!st?.remote) {
                setPendingAfterRemote({ type: "push", branch: branchName || "main" });
                setShowRemote(true);
                return;
            }
            await ensureBranch(branchName || "main");
            await api.request("POST", `/repos/${repoId}/push?setUpstream=true`);
            setStep(1);
            showToast("원격으로 올렸어요.", 1200);
        } catch (e) {
            fail(e, "올리기에 실패했어요.");
        } finally {
            setBusy(false);
            setPushOpen(false);
        }
    };

    const lock1 = step !== 1 || !repoId;
    const lock2 = step !== 2 || !repoId;
    const lock3 = step !== 3 || !repoId;
    const lock4 = step !== 4 || !repoId;

    return (
        <>
            <input ref={fileInputRef} type="file" multiple style={{ display:"none" }} onChange={onFilesChosen} />

            <div className="panel">
                <h3>동작</h3>
                <p className="panel-sub">① 원격에서 받아오기 → ② 파일 담기 → ③ 메시지 쓰고 저장 → ④ 원격으로 올리기</p>

                <div className="controls">
                    <div className="combo-wrap">
                        <button className={`btn btn-primary btn-combo ${lock1 ? "btn-locked" : ""}`} onClick={() => guard(1, () => setPullOpen(o=>!o))}>
                            <span className="combo-text">{selPull}</span>
                            <span className="split-suffix">에서 받아오기</span>
                        </button>
                        {pullOpen && step === 1 && (
                            <div className="combo-menu">
                                {branches.map((b) => (
                                    <button key={b} className={`combo-item ${b === selPull ? "active" : ""}`} onClick={() => setSelPull(b)}>{b}</button>
                                ))}
                                <button className="combo-item" onClick={() => handlePull(selPull)}>받아오기 실행</button>
                            </div>
                        )}
                    </div>

                    <button className={`btn ${lock2 ? "btn-locked" : ""}`} onClick={() => guard(2, openFilePicker)}>파일 담기</button>

                    <div style={{ position:"relative" }}>
                        <input className="input" placeholder="커밋 메시지" value={msg} onChange={(e)=>setMsg(e.target.value)} style={{ flex:1, minWidth:220, maxWidth:320 }} readOnly={lock3}/>
                        {lock3 && <div onClick={() => guard(3, () => {})} style={{ position:"absolute", inset:0, cursor:"not-allowed", borderRadius:10 }}/>}
                    </div>

                    <button className={`btn btn-success ${lock3 || state.stagingArea.length === 0 || !msg.trim() ? "btn-locked" : ""}`} onClick={() => guard(3, handleCommit)}>
                        버전 저장
                    </button>

                    <div className="combo-wrap">
                        <button className={`btn btn-primary btn-combo ${lock4 ? "btn-locked" : ""}`} onClick={() => guard(4, () => setPushOpen(o=>!o))}>
                            <span className="combo-text">{selPush}</span>
                            <span className="split-suffix">으로 올리기</span>
                        </button>
                        {pushOpen && step === 4 && (
                            <div className="combo-menu">
                                {branches.map((b) => (
                                    <button key={b} className={`combo-item ${b === selPush ? "active" : ""}`} onClick={() => setSelPush(b)}>{b}</button>
                                ))}
                                <button className="combo-item" onClick={() => handlePush(selPush)}>올리기 실행</button>
                            </div>
                        )}
                    </div>

                    <button className={`btn ${lock4 ? "btn-locked" : ""}`} onClick={() => guard(4, () => handlePush(selPush))} title="현재 선택 브랜치로 바로 푸시">
                        바로 올리기
                    </button>
                </div>

                <StagingSummary files={state.stagingArea} onRemove={(name) => dispatch({ type: "REMOVE_FROM_STAGING", payload: name })} />
            </div>

            <RemoteConnectModal
                open={showRemote}
                repoId={repoId}
                onClose={() => setShowRemote(false)}
                onConnected={(info) => {
                    showToast("원격이 연결되었습니다. 다음 단계로 진행합니다.");
                    const p = pendingAfterRemote;
                    setTimeout(() => {
                        if (p?.type === "pull") handlePull(p.branch);
                        if (p?.type === "push") handlePush(p.branch);
                    }, 200);
                }}
            />


            {toast && <div className="step-toast">{toast}</div>}
        </>
    );
}
