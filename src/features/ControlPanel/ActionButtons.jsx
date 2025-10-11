import React, {useEffect, useMemo, useRef, useState} from "react";
import {useGit} from "../../features/GitCore/GitContext";
import {api} from "../../features/API";
import AddModal from "./AddModal";
import StagingSummary from "./StagingSummary";
import RemoteConnectModal from "./RemoteConnectModal";
import {getRemoteMem, setRemoteMem} from "../../features/GitCore/remoteMemory";

const STEP_LABEL = {1: "원격에서 받아오기", 2: "파일 담기", 3: "메시지 쓰고 저장", 4: "원격으로 올리기"};

// ... (파일 상단에 있던 normalizeBranchList, fileListOf, findMissingCommits, summarizeFiles 함수들은 그대로 유지) ...
function normalizeBranchList(input) {
    if (!input) return ["main"];
    if (!Array.isArray(input) && Array.isArray(input.branches)) {
        return normalizeBranchList(input.branches);
    }
    if (Array.isArray(input)) {
        const names = input
            .map((b) =>
                typeof b === "string"
                    ? b
                    : (b?.name || b?.branch || b?.ref || b?.id || b?.value || "")
            )
            .filter(Boolean);
        return names.length ? names : ["main"];
    }
    const keys = Object.keys(input || {});
    return keys.length ? keys : ["main"];
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
    const lhashes = lb.map((c) => c?.hash || c?.id || c?.sha || c?.oid || "");
    const rhashes = rb.map((c) => c?.hash || c?.id || c?.sha || c?.oid || "");
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
    commits.forEach((c) => fileListOf(c).forEach((f) => set.add(String(f))));
    return Array.from(set);
}


export default function ActionButtons() {
    // ... (기존 useState, useEffect 등 hook 설정은 그대로 유지) ...
    const {state, dispatch} = useGit();
    const selectedRepoId = state.selectedRepoId;
    const safeRepoId = useMemo(
        () => (selectedRepoId == null ? "" : String(selectedRepoId).trim()),
        [selectedRepoId]
    );
    const repoIdRef = useRef("");
    useEffect(() => {
        repoIdRef.current = safeRepoId;
    }, [safeRepoId]);
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

    const [needsInitialPush, setNeedsInitialPush] = useState(false);

    const setToastAuto = (t, ms = 1600) => {
        setToast(t);
        setTimeout(() => setToast(""), ms);
    };

    const refreshBranches = async () => {
        const rid = repoIdRef.current;
        if (!rid) return;
        try {
            const list = await api.branches.list(rid);
            const names = normalizeBranchList(list?.branches ?? list);
            setBranches(names.length ? names : ["main"]);

            const nextPull = names.includes(selPull) ? selPull : (names[0] || "main");
            const nextPush = names.includes(selPush) ? selPush : (names[0] || "main");
            setSelPull(nextPull);
            setSelPush(nextPush);
        } catch {
        }
    };

    useEffect(() => {
        if (hasRepo) refreshBranches();
    }, [hasRepo, selectedRepoId]);

    useEffect(() => {
        setStep(1);
        setMsg("");
        setPullOpen(false);
        setPushOpen(false);
    }, [selectedRepoId]);

    useEffect(() => {
        if (!hasRepo) return;
        (async () => {
            try {
                const st = await api.repos.status(repoIdRef.current);
                const remoteExists = !!st?.remote || !!st?.remoteUrl || !!st?.remoteConnected;
                const remoteEmptyLike =
                    st?.remoteEmpty === true ||
                    st?.remoteCommitCount === 0 ||
                    st?.remoteHead == null ||
                    st?.commits?.length === 0;
                setNeedsInitialPush(!remoteExists || remoteEmptyLike);
            } catch {
                setNeedsInitialPush(true);
            }
        })();
    }, [hasRepo, selectedRepoId]);

    const fail = (e, fb) => {
        const where = e?.endpoint ? `\n• ${e.method || ""} ${e.endpoint}` : "";
        const status = e?.status ? ` [${e.status}]` : "";
        const raw = e?.dataRaw ? `\n${e.dataRaw}` : e?.data ? `\n${JSON.stringify(e.data).slice(0, 400)}...` : "";
        const m = (e?.data?.message || e?.message || fb || "오류가 발생했어요.").toString();
        setToast(`${m}${status}${where}${raw}`);
        setTimeout(() => setToast(""), 2600);
        console.error("[ActionButtons Error]", {
            msg: m,
            status: e?.status,
            endpoint: e?.endpoint,
            method: e?.method,
            data: e?.data,
            dataRaw: e?.dataRaw,
        });
    };

    const guard = (targetStep, fn) => {
        if (!hasRepo) {
            setToastAuto("레포지토리를 먼저 선택해주세요.");
            return;
        }
        if (step !== targetStep) {
            setToastAuto(`먼저 “${STEP_LABEL[step]}”를 진행해주세요!`);
            return;
        }
        if (busy) return;
        fn();
    };

    // ... (기존 switchOrCreateBranch, ensureServerRemote, ensureRemoteThenBranch, computeTransfer, handlePull 함수들은 그대로 유지) ...
    const switchOrCreateBranch = async (rid, branchName) => {
        const br = String(branchName || "main").trim();
        if (!br) throw new Error("브랜치 이름이 비어있습니다.");
        try {
            const res = await api.branches.switch(rid, br);
            return {created: false, switched: true, message: res?.message || ""};
        } catch (e) {
            if (e?.status === 404) {
                await api.branches.create(rid, br);
                const res2 = await api.branches.switch(rid, br);
                return {created: true, switched: true, message: res2?.message || ""};
            }
            throw e;
        }
    };
    const ensureServerRemote = async () => {
        const rid = repoIdRef.current;
        if (!rid) throw new Error("레포지토리를 먼저 선택해주세요.");
        try {
            await api.repos.connectRemoteLocal(rid, {name: "origin"});
            return true;
        } catch (e) {
            const mem = getRemoteMem(rid);
            if (mem && mem.url && mem.name) {
                try {
                    await api.repos.connectRemote(rid, {url: mem.url, name: mem.name});
                    return true;
                } catch {
                }
            }
            setRemoteModalOpen(true);
            setToastAuto("원격 저장소 연결 창을 열었어요.");
            throw new Error("원격 저장소가 연결되지 않았습니다.");
        }
    };
    const ensureRemoteThenBranch = async (branchName) => {
        await ensureServerRemote();
        const result = await switchOrCreateBranch(repoIdRef.current, branchName || "main");
        if (result?.message) setToastAuto(result.message, 1200);
        return result?.switched === true;
    };
    const computeTransfer = async (rid, branch, type) => {
        const g = await api.repos.graph(rid);
        const missing = findMissingCommits(g, branch, type);
        const commits = missing
            .map((c) => ({
                hash: c?.hash || c?.id || c?.sha || c?.oid || "",
                message: c?.message || c?.msg || c?.title || "",
                files: fileListOf(c),
            }))
            .filter((c) => c.hash);
        const files = summarizeFiles(missing);
        return {type, branch, commits, files};
    };
    const handlePull = async (branchName) => {
        if (!hasRepo) return;
        if (needsInitialPush) {
            setToastAuto("원격이 비어 있어요. 먼저 ‘초기 업로드’를 해주세요.");
            return;
        }
        setBusy(true);
        try {
            const rid = repoIdRef.current;
            const br = (branchName && String(branchName)) || "main";
            const switched = await ensureRemoteThenBranch(br);
            if (!switched) setToastAuto("브랜치 전환에 문제가 있어 현재 브랜치로 받아옵니다.");
            await refreshBranches();
            try {
                const transfer = await computeTransfer(rid, br, "pull");
                if (transfer.commits.length || transfer.files.length) {
                    dispatch({type: "SET_TRANSFER", payload: transfer});
                    dispatch({type: "SET_ANIMATION", payload: "pull"});
                }
                await api.repos.pull(rid);
                dispatch({type: "GRAPH_DIRTY"});
                setStep(2);
            } catch (e) {
                if (e?.status === 409) {
                    setToastAuto("원격이 비어있거나 브랜치가 없습니다. 먼저 파일을 담고 커밋한 뒤 올려주세요.");
                    setStep(2);
                } else throw e;
            }
        } catch (e) {
            if (e?.message === "원격 저장소가 연결되지 않았습니다.")
                setPendingAction({type: "pull", branch: branchName || "main"});
            else fail(e, "받아오기에 실패했어요.");
        } finally {
            setBusy(false);
            setPullOpen(false);
        }
    };

    // ▼▼▼ 수정된 부분 ▼▼▼
    const handleAddConfirm = async (selection) => {
        setOpenAdd(false);
        const rid = repoIdRef.current;
        if (!rid || !selection || selection.length === 0) {
            setToastAuto("담을 파일이 선택되지 않았어요.", 1200);
            return;
        }

        setBusy(true);
        try {
            // selection의 첫번째 요소가 File 객체인지 확인하여 분기
            const isFileUpload = selection[0] instanceof File;
            let addedNames = [];

            if (isFileUpload) {
                // 실제 파일 객체 배열(File[])인 경우, upload API 사용
                await api.repos.upload(rid, selection);
                addedNames = selection.map(f => f.name);
            } else {
                // 파일 이름 배열(string[])인 경우, 기존 add API 사용
                await api.repos.add(rid, selection);
                addedNames = selection;
            }

            dispatch({type: "ADD_SELECTED", payload: addedNames});
            setStep(3);
            setToastAuto(`${addedNames.length}개 파일을 담았어요.`, 1200);

        } catch (e) {
            fail(e, "파일 담기에 실패했어요.");
        } finally {
            setBusy(false);
        }
    };
    // ▲▲▲ 수정된 부분 ▲▲▲

    // ... (기존 handleCommit, quickInitialPush, handlePush 함수 및 return JSX 부분은 그대로 유지) ...
    const handleCommit = async () => {
        const text = msg.trim();
        if (!hasRepo || !text) return;
        if (state.stagingArea.length === 0) {
            setToastAuto("담은 파일이 없어요.", 1200);
            return;
        }
        setBusy(true);
        try {
            const rid = repoIdRef.current;
            await api.repos.commit(rid, text);
            dispatch({type: "COMMIT_SUCCESS", message: text});
            dispatch({type: "GRAPH_DIRTY"});
            setMsg("");
            setStep(4);
        } catch (e) {
            fail(e, "버전 저장에 실패했어요.");
        } finally {
            setBusy(false);
        }
    };
    const quickInitialPush = async () => {
        if (!hasRepo) return;
        setBusy(true);
        try {
            const rid = repoIdRef.current;
            const br = selPush || "main";

            await ensureRemoteThenBranch(br);
            await refreshBranches();

            const readmeContent = `# 초기 업로드
이 레포는 서버 업로드 API를 통해 생성되었습니다.
- 업로드 시각: ${new Date().toISOString()}
`;
            const blob = new Blob([readmeContent], {type: "text/plain"});
            const file = new File([blob], "README.md", {type: "text/plain"});

            try {
                const up = await api.repos.upload(rid, [file]);
                if (!up?.saved?.length) {
                    try {
                        await api.repos.add(rid, ["README.md"]);
                    } catch {
                    }
                }
            } catch (e) {
                const msg = (e?.data?.message || e?.message || "").toString();
                if (/already exists/i.test(msg) || e?.status === 409) {
                    console.info("[init upload] README 이미 존재. 계속 진행합니다.");
                } else {
                    console.warn("[init upload README failed] 계속 진행:", e);
                }
            }

            const message = (msg || "").trim() || "Initial commit";
            await api.repos.commit(rid, message);
            dispatch({type: "COMMIT_SUCCESS", message});
            dispatch({type: "GRAPH_DIRTY"});

            await api.repos.push(rid);

            setNeedsInitialPush(false);
            setStep(1);
            setToastAuto("✅ 초기 업로드 완료! 이제 받아오기/올리기 사용 가능해요.");
        } catch (e) {
            fail(e, "초기 업로드에 실패했어요.");
        } finally {
            setBusy(false);
        }
    };
    const handlePush = async (branchName) => {
        if (!hasRepo) return;
        setBusy(true);
        try {
            const rid = repoIdRef.current;
            const br = (branchName && String(branchName)) || "main";

            await ensureRemoteThenBranch(br);
            await refreshBranches();

            const transfer = await computeTransfer(rid, br, "push");
            if (transfer.commits.length || transfer.files.length) {
                dispatch({type: "SET_TRANSFER", payload: transfer});
                dispatch({type: "SET_ANIMATION", payload: "push"});
            }

            await api.repos.push(rid);
            dispatch({type: "GRAPH_DIRTY"});
            setStep(1);
            setToastAuto("원격으로 올렸어요.", 1200);
        } catch (e) {
            fail(e, "올리기에 실패했어요.");
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

                {/* ▼▼▼ 수정된 부분 ▼▼▼ */}
                {/* step이 1이고, 초기 업로드가 필요한 경우에만 초기 업로드 UI를 보여줍니다. */}
                {step === 1 && needsInitialPush ? (
                    <div
                        className="notice"
                        style={{
                            marginBottom: 12,
                            padding: 12,
                            borderRadius: 10,
                            background: "#fff7ed",
                            border: "1px solid #fed7aa",
                        }}
                    >
                        <div style={{fontSize: 14, lineHeight: 1.4}}>
                            🔰 원격 저장소가 비어 있어요. <b>처음 한 번은 ‘올리기(초기 업로드)’부터</b> 진행해야 합니다.
                        </div>
                        <div style={{marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap"}}>
                            <button className="btn btn-success" disabled={busy || !hasRepo} onClick={quickInitialPush}>
                                초기 업로드 먼저 하기
                            </button>
                            <button className="btn" disabled>
                                받아오기 (원격 비어있음)
                            </button>
                        </div>
                    </div>
                ) : (
                    /* 그렇지 않은 모든 경우에는 일반 컨트롤 버튼들을 보여줍니다. */
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
                                    {branches.map((b) => {
                                        const name = typeof b === "string" ? b : (b?.name || "");
                                        if (!name) return null;
                                        return (
                                            <button
                                                key={name}
                                                className={`combo-item ${name === selPull ? "active" : ""}`}
                                                onClick={() => {
                                                    setSelPull(name);
                                                    handlePull(name);
                                                }}
                                            >
                                                {name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <button
                            className={`btn ${lock2 ? "btn-locked" : ""}`}
                            onClick={() => guard(2, () => setOpenAdd(true))}
                        >
                            파일 담기
                        </button>

                        <div style={{position: "relative"}}>
                            <input
                                className="input"
                                placeholder="커밋 메시지"
                                value={msg}
                                onChange={(e) => setMsg(e.target.value)}
                                style={{flex: 1, minWidth: 220, maxWidth: 320}}
                                readOnly={lock3}
                            />
                            {lock3 && <div onClick={() => guard(3, () => {
                            })} style={{position: "absolute", inset: 0, cursor: "not-allowed", borderRadius: 10}}/>}
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
                                    {branches.map((b) => {
                                        const name = typeof b === "string" ? b : (b?.name || "");
                                        if (!name) return null;
                                        return (
                                            <button
                                                key={name}
                                                className={`combo-item ${name === selPush ? "active" : ""}`}
                                                onClick={() => {
                                                    setSelPush(name);
                                                    handlePush(name);
                                                }}
                                            >
                                                {name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* ▲▲▲ 수정된 부분 ▲▲▲ */}


                <StagingSummary
                    files={state.stagingArea}
                    onRemove={(name) => dispatch({type: "REMOVE_FROM_STAGING", payload: name})}
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
                    if (act.type === "pull") await handlePull(act.branch || "main");
                    else if (act.type === "push") await handlePush(act.branch || "main");
                }}
            />

            {toast && <div className="step-toast">{toast}</div>}
        </>
    );
}