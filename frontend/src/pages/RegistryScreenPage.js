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

  const handleAction = () => toast(`${screen.id} · ${t("common.comingSoon")}`, "warning");
  const handleConfirm = () => {
    setDialogOpen(false);
    toast(`${screen.id} · ${t("toast.success")}`, "success");
  };

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Icon name={screen.icon} size={14} />{screen.id} · {screen.group}</div>
          <h1>{screen.title}</h1>
          <p className="page-description">{screen.description}</p>
        </div>
        <div className="hero-actions"><button className="button button-primary" onClick={handleAction}><Icon name="plus" size={16} />Thêm dữ liệu</button><button className="button button-ghost" onClick={() => setDialogOpen(true)}><Icon name="settings" size={16} />Thao tác</button></div>
      </div>
      <div className="screen-placeholder-grid">
        <section className="card panel">
          <div className="panel-title"><h2>Không gian làm việc {screen.id}</h2><span>{screen.englishTitle}</span></div>
          <div className="placeholder-list">
            <div className="placeholder-row"><div><strong>Trạng thái dữ liệu</strong><span>Đã kết nối layout, token, icon và trạng thái tương tác dùng chung.</span></div><span className="status-badge status-public">Baseline UI</span></div>
            <div className="placeholder-row"><div><strong>Route hiện tại</strong><span>{isAdmin && screen.adminPath ? screen.adminPath : screen.path}{Object.keys(params).length ? ` · ${JSON.stringify(params)}` : ""}</span></div><Icon name="arrow-up-right" size={17} /></div>
            <div className="placeholder-row"><div><strong>Quyền truy cập</strong><span>{screen.role}</span></div><span className={`status-badge ${isAdmin ? "status-warning" : "status-public"}`}>{isAdmin ? "Admin" : "Public"}</span></div>
          </div>
        </section>
        <aside className="card panel">
          <div className="panel-title"><h2>Chuẩn bị triển khai</h2><Icon name="sparkles" size={19} /></div>
          <div className="info-grid">
            <div className="info-block"><span>Component</span><strong>{screen.id.replace("-", "_")}</strong></div>
            <div className="info-block"><span>Layout</span><strong>{isAdmin ? "Admin" : "Public"}</strong></div>
            <div className="info-block"><span>i18n</span><strong>VI · EN</strong></div>
            <div className="info-block"><span>Effects</span><strong>150–200ms</strong></div>
          </div>
          <button className="button button-ghost" style={{ width: "100%", marginTop: 18 }} onClick={() => navigate(isAdmin ? "/admin/dashboard" : "/")}><Icon name="home" size={16} />Về không gian chính</button>
        </aside>
      </div>
      <ConfirmDialog open={dialogOpen} title={`Xác nhận thao tác ${screen.id}`} message="Đây là điểm nối chung cho các thao tác cần xác nhận trước khi tích hợp API thật." onCancel={() => setDialogOpen(false)} onConfirm={handleConfirm} />
    </div>
  );
}
