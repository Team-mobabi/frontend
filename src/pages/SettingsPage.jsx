import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { api } from "../features/API";
import Header from "../components/Header/Header";

export default function SettingsPage() {
    const nav = useNavigate();
    const { user, signout } = useAuth();
    const [activeTab, setActiveTab] = useState("password"); // "password" | "account"

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [passwordBusy, setPasswordBusy] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");

    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordError("");
        setPasswordSuccess("");

        if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
            setPasswordError("모든 필드를 입력해주세요.");
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            setPasswordError("새 비밀번호는 최소 8자 이상이어야 합니다.");
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError("새 비밀번호가 일치하지 않습니다.");
            return;
        }

        setPasswordBusy(true);
        try {
            await api.user.changePassword({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword,
            });
            setPasswordSuccess("비밀번호가 성공적으로 변경되었습니다.");
            setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (err) {
            const msg = err?.data?.message || err?.message || "비밀번호 변경에 실패했습니다.";
            setPasswordError(Array.isArray(msg) ? msg.join("\n") : msg);
        } finally {
            setPasswordBusy(false);
        }
    };

    const handleDeleteAccount = async (e) => {
        e.preventDefault();
        setDeleteError("");

        if (deleteConfirm !== user?.email) {
            setDeleteError("이메일 주소가 일치하지 않습니다.");
            return;
        }

        const confirmed = window.confirm(
            "정말로 회원 탈퇴를 진행하시겠습니까?\n이 작업은 되돌릴 수 없습니다."
        );

        if (!confirmed) return;

        setDeleteBusy(true);
        try {
            await api.user.deleteAccount();
            alert("회원 탈퇴가 완료되었습니다.");
            await signout();
        } catch (err) {
            const msg = err?.data?.message || err?.message || "회원 탈퇴에 실패했습니다.";
            setDeleteError(Array.isArray(msg) ? msg.join("\n") : msg);
        } finally {
            setDeleteBusy(false);
        }
    };

    return (
        <div className="app-container">
            <Header />
            <div className="settings-page">
                <div className="settings-container">
                    <h1 className="settings-title">계정 설정</h1>

                    {/* 탭 메뉴 */}
                    <div className="settings-tabs">
                        <button
                            className={`settings-tab ${activeTab === "password" ? "active" : ""}`}
                            onClick={() => setActiveTab("password")}
                        >
                            비밀번호 변경
                        </button>
                        <button
                            className={`settings-tab ${activeTab === "account" ? "active" : ""}`}
                            onClick={() => setActiveTab("account")}
                        >
                            회원 탈퇴
                        </button>
                    </div>

                    {/* 비밀번호 변경 탭 */}
                    {activeTab === "password" && (
                        <div className="settings-section">
                            <h2>비밀번호 변경</h2>
                            <form onSubmit={handlePasswordChange} className="settings-form">
                                <div className="form-group">
                                    <label htmlFor="currentPassword">현재 비밀번호</label>
                                    <input
                                        className="input"
                                        id="currentPassword"
                                        type="password"
                                        placeholder="현재 비밀번호"
                                        value={passwordForm.currentPassword}
                                        onChange={(e) =>
                                            setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                                        }
                                        disabled={passwordBusy}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="newPassword">새 비밀번호</label>
                                    <input
                                        className="input"
                                        id="newPassword"
                                        type="password"
                                        placeholder="새 비밀번호 (최소 8자)"
                                        value={passwordForm.newPassword}
                                        onChange={(e) =>
                                            setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                                        }
                                        disabled={passwordBusy}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="confirmPassword">새 비밀번호 확인</label>
                                    <input
                                        className="input"
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="새 비밀번호 확인"
                                        value={passwordForm.confirmPassword}
                                        onChange={(e) =>
                                            setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                                        }
                                        disabled={passwordBusy}
                                    />
                                </div>

                                {passwordError && <div className="auth-error">{passwordError}</div>}
                                {passwordSuccess && <div className="auth-success">{passwordSuccess}</div>}

                                <button className="btn btn-primary" type="submit" disabled={passwordBusy}>
                                    {passwordBusy ? "변경 중..." : "비밀번호 변경"}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* 회원 탈퇴 탭 */}
                    {activeTab === "account" && (
                        <div className="settings-section">
                            <h2>회원 탈퇴</h2>
                            <div className="danger-zone">
                                <p className="danger-warning">
                                    ⚠️ 회원 탈퇴 시 모든 데이터가 삭제되며, 이 작업은 되돌릴 수 없습니다.
                                </p>
                                <form onSubmit={handleDeleteAccount} className="settings-form">
                                    <div className="form-group">
                                        <label htmlFor="deleteConfirm">
                                            계속하려면 이메일 주소를 입력하세요: <strong>{user?.email}</strong>
                                        </label>
                                        <input
                                            className="input"
                                            id="deleteConfirm"
                                            type="text"
                                            placeholder={user?.email}
                                            value={deleteConfirm}
                                            onChange={(e) => setDeleteConfirm(e.target.value)}
                                            disabled={deleteBusy}
                                        />
                                    </div>

                                    {deleteError && <div className="auth-error">{deleteError}</div>}

                                    <button
                                        className="btn btn-danger"
                                        type="submit"
                                        disabled={deleteBusy || deleteConfirm !== user?.email}
                                    >
                                        {deleteBusy ? "탈퇴 처리 중..." : "회원 탈퇴"}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    <button className="btn btn-ghost" onClick={() => nav("/app")}>
                        돌아가기
                    </button>
                </div>
            </div>
        </div>
    );
}