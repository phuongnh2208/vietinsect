import React, { useRef, useState } from "react";
import Icon from "../../../components/ui/Icon";
import taxonomyService from "../taxonomy.service";

// F-TX-04: import danh lục Excel/CSV theo template chuẩn (tên khoa học, bậc phân loại, taxon cha).
export default function ImportChecklistPanel({ onImported }) {
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setError(null);
    try {
      const data = await taxonomyService.importChecklist(file);
      setResult(data);
      setStatus("done");
      onImported?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setStatus("error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <p className="page-description">
        Chấp nhận file .xlsx/.csv với cột: <strong>Tên khoa học</strong> (scientific_name), <strong>Bậc phân loại</strong> (taxon_rank),
        <strong> Taxon cha</strong> (parent_name — tùy chọn).
      </p>
      <input ref={fileInputRef} type="file" accept=".xlsx,.csv" onChange={handleFileChange} disabled={status === "uploading"} />

      {status === "uploading" ? <p className="page-description">Đang xử lý file...</p> : null}

      {status === "error" ? (
        <div className="alert-panel" style={{ marginTop: 12 }}>
          <Icon name="alert" size={19} />
          <div><strong>Import thất bại</strong><p>{error}</p></div>
        </div>
      ) : null}

      {status === "done" && result ? (
        <div className="placeholder-list" style={{ marginTop: 12 }}>
          <div className="placeholder-row">
            <div><strong>Đã thêm mới</strong><span>{result.inserted} taxon</span></div>
            <span className="status-badge status-public">{result.inserted}</span>
          </div>
          <div className="placeholder-row">
            <div><strong>Bỏ qua (đã tồn tại)</strong><span>{result.skipped} dòng</span></div>
            <span className="status-badge status-warning">{result.skipped}</span>
          </div>
          {result.conflicts.length > 0 ? (
            <div className="placeholder-row">
              <div>
                <strong>Lỗi/xung đột</strong>
                <span>{result.conflicts.map((c) => `Dòng ${c.row}: ${c.reason}`).join(" · ")}</span>
              </div>
              <span className="status-badge status-danger">{result.conflicts.length}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
