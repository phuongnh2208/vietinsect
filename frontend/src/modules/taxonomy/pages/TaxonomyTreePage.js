import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/ui/EmptyState";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import useTaxonomyStore from "../taxonomy.store";
import TaxonomyTreeView from "../components/TaxonomyTreeView";
import ExternalLinkBadges from "../components/ExternalLinkBadges";

export default function TaxonomyTreePage() {
  const { t } = useTranslation();
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

  const notProvided = t("common.notProvided", "Chưa cung cấp");

  return (
    <div className="page-container page-content vi-page-enter" data-testid="taxonomy-tree-page">
      {/* Compact Header */}
      <div className="vi-compact-page-header">
        <div>
          <div className="eyebrow">
            <Icon name="tree" size={13} />
            <span>HỆ THỐNG PHÂN LOẠI HỌC &amp; DANH PHÁP ICZN</span>
          </div>
          <h1 className="vi-compact-h1">Cây phân loại học Côn trùng Việt Nam</h1>
          <p className="vi-compact-subtitle">
            Khám phá cấu trúc phân cấp từ Giới (Kingdom) đến Loài (Species), tra cứu nhanh số nhánh con và tiêu bản lưu trữ.
          </p>
        </div>
        {isAdmin ? (
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="button button-sm button-primary"
              onClick={() => navigate("/admin/taxonomy/editor")}
            >
              <Icon name="edit" size={15} />
              <span>Quản lý danh pháp</span>
            </button>
          </div>
        ) : null}
      </div>

      {treeStatus === "loading" || treeStatus === "idle" ? (
        <div className="card panel">
          <LoadingState label="Đang tải cây phân loại học..." />
        </div>
      ) : treeStatus === "error" ? (
        <div className="card panel">
          <EmptyState
            icon="alert"
            title="Không tải được cây phân loại"
            description={treeError}
            action={
              <button
                type="button"
                className="button button-ghost"
                onClick={() => fetchTree({ force: true })}
              >
                <Icon name="arrow-up-right" size={16} />
                Thử lại
              </button>
            }
          />
        </div>
      ) : !tree || tree.length === 0 ? (
        <div className="card panel">
          <EmptyState
            icon="tree"
            title="Chưa có dữ liệu phân loại"
            description="Bắt đầu bằng cách thêm taxon gốc (Kingdom) trong Quản lý danh pháp."
          />
        </div>
      ) : (
        <div className="vi-taxonomy-two-panel">
          {/* LEFT 62%: Compact Hierarchical Tree */}
          <TaxonomyTreeView
            nodes={tree}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelect}
            expandedIds={expandedIds}
            onToggleExpanded={toggleExpanded}
          />

          {/* RIGHT 38%: Taxon Detail Panel (Never Blank) */}
          <aside className="card vi-taxonomy-detail-panel" data-testid="taxonomy-detail-panel">
            {selectedNode ? (
              <div>
                <div className="vi-tax-detail-header">
                  <span className="vi-rank-pill">{selectedNode.rank || "Taxon"}</span>
                  <span className="vi-status-pill">
                    {(selectedNode.taxonomicStatus || "accepted").toUpperCase()}
                  </span>
                </div>

                <h2 className="vi-tax-detail-title">
                  <em>{selectedNode.scientificName}</em>
                </h2>
                {selectedNode.scientificNameAuthorship ? (
                  <div className="vi-tax-detail-author">{selectedNode.scientificNameAuthorship}</div>
                ) : null}

                <dl className="vi-sci-dl" style={{ marginTop: 12 }}>
                  <div className="vi-sci-row">
                    <dt>Tên khoa học</dt>
                    <dd>
                      <strong>
                        <em>{selectedNode.scientificName}</em>
                      </strong>
                    </dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>Bậc phân loại (Rank)</dt>
                    <dd>{selectedNode.rank || notProvided}</dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>Tên thường gọi (VN / EN)</dt>
                    <dd>
                      {selectedNode.vernacularNameVn || selectedNode.vernacularNameEn
                        ? `${selectedNode.vernacularNameVn || notProvided} / ${
                            selectedNode.vernacularNameEn || notProvided
                          }`
                        : notProvided}
                    </dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>Đơn vị phân loại cha (Parent)</dt>
                    <dd>
                      {selectedNode.parentName ||
                        (selectedNode.parentId ? `Taxon #${selectedNode.parentId}` : "Gốc (Root)")}
                    </dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>Số nhánh phân loại con</dt>
                    <dd>
                      <strong>{(selectedNode.childCount || 0).toLocaleString("vi-VN")}</strong> đơn vị con
                    </dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>Số mẫu vật liên kết</dt>
                    <dd>
                      <strong>{(selectedNode.specimenCount || 0).toLocaleString("vi-VN")}</strong> mẫu vật
                    </dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>Trạng thái danh pháp</dt>
                    <dd>{(selectedNode.taxonomicStatus || "accepted").toUpperCase()}</dd>
                  </div>
                </dl>

                {selectedNode.externalLinks || selectedNode.iucnStatus ? (
                  <div style={{ marginTop: 12 }}>
                    <ExternalLinkBadges
                      externalLinks={selectedNode.externalLinks}
                      iucnStatus={selectedNode.iucnStatus}
                    />
                  </div>
                ) : null}

                <div className="vi-tax-detail-actions">
                  {selectedNode.slug &&
                  ["Species", "Subspecies", "Genus"].includes(selectedNode.rank) ? (
                    <Link
                      to={
                        isAdmin
                          ? `/admin/species/${selectedNode.slug}`
                          : `/species/${selectedNode.slug}`
                      }
                      className="button button-sm button-primary"
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      <Icon name="arrow-up-right" size={15} />
                      <span>Xem hồ sơ loài đầy đủ</span>
                    </Link>
                  ) : null}

                  <Link
                    to={
                      isAdmin
                        ? `/admin/specimens?taxonId=${selectedNode.id}`
                        : `/specimens/search?taxonId=${selectedNode.id}`
                    }
                    className="button button-sm button-secondary"
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    <Icon name="bug" size={15} />
                    <span>
                      Xem {(selectedNode.specimenCount || 0).toLocaleString("vi-VN")} mẫu vật thuộc nhánh này →
                    </span>
                  </Link>
                </div>
              </div>
            ) : (
              /* Helpful Introductory Guide when no node is selected yet */
              <div className="vi-tax-intro-guide" data-testid="taxonomy-intro-guide">
                <div className="eyebrow">HƯỚNG DẪN KHAI THÁC DANH PHÁP</div>
                <h2 className="vi-tax-detail-title" style={{ marginTop: 4 }}>
                  Trình duyệt Cây Phân loại Học
                </h2>
                <p className="vi-compact-subtitle" style={{ marginTop: 6 }}>
                  Chọn bất kỳ nút phân loại nào ở bảng bên trái hoặc dùng ô tìm kiếm nhanh để xem thông tin định danh, số nhánh con và liên kết hồ sơ loài.
                </p>

                <dl className="vi-sci-dl" style={{ marginTop: 14 }}>
                  <div className="vi-sci-row">
                    <dt>Cấu trúc 7 bậc chính</dt>
                    <dd>Kingdom → Phylum → Class → Order → Family → Genus → Species</dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>Số nhánh gốc hiện tại</dt>
                    <dd>
                      <strong>{tree.length}</strong> nhánh gốc đang hiển thị
                    </dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>Thao tác mở rộng</dt>
                    <dd>Nhấn biểu tượng mũi tên (▸) để tải động (lazy-load) các bậc phân loại con.</dd>
                  </div>
                </dl>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
