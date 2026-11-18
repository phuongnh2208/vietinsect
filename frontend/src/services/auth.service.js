import axios from "axios";
import http from "./http";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

async function login(username, password) {
  const { data } = await http.post("/auth/login", { username, password });
  return data.data; // { accessToken, user: { adminId, username, fullName } }
}

// Khử trùng lặp request khi React 19 StrictMode mount 2 lần liên tiếp lúc F5
let _restorePromise = null;

async function refreshSession() {
  if (_restorePromise) return _restorePromise;

  _restorePromise = axios
    .post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true, timeout: 10000 })
    .then(({ data }) => data.data) // { accessToken, user }
    .finally(() => {
      _restorePromise = null;
    });

  return _restorePromise;
}

async function logout() {
  // Gọi POST /api/auth/logout để server revoke refresh token trong cookie
  await http.post("/auth/logout");
}

const authService = { login, refreshSession, logout };

export default authService;
