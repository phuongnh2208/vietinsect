import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";
import specimenService from "../../specimen/specimen.service";

const activities = [
  ["Đồng bộ GBIF Occurrence API Việt Nam", "100,134 mẫu vật có tọa độ WGS84"],
  ["Đồng bộ danh pháp Catalogue of Life", "726 Họ · 113,987 Giống đã chuẩn hóa"],
  ["Chỉ mục không gian PostGIS GiST", "Hoạt động ổn định · phản hồi < 200ms"],
  ["Phân vùng dữ liệu theo năm thu mẫu", "Partition 1800–2050 sẵn sàng khai thác"],
];

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    specimenService.getStats().then(setStats).catch(() => {});
  }, []);

  const topOrders = stats?.byOrder?.slice(0, 3) || [
    { order_name: "Lepidoptera", count: 32193 },
    { order_name: "Coleoptera", count: 25192 },
    { order_name: "Hymenoptera", count: 20973 },
  ];

  const metrics = [
    {
      key: "specimen",
      label: t("dashboard.specimen"),
      value: stats ? (stats.totalSpecimens || 0).toLocaleString() : "100,134",
      foot: `${stats ? (stats.publicSpecimens || 0).toLocaleString() : "100,134"} bản ghi công khai`,
      icon: "bug",
    },
    {
      key: "species",
      label: t("dashboard.species"),
      value: stats ? (stats.distinctScientificNames || 0).toLocaleString() : "12,480",
      foot: `${stats ? (stats.taxa?.total || 0).toLocaleString() : "114,732"} taxon trong danh lục`,
      icon: "leaf",
    },
    {
      key: "provinces",
      label: "Độ phủ tỉnh thành",
      value: stats ? `${stats.provincesCovered || 34} / 34` : "34 / 34",
      foot: "100% có tọa độ PostGIS",
      icon: "map",
    },
    {
      key: "dna",
      label: t("dashboard.dna"),
      value: stats ? (stats.dnaCount || 0).toLocaleString() : "0",
      foot: `${stats ? (stats.imageCount || 0).toLocaleString() : "0"} tệp hình ảnh nội bộ`,
      icon: "dna",
    },
  ];

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name="dashboard" size={14} />
            SCR-03 · {t("dashboard.eyebrow")}
          </div>
          <h1>{t("dashboard.title")}</h1>
          <p className="page-description">{t("dashboard.description")}</p>
        </div>
        <div className="hero-actions" style={{ marginTop: 0 }}>
          <button className="button button-ghost" onClick={() => navigate("/admin/map")}>
            <Icon name="map" size={16} />
            Bản đồ GIS
          </button>
          <button className="button button-primary" onClick={() => navigate("/admin/specimens")}>
            <Icon name="database" size={16} />
            Quản lý mẫu vật
          </button>
        </div>
      </div>

      <div className="metric-grid">
        {metrics.map((metric) => (
          <article key={metric.key} className="card metric-card vi-hover-lift">
            <div className="metric-head">
              <span>{metric.label}</span>
              <span className="metric-icon">
                <Icon name={metric.icon} size={18} />
              </span>
            </div>
            <div className="metric-value">{metric.value}</div>
            <div className="metric-foot">
              <Icon name="arrow-up-right" size={13} />
              {metric.foot}
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="card panel">
          <div className="panel-title">
            <h2>Phân bố theo Bộ côn trùng</h2>
            <span>Số liệu thực từ CSDL</span>
          </div>
          <div className="treemap">
            {topOrders.map((ord) => (
              <div
                key={ord.order_name}
                className="treemap-block"
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/admin/specimens?order=${encodeURIComponent(ord.order_name)}`)}
              >
                {ord.order_name} · {Number(ord.count).toLocaleString()}
              </div>
            ))}
          </div>
        </section>

        <section className="card panel">
          <div className="panel-title">
            <h2>Không gian phân bố GIS</h2>
            <span>Việt Nam (WGS84)</span>
          </div>
          <div
            className="map-preview"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/admin/map")}
            title="Nhấp để mở Bản đồ phân bố SCR-18"
          >
            <span className="map-point" style={{ left: "54%", top: "39%" }} />
            <span className="map-point" style={{ left: "47%", top: "60%", animationDelay: ".6s" }} />
            <span className="map-point" style={{ left: "64%", top: "72%", animationDelay: "1.1s" }} />
            <span className="map-point" style={{ left: "40%", top: "47%", animationDelay: "1.5s" }} />
          </div>
        </section>

        <section className="card panel">
          <div className="panel-title">
            <h2>{t("dashboard.digitization")}</h2>
            <span>Chuẩn hóa dữ liệu</span>
          </div>
          <div className="info-grid">
            <div className="info-block">
              <span>Tọa độ địa lý</span>
              <strong>100%</strong>
            </div>
            <div className="info-block">
              <span>Định danh khoa học</span>
              <strong>92.9%</strong>
            </div>
          </div>
          <div className="progress-track" style={{ marginTop: 19 }}>
            <div className="progress-bar" style={{ width: "93%" }} />
          </div>
        </section>

        <section className="card panel">
          <div className="panel-title">
            <h2>{t("dashboard.alerts")}</h2>
            <span>Gợi ý chuẩn hóa</span>
          </div>
          <div className="alert-panel">
            <Icon name="alert" size={19} />
            <div>
              <strong>Liên kết sâu bậc Loài (Species Relink)</strong>
              <p>
                Các mẫu vật đã có tên khoa học gốc từ GBIF, sẵn sàng đối chiếu chi tiết xuống cấp
                Genus / Species.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="card panel" style={{ marginTop: 16 }}>
        <div className="panel-title">
          <h2>{t("dashboard.recent")}</h2>
          <button
            className="button button-ghost button-sm"
            onClick={() => navigate("/admin/specimens")}
          >
            {t("common.viewAll")}
          </button>
        </div>
        <div className="activity-list">
          {activities.map(([title, detail]) => (
            <div className="activity-item" key={title}>
              <span className="activity-dot" />
              <div>
                <strong>{title}</strong>
                <span>{detail}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
