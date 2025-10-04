// 공통 axios 인스턴스: 토큰 자동 첨부, 에러 공통 처리
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || ""; // 예: "/mobabi/app"

// withCredentials가 필요하면 true로
export const api = axios.create({
    baseURL: API_BASE,
    withCredentials: false,
});

// 런타임에서 토큰 세팅/삭제
export function setAuthToken(token) {
    if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        localStorage.setItem("access_token", token);
    } else {
        delete api.defaults.headers.common.Authorization;
        localStorage.removeItem("access_token");
    }
}

// 새로고침 시 저장된 토큰 복구
const saved = localStorage.getItem("access_token");
if (saved) setAuthToken(saved);

// (선택) 공통 에러 로깅
api.interceptors.response.use(
    (res) => res,
    (err) => {
        // 401 등 처리
        return Promise.reject(err);
    }
);
