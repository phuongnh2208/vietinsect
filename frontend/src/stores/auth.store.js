import { create } from "zustand";

// SRS §3.4 + §5.2: accessToken lưu in-memory (Zustand), KHÔNG localStorage.
// refreshToken lưu trong HttpOnly cookie — server set, JS không đọc được.
const useAuthStore = create((set) => ({
  user: null,
  token: null, // accessToken in-memory
  isAuthenticated: false,
  initialized: false, // Đã kiểm tra khôi phục phiên từ HttpOnly cookie hay chưa

  setAuth: (user, token) => {
    set({
      user: user || null,
      token: token || null,
      isAuthenticated: !!token,
      initialized: true,
    });
  },

  // Dùng khi interceptor nhận được accessToken mới từ /auth/refresh
  setToken: (token, user) => {
    set((state) => ({
      token: token || null,
      user: user !== undefined ? user : state.user,
      isAuthenticated: !!token,
      initialized: true,
    }));
  },

  markInitialized: () => {
    set({ initialized: true });
  },

  logout: () => {
    set({ user: null, token: null, isAuthenticated: false, initialized: true });
  },
}));

export default useAuthStore;
