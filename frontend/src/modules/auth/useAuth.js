import { useState } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../../services/auth.service";
import useAuthStore from "../../stores/auth.store";

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
      setAuth(result.user, result.token);
      navigate("/admin/dashboard");
      return { ok: true, result };
    } catch (err) {
      const message = err.response?.data?.message || "Đăng nhập thất bại";
      setError(message);
      return { ok: false, error: message };
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    logoutStore();
    navigate("/login");
  }

  return { login, logout, loading, error };
}

export default useAuth;
