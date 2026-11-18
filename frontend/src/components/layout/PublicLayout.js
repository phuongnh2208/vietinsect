import React from "react";
import { NavLink, Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandLogo from "../ui/BrandLogo";
import Icon from "../ui/Icon";

const publicNavItems = [
  { label: "Get data", path: "/specimens/search", matchPrefix: ["/specimens", "/dna"] },
  { label: "How to", path: "/search/advanced", matchPrefix: ["/search/advanced"] },
  { label: "Tools", path: "/map", matchPrefix: ["/map", "/ai"] },
  { label: "Community", path: "/taxonomy", matchPrefix: ["/taxonomy", "/species"] },
  { label: "About", path: "/reports", matchPrefix: ["/reports"] },
];

export default function PublicLayout() {
  const { t } = useTranslation();

  return (
    <div className="app-shell public-shell editorial-theme">
      {/* Top Main Navigation Bar */}
      <header className="public-editorial-header">
        <div className="header-container">
          <Link to="/" className="brand-logo-link" aria-label="VietInsect Home">
            <BrandLogo />
          </Link>

          <nav className="editorial-nav" aria-label="Điều hướng chính">
            <div className="nav-links-wrapper">
              {publicNavItems.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.path}
                  className={({ isActive }) =>
                    `nav-link-item ${isActive ? "active" : ""}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      </header>

      {/* Main Page Outlet */}
      <div className="public-page-body">
        <Outlet />
      </div>

      {/* Editorial Footer */}
      <footer className="editorial-footer">
        <div className="footer-container">
          <div className="footer-brand-col">
            <BrandLogo showSubtitle={true} />
            <p className="footer-mission">
              Nền tảng số hóa và khai thác dữ liệu đa dạng sinh học côn trùng Việt Nam — Free and open access to biodiversity data.
            </p>
          </div>

          <div className="footer-links-grid">
            <div className="footer-col">
              <h4>Get Data</h4>
              <Link to="/specimens/search">Tra cứu mẫu vật số</Link>
              <Link to="/taxonomy">Cây phân loại sinh học</Link>
              <Link to="/dna">Dữ liệu chuỗi DNA</Link>
            </div>
            <div className="footer-col">
              <h4>Tools & Analysis</h4>
              <Link to="/map">Bản đồ phân bố GIS</Link>
              <Link to="/ai/species-identification">Nhận diện loài AI</Link>
              <Link to="/search/advanced">Tìm kiếm nâng cao</Link>
            </div>
            <div className="footer-col">
              <h4>About & Standards</h4>
              <Link to="/reports">Báo cáo đa dạng sinh học</Link>
              <a href="https://www.gbif.org" target="_blank" rel="noreferrer">GBIF Data Standard</a>
              <Link to="/login">Khu vực Quản trị</Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div className="footer-container bottom-flex">
            <span>© {new Date().getFullYear()} VietInsect. All rights reserved.</span>
            <span className="footer-tagline">Open Biodiversity Data Platform</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
