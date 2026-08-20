import React, { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useAuth from "../useAuth";
import useAuthStore from "../../../stores/auth.store";
import Icon from "../../../components/ui/Icon";
import { useToast } from "../../../components/ui/ToastProvider";

export default function LoginPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, loading, error } = useAuth();
  const token = useAuthStore((state) => state.token);
  const { toast } = useToast();

  if (token) return <Navigate to="/admin/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    await login(username, password);
    if (error) toast(t("toast.error"), "error");
  }

  return (
    <main className="auth-page">
      <section className="auth-visual"><Link to="/" className="brand"><span className="brand-mark"><Icon name="bug" size={21} /></span><span><strong>VietInsect</strong><small>{t("appSubtitle")}</small></span></Link><div className="auth-visual-copy"><span className="hero-kicker">SCR-01 · Admin Login</span><h1>{t("auth.welcome")}</h1><p>Dữ liệu tự nhiên được tổ chức rõ ràng để mỗi quyết định nghiên cứu đều bắt đầu từ bằng chứng đáng tin cậy.</p></div><span className="hero-kicker" style={{ color: "rgba(255,255,255,.44)" }}>60–30–10 · Dark green design system</span></section>
      <section className="auth-form-pane"><div className="auth-card vi-page-enter"><div className="eyebrow"><Icon name="shield" size={14} />{t("common.admin")}</div><h1 className="auth-title">{t("auth.loginTitle")}</h1><p className="auth-description">{t("auth.loginDescription")}</p><form onSubmit={handleSubmit}><div className="form-field"><label htmlFor="username">{t("auth.username")}</label><input id="username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></div><div className="form-field"><label htmlFor="password">{t("auth.password")}</label><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button button-primary auth-submit" disabled={loading}><Icon name="arrow-up-right" size={16} />{loading ? t("auth.signingIn") : t("auth.signIn")}</button></form><p className="form-hint"><Icon name="shield" size={14} />{t("auth.lockNotice")}</p></div></section>
    </main>
  );
}
