import React from "react";
import { Link } from "react-router-dom";
import BrandLogo from "../components/ui/BrandLogo";
import Icon from "../components/ui/Icon";

export default function NotFound() {
  return (
    <main className="auth-form-pane" style={{ minHeight: "100vh" }}>
      <div className="auth-card vi-page-enter" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <BrandLogo showSubtitle={true} />
        </div>
        <div className="eyebrow" style={{ justifyContent: "center" }}>
          <Icon name="alert" size={14} />404 · Màn hình không tồn tại
        </div>
        <h1 className="auth-title">404 - Không Tìm Thấy Trang</h1>
        <p className="auth-description">
          Đường dẫn bạn truy cập không tồn tại hoặc đã được chuyển sang phân hệ mới trong hệ thống.
        </p>
        <Link to="/" className="button button-primary" style={{ width: "100%", justifyContent: "center" }}>
          <Icon name="home" size={16} />Về Trang Chủ VietInsect
        </Link>
      </div>
    </main>
  );
}

