import React, { useState } from "react";

const RANKS = ["Kingdom", "Phylum", "Class", "Order", "Family", "Genus", "Species"];

export default function TaxonForm({ onSubmit }) {
  const [form, setForm] = useState({ rank: "Species", scientificName: "", status: "accepted", acceptedName: "" });

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <form
      className="placeholder-list"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="form-field">
        <label>Bậc phân loại</label>
        <select value={form.rank} onChange={update("rank")}>
          {RANKS.map((rank) => <option key={rank} value={rank}>{rank}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Tên khoa học</label>
        <input value={form.scientificName} onChange={update("scientificName")} placeholder="vd. Attacus atlas" required />
      </div>
      <div className="form-field">
        <label>Trạng thái danh pháp</label>
        <select value={form.status} onChange={update("status")}>
          <option value="accepted">Accepted</option>
          <option value="synonym">Synonym</option>
        </select>
      </div>
      {form.status === "synonym" ? (
        <div className="form-field">
          <label>Tên được chấp nhận (accepted name)</label>
          <input value={form.acceptedName} onChange={update("acceptedName")} placeholder="Tên khoa học accepted tương ứng" />
        </div>
      ) : null}
      <button type="submit" className="button button-primary" style={{ width: "100%" }}>Lưu taxon</button>
    </form>
  );
}
