import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import UserSearchModal from "../Modal/UserSearchModal.jsx"; // 경로는 맞는지 확인!
import logoImage from '../../assets/styles/logo.png';
import {useAuth} from "../../features/auth/AuthContext.jsx"; // 경로는 맞는지 확인!

// [삭제] console.log 제거

export default function Header() {
    const nav = useNavigate();
    const { user } = useAuth(); // [추가] 로그인한 사용자 정보 가져오기
    const [modalOpen, setModalOpen] = useState(false);

    const handleSignout = () => {
        // [수정] useAuth 훅을 사용하므로 AuthContext의 logout 사용 (가정)
        // localStorage.removeItem("gitgui_token"); // 직접 제거 대신 context 사용
        // 만약 AuthContext에 logout 함수가 없다면 이전 방식 사용
        api.auth.signout(); // API 호출은 유지
        nav("/splash");
    };

    return (
        <header className="app-header">
            <Link to="/app" className="app-logo"> {/* [수정] 링크를 /app으로 */}
                <img src={logoImage} alt="Mobabi Logo" />
            </Link>
            <div className="app-title">Mobabi</div>
            <div className="app-spacer" />

            {/* [수정] '공개 레포 탐색' 버튼 */}
            <Link to="/public-repos" className="btn btn-ghost header-link-btn">
                🌍 공개 레포 탐색
            </Link>

            {/* [수정] '사용자 검색' 버튼 */}
            <button className="btn btn-ghost header-link-btn" onClick={() => setModalOpen(true)} title="사용자 검색">
                🔍 사용자 검색
            </button>

            {/* [추가] 로그인한 사용자 이메일 표시 */}
            {user?.email && <span className="user-email-display">{user.email}</span>}

            <button className="btn btn-ghost" onClick={handleSignout}>로그아웃</button>

            <UserSearchModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </header>
    );
}