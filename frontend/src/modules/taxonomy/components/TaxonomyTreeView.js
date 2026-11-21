import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../../components/ui/Icon";
import taxonomyService from "../taxonomy.service";
import useTaxonomyStore from "../taxonomy.store";

const RANKS = ["All", "Kingdom", "Phylum", "Class", "Order", "Family", "Genus", "Species"];
const INITIAL_CHILD_CAP = 80;

function TreeNode({
  node,
  depth,
  rankFilter,
  expandedIds,
  loadingNodeIds,
  onToggle,
  selectedNodeId,
  onSelect,
}) {
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_CHILD_CAP);
  const hasChildren = (node.children && node.children.length > 0) || (node.childCount || 0) > 0;
  const expanded = expandedIds[node.id] !== undefined ? expandedIds[node.id] : depth < 3;
  const isLoadingChildren = !!loadingNodeIds[node.id];
  const isSelected = node.id === selectedNodeId;
  const isItalicRank = ["Genus", "Species", "Subspecies"].includes(node.rank);

  const visibleChildren = useMemo(() => {
    const list = node.children || [];
    if (!rankFilter || rankFilter === "All") return list.slice(0, visibleLimit);
    return list.slice(0, visibleLimit);
  }, [node.children, rankFilter, visibleLimit]);

  const totalChildrenCount = (node.children || []).length;

  return (
    <li className="vi-tree-li">
      <div
        className={`vi-tree-row${isSelected ? " is-selected" : ""}${
          rankFilter !== "All" && node.rank === rankFilter ? " is-rank-match" : ""
        }`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => onSelect(node)}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? expanded : undefined}
      >
        {hasChildren ? (
          <button
            type="button"
            className="vi-tree-toggle-btn"
            onClick={(event) => {
              event.stopPropagation();
              onToggle(node.id, expanded);
            }}
            aria-label={expanded ? "Thu gọn nhánh" : "Mở rộng nhánh"}
          >
            <Icon name={expanded ? "chevron-down" : "chevron-right"} size={13} />
          </button>
        ) : (
          <span className="vi-tree-toggle-spacer" />
        )}

        <span className={`vi-tree-rank-badge rank-${(node.rank || "taxon").toLowerCase()}`}>
          {node.rank}
        </span>

        <span className="vi-tree-sci-name">
          {isItalicRank ? <em>{node.scientificName}</em> : <strong>{node.scientificName}</strong>}
        </span>

        {node.vernacularNameVn ? (
          <span className="vi-tree-common-name">({node.vernacularNameVn})</span>
        ) : null}

        <div className="vi-tree-metrics">
          {node.childCount > 0 ? (
            <span className="vi-tree-child-pill" title="Số đơn vị phân loại con">
              {node.childCount.toLocaleString("vi-VN")} nhánh
            </span>
          ) : null}
          <span className="vi-tree-spec-pill" title="Số mẫu vật liên kết">
            {(node.specimenCount || 0).toLocaleString("vi-VN")} mẫu
          </span>
        </div>
      </div>

      {expanded && isLoadingChildren ? (
        <div className="vi-tree-loading-row" style={{ paddingLeft: (depth + 1) * 16 + 28 }}>
          Đang tải các nhánh con...
        </div>
      ) : null}

      {expanded && visibleChildren.length > 0 ? (
        <ul className="vi-tree-children-ul" role="group">
          {visibleChildren.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              rankFilter={rankFilter}
              expandedIds={expandedIds}
              loadingNodeIds={loadingNodeIds}
              onToggle={onToggle}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
            />
          ))}
          {totalChildrenCount > visibleLimit ? (
            <li style={{ paddingLeft: (depth + 1) * 16 + 28, paddingBlock: 4 }}>
              <button
                type="button"
                className="button button-sm button-ghost"
                onClick={() => setVisibleLimit((l) => l + 100)}
              >
                Hiển thị thêm {Math.min(100, totalChildrenCount - visibleLimit)} nhánh con...
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}

export default function TaxonomyTreeView({
  nodes,
  selectedNodeId,
  onSelectNode,
  expandedIds,
  onToggleExpanded,
}) {
  const [query, setQuery] = useState("");
  const [rankFilter, setRankFilter] = useState("All");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const loadingNodeIds = useTaxonomyStore((state) => state.loadingNodeIds);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await taxonomyService.searchTaxa(query.trim());
        const filtered =
          rankFilter === "All"
            ? results
            : (results || []).filter(
                (r) => String(r.rank || "").toLowerCase() === rankFilter.toLowerCase()
              );
        setSuggestions(filtered || []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [query, rankFilter]);

  const roots = useMemo(() => nodes || [], [nodes]);

  return (
    <div className="card vi-taxonomy-explorer-left" data-testid="taxonomy-tree-view">
      {/* Compact Search & Rank Filter Toolbar */}
      <div className="vi-taxonomy-toolbar">
        <div className="vi-taxonomy-search-box">
          <Icon name="search" size={15} />
          <input
            type="text"
            aria-label="Tìm nhanh tên khoa học trong cây phân loại"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm nhanh tên khoa học (Order, Family, Genus, Species)..."
          />
          {searching ? <span className="vi-search-spinner">Đang tìm...</span> : null}
          {query ? (
            <button
              type="button"
              className="vi-clear-search-btn"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
              }}
              aria-label="Xóa từ khóa tìm kiếm"
            >
              ×
            </button>
          ) : null}

          {suggestions.length > 0 ? (
            <div className="vi-taxonomy-suggestions-dropdown">
              {suggestions.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className="vi-taxonomy-suggestion-row"
                  onClick={() => {
                    onSelectNode(node);
                    setQuery("");
                    setSuggestions([]);
                  }}
                >
                  <span>
                    <em>{node.scientificName}</em>
                    {node.vernacularNameVn ? ` (${node.vernacularNameVn})` : ""}
                  </span>
                  <span className="vi-tree-rank-badge">{node.rank}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <select
          className="vi-compact-select"
          aria-label="Lọc theo bậc phân loại"
          value={rankFilter}
          onChange={(e) => setRankFilter(e.target.value)}
        >
          {RANKS.map((r) => (
            <option key={r} value={r}>
              {r === "All" ? "Tất cả bậc (All Ranks)" : `Bậc: ${r}`}
            </option>
          ))}
        </select>
      </div>

      {/* Compact Scrollable Tree Viewport */}
      <ul className="vi-tree-root-ul" role="tree">
        {roots.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            rankFilter={rankFilter}
            expandedIds={expandedIds}
            loadingNodeIds={loadingNodeIds}
            onToggle={onToggleExpanded}
            selectedNodeId={selectedNodeId}
            onSelect={onSelectNode}
          />
        ))}
      </ul>
    </div>
  );
}
