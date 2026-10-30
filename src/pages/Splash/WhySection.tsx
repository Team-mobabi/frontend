// 랜딩: 누구를 위한 서비스이고 왜 써야 하는지 설명하는 섹션

const REASONS = [
    {
        worry: "명령어가 낯설어요",
        title: "버튼과 쉬운 말로 시작",
        body: "가져오기 · 담기 · 저장 · 올리기 버튼만 누르면 돼요. 단계 안내가 지금 해야 할 일을 알려 줍니다.",
        color: "#4B5AE4",
    },
    {
        worry: "잘못 건드릴까 봐 무서워요",
        title: "망가져도 괜찮은 연습장",
        body: "모든 작업은 서버의 연습용 저장소에서 일어나 내 컴퓨터에는 영향이 없어요. 언제든 원하는 시점으로 되돌릴 수 있어요.",
        color: "#22c55e",
    },
    {
        worry: "지금 무슨 상태인지 모르겠어요",
        title: "눈으로 보는 Git",
        body: "내 컴퓨터와 서버의 기록을 나란히 그래프로 보여 줘서, 어느 쪽이 앞서 있는지 한눈에 알 수 있어요.",
        color: "#3b82f6",
    },
    {
        worry: "협업은 해 본 적이 없어요",
        title: "팀 프로젝트 미리 체험",
        body: "가지 만들기, 변경 요청과 리뷰, 충돌 해결까지 실제 협업 흐름을 연습해요. 막히는 충돌은 AI가 풀어서 설명해 줍니다.",
        color: "#f59e0b",
    },
];

const COMMAND_MAP = [
    { button: "가져오기", command: "git pull" },
    { button: "파일 담기", command: "git add" },
    { button: "현재 상태 저장", command: "git commit" },
    { button: "올리기", command: "git push" },
    { button: "새 작업 가지", command: "git switch -c" },
    { button: "변경 요청", command: "Pull Request" },
];

export default function WhySection() {
    return (
        <section className="why" aria-labelledby="why-title">
            <div className="why-inner">
                <p className="why-eyebrow">이런 고민이 있다면</p>
                <h2 id="why-title" className="why-title">Git, 실전 전에 여기서 먼저 연습하세요</h2>
                <p className="why-lead">
                    수업 과제나 첫 팀 프로젝트에서 Git 때문에 막혀 본 적 있나요? mobabi는 Git을 처음 배우는 사람이
                    실수 걱정 없이 직접 눌러 보며 익히는 연습장입니다.
                </p>

                <div className="why-grid">
                    {REASONS.map((r) => (
                        <article key={r.title} className="why-card" style={{ ["--why-color" as string]: r.color }}>
                            <span className="why-worry">“{r.worry}”</span>
                            <h3 className="why-card-title">{r.title}</h3>
                            <p className="why-card-body">{r.body}</p>
                        </article>
                    ))}
                </div>

                <div className="why-bridge">
                    <div className="why-bridge-copy">
                        <h3>익숙해지면 진짜 명령어로</h3>
                        <p>mobabi에서 누른 버튼은 실제 Git 명령어와 그대로 이어져요. 연습한 흐름을 터미널에서도 똑같이 쓸 수 있습니다.</p>
                    </div>
                    <dl className="why-map">
                        {COMMAND_MAP.map((m) => (
                            <div key={m.command} className="why-map-row">
                                <dt>{m.button}</dt>
                                <dd><code>{m.command}</code></dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>
        </section>
    );
}
