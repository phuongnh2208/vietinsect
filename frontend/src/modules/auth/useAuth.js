import { useState } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../../services/auth.service";
import useAuthStore from "../../stores/auth.store";
import { setLogoutHandler } from "../../services/http";

function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const setAuth = useAuthStore((state) => state.setAuth);
  const logoutStore = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  async function login(username, password) {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.login(username, password);
      // result = { accessToken, user } — refreshToken đã nằm trong HttpOnly cookie
      setAuth(result.user, result.accessToken);

      // Đăng ký logout handler cho http interceptor để tránh circular import
      setLogoutHandler(() => {
        logoutStore();
        navigate("/login");
      });

      navigate("/admin/dashboard");
      return { ok: true };
    } catch (err) {
      const message = err.response?.data?.message || "Đăng nhập thất bại";
      setError(message);
      return { ok: false, error: message };
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await authService.logout(); // Revoke refresh token trên server
    } catch {
      // Bỏ qua lỗi logout — vẫn clear state local
    }
    logoutStore();
    navigate("/login");
  }

  return { login, logout, loading, error };
}

export default useAuth;
