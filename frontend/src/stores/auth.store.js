import { create } from "zustand";

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem("vietinsect_token") || null,

  setAuth: (user, token) => {
    localStorage.setItem("vietinsect_token", token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem("vietinsect_token");
    set({ user: null, token: null });
  },

  isAuthenticated: () => !!localStorage.getItem("vietinsect_token"),
}));

export default useAuthStore;
