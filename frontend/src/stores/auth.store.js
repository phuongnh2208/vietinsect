import { create } from "zustand";

const initialToken = typeof localStorage !== "undefined" ? localStorage.getItem("vietinsect_token") : null;

const useAuthStore = create((set) => ({
  user: null,
  token: initialToken || null,
  isAuthenticated: !!initialToken,

  setAuth: (user, token) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("vietinsect_token", token);
    }
    set({ user, token, isAuthenticated: !!token });
  },

  logout: () => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("vietinsect_token");
    }
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

export default useAuthStore;
