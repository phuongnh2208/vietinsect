import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandLogo from "../components/ui/BrandLogo";
import Icon from "../components/ui/Icon";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <main className="auth-form-pane" style={{ minHeight: "100vh" }}>
      <div className="auth-card vi-page-enter" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <BrandLogo showSubtitle={true} />
        </div>
        <div className="eyebrow" style={{ justifyContent: "center" }}>
          <Icon name="alert" size={14} />404 · {t("error.notFoundTitle")}
        </div>
        <h1 className="auth-title">404 - {t("error.notFoundTitle")}</h1>
        <p className="auth-description">{t("error.notFoundDescription")}</p>
        <Link to="/" className="button button-primary" style={{ width: "100%", justifyContent: "center" }}>
          <Icon name="home" size={16} />
          {t("error.backToHome")}
        </Link>
      </div>
    </main>
  );
}
