import React, { useState } from "react";

const SHOT_ANGLES = [
  { value: "habitus", label: "Toàn thân (Habitus)" },
  { value: "dorsal", label: "Mặt lưng (Dorsal)" },
  { value: "ventral", label: "Mặt bụng (Ventral)" },
  { value: "lateral", label: "Mặt bên (Lateral)" },
  { value: "genitalia", label: "Cơ quan sinh dục (Genitalia)" },
  { value: "label", label: "Nhãn mẫu vật (Label)" },
];

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);

/**
 * ImageUploadZone — Kéo thả nhiều ảnh JPG/PNG, gắn nhãn góc chụp, xem trước thumbnail (F-SP-08).
 */
export default function ImageUploadZone({ onFilesSelected, disabled = false }) {
  const [shotType, setShotType] = useState("dorsal");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (fileList) => {
    setError("");
    const accepted = [];
    const rejected = [];

    Array.from(fileList || []).forEach((file) => {
      if (!ALLOWED_TYPES.has(file.type)) {
        rejected.push(`${file.name}: chỉ chấp nhận JPG/PNG`);
      } else if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name}: vượt quá 15MB`);
      } else {
        accepted.push({
          file,
          name: file.name,
          size: file.size,
          shotType,
        });
      }
    });

    if (rejected.length > 0) {
      setError(rejected.join("; "));
    }
    if (accepted.length > 0) {
      setItems((prev) => [...prev, ...accepted]);
      if (onFilesSelected) {
        onFilesSelected(accepted);
      }
    }
  };

  return (
    <div className="card" data-testid="image-upload-zone" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong>Tải lên nhiều ảnh mẫu vật (JPG/PNG, tối đa 15MB/ảnh)</strong>
        <label style={{ fontSize: 12 }}>
          Góc chụp:{" "}
          <select
            aria-label="Chọn góc chụp ảnh"
            value={shotType}
            onChange={(e) => setShotType(e.target.value)}
            disabled={disabled}
          >
            {SHOT_ANGLES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        data-testid="image-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!disabled) handleFiles(e.dataTransfer?.files);
        }}
        style={{
          border: `2px dashed ${isDragging ? "#0F3820" : "#94a3b8"}`,
          borderRadius: 8,
          padding: 20,
          textAlign: "center",
          background: isDragging ? "#F0FDF4" : "#F8FAFC",
        }}
      >
        <p style={{ margin: "0 0 8px 0", fontSize: 13 }}>
          Kéo thả nhiều ảnh vào đây hoặc chọn từ máy tính
        </p>
        <input
          type="file"
          aria-label="Chọn tệp ảnh mẫu vật"
          accept="image/jpeg,image/png"
          multiple
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <div role="alert" style={{ color: "#b91c1c", fontSize: 12, marginTop: 8 }}>
          {error}
        </div>
      )}

      {items.length > 0 && (
        <ul data-testid="image-upload-list" style={{ marginTop: 10, paddingLeft: 18, fontSize: 12 }}>
          {items.map((it, idx) => (
            <li key={`${it.name}-${idx}`}>
              {it.name} — góc chụp: <strong>{it.shotType}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
