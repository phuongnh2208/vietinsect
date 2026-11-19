import React from "react";
import { Link } from "react-router-dom";
import Icon from "../../../components/ui/Icon";

export default function SpecimenTaxonomyHierarchy({
  orderName,
  familyName,
  genusName,
  scientificName,
  taxonRank,
  isAdmin = false,
}) {
  const basePath = isAdmin ? "/admin/specimens" : "/specimens/search";

  const ranks = [
    { rank: "Giới (Kingdom)", name: "Animalia", term: "kingdom" },
    { rank: "Ngành (Phylum)", name: "Arthropoda", term: "phylum" },
    { rank: "Lớp (Class)", name: "Insecta", term: "class" },
    {
      rank: "Bộ (Order)",
      name: orderName,
      term: "order",
      link: orderName ? `${basePath}?order=${encodeURIComponent(orderName)}` : null,
    },
    {
      rank: "Họ (Family)",
      name: familyName,
      term: "family",
      link: familyName ? `${basePath}?q=${encodeURIComponent(familyName)}` : null,
    },
    {
      rank: "Giống/Chi (Genus)",
      name: genusName,
      term: "genus",
      link: genusName ? `${basePath}?q=${encodeURIComponent(genusName)}` : null,
      italic: true,
    },
    {
      rank: "Loài (Species)",
      name: scientificName,
      term: "species",
      italic: true,
      current: true,
    },
  ];

  return (
    <div className="vi-specimen-taxonomy card">
      <div className="taxonomy-header">
        <div className="taxonomy-header-title">
          <Icon name="tree" size={16} />
          <span>Vị trí phân loại học (Taxonomic Classification)</span>
        </div>
        {taxonRank && (
          <span className="taxonomy-rank-badge">
            Bậc định danh: <strong>{taxonRank}</strong>
          </span>
        )}
      </div>

      <div className="taxonomy-chain">
        {ranks.map((r, idx) => {
          if (!r.name) return null;
          return (
            <React.Fragment key={r.rank}>
              <div className={`taxonomy-node ${r.current ? "is-current" : ""}`}>
                <span className="taxonomy-node-rank">{r.rank}</span>
                {r.link ? (
                  <Link to={r.link} className={`taxonomy-node-name ${r.italic ? "is-italic" : ""}`}>
                    {r.name}
                  </Link>
                ) : (
                  <span className={`taxonomy-node-name ${r.italic ? "is-italic" : ""}`}>
                    {r.name}
                  </span>
                )}
              </div>
              {idx < ranks.length - 1 && ranks[idx + 1].name && (
                <span className="taxonomy-divider">
                  <Icon name="chevron-right" size={12} />
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
