import React, { useState } from "react";
import Icon from "../../../components/ui/Icon";
import { useToast } from "../../../components/ui/ToastProvider";
import TaxonForm from "../components/TaxonForm";

const SEED_TAXA = [
  { id: 1, rank: "Species", scientificName: "Attacus atlas", status: "accepted" },
  { id: 2, rank: "Species", scientificName: "Attacus caesar", status: "accepted" },
  { id: 3, rank: "Species", scientificName: "Attacus edwardsii", status: "synonym", acceptedName: "Attacus atlas" },
];

export default function TaxonEditorPage() {
  const { toast } = useToast();
  const [taxa, setTaxa] = useState(SEED_TAXA);

  const handleSubmit = (form) => {
    setTaxa((current) => [{ id: current.length + 1, ...form }, ...current]);
    toast(`Đã lưu ${form.scientificName}`, "success");
  };

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Icon name="edit" size={14} />SCR-14 · Phân loại học & Hồ sơ loài</div>
          <h1>Quản lý danh pháp</h1>
          <p className="page-description">Thêm mới hoặc hiệu chỉnh các bậc taxon, thiết lập mối quan hệ đồng danh pháp (accepted/synonym).</p>
        </div>
      </div>

      <div className="screen-placeholder-grid">
        <section className="card panel">
          <div className="panel-title"><h2>Danh sách taxon</h2><span>{taxa.length} bản ghi</span></div>
          <div className="placeholder-list">
            {taxa.map((taxon) => (
              <div key={taxon.id} className="placeholder-row">
                <div>
                  <strong className="taxonomy-name">{taxon.scientificName}</strong>
                  <span>{taxon.rank}{taxon.status === "synonym" ? ` · synonym của ${taxon.acceptedName}` : ""}</span>
                </div>
                <span className={`status-badge ${taxon.status === "accepted" ? "status-public" : "status-warning"}`}>
                  {taxon.status === "accepted" ? "Accepted" : "Synonym"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <aside className="card panel">
          <div className="panel-title"><h2>Thêm / sửa taxon</h2><Icon name="plus" size={17} /></div>
          <TaxonForm onSubmit={handleSubmit} />
        </aside>
      </div>
    </div>
  );
}
