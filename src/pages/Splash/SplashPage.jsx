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
                    <button className="btn btn-ghost" onClick={() => nav("/login")}>로그인</button>
                    <button className="btn btn-primary" onClick={() => nav("/signup")}>지금 시작하기</button>
                </div>
            </header>

            <main className="splash-hero">
                <div className="splash-copy">
                    <h1>Git, <span className="accent">명령어 대신 상호작용으로</span></h1>
                    <p className="lead">
                        복잡한 명령어 없이, 눈으로 보고 끌어오며 배우는 새로운 Git의 세계.<br />
                        브랜치를 만들고, 드래그하여 병합하는 모든 과정을 직접 경험하세요.
                    </p>
                    <div className="cta-row">
                        <button className="btn btn-primary" onClick={() => nav("/signup")}>무료로 시작하기</button>
                    </div>
                    <div className="trust">
                        <span className="chip">동적 애니메이션</span>
                        <span className="chip">드래그 & 드롭 병합</span>
                        <span className="chip">실시간 시각화</span>
                        <span className="chip">GitHub 원격 연동</span>
                    </div>
                </div>

                <div className="sv-card">
                    <div className="sv-title">Local & Remote</div>
                    <div className="sv-graph" style={{ height: 220 }}>
                        {/* Visual representation of the app's UI */}
                        <div className="node" style={{ left: '20%', top: '25%' }}>feat/login</div>
                        <div className="node head" style={{ left: '60%', top: '25%' }}>main</div>

                        <svg className="sv-lines" style={{ width: '100%', height: '100%' }}>
                            <path d="M 104 55 C 150 55, 150 110, 290 110" />
                            <path d="M 290 55 v 110" />
                        </svg>

                        <div className="node" style={{ left: '20%', top: '75%' }}>로그인 UI 완성</div>
                        <div className="node" style={{ left: '60%', top: '50%' }}>초기 설정</div>
                        <div className="node merge" style={{ left: '60%', top: '75%' }}>Merge: feat/login</div>
                    </div>
                    <div className="sv-steps" style={{ marginTop: 12 }}>
                        <div className="sv-step">
                            <div className="dot" />
                            <div className="txt">브랜치를 생성하고 작업을 커밋합니다.</div>
                        </div>
                        <div className="sv-step">
                            <div className="dot" style={{ background: 'var(--success)'}} />
                            <div className="txt">작업이 끝난 브랜치를 'main'으로 드래그하여 병합합니다.</div>
                        </div>
                        <div className="sv-step">
                            <div className="dot" style={{ background: 'var(--warn)'}} />
                            <div className="txt">완성된 작업을 원격 저장소에 푸시합니다.</div>
                        </div>
                    </div>
                </div>
            </main>

            <section className="splash-features">
                <div className="feat">
                    <div className="feat-head">직관적인 워크플로우</div>
                    <div className="feat-body">Pull부터 Push까지, Git의 전체 흐름을 애니메이션으로 명확하게 보여주어 초보자도 쉽게 따라할 수 있습니다.</div>
                </div>
                <div className="feat">
                    <div className="feat-head">강력한 브랜치 관리</div>
                    <div className="feat-body">브랜치를 만들고, 시각적으로 확인하며, 드래그 앤 드롭이라는 가장 직관적인 방식으로 브랜치를 병합할 수 있습니다.</div>
                </div>
                <div className="feat">
                    <div className="feat-head">실시간 동기화</div>
                    <div className="feat-body">GitHub 저장소 주소만으로 원격 연결을 설정하고, Local과 Remote의 차이점을 실시간으로 비교하며 안전하게 작업하세요.</div>
                </div>
            </section>

            <footer className="splash-footer">
                <div>© {new Date().getFullYear()} mobabi</div>
                <div className="foot-links">
                    <a href="#" onClick={(e)=>e.preventDefault()}>이용약관</a>
                    <a href="#" onClick={(e)=>e.preventDefault()}>개인정보 처리방침</a>
                </div>
            </footer>
        </div>
    );
}