import React, { useEffect } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import useAuthStore from "../../stores/auth.store";
import authService from "../../services/auth.service";
import { setLogoutHandler } from "../../services/http";
import LoadingState from "../../components/ui/LoadingState";

function AuthGuard() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initialized = useAuthStore((state) => state.initialized);
  const setAuth = useAuthStore((state) => state.setAuth);
  const markInitialized = useAuthStore((state) => state.markInitialized);
  const logoutStore = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  // Đảm bảo interceptor 401 luôn có logout handler kể cả sau khi F5 khôi phục phiên
  useEffect(() => {
    setLogoutHandler(() => {
      logoutStore();
      navigate("/login", { replace: true });
    });
  }, [logoutStore, navigate]);

  // Tự động khôi phục phiên đăng nhập từ HttpOnly cookie khi reload trang (F5)
  useEffect(() => {
    if (initialized || isAuthenticated) return;

    let active = true;
    authService
      .refreshSession()
      .then((result) => {
        if (!active) return;
        if (result?.accessToken) {
          setAuth(result.user || null, result.accessToken);
        } else {
          markInitialized();
        }
      })
      .catch(() => {
        if (active) markInitialized();
      });

    return () => {
      active = false;
    };
  }, [initialized, isAuthenticated, setAuth, markInitialized]);

  if (!initialized && !isAuthenticated) {
    return (
      <div className="page-container page-content">
        <div className="card panel">
          <LoadingState label="Đang khôi phục phiên quản trị..." />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default AuthGuard;
