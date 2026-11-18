import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../../components/ui/Icon";
import taxonomyService from "../taxonomy.service";
import useTaxonomyStore from "../taxonomy.store";

function TreeNode({ node, depth, expandedIds, loadingNodeIds, onToggle, selectedNodeId, onSelect }) {
  const hasChildren = (node.children && node.children.length > 0) || (node.childCount || 0) > 0;
  // Mặc định mở đến bậc Class (depth < 3) để thấy ngay 16 Bộ (Order), thu gọn từ Order trở xuống tránh render 114k DOM nodes
  const expanded = expandedIds[node.id] !== undefined ? expandedIds[node.id] : depth < 3;
  const isLoadingChildren = !!loadingNodeIds[node.id];
  const isSelected = node.id === selectedNodeId;

  return (
    <li>
      <div
        className={`taxonomy-node${isSelected ? " taxonomy-node-selected" : ""}`}
        style={{ paddingLeft: depth * 18 }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <button
            className="icon-button"
            style={{ width: 22, height: 22 }}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(node.id, expanded);
            }}
            aria-label={expanded ? "Thu gọn" : "Mở rộng"}
          >
            <Icon name={expanded ? "chevron-down" : "arrow-up-right"} size={14} />
          </button>
        ) : (
          <span style={{ width: 22, display: "inline-block" }} />
        )}
        <span className="taxonomy-rank">{node.rank}</span>
        <span className="taxonomy-name">{node.scientificName}</span>
        {node.vernacularNameVn ? <span className="taxonomy-common">({node.vernacularNameVn})</span> : null}
        <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
          {node.childCount > 0 ? (
            <span style={{ fontSize: 11, color: "var(--vi-muted)", fontWeight: 600 }}>
              {node.childCount.toLocaleString()} nhánh
            </span>
          ) : null}
          <span className="status-badge status-public">{(node.specimenCount || 0).toLocaleString()}</span>
        </div>
      </div>
      {expanded && isLoadingChildren ? (
        <div style={{ padding: `6px 12px 6px ${(depth + 1) * 18 + 16}px`, fontSize: 12, color: "var(--vi-muted)" }}>
          Đang tải danh pháp con...
        </div>
      ) : null}
      {expanded && node.children && node.children.length > 0 ? (
        <ul className="taxonomy-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              loadingNodeIds={loadingNodeIds}
              onToggle={onToggle}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function TaxonomyTreeView({ nodes, selectedNodeId, onSelectNode, expandedIds, onToggleExpanded }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const loadingNodeIds = useTaxonomyStore((state) => state.loadingNodeIds);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return undefined;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await taxonomyService.searchTaxa(query.trim());
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const roots = useMemo(() => nodes || [], [nodes]);

  return (
    <div className="card panel taxonomy-tree-pane">
      <div className="taxonomy-search">
        <Icon name="search" size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm nhanh theo tên khoa học (Genus, Family, Species)..."
        />
        {suggestions.length > 0 ? (
          <div className="taxonomy-suggestions">
            {suggestions.map((node) => (
              <div
                key={node.id}
                className="taxonomy-suggestion-item"
                onClick={() => {
                  onSelectNode(node);
                  setQuery("");
                  setSuggestions([]);
                }}
              >
                <em>{node.scientificName}</em> <span>{node.rank}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <ul className="taxonomy-tree-root">
        {roots.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
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
