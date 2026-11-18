import { create } from "zustand";

// SRS §3.4 + §5.2: accessToken lưu in-memory (Zustand), KHÔNG localStorage.
// refreshToken lưu trong HttpOnly cookie — server set, JS không đọc được.
const useAuthStore = create((set) => ({
  user: null,
  token: null,           // accessToken in-memory
  isAuthenticated: false,

  setAuth: (user, token) => {
    set({ user, token, isAuthenticated: !!token });
  },

  // Dùng khi interceptor nhận được accessToken mới từ /auth/refresh
  setToken: (token) => {
    set({ token });
  },

  logout: () => {
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

export default useAuthStore;
