import React from "react";
import { Link } from "react-router-dom";
import Icon from "../components/ui/Icon";

export default function NotFound() {
  return <main className="auth-form-pane" style={{ minHeight: "100vh" }}><div className="auth-card"><div className="eyebrow"><Icon name="alert" size={14} />404 · Not found</div><h1 className="auth-title">Không tìm thấy màn hình</h1><p className="auth-description">Route này chưa được gắn vào registry hoặc không còn tồn tại.</p><Link to="/" className="button button-primary"><Icon name="home" size={16} />Về trang chủ</Link></div></main>;
}
