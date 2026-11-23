import React, { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useAuth from "../useAuth";
import useAuthStore from "../../../stores/auth.store";
import authService from "../../../services/auth.service";
import BrandLogo from "../../../components/ui/BrandLogo";
import Icon from "../../../components/ui/Icon";
import LanguageSwitcher from "../../../components/ui/LanguageSwitcher";
import { useToast } from "../../../components/ui/ToastProvider";

export default function LoginPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, loading, error } = useAuth();
  const token = useAuthStore((state) => state.token);
  const initialized = useAuthStore((state) => state.initialized);
  const setAuth = useAuthStore((state) => state.setAuth);
  const markInitialized = useAuthStore((state) => state.markInitialized);
  const { toast } = useToast();

  useEffect(() => {
    if (initialized || token) return;
    authService
      .refreshSession()
      .then((res) => {
        if (res?.accessToken) setAuth(res.user || null, res.accessToken);
        else markInitialized();
      })
      .catch(() => markInitialized());
  }, [initialized, token, setAuth, markInitialized]);

  if (token) return <Navigate to="/admin/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    const outcome = await login(username, password);
    if (!outcome.ok) toast(outcome.error || t("toast.error"), "error");
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Link to="/" className="brand-logo-link" style={{ marginBottom: "auto" }}>
          <BrandLogo showSubtitle={true} />
        </Link>
        <div className="auth-visual-copy">
          <span className="hero-kicker">Hệ Thống Quản Trị Dữ Liệu</span>
          <h1>Dữ Liệu Đa Dạng Sinh Học Côn Trùng Việt Nam</h1>
          <p>
            Nền tảng số hóa, lưu trữ và phân tích mẫu vật, hồ sơ danh pháp, bản đồ sinh thái và dữ liệu DNA phục vụ bảo tồn bền vững.
          </p>
        </div>
        <div className="hero-editorial-footer" style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "14px" }}>
          <span className="hero-kicker" style={{ color: "#DCE8D2" }}>VietInsect Data Center · WCAG 2.1 AA</span>
        </div>
      </section>

      <section className="auth-form-pane">
        <div className="auth-card vi-page-enter">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div className="eyebrow" style={{ marginBottom: 0 }}>
              <Icon name="shield" size={14} />
              {t("common.admin")}
            </div>
            <LanguageSwitcher variant="single" />
          </div>
          <h1 className="auth-title">{t("auth.loginTitle")}</h1>
          <p className="auth-description">{t("auth.loginDescription")}</p>

          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="username">{t("auth.username")}</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder={t("form.enterValue")}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="password">{t("auth.password")}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder={t("form.enterValue")}
                required
              />
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="button button-primary auth-submit" disabled={loading}>
              <Icon name="arrow-up-right" size={16} />
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>

          <p className="form-hint">
            <Icon name="shield" size={14} />
            {t("auth.lockNotice")}
          </p>
        </div>
      </section>
    </main>
  );
}

