import React, { useMemo, useState } from "react";
import Icon from "../../../components/ui/Icon";

const MOCK_TREE = {
  id: "kingdom-animalia",
  rank: "Kingdom",
  name: "Animalia",
  common: "Animals",
  count: "1.2M+",
  children: [
    {
      id: "phylum-arthropoda",
      rank: "Phylum",
      name: "Arthropoda",
      common: "Arthropods",
      count: "900K",
      children: [
        {
          id: "class-insecta",
          rank: "Class",
          name: "Insecta",
          common: "Insects",
          count: "142,501",
          children: [
            {
              id: "order-lepidoptera",
              rank: "Order",
              name: "Lepidoptera",
              common: "Butterflies and Moths",
              count: "18,200",
              children: [
                {
                  id: "family-saturniidae",
                  rank: "Family",
                  name: "Saturniidae",
                  common: "Giant Silkworm Moths",
                  count: "2,300",
                  children: [
                    {
                      id: "genus-attacus",
                      rank: "Genus",
                      name: "Attacus",
                      common: "Atlas Moths",
                      count: "42",
                      children: [
                        { id: "species-attacus-atlas", rank: "Species", name: "Attacus atlas", common: "Atlas Moth / Bướm khế", count: "12 Samples", slug: "attacus-atlas" },
                        { id: "species-attacus-caesar", rank: "Species", name: "Attacus caesar", common: "", count: "5", slug: "attacus-caesar" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function flatten(node, acc = []) {
  acc.push(node);
  (node.children || []).forEach((child) => flatten(child, acc));
  return acc;
}

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
        <span className="taxonomy-name">{node.name}</span>
        {node.common ? <span className="taxonomy-common">({node.common})</span> : null}
        <span className="status-badge status-public" style={{ marginLeft: "auto" }}>{node.count}</span>
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

export default function TaxonomyTreeView({ selectedNodeId, onSelectNode }) {
  const [expandedIds, setExpandedIds] = useState({});
  const [query, setQuery] = useState("");
  const allNodes = useMemo(() => flatten(MOCK_TREE), []);
  const suggestions = useMemo(
    () => (query.length < 2 ? [] : allNodes.filter((node) => node.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)),
    [query, allNodes]
  );

  const toggle = (id) => setExpandedIds((current) => ({ ...current, [id]: current[id] === false ? true : false }));

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
              <div key={node.id} className="taxonomy-suggestion-item" onClick={() => { onSelectNode(node); setQuery(""); }}>
                <em>{node.name}</em> <span>{node.rank}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <ul className="taxonomy-tree-root">
        <TreeNode
          node={MOCK_TREE}
          depth={0}
          expandedIds={expandedIds}
          onToggle={toggle}
          selectedNodeId={selectedNodeId}
          onSelect={onSelectNode}
        />
      </ul>
    </div>
  );
}
