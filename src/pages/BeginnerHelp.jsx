import React, { useState } from "react";

// 페이지별 콘텐츠 정의
const pages = [
    {
        title: "✨ Mobabi 시작하기",
        content: (
            <>
                <strong>Mobabi에 오신 것을 환영합니다!</strong>
                <p>Mobabi는 여러분의 작업을 안전하게 저장하고 관리할 수 있도록 도와주는 도구입니다.</p>
                <p>복잡한 용어는 걱정하지 마세요.</p>
                <p>이 가이드에서 차근차근 알려드릴게요! '다음' 버튼을 눌러 시작해보세요!</p>
            </>
        )
    },
    {
        title: "📊 화면 이해하기",
        content: (
            <>
                <h5><strong>1. 내 작업 공간 vs 서버 공간</strong></h5>
                <p>화면 중앙의 그래프를 볼까요?</p>
                <ul>
                    <li><strong>왼쪽</strong>: 내 컴퓨터에 저장된 작업</li>
                    <li><strong>오른쪽</strong>: 서버에 저장된 작업</li>
                </ul>
                <p>내가 작업한 내용은 먼저 내 컴퓨터에 저장되고, 나중에 서버로 복사할 수 있어요!</p>

                <h5><strong>2. 동그라미는 저장된 순간을 나타내요</strong></h5>
                <p>그래프의 <strong>동그라미</strong> 하나하나가 '한 번 저장한 순간'이에요.</p>
                <ul>
                    <li><strong>동그라미 색상</strong>: 어느 버전에 속하는지 보여줘요 (예: main 버전은 파란색)</li>
                    <li><strong>HEAD 표시</strong>: 지금 내가 작업 중인 위치에는 별도 표시가 따로 붙어있어요</li>
                </ul>
            </>
        )
    },
    {
        title: "🌿 여러 버전으로 작업하기",
        content: (
            <>
                <h5><strong>여러 가지 시도를 동시에 할 수 있어요</strong></h5>
                <p>예를 들어볼게요:</p>
                <ul>
                    <li>원래 작업은 그대로 두고</li>
                    <li>'새로운 기능 추가'라는 별도 버전을 만들어서</li>
                    <li>실험해볼 수 있어요!</li>
                </ul>
                <p>실험이 성공하면 나중에 원래 작업에 합칠 수 있답니다.</p>

                <h5><strong>선으로 연결되어 있어요</strong></h5>
                <p>동그라미들을 잇는 선은 저장한 순서와 관계를 보여줘요.</p>
                <ul>
                    <li><strong>실선</strong>: 일반적인 작업 순서를 나타내요</li>
                    <li><strong style={{borderBottom:"2px dotted #9aa3b2"}}>점선</strong>: 다른 버전을 하나로 합친 관계(병합)를 나타내요</li>
                    <li><strong>선의 색상</strong>: 각 버전마다 다른 색으로 표시돼요 (예: main은 파란색)</li>
                </ul>
            </>
        )
    },
    {
        title: "🚶 작업 순서 알아보기",
        content: (
            <>
                <h5><strong>작업 순서를 쉽게 알 수 있어요</strong></h5>
                <p>상단에 있는 4개 버튼을 순서대로 누르면 기본 작업이 완료돼요!</p>
                <ol>
                    <li><strong>① 최신 내용 가져오기</strong><br/>서버에 있는 다른 사람의 작업을 내 컴퓨터로 가져와요</li>

                    <li><strong>② 파일 담기</strong><br/>변경한 파일 중에서 저장할 파일을 골라 담아요 (쇼핑 장바구니처럼!)</li>

                    <li><strong>③ 저장하기</strong><br/>담은 파일들을 묶어서 내 컴퓨터에 저장해요<br/>(무슨 작업인지 간단히 메모도 남겨요)</li>

                    <li><strong>④ 서버에 올리기</strong><br/>내 컴퓨터에 저장한 내용을 서버로 복사해서<br/>다른 사람도 볼 수 있게 만들어요</li>
                </ol>
                <p>이 순서를 반복하면서 작업하면 돼요!</p>
            </>
        )
    },
    {
        title: "🤖 AI Helpper",
        content: (
            <>
                <h5><strong>AI가 충돌을 도와줄 수 있어요</strong></h5>
                <p>
                    여러 사람이 같이 작업하다 보면, <br/>같은 부분을 서로 다르게 수정해서 충돌이 일어날 수 있어요.
                </p>
                <p>
                    걱정 마세요! <strong>Mobabi의 AI가 자동으로 해결 방법을 찾아서 제안</strong>해 줄 거예요.
                </p>
                <ul>
                    <li>충돌이 발생하면 AI가 알아서 분석해요</li>
                    <li>AI가 제안한 해결 방법을 클릭 한 번으로 적용할 수 있어요</li>
                    <li>복잡한 문제도 쉽게 해결할 수 있답니다!</li>
                </ul>
                <p>이제 Mobabi와 함께 편하게 작업해보세요! 😊</p>
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