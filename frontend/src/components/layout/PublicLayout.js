import React from "react";
import { NavLink, Link, Outlet } from "react-router-dom";
import BrandLogo from "../ui/BrandLogo";

const publicNavItems = [
  { label: "Tra cứu Mẫu vật", path: "/specimens/search" },
  { label: "Bản đồ GIS", path: "/map" },
  { label: "Cây Phân loại", path: "/taxonomy" },
  { label: "Mã vạch DNA", path: "/dna" },
  { label: "Thư viện Ảnh", path: "/media" },
];

export default function PublicLayout() {
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
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-link-item ${isActive ? "active" : ""}`}
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
              <h4>Khai thác Dữ liệu</h4>
              <Link to="/specimens/search">Tra cứu mẫu vật số</Link>
              <Link to="/taxonomy">Cây phân loại sinh học</Link>
              <Link to="/dna">Kho mã vạch DNA</Link>
              <Link to="/media">Thư viện hình ảnh</Link>
            </div>
            <div className="footer-col">
              <h4>Công cụ & Bản đồ</h4>
              <Link to="/map">Bản đồ phân bố GIS</Link>
              <Link to="/ai/species-identification">Nhận diện loài AI</Link>
              <Link to="/search/advanced">Tìm kiếm nâng cao</Link>
            </div>
            <div className="footer-col">
              <h4>Tiêu chuẩn & Quản trị</h4>
              <Link to="/reports">Báo cáo đa dạng sinh học</Link>
              <a href="https://www.gbif.org" target="_blank" rel="noreferrer">
                Chuẩn quốc tế GBIF / Darwin Core
              </a>
              <Link to="/login">Khu vực Quản trị</Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div className="footer-container bottom-flex">
            <span>© {new Date().getFullYear()} VietInsect — Viện Công nghệ Thông tin (VAST).</span>
            <span className="footer-tagline">Open Biodiversity Data Platform</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
