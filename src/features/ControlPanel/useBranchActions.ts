import { useState } from "react";
import { useGit } from "../GitCore/GitContext";
import { api, errorMessage } from "../../lib/api";
import { useToast } from "../../components/Toast/ToastProvider";
import type { Id } from "../../types/api";
import { normalizeBranchList } from "./gitTransfer";

interface Options {
    repoId: Id | null;
    setBusy: (busy: boolean) => void;
    /** 메뉴를 닫는 등 작업 시작 전 처리 */
    onBeforeAction?: () => void;
}

// 작업 버전(브랜치) 목록 / 선택 / 생성 / 삭제
export function useBranchActions({ repoId, setBusy, onBeforeAction }: Options) {
    const { dispatch } = useGit();
    const toast = useToast();
    const [branches, setBranches] = useState<string[]>(["main"]); // 작업 버전 목록
    const [selBranch, setSelBranch] = useState("main"); // 선택된 작업 버전

    const fail = (e: unknown, fb: string) => toast.show(errorMessage(e, fb), "error");

    // '새 작업 버전 만들기' 처리
    const createBranch = async () => {
        onBeforeAction?.();
        const newBranchName = prompt(`현재 '${selBranch}' 버전에서 시작하는 새 작업 버전의 이름을 입력하세요:`)?.trim();
        if (!newBranchName || !repoId) return; // 취소 또는 빈 이름
        setBusy(true);
        try {
            await api.branches.create(repoId, { name: newBranchName, from: selBranch });
            setBranches(normalizeBranchList(await api.branches.list(repoId)));
            // 새로 만든 브랜치로 전환
            await api.branches.switch(repoId, newBranchName);
            setSelBranch(newBranchName);
            await api.repos.graph(repoId);
            dispatch({ type: "GRAPH_DIRTY" });
            toast.show(`'${newBranchName}' 작업 버전을 만들었습니다!`, "success");
        } catch (e) {
            fail(e, "새 작업 버전을 만드는 데 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    // '작업 버전 삭제' 처리
    const deleteBranch = async (branchName: string) => {
        onBeforeAction?.();
        if (!repoId) return;
        if (branchName === "main") {
            toast.show("'main' 기본 버전은 삭제할 수 없습니다.", "error");
            return;
        }
        if (!window.confirm(`'${branchName}' 작업 버전을 정말로 삭제하시겠습니까?\n(서버에 있는 버전은 삭제되지 않습니다.)`)) return;
        setBusy(true);
        try {
            await api.branches.remove(repoId, branchName);
            toast.show(`'${branchName}' 작업 버전을 삭제했습니다.`, "success");
            setBranches((prev) => prev.filter((b) => b !== branchName));
            if (selBranch === branchName) {
                // 삭제된 버전을 보고 있었다면 'main'으로 이동
                setSelBranch("main");
                await api.branches.switch(repoId, "main");
            }
            dispatch({ type: "GRAPH_TICK" });
        } catch (e) {
            fail(e, "작업 버전을 삭제하는 데 실패했어요.");
        } finally {
            setBusy(false);
        }
    };

    return { branches, setBranches, selBranch, setSelBranch, createBranch, deleteBranch };
}
