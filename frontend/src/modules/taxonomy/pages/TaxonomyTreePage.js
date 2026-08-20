import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../../../components/ui/Icon";
import { useToast } from "../../../components/ui/ToastProvider";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import TaxonomyTreeView from "../components/TaxonomyTreeView";

export default function TaxonomyTreePage() {
  const isAdmin = useIsAdminContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedNode, setSelectedNode] = useState({
    id: "species-attacus-atlas",
    rank: "Species",
    name: "Attacus atlas",
    common: "Atlas Moth / Bướm khế",
    count: "12 Samples",
    slug: "attacus-atlas",
  });

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Icon name="tree" size={14} />SCR-12 · Phân loại học & Hồ sơ loài</div>
          <h1>Cây phân loại học</h1>
          <p className="page-description">Duyệt cấu trúc phân loại từ Kingdom đến Species, xem số lượng mẫu vật tại mỗi bậc taxon.</p>
        </div>
        {isAdmin ? (
          <div className="hero-actions">
            <button className="button button-ghost" onClick={() => toast("Đang chuẩn bị xuất dữ liệu", "warning")}>
              <Icon name="upload" size={16} />Xuất dữ liệu
            </button>
            <button className="button button-primary" onClick={() => navigate("/admin/taxonomy/editor")}>
              <Icon name="edit" size={16} />Quản lý danh pháp
            </button>
          </div>
        ) : null}
      </div>

      <div className="screen-placeholder-grid">
        <TaxonomyTreeView selectedNodeId={selectedNode?.id} onSelectNode={setSelectedNode} />

        <aside className="card panel">
          <div className="panel-title">
            <h2 className="taxonomy-name">{selectedNode?.name || "Chọn một taxon"}</h2>
            <span>{selectedNode?.rank}</span>
          </div>
          {selectedNode ? (
            <div className="placeholder-list">
              {selectedNode.common ? (
                <div className="placeholder-row"><div><strong>Tên thường gọi</strong><span>{selectedNode.common}</span></div></div>
              ) : null}
              <div className="placeholder-row">
                <div><strong>Bản ghi liên kết</strong><span>{selectedNode.count}</span></div>
                <Icon name="database" size={17} />
              </div>
              {selectedNode.rank === "Species" ? (
                <button
                  className="button button-ghost"
                  style={{ width: "100%" }}
                  onClick={() => navigate(isAdmin ? `/admin/species/${selectedNode.slug}` : `/species/${selectedNode.slug}`)}
                >
                  <Icon name="arrow-up-right" size={16} />Xem hồ sơ loài đầy đủ
                </button>
              ) : null}
            </div>
          ) : (
            <p className="page-description">Chọn một node trên cây để xem chi tiết.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
