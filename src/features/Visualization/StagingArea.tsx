interface StagingAreaProps {
    files: string[];
    animationClass?: string;
}

export default function StagingArea({ files, animationClass }: StagingAreaProps) {
    return (
        <div className={`staging-area ${animationClass || ''}`}>
            <div className="staging-title">스테이징 영역</div>
            <div className="staging-files">
                {files.length > 0 ? (
                    files.map(file => (
                        <div key={file} className="chip-pill-static">
                            <span>📄 {file}</span>
                        </div>
                    ))
                ) : (
                    <div className="staging-empty-text">파일을 담아주세요...</div>
                )}
            </div>
        </div>
    );
}
