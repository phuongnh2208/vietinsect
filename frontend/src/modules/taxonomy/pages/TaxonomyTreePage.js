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
  const { t, i18n } = useTranslation();
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

  const notProvided = t("media.notProvided");

  return (
    <div className="page-container page-content vi-page-enter" data-testid="taxonomy-tree-page">
      {/* Compact Header */}
      <div className="vi-compact-page-header">
        <div>
          <div className="eyebrow">
            <Icon name="tree" size={13} />
            <span>{t("taxonomy.eyebrow")}</span>
          </div>
          <h1 className="vi-compact-h1">{t("taxonomy.treeTitle")}</h1>
          <p className="vi-compact-subtitle">{t("taxonomy.treeSubtitle")}</p>
        </div>
        {isAdmin ? (
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="button button-sm button-primary"
              onClick={() => navigate("/admin/taxonomy/editor")}
            >
              <Icon name="edit" size={15} />
              <span>{t("taxonomy.manageNomenclature")}</span>
            </button>
          </div>
        ) : null}
      </div>

      {treeStatus === "loading" || treeStatus === "idle" ? (
        <div className="card panel">
          <LoadingState label={t("taxonomy.loadingTree")} />
        </div>
      ) : treeStatus === "error" ? (
        <div className="card panel">
          <EmptyState
            icon="alert"
            title={t("taxonomy.loadErrorTitle")}
            description={treeError}
            action={
              <button
                type="button"
                className="button button-ghost"
                onClick={() => fetchTree({ force: true })}
              >
                <Icon name="arrow-up-right" size={16} />
                {t("specimen.retry")}
              </button>
            }
          />
        </div>
      ) : !tree || tree.length === 0 ? (
        <div className="card panel">
          <EmptyState
            icon="tree"
            title={t("taxonomy.emptyTitle")}
            description={t("taxonomy.emptyDesc")}
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
                    <dt>{t("taxonomy.scientificName")}</dt>
                    <dd>
                      <strong>
                        <em>{selectedNode.scientificName}</em>
                      </strong>
                    </dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>{t("taxonomy.rank")}</dt>
                    <dd>{selectedNode.rank || notProvided}</dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>{t("taxonomy.vernacularBoth")}</dt>
                    <dd>
                      {selectedNode.vernacularNameVn || selectedNode.vernacularNameEn
                        ? `${selectedNode.vernacularNameVn || notProvided} / ${
                            selectedNode.vernacularNameEn || notProvided
                          }`
                        : notProvided}
                    </dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>{t("taxonomy.parentTaxon")}</dt>
                    <dd>
                      {selectedNode.parentName ||
                        (selectedNode.parentId ? `Taxon #${selectedNode.parentId}` : t("taxonomy.rootNode"))}
                    </dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>{t("taxonomy.childCountLabel")}</dt>
                    <dd>
                      <strong>{t("taxonomy.childUnits", { count: (selectedNode.childCount || 0).toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN") })}</strong>
                    </dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>{t("taxonomy.linkedSpecimensLabel")}</dt>
                    <dd>
                      <strong>{t("taxonomy.specimenUnits", { count: (selectedNode.specimenCount || 0).toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN") })}</strong>
                    </dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>{t("taxonomy.status")}</dt>
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
                      <span>{t("taxonomy.viewFullProfile")}</span>
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
                      {t("taxonomy.viewBranchSpecimens", {
                        count: (selectedNode.specimenCount || 0).toLocaleString(i18n.language.startsWith("en") ? "en-US" : "vi-VN"),
                      })}
                    </span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="vi-tax-intro-guide" data-testid="taxonomy-intro-guide">
                <div className="eyebrow">{t("taxonomy.guideEyebrow")}</div>
                <h2 className="vi-tax-detail-title" style={{ marginTop: 4 }}>
                  {t("taxonomy.guideTitle")}
                </h2>
                <p className="vi-compact-subtitle" style={{ marginTop: 6 }}>
                  {t("taxonomy.guideDesc")}
                </p>

                <dl className="vi-sci-dl" style={{ marginTop: 14 }}>
                  <div className="vi-sci-row">
                    <dt>{t("taxonomy.guideStructure")}</dt>
                    <dd>Kingdom → Phylum → Class → Order → Family → Genus → Species</dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>{t("taxonomy.guideRoots")}</dt>
                    <dd>
                      <strong>{t("taxonomy.guideRootsCount", { count: tree.length })}</strong>
                    </dd>
                  </div>
                  <div className="vi-sci-row">
                    <dt>{t("taxonomy.guideExpand")}</dt>
                    <dd>{t("taxonomy.guideExpandDesc")}</dd>
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
