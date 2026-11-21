import React from "react";

/**
 * ImportPreviewTable — Xem trước tối đa 20 dòng đầu với đánh dấu Đỏ (lỗi) / Vàng (cảnh báo) (F-SP-06).
 */
export default function ImportPreviewTable({ previewRows = [], totalRows = 0 }) {
  const rows = previewRows.slice(0, 20);

  if (rows.length === 0) {
    return (
      <div className="card" data-testid="import-preview-empty" style={{ padding: 16, color: "#64748b" }}>
        Chưa có dữ liệu xem trước.
      </div>
    );
  }

  return (
    <div className="card" data-testid="import-preview-table" style={{ padding: 16, overflowX: "auto" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
        Xem trước {rows.length} / {totalRows || rows.length} dòng đầu tiên
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
            <th style={{ padding: 6 }}>Dòng</th>
            <th style={{ padding: 6 }}>Trạng thái</th>
            <th style={{ padding: 6 }}>Tên khoa học</th>
            <th style={{ padding: 6 }}>Ngày thu</th>
            <th style={{ padding: 6 }}>Chi tiết kiểm tra</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const bg =
              r.severity === "error"
                ? "#FEE2E2"
                : r.severity === "warning"
                ? "#FEF9C3"
                : "#FFFFFF";
            const badgeText =
              r.severity === "error" ? "LỖI (ĐỎ)" : r.severity === "warning" ? "CẢNH BÁO (VÀNG)" : "HỢP LỆ";
            return (
              <tr
                key={r.rowIndex}
                data-testid={`preview-row-${r.rowIndex}`}
                data-severity={r.severity}
                style={{ background: bg, borderBottom: "1px solid #e2e8f0" }}
              >
                <td style={{ padding: 6 }}>{r.rowIndex}</td>
                <td style={{ padding: 6, fontWeight: 700 }}>{badgeText}</td>
                <td style={{ padding: 6 }}>
                  <em>{r.data?.scientificName || "—"}</em>
                </td>
                <td style={{ padding: 6 }}>{r.data?.collectionDate || "—"}</td>
                <td style={{ padding: 6 }}>
                  {(r.errors || []).concat(r.warnings || []).join("; ") || "Đạt chuẩn"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
