import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/styles/logo.png";

// 액션 버튼 목업 컴포넌트 (클래스 추가)
const ActionButtonsMockup = () => (
    <div className="action-buttons-mockup">
        <button className="btn btn-mockup btn-mockup-pull">main 에서 받아오기 ▼</button>
        <button className="btn btn-mockup btn-mockup-add">파일 담기</button>
        <button className="btn btn-mockup btn-mockup-commit">현재 상태 저장</button>
        <button className="btn btn-mockup btn-mockup-push primary">main 으로 올리기 ▼</button>
    </div>
);

export default function SplashPage() {
    const nav = useNavigate();

    // --- 나머지 SplashPage 코드는 이전과 동일하게 유지 ---
    // ... (header, splash-hero, splash-copy, sv-card 등) ...
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
                    <h1>복잡한 버전관리,<br /><span className="accent">mobabi가 <br />해결해 드립니다.</span></h1>
                    <p className="lead">
                        명령어 없이 버튼만으로 브랜치를 관리하고, <br />
                        똑똑한 AI 충돌 해결 기능으로 버전 관리 프로그램을 손쉽게 <br />
                        이용해보세요.
                    </p>
                    <div className="cta-row">
                        <button className="btn btn-primary" onClick={() => nav("/signup")}>무료로 시작하기</button>
                    </div>
                    <div className="trust">
                        <span className="chip">AI 충돌 해결</span>
                        <span className="chip">실시간 Git 그래프</span>
                        <span className="chip">쉬운 브랜치 관리</span>
                        <span className="chip">원격 저장소 연동</span>
                    </div>
                </div>

                <div className="sv-card">
                    <div className="sv-title">간편한 Git 워크플로우</div>
                    <div className="sv-action-buttons-area">
                        <ActionButtonsMockup />
                    </div>
                    <div className="sv-steps" style={{ marginTop: '1.5rem' }}>
                        <div className="sv-step">
                            <div className="dot" style={{ background: 'var(--accent)' }} />
                            <div className="txt">원격 저장소에서 최신 변경사항 받아오기 (Pull)</div>
                        </div>
                        <div className="sv-step">
                            <div className="dot" style={{ background: 'var(--blue, #3b82f6)' }} /> {/* --blue 변수 또는 기본값 */}
                            <div className="txt">수정한 파일을 스테이징 영역에 담기 (Add)</div>
                        </div>
                        <div className="sv-step">
                            <div className="dot" style={{ background: 'var(--success)'}} />
                            <div className="txt">메시지와 함께 변경 내역 저장 (Commit)</div>
                        </div>
                        <div className="sv-step">
                            <div className="dot" style={{ background: 'var(--warn)'}} />
                            <div className="txt">로컬 저장소의 변경 사항을 원격에 올리기 (Push)</div>
                        </div>
                    </div>
                </div>
            </main>

            <section className="splash-features">
                {/* ... features 섹션 내용 ... */}
                <div className="feat">
                    <div className="feat-head">직관적인 시각화</div>
                    <div className="feat-body">복잡한 Git 이력을 그래프로 한눈에 파악하고, <br />
                        브랜치와 커밋의 흐름을 쉽게 이해하세요.</div>
                </div>
                <div className="feat">
                    <div className="feat-head">강력한 AI 충돌 해결</div>
                    <div className="feat-body">까다로운 병합 충돌도 AI가 분석하여 <br />최적의 해결책을 제안합니다. <br />
                        더 이상 충돌을 두려워하지 마세요.</div>
                </div>
                <div className="feat">
                    <div className="feat-head">Local & Remote 관리</div>
                    <div className="feat-body">로컬 작업과 원격 저장소의 차이점을 실시간으로 비교하며 <br />안전하게 작업을 동기화할 수 있습니다.</div>
                </div>
            </section>

            <footer className="splash-footer">
                {/* ... footer 내용 ... */}
                <div>© {new Date().getFullYear()} mobabi</div>
                <div className="foot-links">
                    <a href="#" onClick={(e) => e.preventDefault()}>이용약관</a>
                    <a href="#" onClick={(e) => e.preventDefault()}>개인정보 처리방침</a>
                </div>
            </footer>
        </div>
    );
}