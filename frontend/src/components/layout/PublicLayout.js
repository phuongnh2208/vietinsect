import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../ui/Icon";

const publicLinks = [
  { labelKey: "nav.catalog", path: "/specimens/search" },
  { labelKey: "nav.taxonomy", path: "/taxonomy" },
  { labelKey: "nav.map", path: "/map" },
  { labelKey: "nav.dna", path: "/dna" },
];

export default function PublicLayout() {
  const { t } = useTranslation();

  return (
    <div className="app-shell public-shell">
      <header className="public-header">
        <NavLink to="/" className="brand">
          <span className="brand-mark"><Icon name="bug" size={21} /></span>
          <span><strong>VietInsect</strong><small>{t("appSubtitle")}</small></span>
        </NavLink>
        <nav className="public-nav" aria-label="Điều hướng công khai">
          {publicLinks.map((item) => <NavLink key={item.path} to={item.path} className={({ isActive }) => isActive ? "active" : ""}>{t(item.labelKey)}</NavLink>)}
        </nav>
        <div className="public-header-actions" aria-hidden="true" />
      </header>
      <Outlet />
      <footer className="public-footer">
        <div className="public-footer-inner">
          <div><div className="brand"><span className="brand-mark"><Icon name="bug" size={19} /></span><span><strong>VietInsect</strong><small>{t("appSubtitle")}</small></span></div><p>Nền tảng số hóa và khai thác dữ liệu đa dạng sinh học côn trùng Việt Nam, phục vụ nghiên cứu và bảo tồn.</p></div>
          <div><span className="eyebrow" style={{ color: "#DCE8D2" }}>Open biodiversity data</span><p>Thiết kế theo hệ màu đậm 60–30–10 và chuẩn tương phản WCAG 2.1 AA.</p></div>
        </div>
      </footer>
    </div>
  );
}
