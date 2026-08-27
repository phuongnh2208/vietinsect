import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/ui/EmptyState";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import useTaxonomyStore from "../taxonomy.store";
import TaxonomyTreeView from "../components/TaxonomyTreeView";

export default function TaxonomyTreePage() {
  const isAdmin = useIsAdminContext();
  const navigate = useNavigate();
  const tree = useTaxonomyStore((state) => state.tree);
  const treeStatus = useTaxonomyStore((state) => state.treeStatus);
  const treeError = useTaxonomyStore((state) => state.treeError);
  const fetchTree = useTaxonomyStore((state) => state.fetchTree);
  const selectedNodeId = useTaxonomyStore((state) => state.selectedNodeId);
  const selectNode = useTaxonomyStore((state) => state.selectNode);
  const expandedIds = useTaxonomyStore((state) => state.expandedIds);
  const toggleExpanded = useTaxonomyStore((state) => state.toggleExpanded);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    if (treeStatus === "idle") fetchTree();
  }, [treeStatus, fetchTree]);

  const handleSelect = (node) => {
    selectNode(node.id);
    setSelectedNode(node);
  };

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
            <button className="button button-primary" onClick={() => navigate("/admin/taxonomy/editor")}>
              <Icon name="edit" size={16} />Quản lý danh pháp
            </button>
          </div>
        ) : null}
      </div>

      {treeStatus === "loading" || treeStatus === "idle" ? (
        <div className="card panel"><LoadingState label="Đang tải cây phân loại..." /></div>
      ) : treeStatus === "error" ? (
        <div className="card panel">
          <EmptyState
            icon="alert"
            title="Không tải được cây phân loại"
            description={treeError}
            action={<button className="button button-ghost" onClick={() => fetchTree({ force: true })}><Icon name="arrow-up-right" size={16} />Thử lại</button>}
          />
        </div>
      ) : tree.length === 0 ? (
        <div className="card panel">
          <EmptyState icon="tree" title="Chưa có dữ liệu phân loại" description="Bắt đầu bằng cách thêm taxon gốc (Kingdom) trong Quản lý danh pháp." />
        </div>
      ) : (
        <div className="screen-placeholder-grid">
          <TaxonomyTreeView
            nodes={tree}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelect}
            expandedIds={expandedIds}
            onToggleExpanded={toggleExpanded}
          />

          <aside className="card panel">
            <div className="panel-title">
              <h2 className="taxonomy-name">{selectedNode?.scientificName || "Chọn một taxon"}</h2>
              <span>{selectedNode?.rank}</span>
            </div>
            {selectedNode ? (
              <div className="placeholder-list">
                {selectedNode.vernacularNameVn ? (
                  <div className="placeholder-row"><div><strong>Tên thường gọi</strong><span>{selectedNode.vernacularNameVn}</span></div></div>
                ) : null}
                <div className="placeholder-row">
                  <div><strong>Mẫu vật liên kết</strong><span>{selectedNode.specimenCount} mẫu</span></div>
                  <Icon name="database" size={17} />
                </div>
                {selectedNode.rank === "Species" || selectedNode.rank === "Subspecies" ? (
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
      )}
    </div>
  );
}
