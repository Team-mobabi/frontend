import React, {useEffect, useMemo, useRef, useState} from "react";
import Toast from "../../components/Toast/Toast.jsx";
// [삭제] api, useGit 임포트 제거 (더 이상 status 안 부름)

// [삭제] Helper Functions (candidatesFromStatus 등) 모두 제거

// --- Helper Functions ---
/**
 * .gitignore 패턴에 해당하는 파일인지 확인
 * @param {File} file - 확인할 파일 객체
 * @returns {boolean} - 무시해야 하는 파일이면 true
 */
function shouldIgnoreFile(file) {
    const path = file.webkitRelativePath || file.name;
    const pathLower = path.toLowerCase();

    // 일반적인 .gitignore 패턴들
    const ignorePatterns = [
        /node_modules\//i,
        /\.git\//i,
        /\.idea\//i,
        /\.vscode\//i,
        /dist\//i,
        /build\//i,
        /coverage\//i,
        /\.next\//i,
        /\.nuxt\//i,
        /\.cache\//i,
        /\.temp\//i,
        /\.tmp\//i,
        /\.log$/i,
        /\.env$/i,
        /\.env\./i,
        /\.DS_Store$/i,
        /__pycache__\//i,
        /\.pytest_cache\//i,
        /\.mypy_cache\//i,
        /vendor\//i,
        /target\//i,
    ];

    return ignorePatterns.some(pattern => pattern.test(path));
}

/**
 * 파일 배열에서 .gitignore 패턴에 해당하는 파일들을 필터링
 * @param {File[]} files - 필터링할 파일 배열
 * @returns {{filtered: File[], ignored: number}} - 필터링된 파일과 무시된 파일 수
 */
function filterIgnoredFiles(files) {
    const filtered = [];
    let ignoredCount = 0;

    files.forEach(file => {
        if (shouldIgnoreFile(file)) {
            ignoredCount++;
            console.log('[AddModal] 무시된 파일:', file.webkitRelativePath || file.name);
        } else {
            filtered.push(file);
        }
    });

    return { filtered, ignored: ignoredCount };
}

// --- Component ---
export default function AddModal({open, onCancel, onConfirm}) {
    // [삭제] status 관련 state 모두 제거 (tab, loading, files, selected, q 등)
    const [err, setErr] = useState("");
    const [toast, setToast] = useState("");
    const [pickedFiles, setPickedFiles] = useState([]);

    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    useEffect(() => {
        if (open) {
            init();
        }
    }, [open]);

    function init() {
        setErr("");
        setPickedFiles([]);
        // [삭제] loadStatus() 호출 제거
    }

    // [삭제] status 관련 함수 모두 제거 (loadStatus, toggle, toggleAll, copyPath 등)

    function onFilePick(e) {
        const list = Array.from(e.target.files || []);
        console.log('[AddModal] 선택된 파일:', list);
        console.log('[AddModal] webkitdirectory 속성:', e.target.webkitdirectory);

        // 각 파일의 webkitRelativePath 확인
        list.forEach((f, idx) => {
            console.log(`[AddModal] 파일 ${idx + 1}:`, {
                name: f.name,
                webkitRelativePath: f.webkitRelativePath,
                size: f.size
            });
        });

        // .gitignore 패턴 필터링
        const { filtered, ignored } = filterIgnoredFiles(list);
        console.log(`[AddModal] 필터링 결과: ${filtered.length}개 파일 선택, ${ignored}개 파일 무시됨`);

        let chosen = filtered;
        let messages = [];

        // 무시된 파일이 있으면 알림
        if (ignored > 0) {
            messages.push(`${ignored}개의 파일이 자동으로 제외되었습니다. (node_modules, .git, .idea 등)`);
        }

        // 100개 제한
        if (chosen.length > 100) {
            chosen = chosen.slice(0, 100);
            messages.push("최대 100개 파일까지만 담을 수 있어요. 처음 100개만 선택됩니다.");
        }

        // 메시지 표시
        if (messages.length > 0) {
            setToast(messages.join('\n'));
        }

        setPickedFiles(chosen);

        if (e.target.webkitdirectory) {
            if (folderInputRef.current) folderInputRef.current.value = null;
        } else {
            if (fileInputRef.current) fileInputRef.current.value = null;
        }
    }

    function onDrop(e) {
        e.preventDefault();
        const list = Array.from(e.dataTransfer?.files || []);

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
            setErr("폴더 끌어다 놓기는 지원되지 않습니다. '폴더 선택' 버튼을 이용해주세요.");
            setPickedFiles([]);
        } else {
            setErr("");

            // .gitignore 패턴 필터링
            const { filtered, ignored } = filterIgnoredFiles(list);
            console.log(`[AddModal] 필터링 결과 (드롭): ${filtered.length}개 파일 선택, ${ignored}개 파일 무시됨`);

            let chosen = filtered;
            let messages = [];

            // 무시된 파일이 있으면 알림
            if (ignored > 0) {
                messages.push(`${ignored}개의 파일이 자동으로 제외되었습니다. (node_modules, .git, .idea 등)`);
            }

            // 100개 제한
            if (chosen.length > 100) {
                chosen = chosen.slice(0, 100);
                messages.push("최대 100개 파일까지만 담을 수 있어요. 처음 100개만 선택됩니다.");
            }

            // 메시지 표시
            if (messages.length > 0) {
                setToast(messages.join('\n'));
            }

            setPickedFiles(chosen);
        }
    }

    function onDragOver(e) {
        e.preventDefault();
    }

    function handleConfirm() {
        console.log("모달 확인 버튼 클릭됨!");
        // [수정] "status" 탭 분기 제거
        if (pickedFiles.length === 0) return;
        onConfirm(pickedFiles); // 항상 File 객체 배열(pickedFiles)을 전달
    }

    if (!open) return null;

    // [수정] "status" 탭 분기 제거
    const isConfirmDisabled = pickedFiles.length === 0;

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-head">
                    <h4>파일 담기 (업로드)</h4>
                    <button className="modal-close" onClick={onCancel}>×</button>
                </div>

                <div className="modal-body">
                    {/* [삭제] 탭 버튼 UI 제거 */}

                    {/* [수정] 탭 분기(ternary) 제거하고 "pick" 탭 내용만 남김 */}
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            style={{ display: "none" }}
                            onChange={onFilePick}
                        />
                        <input
                            ref={folderInputRef}
                            type="file"
                            multiple
                            style={{ display: "none" }}
                            onChange={onFilePick}
                            {...({ webkitdirectory: "", directory: "", mozdirectory: "" })}
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
                            <div style={{fontSize: 13, color: "var(--sub)", marginBottom: 8}}>여기로 파일을 끌어다 놓거나<br/>아래 버튼으로 선택하세요.</div>

                            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                <button className="btn" type="button" onClick={() => fileInputRef.current?.click()}>
                                    파일 선택
                                </button>
                                <button className="btn" type="button" onClick={() => folderInputRef.current?.click()}>
                                    폴더 선택
                                </button>
                            </div>
                        </div>

                        {err && <div style={{ color: "var(--danger)", marginBottom: '10px' }}>{err}</div>}

                        {pickedFiles.length > 0 ? (
                            <div className="push-list" style={{maxHeight: 240, overflow: "auto"}}>
                                {pickedFiles.map(f => (
                                    <div key={f.name + f.size + f.lastModified} className="push-row">
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
                </div>

                <div className="modal-actions">
                    <button className="btn" onClick={onCancel}>취소</button>
                    <button className="btn btn-primary" onClick={handleConfirm}
                            disabled={isConfirmDisabled}>
                        선택한 파일/폴더 업로드하여 담기
                    </button>
                </div>
            </div>
            {toast && (
                <Toast
                    message={toast}
                    duration={3000}
                    onClose={() => setToast("")}
                />
            )}
        </div>
    );
}