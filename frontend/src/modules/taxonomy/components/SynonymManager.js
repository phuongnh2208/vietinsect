import React, { useState } from "react";
import Icon from "../../../components/ui/Icon";

// F-TX-03: gắn synonym → accepted name. Chỉ taxon đang "accepted" mới được chọn làm accepted target.
export default function SynonymManager({ taxonOptions, onSetSynonym, onClearSynonym, submitting }) {
  const [synonymId, setSynonymId] = useState("");
  const [acceptedId, setAcceptedId] = useState("");

  const acceptedCandidates = taxonOptions.filter((taxon) => taxon.taxonomicStatus === "accepted" && String(taxon.id) !== synonymId);
  const currentSynonyms = taxonOptions.filter((taxon) => taxon.taxonomicStatus === "synonym");

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!synonymId || !acceptedId) return;
    onSetSynonym(Number(synonymId), Number(acceptedId));
    setSynonymId("");
    setAcceptedId("");
  };

  return (
    <div>
      <form className="placeholder-list" onSubmit={handleSubmit}>
        <div className="form-field">
          <label>Taxon là synonym</label>
          <select value={synonymId} onChange={(e) => setSynonymId(e.target.value)} required>
            <option value="">— Chọn taxon —</option>
            {taxonOptions.map((taxon) => <option key={taxon.id} value={taxon.id}>{taxon.rank} · {taxon.scientificName}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Là synonym của (accepted name)</label>
          <select value={acceptedId} onChange={(e) => setAcceptedId(e.target.value)} required>
            <option value="">— Chọn accepted taxon —</option>
            {acceptedCandidates.map((taxon) => <option key={taxon.id} value={taxon.id}>{taxon.rank} · {taxon.scientificName}</option>)}
          </select>
        </div>
        <button type="submit" className="button button-primary" style={{ width: "100%" }} disabled={submitting}>
          <Icon name="check" size={16} />Gắn đồng danh pháp
        </button>
      </form>

      {currentSynonyms.length > 0 ? (
        <div className="placeholder-list" style={{ marginTop: 16 }}>
          {currentSynonyms.map((taxon) => {
            const accepted = taxonOptions.find((option) => option.id === taxon.acceptedTaxonId);
            return (
              <div key={taxon.id} className="placeholder-row">
                <div>
                  <strong className="taxonomy-name">{taxon.scientificName}</strong>
                  <span>synonym của {accepted ? accepted.scientificName : `#${taxon.acceptedTaxonId}`}</span>
                </div>
                <button className="button button-ghost button-sm" onClick={() => onClearSynonym(taxon.id)}>Gỡ</button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
