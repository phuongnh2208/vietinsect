import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";
import specimenService from "../specimen.service";

export default function SpecimenAuditTimeline({ specimenId, history = [] }) {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const [items, setItems] = useState(history || []);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setItems(history || []);
  }, [history]);

  const handleFilterHistory = async () => {
    if (!specimenId) return;
    setLoading(true);
    try {
      const res = await specimenService.getSpecimenHistory(specimenId, { dateFrom, dateTo });
      setItems(res);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilter = () => {
    setDateFrom("");
    setDateTo("");
    setItems(history || []);
  };

  return (
    <section className="card vi-specimen-audit-section">
      <div className="audit-header" style={{ flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="archive" size={16} />
          <h3>
            {isEn
              ? `Change History & Audit Timeline (${items.length})`
              : `Lịch sử Kiểm toán & Thay đổi Dữ liệu (${items.length})`}
          </h3>
        </div>
        <span className="status-badge status-private">
          {isEn ? "ADMIN ONLY" : "CHỈ QUẢN TRỊ VIÊN"}
        </span>
      </div>

      {specimenId ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            marginBottom: 12,
            paddingBottom: 10,
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span>{isEn ? "From:" : "Từ ngày:"}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ padding: "4px 8px", fontSize: 12 }}
            />
          </label>
          <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span>{isEn ? "To:" : "Đến ngày:"}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ padding: "4px 8px", fontSize: 12 }}
            />
          </label>
          <button
            type="button"
            className="button button-sm button-secondary"
            disabled={loading}
            onClick={handleFilterHistory}
          >
            {loading ? "..." : isEn ? "Filter" : "Lọc thời gian"}
          </button>
          {(dateFrom || dateTo) && (
            <button type="button" className="button button-sm button-ghost" onClick={handleResetFilter}>
              {isEn ? "Reset" : "Đặt lại"}
            </button>
          )}
        </div>
      ) : null}

      {!items || items.length === 0 ? (
        <p className="audit-empty-desc">
          {isEn
            ? "No manual field changes recorded in the selected time range."
            : "Bản ghi này chưa phát sinh lần cập nhật thủ công nào trong khoảng thời gian đang chọn."}
        </p>
      ) : (
        <div className="audit-timeline-list">
          {items.map((item) => (
            <div key={item.id} className="audit-timeline-item">
              <div className="timeline-marker" />
              <div className="timeline-content">
                <div className="timeline-top">
                  <strong className="timeline-field">
                    {isEn ? "Field" : "Trường"}: {item.fieldName}
                  </strong>
                  <span className="timeline-time">
                    {new Date(item.changedAt).toLocaleString(isEn ? "en-US" : "vi-VN")}
                  </span>
                </div>
                <div className="timeline-diff">
                  <span className="val-old">{item.oldValue || (isEn ? "(empty)" : "(trống)")}</span>
                  <span className="val-arrow">→</span>
                  <span className="val-new">{item.newValue || (isEn ? "(empty)" : "(trống)")}</span>
                </div>
                <div className="timeline-user">
                  <span>{isEn ? "Modified by: " : "Thực hiện bởi: "}</span>
                  <strong>{item.changedByUsername || "admin"}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
