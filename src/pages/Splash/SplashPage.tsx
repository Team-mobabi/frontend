import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/styles/logo.png";
import HeroGitFlow from "./HeroGitFlow";
import HeroBackdrop from "./HeroBackdrop";
import WhySection from "./WhySection";
import { HERO_STEP_COLORS, type HeroStep } from "./heroSteps";

const FLOW_STEPS: { step: Exclude<HeroStep, 0>; button: string; text: string; primary?: boolean }[] = [
    { step: 1, button: "main 에서 받아오기 ▼", text: "원격 저장소에서 최신 변경사항 받아오기 (Pull)" },
    { step: 2, button: "파일 담기", text: "수정한 파일을 스테이징 영역에 담기 (Add)" },
    { step: 3, button: "현재 상태 저장", text: "메시지와 함께 변경 내역 저장 (Commit)" },
    { step: 4, button: "main 으로 올리기 ▼", text: "로컬 저장소의 변경 사항을 원격에 올리기 (Push)", primary: true },
];

export default function SplashPage() {
    const nav = useNavigate();
    const [activeStep, setActiveStep] = useState<HeroStep>(0);

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
                <HeroBackdrop />
                <div className="splash-copy">
                    <h1>복잡한 버전관리,<br /><span className="accent">mobabi가 <br />해결해 드립니다.</span></h1>
                    <p className="lead">
                        Git이 처음이어도 괜찮아요. <br />
                        명령어 없이 버튼으로 직접 눌러 보며 버전 관리를 연습하고, <br />
                        막히는 충돌은 AI가 함께 풀어 드려요.
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
                    <HeroGitFlow onStep={setActiveStep} />
                    <div className="action-buttons-mockup">
                        {FLOW_STEPS.map(({ step, button, primary }) => (
                            <button
                                key={step}
                                type="button"
                                tabIndex={-1}
                                className={`btn btn-mockup${primary ? " primary" : ""}${activeStep === step ? " is-active" : ""}`}
                                style={activeStep === step ? { borderColor: HERO_STEP_COLORS[step], color: HERO_STEP_COLORS[step] } : undefined}
                            >
                                {button}
                            </button>
                        ))}
                    </div>
                    <div className="sv-steps">
                        {FLOW_STEPS.map(({ step, text }) => (
                            <div key={step} className={`sv-step${activeStep === step ? " is-active" : ""}`}>
                                <div className="dot" style={{ background: HERO_STEP_COLORS[step] }} />
                                <div className="txt">{text}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            <WhySection />

            <footer className="splash-footer">
                <div>© {new Date().getFullYear()} mobabi</div>
                <div className="foot-links">
                    <a href="#" onClick={(e) => e.preventDefault()}>이용약관</a>
                    <a href="#" onClick={(e) => e.preventDefault()}>개인정보 처리방침</a>
                </div>
            </footer>
        </div>
    );
}