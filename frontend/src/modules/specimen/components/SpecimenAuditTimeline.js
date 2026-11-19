import React from "react";
import Icon from "../../../components/ui/Icon";

export default function SpecimenAuditTimeline({ history = [] }) {
  if (!history || history.length === 0) {
    return (
      <section className="card vi-specimen-audit-section">
        <div className="audit-header">
          <Icon name="archive" size={16} />
          <h3>Lịch sử Kiểm toán & Thay đổi Dữ liệu (Audit Log)</h3>
        </div>
        <p className="audit-empty-desc">
          Bản ghi này chưa phát sinh lần cập nhật thủ công nào kể từ thời điểm nhập liệu ban đầu.
        </p>
      </section>
    );
  }

  return (
    <section className="card vi-specimen-audit-section">
      <div className="audit-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="archive" size={16} />
          <h3>Lịch sử Kiểm toán & Thay đổi Dữ liệu ({history.length})</h3>
        </div>
        <span className="status-badge status-private">CHỈ QUẢN TRỊ VIÊN</span>
      </div>

      <div className="audit-timeline-list">
        {history.map((item) => (
          <div key={item.id} className="audit-timeline-item">
            <div className="timeline-marker" />
            <div className="timeline-content">
              <div className="timeline-top">
                <strong className="timeline-field">Trường: {item.fieldName}</strong>
                <span className="timeline-time">
                  {new Date(item.changedAt).toLocaleString("vi-VN")}
                </span>
              </div>
              <div className="timeline-diff">
                <span className="val-old">{item.oldValue || "(trống)"}</span>
                <span className="val-arrow">→</span>
                <span className="val-new">{item.newValue || "(trống)"}</span>
              </div>
              <div className="timeline-user">
                <span>Thực hiện bởi: </span>
                <strong>{item.changedByUsername || "admin"}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
