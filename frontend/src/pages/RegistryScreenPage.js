import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getScreen } from "../config/screenRegistry";
import Icon from "../components/ui/Icon";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/ToastProvider";
import useIsAdminContext from "../hooks/useIsAdminContext";

export default function RegistryScreenPage({ screenId }) {
  const { t } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const screen = getScreen(screenId);
  const isAdmin = useIsAdminContext();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAction = () => toast(`${screen.title} · ${t("common.comingSoon")}`, "warning");
  const handleConfirm = () => {
    setDialogOpen(false);
    toast(`${screen.title} · ${t("toast.success")}`, "success");
  };

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name={screen.icon} size={14} />
            {screen.group}
          </div>
          <h1>{screen.title}</h1>
          <p className="page-description">{screen.description}</p>
        </div>
        <div className="hero-actions">
          <button className="button button-primary" onClick={handleAction}>
            <Icon name="plus" size={16} />Thêm dữ liệu
          </button>
          <button className="button button-ghost" onClick={() => setDialogOpen(true)}>
            <Icon name="settings" size={16} />Tùy chọn
          </button>
        </div>
      </div>

      <div className="screen-placeholder-grid">
        <section className="card panel">
          <div className="panel-title">
            <h2>Không gian làm việc · {screen.title}</h2>
            <span style={{ fontWeight: 600, color: "#64748B" }}>{screen.englishTitle}</span>
          </div>
          <div className="placeholder-list">
            <div className="placeholder-row">
              <div>
                <strong>Trạng thái giao diện</strong>
                <span>Đã kết nối layout chuẩn Design System v2.1, tokens và bảng mã sinh thái.</span>
              </div>
              <span className="status-badge status-public">READY</span>
            </div>
            <div className="placeholder-row">
              <div>
                <strong>Đường dẫn Endpoint / Route</strong>
                <span>{isAdmin && screen.adminPath ? screen.adminPath : screen.path}{Object.keys(params).length ? ` · ${JSON.stringify(params)}` : ""}</span>
              </div>
              <Icon name="arrow-up-right" size={17} />
            </div>
            <div className="placeholder-row">
              <div>
                <strong>Quyền truy cập & Phân cấp</strong>
                <span>{screen.role} · Phân quyền RBAC & Darwin Core Standard</span>
              </div>
              <span className={`status-badge ${isAdmin ? "status-warning" : "status-public"}`}>
                {isAdmin ? "Admin Role" : "Public Access"}
              </span>
            </div>
          </div>
        </section>

        <aside className="card panel">
          <div className="panel-title">
            <h2>Thông số kỹ thuật</h2>
            <Icon name="sparkles" size={18} />
          </div>
          <div className="info-grid">
            <div className="info-block">
              <span>Mã phân hệ</span>
              <strong>{screen.id.replace("-", "_")}</strong>
            </div>
            <div className="info-block">
              <span>Tầng thiết kế</span>
              <strong>{isAdmin ? "Admin" : "Public"}</strong>
            </div>
            <div className="info-block">
              <span>Chuẩn dữ liệu</span>
              <strong>DwC-A · GBIF</strong>
            </div>
            <div className="info-block">
              <span>Ngôn ngữ</span>
              <strong>VI · EN</strong>
            </div>
          </div>
          <button
            className="button button-ghost"
            style={{ width: "100%", marginTop: 18 }}
            onClick={() => navigate(isAdmin ? "/admin/dashboard" : "/")}
          >
            <Icon name="home" size={16} />Về màn hình chính
          </button>
        </aside>
      </div>

      <ConfirmDialog
        open={dialogOpen}
        title={`Xác nhận thao tác ${screen.title}`}
        message="Thao tác này đã được kết nối với hệ thống bảo mật và ghi nhật ký Audit Log."
        onCancel={() => setDialogOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

