import React, { useState } from "react";

const TARGET_FIELDS = [
  { key: "specimenCode", label: "Mã mẫu (specimenCode)" },
  { key: "scientificName", label: "Tên khoa học (scientificName) *" },
  { key: "commonNameVn", label: "Tên tiếng Việt (commonNameVn)" },
  { key: "orderName", label: "Bộ (orderName)" },
  { key: "familyName", label: "Họ (familyName)" },
  { key: "genusName", label: "Giống (genusName)" },
  { key: "provinceName", label: "Tỉnh/Thành (provinceName)" },
  { key: "localityDetail", label: "Địa điểm chi tiết (localityDetail)" },
  { key: "latitude", label: "Vĩ độ (latitude)" },
  { key: "longitude", label: "Kinh độ (longitude)" },
  { key: "collectionDate", label: "Ngày thu (collectionDate) *" },
  { key: "recordedBy", label: "Người thu (recordedBy)" },
  { key: "notes", label: "Ghi chú (notes)" },
  { key: "isPublic", label: "Công khai (isPublic)" },
];

/**
 * ColumnMapperModal — Kéo thả (drag-and-drop) hoặc chọn để ánh xạ cột file Excel/CSV vào trường chuẩn 22 cột (F-SP-06).
 */
export default function ColumnMapperModal({
  open = false,
  sourceColumns = [],
  initialMapping = {},
  onApply,
  onClose,
}) {
  const [mapping, setMapping] = useState(initialMapping);
  const [draggedCol, setDraggedCol] = useState(null);

  if (!open) return null;

  const handleDropOnField = (fieldKey) => {
    if (!draggedCol) return;
    setMapping((prev) => ({ ...prev, [fieldKey]: draggedCol }));
    setDraggedCol(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Ánh xạ cột dữ liệu import"
      data-testid="column-mapper-modal"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div className="card" style={{ width: "min(820px, 94vw)", maxHeight: "85vh", overflow: "auto", padding: 20, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Ánh xạ cột Import (Kéo thả tên cột file vào trường đích)</h3>
          <button type="button" className="button button-ghost" onClick={onClose}>
            Đóng
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Cột trong file nguồn ({sourceColumns.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sourceColumns.map((col) => (
                <div
                  key={col}
                  draggable
                  onDragStart={() => setDraggedCol(col)}
                  data-testid={`source-col-${col}`}
                  style={{
                    padding: "4px 10px",
                    border: "1px solid #0F3820",
                    borderRadius: 6,
                    background: "#F0FDF4",
                    cursor: "grab",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {col}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Trường dữ liệu VietInsect</div>
            <div style={{ display: "grid", gap: 8 }}>
              {TARGET_FIELDS.map((f) => (
                <div
                  key={f.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropOnField(f.key)}
                  data-testid={`target-field-${f.key}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    border: "1px dashed #94a3b8",
                    borderRadius: 6,
                    background: mapping[f.key] ? "#ECFDF5" : "#F8FAFC",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{f.label}</span>
                  <select
                    aria-label={`Chọn cột cho ${f.key}`}
                    value={mapping[f.key] || ""}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ fontSize: 12, padding: "2px 6px" }}
                  >
                    <option value="">-- Chưa gán --</option>
                    {sourceColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="button button-ghost" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => onApply && onApply(mapping)}
          >
            Áp dụng ánh xạ
          </button>
        </div>
      </div>
    </div>
  );
}
