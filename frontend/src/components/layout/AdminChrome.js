import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import { adminScreens } from "../../config/screenRegistry";
import useAuthStore from "../../stores/auth.store";
import Icon from "../ui/Icon";

const navItems = [
  { labelKey: "nav.dashboard", path: "/admin/dashboard", icon: "dashboard" },
  { labelKey: "nav.catalog", path: "/admin/specimens", icon: "database" },
  { labelKey: "nav.taxonomy", path: "/taxonomy", icon: "tree" },
  { labelKey: "nav.map", path: "/map", icon: "map" },
  { labelKey: "nav.dna", path: "/dna", icon: "dna" },
  { labelKey: "nav.analytics", path: "/admin/analytics", icon: "chart" },
  { labelKey: "nav.reports", path: "/reports", icon: "file" },
];

export function AdminSidebar({ open, onClose }) {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="Điều hướng quản trị">
      <div className="brand">
        <div className="brand-mark"><Icon name="bug" size={21} /></div>
        <div><strong>VietInsect</strong><small>{t("appSubtitle")}</small></div>
      </div>
      <div className="sidebar-section-label">Workspace</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} onClick={onClose} className={({ isActive }) => `sidebar-link ${isActive || location.pathname === item.path ? "active" : ""}`}>
            <Icon name={item.icon} size={18} />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <NavLink to="/admin/system" onClick={onClose} className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}><Icon name="settings" size={18} /><span>{t("nav.settings")}</span></NavLink>
        <button className="sidebar-link" onClick={logout}><Icon name="arrow-up-right" size={18} /><span>{t("common.logout")}</span></button>
        <div className="sidebar-screen-count">{adminScreens.length} admin screens · {user?.username || "VietInsect team"}</div>
      </div>
    </aside>
  );
}

export function Topbar({ onMenuClick }) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(() => window.localStorage.getItem("vietinsect_theme") || "light");
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
      <button className="icon-button topbar-menu" onClick={onMenuClick} aria-label="Mở menu"><Icon name="menu" size={20} /></button>
      <label className="topbar-search"><Icon name="search" size={18} /><input placeholder={`${t("common.search")}...`} aria-label={t("common.search")} /></label>
      <div className="topbar-actions">
        <div className="language-toggle" aria-label={t("common.language")}>
          <button className={i18n.language === "vi" ? "active" : ""} onClick={() => changeLanguage("vi")}>VI</button>
          <button className={i18n.language === "en" ? "active" : ""} onClick={() => changeLanguage("en")}>EN</button>
        </div>
        <button className="icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={theme === "light" ? t("common.dark") : t("common.light")}><Icon name={theme === "light" ? "moon" : "sun"} size={18} /></button>
        <button className="icon-button" onClick={() => {}} aria-label={t("common.notifications")}><Icon name="bell" size={18} /></button>
        <span className="topbar-divider" />
        <div className="user-chip"><div className="avatar">{(user?.username || "AD").slice(0, 2).toUpperCase()}</div><div className="user-copy"><strong>{user?.username || "Admin"}</strong><span>{t("common.admin")}</span></div></div>
      </div>
    </header>
  );
}
