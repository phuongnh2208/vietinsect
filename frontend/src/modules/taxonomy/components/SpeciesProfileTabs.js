import React, { useState } from "react";
import Icon from "../../../components/ui/Icon";

const TABS = [
  { id: "morphology", label: "Hình thái & Sinh thái", icon: "leaf" },
  { id: "specimens", label: "Mẫu vật", icon: "bug" },
  { id: "dna", label: "DNA", icon: "dna" },
  { id: "activity", label: "Hoạt tính", icon: "chart" },
  { id: "distribution", label: "Phân bố", icon: "map" },
];

const PANELS = {
  morphology: "Mô tả hình thái, sinh cảnh sống và đặc điểm sinh thái của loài sẽ hiển thị tại đây khi kết nối dữ liệu thật.",
  specimens: "Danh sách mẫu vật thuộc loài này, liên kết trực tiếp tới trang chi tiết mẫu vật.",
  dna: "Các chuỗi DNA/marker gen (COI, 16S rRNA, ITS2) đã ghi nhận cho loài.",
  activity: "Widget nhận dạng AI và chỉ số hoạt tính liên quan tới loài.",
  distribution: "Bản đồ phân bố và mô hình SDM (Species Distribution Model) cho loài.",
};

export default function SpeciesProfileTabs() {
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
      <p className="page-description">{PANELS[active]}</p>
    </div>
  );
}
