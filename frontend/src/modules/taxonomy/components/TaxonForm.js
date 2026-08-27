import React, { useEffect, useState } from "react";
import { TAXON_RANKS, IUCN_STATUSES } from "../taxonomy.constants";

const EMPTY_FORM = {
  parentId: "",
  taxonRank: "Species",
  scientificName: "",
  scientificNameAuthorship: "",
  yearDescribed: "",
  vernacularNameVn: "",
  vernacularNameEn: "",
  colId: "",
  itisTsn: "",
  gbifTaxonKey: "",
  iucnStatus: "",
  taxonNotes: "",
};

function toFormValues(taxon) {
  if (!taxon) return EMPTY_FORM;
  return {
    parentId: taxon.parentId || "",
    taxonRank: taxon.rank,
    scientificName: taxon.scientificName,
    scientificNameAuthorship: taxon.scientificNameAuthorship || "",
    yearDescribed: taxon.yearDescribed || "",
    vernacularNameVn: taxon.vernacularNameVn || "",
    vernacularNameEn: taxon.vernacularNameEn || "",
    colId: "",
    itisTsn: "",
    gbifTaxonKey: "",
    iucnStatus: taxon.iucnStatus || "",
    taxonNotes: taxon.notes || "",
  };
}

// F-TX-02: form CRUD taxon dùng chung cho tạo mới và chỉnh sửa; parentOptions là danh sách
// taxon đã duyệt phẳng (kèm depth) để dựng <select> phân cấp bằng thụt lề.
export default function TaxonForm({ editingTaxon, parentOptions, onSubmit, onCancelEdit, submitting }) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    setForm(toFormValues(editingTaxon));
  }, [editingTaxon]);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      ...form,
      parentId: form.parentId ? Number(form.parentId) : null,
      yearDescribed: form.yearDescribed ? Number(form.yearDescribed) : null,
      iucnStatus: form.iucnStatus || null,
    });
  };

  return (
    <form className="placeholder-list" onSubmit={handleSubmit}>
      <div className="form-field">
        <label>Taxon cha</label>
        <select value={form.parentId} onChange={update("parentId")}>
          <option value="">— Không có (taxon gốc) —</option>
          {parentOptions.filter((option) => option.id !== editingTaxon?.id).map((option) => (
            <option key={option.id} value={option.id}>{"— ".repeat(option.depth)}{option.rank} · {option.scientificName}</option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label>Bậc phân loại</label>
        <select value={form.taxonRank} onChange={update("taxonRank")} required>
          {TAXON_RANKS.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Tên khoa học</label>
        <input value={form.scientificName} onChange={update("scientificName")} placeholder="vd. Attacus atlas" required minLength={2} />
      </div>
      <div className="form-field">
        <label>Tác giả & năm công bố</label>
        <input value={form.scientificNameAuthorship} onChange={update("scientificNameAuthorship")} placeholder="vd. Linnaeus" />
      </div>
      <div className="form-field">
        <label>Năm công bố</label>
        <input type="number" value={form.yearDescribed} onChange={update("yearDescribed")} placeholder="vd. 1758" min={1750} max={new Date().getFullYear()} />
      </div>
      <div className="form-field">
        <label>Tên thường gọi (Tiếng Việt)</label>
        <input value={form.vernacularNameVn} onChange={update("vernacularNameVn")} placeholder="vd. Bướm khế" />
      </div>
      <div className="form-field">
        <label>Tên thường gọi (English)</label>
        <input value={form.vernacularNameEn} onChange={update("vernacularNameEn")} placeholder="e.g. Atlas Moth" />
      </div>
      <div className="form-field">
        <label>Tình trạng IUCN</label>
        <select value={form.iucnStatus} onChange={update("iucnStatus")}>
          <option value="">— Chưa đánh giá —</option>
          {IUCN_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>
      {!editingTaxon ? (
        <>
          <div className="form-field">
            <label>GBIF Taxon Key</label>
            <input value={form.gbifTaxonKey} onChange={update("gbifTaxonKey")} placeholder="vd. 1234567" />
          </div>
          <div className="form-field">
            <label>ITIS TSN</label>
            <input value={form.itisTsn} onChange={update("itisTsn")} placeholder="vd. 717435" />
          </div>
        </>
      ) : null}
      <div className="form-field">
        <label>Ghi chú</label>
        <textarea rows={3} value={form.taxonNotes} onChange={update("taxonNotes")} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" className="button button-primary" style={{ flex: 1 }} disabled={submitting}>
          {submitting ? "Đang lưu..." : editingTaxon ? "Cập nhật taxon" : "Thêm taxon"}
        </button>
        {editingTaxon ? <button type="button" className="button button-ghost" onClick={onCancelEdit}>Hủy</button> : null}
      </div>
    </form>
  );
}
