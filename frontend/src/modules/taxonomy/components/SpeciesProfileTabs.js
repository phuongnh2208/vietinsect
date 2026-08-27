import React, { useState } from "react";
import Icon from "../../../components/ui/Icon";
import EmptyState from "../../../components/ui/EmptyState";

const TABS = [
  { id: "morphology", label: "Hình thái & Sinh thái", icon: "leaf" },
  { id: "specimens", label: "Mẫu vật", icon: "bug" },
  { id: "dna", label: "DNA", icon: "dna" },
  { id: "activity", label: "Hoạt tính", icon: "chart" },
  { id: "distribution", label: "Phân bố", icon: "map" },
];

export default function SpeciesProfileTabs({ profile }) {
  const [active, setActive] = useState(TABS[0].id);

  return (
    <div>
      <div className="tabs-row">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button${active === tab.id ? " active" : ""}`}
            onClick={() => setActive(tab.id)}
          >
            <Icon name={tab.icon} size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {active === "morphology" ? (
        <div className="species-tab-grid">
          <div>
            <h3 className="species-tab-heading">Hình thái</h3>
            <p className="page-description">{profile.morphologyDescription || "Chưa có mô tả hình thái."}</p>
          </div>
          <div>
            <h3 className="species-tab-heading">Sinh thái</h3>
            <p className="page-description">{profile.ecologyDescription || "Chưa có mô tả sinh thái."}</p>
          </div>
        </div>
      ) : null}

      {active === "specimens" ? (
        profile.specimenCount > 0 ? (
          <p className="page-description">{profile.specimenCount} mẫu vật thuộc loài này. Danh sách chi tiết sẽ liên kết sang module Quản lý Mẫu vật (SCR-05~08) khi module đó hoàn thiện.</p>
        ) : (
          <EmptyState icon="bug" title="Chưa có mẫu vật" description="Chưa ghi nhận mẫu vật nào thuộc loài này." />
        )
      ) : null}

      {active === "dna" ? (
        <EmptyState icon="dna" title="Chưa liên kết dữ liệu DNA" description="Các chuỗi GenBank/BOLD sẽ hiển thị tại đây khi module DNA (SCR-20~22) hoàn thiện." />
      ) : null}

      {active === "activity" ? (
        profile.bioactivity && profile.bioactivity.length > 0 ? (
          <div className="placeholder-list">
            {profile.bioactivity.map((record) => (
              <div key={record.id} className="placeholder-row">
                <div>
                  <strong>{record.activityType}{record.activityLevel ? ` · ${record.activityLevel}` : ""}</strong>
                  <span>{record.description || "Không có mô tả chi tiết."}</span>
                  {record.referenceTitle ? <span>Tài liệu: {record.referenceTitle}{record.referenceDoi ? ` (DOI: ${record.referenceDoi})` : ""}</span> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="sparkles" title="Chưa có dữ liệu hoạt tính" description="Hoạt tính sinh/hóa học của loài sẽ hiển thị tại đây (F-TX-07)." />
        )
      ) : null}

      {active === "distribution" ? (
        <EmptyState icon="map" title="Chưa có bản đồ phân bố" description="Bản đồ điểm thu mẫu sẽ hiển thị tại đây khi module GIS (SCR-18) kết nối dữ liệu thật." />
      ) : null}
    </div>
  );
}
