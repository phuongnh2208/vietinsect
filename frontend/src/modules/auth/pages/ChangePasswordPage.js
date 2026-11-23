import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";
import { useToast } from "../../../components/ui/ToastProvider";
import useAuthStore from "../../../stores/auth.store";
import systemService from "../../system/system.service";
import getApiErrorMessage from "../../../utils/apiError";

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const logoutStore = useAuthStore((state) => state.logout);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;
    if (!strongPw.test(newPassword)) {
      toast(t("auth.passwordHint"), "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast(t("auth.passwordMismatch"), "warning");
      return;
    }

    setSubmitting(true);
    try {
      await systemService.changePassword(currentPassword, newPassword);
      toast(t("notification.saved"), "success");
      logoutStore();
      navigate("/login", { replace: true });
    } catch (err) {
      toast(getApiErrorMessage(err, t), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name="key" size={14} />
            {t("common.admin")}
          </div>
          <h1>{t("auth.changePasswordTitle")}</h1>
          <p className="page-description">{t("auth.passwordHint")}</p>
        </div>
      </div>

      <section className="card panel" style={{ maxWidth: 540 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="cp-cur">{t("auth.currentPassword")} *</label>
            <input
              id="cp-cur"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="cp-new">{t("auth.newPassword")} *</label>
            <input
              id="cp-new"
              type="password"
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="cp-cfm">{t("auth.confirmPassword")} *</label>
            <input
              id="cp-cfm"
              type="password"
              minLength={12}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => navigate("/admin/dashboard")}
              disabled={submitting}
            >
              {t("common.cancel")}
            </button>
            <button type="submit" className="button button-primary" disabled={submitting}>
              <Icon name="check" size={16} />
              {submitting ? t("common.saving") : t("auth.changePasswordSubmit")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
