import axios from "axios";
import useAuthStore from "../stores/auth.store";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true, // Gửi HttpOnly cookie trong mọi request (SRS §3.4)
});

function isAdminRouteContext() {
  if (typeof window === "undefined" || !window.location) return false;
  return window.location.pathname.startsWith("/admin");
}

function isAuthEndpoint(url) {
  return typeof url === "string" && url.includes("/auth/");
}

// Request: chỉ gắn accessToken ở ngữ cảnh /admin (hoặc endpoint /auth/*); route public không gửi Bearer token và gửi X-View-As: public (DEF-051, DEF-090)
http.interceptors.request.use((config) => {
  const inAdminContext = isAdminRouteContext();
  if (inAdminContext || isAuthEndpoint(config.url)) {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } else {
    if (config.headers && "Authorization" in config.headers) {
      delete config.headers.Authorization;
    }
    config.headers["X-View-As"] = "public";
  }
  return config;
});

// BUG #2: inject logout handler để tránh circular import giữa http.js và store.
let _logoutFn = null;
export function setLogoutHandler(fn) {
  _logoutFn = fn;
}

// Trạng thái refresh để tránh nhiều request cùng gọi /auth/refresh song song.
let _isRefreshing = false;
let _refreshQueue = []; // { resolve, reject }[]

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Nếu 401 và chưa retry lần nào → thử dùng refreshToken trong cookie
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Không retry request đến /auth/login hoặc /auth/refresh
      if (
        originalRequest.url?.includes("/auth/refresh") ||
        originalRequest.url?.includes("/auth/login")
      ) {
        if (originalRequest.url?.includes("/auth/refresh") && _logoutFn) {
          _logoutFn();
        }
        return Promise.reject(error);
      }

      if (_isRefreshing) {
        // Queue request đang chờ — resolve khi refresh xong
        return new Promise((resolve, reject) => {
          _refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return http(originalRequest);
        });
      }

      originalRequest._retry = true;
      _isRefreshing = true;

      try {
        // withCredentials đã được set ở instance, cookie tự gửi kèm
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        const newToken = data.data.accessToken;

        // Cập nhật token mới (và thông tin user nếu có) vào store (in-memory)
        useAuthStore.getState().setToken(newToken, data.data.user);

        // Giải phóng queue
        _refreshQueue.forEach(({ resolve }) => resolve(newToken));
        _refreshQueue = [];

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return http(originalRequest);
      } catch (refreshError) {
        _refreshQueue.forEach(({ reject }) => reject(refreshError));
        _refreshQueue = [];
        // Refresh thất bại → logout sạch
        if (_logoutFn) _logoutFn();
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default http;
