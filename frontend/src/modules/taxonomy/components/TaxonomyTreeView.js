import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../../components/ui/Icon";
import taxonomyService from "../taxonomy.service";

function TreeNode({ node, depth, expandedIds, onToggle, selectedNodeId, onSelect }) {
  const hasChildren = node.children && node.children.length > 0;
  const expanded = expandedIds[node.id] !== false;
  const isSelected = node.id === selectedNodeId;

  return (
    <li>
      <div
        className={`taxonomy-node${isSelected ? " taxonomy-node-selected" : ""}`}
        style={{ paddingLeft: depth * 20 }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <button
            className="icon-button"
            style={{ width: 22, height: 22 }}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(node.id);
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
        <span className="status-badge status-public" style={{ marginLeft: "auto" }}>{node.specimenCount}</span>
      </div>
      {hasChildren && expanded ? (
        <ul className="taxonomy-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
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
          placeholder="Tìm nhanh theo tên khoa học..."
        />
        {suggestions.length > 0 ? (
          <div className="taxonomy-suggestions">
            {suggestions.map((node) => (
              <div key={node.id} className="taxonomy-suggestion-item" onClick={() => { onSelectNode(node); setQuery(""); setSuggestions([]); }}>
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
            onToggle={onToggleExpanded}
            selectedNodeId={selectedNodeId}
            onSelect={onSelectNode}
          />
        ))}
      </ul>
    </div>
  );
}
