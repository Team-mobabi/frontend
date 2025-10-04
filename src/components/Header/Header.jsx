import React from 'react';

const Header = () => {
    return (
        <header className="app-header">
            <div className="header-content">

                <div className="user-info">
                    {/* 사용자 정보나 설정 아이콘이 들어갈 자리입니다. */}
                    <span className="text-sm text-gray-600">사용자명</span>
                </div>
            </div>
        </header>
    );
};

export default Header;