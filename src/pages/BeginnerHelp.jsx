import React, { useState } from "react";

// 페이지별 콘텐츠 정의
const pages = [
    {
        title: "✨ Mobabi 시작하기",
        content: (
            <>
                <p>Mobabi에 오신 것을 환영합니다! Git이 처음이라도 걱정 마세요. Mobabi가 여러분의 작업을 쉽고 안전하게 관리하도록 도와드릴게요.</p>
                <p>이 가이드에서는 Mobabi의 핵심 기능들을 단계별로 알아볼 거예요. '다음' 버튼을 눌러 시작해보세요!</p>
            </>
        )
    },
    {
        title: "📊 그래프 읽는 법 (기본)",
        content: (
            <>
                <h5><strong>1. 내 컴퓨터(Local) vs 서버(Remote)</strong></h5>
                <p>화면 중앙 그래프의 왼쪽은 <strong>내 컴퓨터(Local)</strong>, 오른쪽은 <strong>서버(Remote)</strong> 작업 공간을 보여줘요. 내 작업은 왼쪽에 먼저 기록되고, '서버에 올리기'를 하면 오른쪽에 복사됩니다.</p>

                <h5><strong>2. 작업 기록 (Commit)</strong> 💾</h5>
                <p>그래프의 <strong>동그란 원(🔵)</strong> 하나하나가 **'작업 기록' (Commit)**이에요. '버전 저장'을 할 때마다 생기죠. 각 기록은 고유 ID를 가져요.</p>
                <ul>
                    <li><strong>초록색 테두리 원(🟢)</strong>: 현재 내가 작업 중인 최신 기록(HEAD)이에요.</li>
                    <li><strong>주황색 원(🟠)</strong>: 여러 작업 내용을 하나로 합친 특별한 기록(Merge Commit)이에요.</li>
                </ul>
            </>
        )
    },
    {
        title: "🌿 그래프 읽는 법 (버전과 선)",
        content: (
            <>
                <h5><strong>3. 동시에 여러 작업 (Branch)</strong></h5>
                <p>하나의 프로젝트에서 여러 작업을 동시에 할 때 **'작업 버전' (Branch)**을 만들어요. 예를 들어 '로그인 기능' 버전을 만들면, 원래 작업(main)에 영향을 주지 않고 안전하게 새 기능을 추가할 수 있어요.</p>
                <ul>
                    <li><strong>버전 이름표 (예: main, feature/login)</strong>: 각 버전의 마지막 기록 위치를 가리키는 이름표예요.</li>
                    <li><strong>새 버전 만들기</strong>: '가져오기' 버튼 옆 ▼ 메뉴에서 만들 수 있어요!</li>
                </ul>

                <h5><strong>4. 선의 의미</strong></h5>
                <p>원들을 잇는 선은 작업 기록의 순서와 관계를 보여줘요.</p>
                <ul>
                    <li><strong>실선</strong>: 내 컴퓨터(Local)에 저장된 기록들의 연결선이에요.</li>
                    <li><strong style={{borderBottom:"2px dotted #9aa3b2"}}>점선</strong>: 서버(Remote)에 저장된 기록들의 연결선이에요. 내 컴퓨터와 서버 내용이 다를 때 점선이 실선과 다른 경로로 나타날 수 있어요.</li>
                    <li><strong>선 색상</strong>: 보통 각 작업 버전(Branch)마다 다른 색으로 표시되어 흐름을 구분하기 쉽게 해줘요.</li>
                </ul>
            </>
        )
    },
    {
        title: "🚶‍♀️ 작업 흐름 따라하기",
        content: (
            <>
                <p>Mobabi 상단 버튼 4개를 순서대로 따라 하면 기본 작업이 완료돼요!</p>
                <ol>
                    <li><strong>[버전] 에서 가져오기 (Pull)</strong>: 다른 사람이 서버에 올린 최신 내용을 내 컴퓨터로 가져와요.</li>
                    <li><strong>파일 담기 (Add/Stage)</strong>: 수정한 파일 중 이번 버전에 포함시킬 파일을 선택해서 장바구니에 담아요.</li>
                    <li><strong>버전 저장 (Commit)</strong>: 담은 파일들을 하나의 작업 단위로 묶고, 설명을 적어 내 컴퓨터에 기록해요. (그래프에 새 원 생성!)</li>
                    <li><strong>[버전] 으로 올리기 (Push)</strong>: 내 컴퓨터에 저장한 기록들을 서버에 업로드해서 공유하거나 백업해요.</li>
                </ol>
                <p>이 과정을 반복하면서 작업하면 된답니다!</p>
            </>
        )
    },
    {
        title: "🤖 똑똑한 AI 도우미",
        content: (
            <>
                <p>
                    다른 사람과 함께 작업하다 보면 가끔 같은 파일의 같은 부분을 서로 다르게 수정해서 내용이 겹치는 문제**(Conflict)**가 발생할 수 있어요.
                </p>
                <p>
                    Mobabi는 이럴 때 당황하지 않도록 AI가 나서서 가장 좋은 해결 방법을 제안해 준답니다!
                </p>
                <ul>
                    <li>'가져오기' 또는 '병합' 시 문제가 생기면 AI가 자동으로 해결책을 보여줘요.</li>
                    <li>AI의 제안을 보고 클릭 한 번으로 복잡한 문제를 해결할 수 있어요!</li>
                </ul>
                <p>이제 Mobabi와 함께 즐겁게 Git을 경험해보세요! 😊</p>
            </>
        )
    }
];

export default function BeginnerHelp({ onClose }) {
    const [currentPage, setCurrentPage] = useState(0); // 현재 페이지 상태
    const totalPages = pages.length;

    const goToNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
    };

    const goToPrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 0));
    };

    const currentPageData = pages[currentPage];

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head help-modal-head">
                    <h4>{currentPageData.title}</h4>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body help-content help-content-paginated">
                    {currentPageData.content}
                </div>
                <div className="modal-actions help-modal-actions">
                    {/* 페이지 번호 표시 */}
                    <span className="page-number">{currentPage + 1} / {totalPages}</span>
                    <div className="pagination-buttons">
                        <button
                            className="btn btn-ghost"
                            onClick={goToPrevPage}
                            disabled={currentPage === 0} // 첫 페이지면 비활성화
                        >
                            이전
                        </button>
                        {currentPage === totalPages - 1 ? (
                            // 마지막 페이지면 '닫기' 버튼
                            <button className="btn btn-primary" onClick={onClose}>
                                도움말 닫기
                            </button>
                        ) : (
                            // 마지막 페이지 아니면 '다음' 버튼
                            <button className="btn btn-primary" onClick={goToNextPage}>
                                다음
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}