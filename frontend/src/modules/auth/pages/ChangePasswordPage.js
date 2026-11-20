import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../../../components/ui/Icon";
import { useToast } from "../../../components/ui/ToastProvider";
import useAuthStore from "../../../stores/auth.store";
import systemService from "../../system/system.service";

export default function ChangePasswordPage() {
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
      toast(
        "Mật khẩu mới phải ≥12 ký tự và gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt (SRS §5.2)",
        "warning",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("Mật khẩu xác nhận không trùng khớp", "warning");
      return;
    }

    setSubmitting(true);
    try {
      await systemService.changePassword(currentPassword, newPassword);
      toast("Đã đổi mật khẩu và thu hồi các phiên cũ. Vui lòng đăng nhập lại.", "success");
      logoutStore();
      navigate("/login", { replace: true });
    } catch (err) {
      toast(err.response?.data?.message || "Không thể đổi mật khẩu", "error");
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
            Bảo mật Tài khoản Quản trị
          </div>
          <h1>Đổi mật khẩu quản trị viên</h1>
          <p className="page-description">
            Mật khẩu mới yêu cầu tối thiểu 12 ký tự, được băm bằng thuật toán bcrypt (cost factor 12) và
            tự động thu hồi toàn bộ refresh token cũ.
          </p>
        </div>
      </div>

      <section className="card panel" style={{ maxWidth: 540 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="cp-cur">Mật khẩu hiện tại *</label>
            <input
              id="cp-cur"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="cp-new">Mật khẩu mới (≥ 12 ký tự) *</label>
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
            <label htmlFor="cp-cfm">Nhập lại mật khẩu mới *</label>
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
              Hủy
            </button>
            <button type="submit" className="button button-primary" disabled={submitting}>
              <Icon name="check" size={16} />
              {submitting ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
