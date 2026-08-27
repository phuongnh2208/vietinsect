import React from "react";
import Icon from "../../../components/ui/Icon";

const IUCN_LABELS = {
  LC: "Least Concern",
  NT: "Near Threatened",
  VU: "Vulnerable",
  EN: "Endangered",
  CR: "Critically Endangered",
  EW: "Extinct in the Wild",
  EX: "Extinct",
  DD: "Data Deficient",
  NE: "Not Evaluated",
};

const IUCN_SEVERITY = {
  LC: "status-public",
  NT: "status-warning",
  VU: "status-warning",
  EN: "status-danger",
  CR: "status-danger",
  EW: "status-danger",
  EX: "status-danger",
};

const LINK_LABELS = {
  gbif: "GBIF",
  itis: "ITIS",
  catalogueOfLife: "Catalogue of Life",
  iucnRedList: "IUCN Red List",
};

// F-TX-06: liên kết CSDL quốc tế. BOLD TaxID hiển thị ở module DNA (SCR-20~22), không lặp lại ở đây.
export default function ExternalLinkBadges({ externalLinks = {}, iucnStatus }) {
  const linkEntries = Object.entries(externalLinks);

  if (linkEntries.length === 0 && !iucnStatus) return null;

  return (
    <div className="external-link-badges">
      {iucnStatus ? (
        <span className={`status-badge ${IUCN_SEVERITY[iucnStatus] || "status-public"}`} title={IUCN_LABELS[iucnStatus] || iucnStatus}>
          IUCN {iucnStatus}
        </span>
      ) : null}
      {linkEntries.map(([key, url]) => (
        <a key={key} href={url} target="_blank" rel="noreferrer" className="external-link-chip">
          <Icon name="arrow-up-right" size={12} />{LINK_LABELS[key] || key}
        </a>
      ))}
    </div>
  );
}
