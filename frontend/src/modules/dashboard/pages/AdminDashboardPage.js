import React from "react";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";

const metrics = [
  { key: "specimen", value: "24,680", delta: "+12.4%", icon: "bug" },
  { key: "species", value: "3,842", delta: "+8.7%", icon: "leaf" },
  { key: "media", value: "18,492", delta: "+16.2%", icon: "image" },
  { key: "dna", value: "1,206", delta: "+5.8%", icon: "dna" },
];

const activities = [
  ["Mẫu vật mới được phê duyệt", "SHP-2026-00482 · 12 phút trước"],
  ["Chuỗi DNA đã được liên kết", "DNA-COI-0192 · 37 phút trước"],
  ["Bộ ảnh mới đã được công khai", "Media batch #108 · 1 giờ trước"],
  ["Cập nhật tên khoa học", "Taxon editor · 2 giờ trước"],
];

export default function AdminDashboardPage() {
  const { t } = useTranslation();

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div><div className="eyebrow"><Icon name="dashboard" size={14} />SCR-03 · {t("dashboard.eyebrow")}</div><h1>{t("dashboard.title")}</h1><p className="page-description">{t("dashboard.description")}</p></div>
        <button className="button button-primary"><Icon name="file" size={16} />Xuất báo cáo</button>
      </div>
      <div className="metric-grid">
        {metrics.map((metric) => <article key={metric.key} className="card metric-card vi-hover-lift"><div className="metric-head"><span>{t(`dashboard.${metric.key}`)}</span><span className="metric-icon"><Icon name={metric.icon} size={18} /></span></div><div className="metric-value">{metric.value}</div><div className="metric-foot"><Icon name="arrow-up-right" size={13} />{metric.delta} so với tháng trước</div></article>)}
      </div>
      <div className="dashboard-grid">
        <section className="card panel"><div className="panel-title"><h2>Phân bố theo nhóm</h2><span>Toàn bộ dữ liệu đã duyệt</span></div><div className="treemap"><div className="treemap-block">Lepidoptera · 8,420</div><div className="treemap-block">Coleoptera · 5,810</div><div className="treemap-block">Hymenoptera · 3,250</div></div></section>
        <section className="card panel"><div className="panel-title"><h2>Bản đồ dữ liệu</h2><span>Việt Nam</span></div><div className="map-preview"><span className="map-point" style={{ left: "54%", top: "39%" }} /><span className="map-point" style={{ left: "47%", top: "60%", animationDelay: ".6s" }} /><span className="map-point" style={{ left: "64%", top: "72%", animationDelay: "1.1s" }} /><span className="map-point" style={{ left: "40%", top: "47%", animationDelay: "1.5s" }} /></div></section>
        <section className="card panel"><div className="panel-title"><h2>{t("dashboard.digitization")}</h2><span>Tháng 08/2026</span></div><div className="info-grid"><div className="info-block"><span>Ảnh đã xử lý</span><strong>78%</strong></div><div className="info-block"><span>Metadata chuẩn hóa</span><strong>64%</strong></div></div><div className="progress-track" style={{ marginTop: 19 }}><div className="progress-bar" style={{ width: "72%" }} /></div></section>
        <section className="card panel"><div className="panel-title"><h2>{t("dashboard.alerts")}</h2><span>3 cần xử lý</span></div><div className="alert-panel"><Icon name="alert" size={19} /><div><strong>Trùng định danh mẫu vật</strong><p>12 bản ghi cần được kiểm tra trước khi xuất bản.</p></div></div></section>
      </div>
      <section className="card panel" style={{ marginTop: 16 }}><div className="panel-title"><h2>{t("dashboard.recent")}</h2><button className="button button-ghost button-sm">{t("common.viewAll")}</button></div><div className="activity-list">{activities.map(([title, detail]) => <div className="activity-item" key={title}><span className="activity-dot" /><div><strong>{title}</strong><span>{detail}</span></div></div>)}</div></section>
    </div>
  );
}
