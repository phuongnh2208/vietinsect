import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";

export default function SpecimenTaxonomyHierarchy({
  orderName,
  familyName,
  genusName,
  scientificName,
  taxonRank,
  isAdmin = false,
}) {
  const { t } = useTranslation();
  const basePath = isAdmin ? "/admin/specimens" : "/specimens/search";

  const ranks = [
    { rank: t("specimenDetail.rankKingdom"), name: "Animalia", term: "kingdom" },
    { rank: t("specimenDetail.rankPhylum"), name: "Arthropoda", term: "phylum" },
    { rank: t("specimenDetail.rankClass"), name: "Insecta", term: "class" },
    {
      rank: t("specimenDetail.rankOrder"),
      name: orderName,
      term: "order",
      link: orderName ? `${basePath}?order=${encodeURIComponent(orderName)}` : null,
    },
    {
      rank: t("specimenDetail.rankFamily"),
      name: familyName,
      term: "family",
      link: familyName ? `${basePath}?family=${encodeURIComponent(familyName)}` : null,
    },
    {
      rank: t("specimenDetail.rankGenus"),
      name: genusName,
      term: "genus",
      link: genusName ? `${basePath}?genus=${encodeURIComponent(genusName)}` : null,
      italic: true,
    },
    {
      rank: t("specimenDetail.rankSpecies"),
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
          <span>{t("specimenDetail.taxonomyTitle")}</span>
        </div>
        {taxonRank && (
          <span className="taxonomy-rank-badge">
            {t("specimenDetail.identifiedRank")} <strong>{taxonRank}</strong>
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
