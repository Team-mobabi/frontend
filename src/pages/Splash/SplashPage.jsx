import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/styles/logo.png";

export default function SplashPage() {
    const nav = useNavigate();

    return (
        <div className="splash">
            <header className="splash-header">
                <div className="splash-brand">
                    <img src={logo} alt="mobabi" />
                    <span>mobabi</span>
                </div>
                <div className="splash-actions">
                    <button className="btn btn-primary" onClick={() => nav("/login")}>로그인</button>
                </div>
            </header>

            <main className="splash-hero">
                <div className="splash-copy">
                    <h1>명령어 없이 배우는 <span className="accent">Git 시각화</span></h1>
                    <p className="lead">
                        초보자도 이해할 수 있는 Git 학습 환경.<br />
                        Pull → Add → Commit → Push 단계를 직관적으로 경험하세요.
                    </p>
                    <div className="cta-row">
                        <button className="btn btn-primary" onClick={() => nav("/signup")}>회원가입</button>
                    </div>
                    <div className="trust">
                        <span className="chip">단계별 시각화</span>
                        <span className="chip">한눈에 브랜치 흐름</span>
                        <span className="chip">GitHub 원격 연동</span>
                    </div>
                </div>

                <div className="workflow-card">
                    <div className="wf-header">이 흐름을 도와줘요</div>
                    <div className="wf-timeline">
                        <div className="wf-step">
                            <div className="wf-icon">⬇️</div>
                            <div className="wf-info">
                                <strong>Pull</strong>
                                <p>원격 저장소에서 최신 변경 사항을 가져옵니다.</p>
                            </div>
                        </div>
                        <div className="wf-connector" />
                        <div className="wf-step">
                            <div className="wf-icon">📂</div>
                            <div className="wf-info">
                                <strong>Add</strong>
                                <p>수정된 파일을 스테이징 영역에 담습니다.</p>
                            </div>
                        </div>
                        <div className="wf-connector" />
                        <div className="wf-step">
                            <div className="wf-icon">📝</div>
                            <div className="wf-info">
                                <strong>Commit</strong>
                                <p>변경 내용을 버전으로 기록합니다.</p>
                            </div>
                        </div>
                        <div className="wf-connector" />
                        <div className="wf-step">
                            <div className="wf-icon">⬆️</div>
                            <div className="wf-info">
                                <strong>Push</strong>
                                <p>로컬 변경사항을 원격 저장소로 업로드합니다.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <section className="splash-features">
                <div className="feat">
                    <div className="feat-head">원격 연결</div>
                    <div className="feat-body">GitHub 주소만 붙여넣으면 바로 연결됩니다.</div>
                </div>
                <div className="feat">
                    <div className="feat-head">시각화</div>
                    <div className="feat-body">브랜치와 커밋이 한눈에 보입니다.</div>
                </div>
                <div className="feat">
                    <div className="feat-head">안전한 푸시</div>
                    <div className="feat-body">upstream 설정도 자동으로 처리됩니다.</div>
                </div>
            </section>

            <footer className="splash-footer">
                <div>© {new Date().getFullYear()} mobabi</div>
                <div className="foot-links">
                    <a href="#" onClick={(e)=>e.preventDefault()}>이용약관</a>
                    <a href="#" onClick={(e)=>e.preventDefault()}>개인정보</a>
                </div>
            </footer>
        </div>
    );
}
