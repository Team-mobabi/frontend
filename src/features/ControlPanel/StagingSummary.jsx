import React from 'react';
import { useGit } from '../GitCore/GitContext.jsx';
import { removeFromStaging } from '../GitCore/gitActions';
import { api } from '../API';

export default function StagingSummary({ files, repoId }) {
    const { dispatch, state } = useGit();

    const onRemove = async (name) => {
        try {
            // 서버에서 파일 삭제 (스테이징 영역에서도 자동으로 제거됨)
            if (repoId) {
                await api.repos.deleteFile(repoId, { path: name });
                
                // 상태 새로고침을 위해 그래프 버전 업데이트
                dispatch({ type: "GRAPH_DIRTY" });
                
                // 서버의 실제 상태를 가져와서 스테이징 영역 동기화
                try {
                    const status = await api.repos.status(repoId);
                    if (status?.files !== undefined) {
                        // 서버의 실제 staged 파일 목록으로 업데이트
                        const stagedFileNames = Array.isArray(status.files) 
                            ? status.files.map(f => f.path || f.file || f.name || String(f))
                            : [];
                        dispatch({ 
                            type: "SET_STAGING_AREA", 
                            payload: stagedFileNames 
                        });
                    } else {
                        // status.files가 없으면 UI에서만 제거
                        dispatch(removeFromStaging(name));
                    }
                } catch (e) {
                    console.error("[StagingSummary] 상태 새로고침 실패:", e);
                    // 에러가 나도 UI는 업데이트
                    dispatch(removeFromStaging(name));
                }
            } else {
                // repoId가 없으면 UI에서만 제거
                dispatch(removeFromStaging(name));
            }
        } catch (error) {
            console.error("[StagingSummary] 파일 제거 실패:", error);
            // 에러가 나도 UI는 업데이트
            dispatch(removeFromStaging(name));
        }
    };

    return (
        <div className="staging-panel">
            <div className="staging-head">
                <span className="staging-title">담은 파일</span>
            </div>
            {files.length === 0 ? (
                <div className="staging-empty">아직 담은 파일이 없어요</div>
            ) : (
                <div className="staging-bar">
                    {files.map((name) => (
                        <span key={name} className="chip-pill">
              {name}
                            <button
                                className="chip-x"
                                onClick={() => onRemove(name)}
                                aria-label="remove"
                            >
                ✕
              </button>
            </span>
                    ))}
                </div>
            )}
        </div>
    );
}
