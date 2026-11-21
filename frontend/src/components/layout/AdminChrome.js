import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { screenById } from "../../config/screenRegistry";
import useAuthStore from "../../stores/auth.store";
import useAuth from "../../modules/auth/useAuth";
import BrandLogo from "../ui/BrandLogo";
import Icon from "../ui/Icon";

const navScreenIds = ["SCR-03", "SCR-05", "SCR-12", "SCR-18", "SCR-20", "SCR-25", "SCR-26"];
const navLabels = {
  "SCR-03": "nav.dashboard",
  "SCR-05": "nav.catalog",
  "SCR-12": "nav.taxonomy",
  "SCR-18": "nav.map",
  "SCR-20": "nav.dna",
  "SCR-25": "nav.analytics",
  "SCR-26": "nav.reports",
};

export function AdminSidebar({ open, onClose }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { logout } = useAuth();

  const navItems = useMemo(
    () =>
      navScreenIds
        .map((screenId) => {
          const screen = screenById[screenId];
          if (!screen) return null;
          return {
            screenId,
            labelKey: navLabels[screenId],
            path: screen.adminPath || screen.path,
            icon: screen.icon,
          };
        })
        .filter(Boolean),
    []
  );

  return (
    <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="Điều hướng quản trị">
      <NavLink
        to="/admin/dashboard"
        className="brand-logo-link"
        style={{ padding: "0 10px 24px" }}
        onClick={onClose}
      >
        <BrandLogo showSubtitle={true} />
      </NavLink>
      <div className="sidebar-section-label">Workspace</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              `sidebar-link ${isActive || location.pathname === item.path ? "active" : ""}`
            }
          >
            <Icon name={item.icon} size={18} />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <NavLink
          to="/admin/media"
          onClick={onClose}
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        >
          <Icon name="image" size={18} />
          <span>Thư viện ảnh</span>
        </NavLink>
        <NavLink
          to="/admin/sharing"
          onClick={onClose}
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        >
          <Icon name="lock" size={18} />
          <span>Chia sẻ Public/Private</span>
        </NavLink>
        <NavLink
          to="/admin/system"
          onClick={onClose}
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
        >
          <Icon name="settings" size={18} />
          <span>{t("nav.settings")}</span>
        </NavLink>
        <button type="button" className="sidebar-link" onClick={logout}>
          <Icon name="arrow-up-right" size={18} />
          <span>{t("common.logout")}</span>
        </button>
      </div>
    </aside>
  );
}

export function Topbar({ onMenuClick }) {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState(
    () => window.localStorage.getItem("vietinsect_theme") || "light"
  );
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("vietinsect_theme", theme);
  }, [theme]);

  const changeLanguage = (language) => {
    i18n.changeLanguage(language);
    window.localStorage.setItem("vietinsect_language", language);
  };

  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-button topbar-menu"
        onClick={onMenuClick}
        aria-label="Mở menu"
      >
        <Icon name="menu" size={20} />
      </button>

      <label className="topbar-search">
        <Icon name="search" size={18} />
        <input placeholder={`${t("common.search")}...`} aria-label={t("common.search")} />
      </label>

      <div className="topbar-actions">
        <div className="language-toggle" aria-label={t("common.language")}>
          <button
            type="button"
            className={i18n.language === "vi" ? "active" : ""}
            onClick={() => changeLanguage("vi")}
          >
            VI
          </button>
          <button
            type="button"
            className={i18n.language === "en" ? "active" : ""}
            onClick={() => changeLanguage("en")}
          >
            EN
          </button>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          aria-label={theme === "light" ? t("common.dark") : t("common.light")}
        >
          <Icon name={theme === "light" ? "moon" : "sun"} size={18} />
        </button>
        <button type="button" className="icon-button" aria-label={t("common.notifications")}>
          <Icon name="bell" size={18} />
        </button>
        <span className="topbar-divider" />
        <div className="user-chip">
          <div className="avatar">{(user?.username || "AD").slice(0, 2).toUpperCase()}</div>
          <div className="user-copy">
            <strong>{user?.username || "Admin"}</strong>
            <span>{t("common.admin")}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
