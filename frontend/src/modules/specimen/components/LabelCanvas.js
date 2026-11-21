import React from "react";

/**
 * LabelCanvas — Preview lưới nhãn mẫu vật chuẩn Specify 7 (SCR-11, F-SP-09).
 */
export default function LabelCanvas({ specimens = [], layoutConfig = {} }) {
  const {
    colsPerRow = 3,
    template = "specify7",
    fontFamily = "DejaVu Sans",
    fontSize = 10,
    includeQr = true,
    includeGps = true,
    institutionTitle = "VIỆN HÀN LÂM KH&CN VIỆT NAM (VAST)",
  } = layoutConfig;

  const minHeight = template === "museum-box" ? 200 : template === "pin-mini" ? 120 : 165;

  if (!specimens.length) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
        Chưa chọn mẫu vật nào để xem trước nhãn in.
      </div>
    );
  }

  return (
    <div
      className="card"
      data-testid="label-canvas"
      style={{
        padding: 24,
        background: "#FFFFFF",
        border: "2px solid #111111",
        fontFamily: `'${fontFamily}', 'DejaVu Sans', sans-serif`,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${colsPerRow}, 1fr)`,
          gap: 16,
        }}
      >
        {specimens.map((s) => (
          <div
            key={s.id}
            style={{
              border: "2px solid #111111",
              padding: 12,
              background: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight,
              fontSize,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: Math.max(8, fontSize - 1),
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  borderBottom: "1px solid #111111",
                  paddingBottom: 4,
                  marginBottom: 6,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{institutionTitle}</span>
                <span className="mono">#{s.id}</span>
              </div>
              <div style={{ fontSize: fontSize + 4, fontWeight: 800, color: "#111111", marginBottom: 2 }}>
                <em>{s.scientificName}</em>
              </div>
              <div style={{ fontSize: fontSize + 1, fontWeight: 700, color: "#0F3820", marginBottom: 6 }}>
                {s.orderName || "Insecta"} · {s.familyName || "—"}
              </div>
              <div style={{ fontSize, lineHeight: 1.45, color: "#111111" }}>
                <div>
                  <strong>Địa điểm:</strong> {s.provinceNameVn || "Việt Nam"}
                  {s.localityDetail ? ` (${s.localityDetail})` : ""}
                </div>
                {includeGps && s.latitude != null && (
                  <div className="mono" style={{ fontSize: Math.max(9, fontSize - 1) }}>
                    <strong>GPS:</strong> {Number(s.latitude).toFixed(4)}°N, {Number(s.longitude).toFixed(4)}°E
                  </div>
                )}
                <div>
                  <strong>Ngày thu:</strong> {s.collectionDate || "—"} · <strong>Leg:</strong>{" "}
                  {s.recordedBy || "VAST"}
                </div>
              </div>
            </div>

            <div
              style={{
                borderTop: "1px dashed #111111",
                paddingTop: 6,
                marginTop: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span className="mono" style={{ fontSize: fontSize + 1, fontWeight: 800 }}>
                {s.specimenCode}
              </span>
              {includeQr && (
                <span
                  className="mono"
                  style={{
                    fontSize: 9,
                    padding: "2px 6px",
                    border: "1px solid #111111",
                    background: "#F5F5F5",
                    fontWeight: 700,
                  }}
                >
                  QR · {s.specimenCode}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
