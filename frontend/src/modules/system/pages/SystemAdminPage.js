import React, { useCallback, useEffect, useState } from "react";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/ToastProvider";
import systemService from "../system.service";

const ACTION_COLORS = {
  LOGIN: "#2E7D32",
  CREATE: "#0F3820",
  UPDATE: "#1D4ED8",
  UPDATE_CONFIG: "#6D28D9",
  UPLOAD_MEDIA: "#0284C7",
  TOGGLE_PUBLIC: "#9C7A1F",
  BATCH_PUBLIC: "#9C7A1F",
  DELETE: "#B0241A",
  DELETE_MEDIA: "#B0241A",
  CHANGE_PASSWORD: "#78350F",
};

export default function SystemAdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("audit"); // audit | config

  // Audit Log state
  const [auditFilters, setAuditFilters] = useState({
    q: "",
    actionType: "",
    targetTable: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    limit: 25,
  });
  const [auditItems, setAuditItems] = useState([]);
  const [auditPagination, setAuditPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 0 });
  const [loadingAudit, setLoadingAudit] = useState(true);

  // System Config state
  const [configs, setConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [draftValues, setDraftValues] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const res = await systemService.getAuditLogs(auditFilters);
      setAuditItems(res.items);
      setAuditPagination(res.pagination);
    } catch (err) {
      toast(err.response?.data?.message || "Không thể tải nhật ký Audit Log", "error");
    } finally {
      setLoadingAudit(false);
    }
  }, [auditFilters, toast]);

  const loadConfigs = useCallback(async () => {
    setLoadingConfigs(true);
    try {
      const list = await systemService.getConfigs();
      setConfigs(list);
      const drafts = {};
      list.forEach((c) => {
        drafts[c.key] = c.isSecret ? "" : String(c.value ?? "");
      });
      setDraftValues(drafts);
    } catch (err) {
      toast(err.response?.data?.message || "Không thể tải cấu hình hệ thống", "error");
    } finally {
      setLoadingConfigs(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === "audit") loadAudit();
    else loadConfigs();
  }, [activeTab, loadAudit, loadConfigs]);

  const handleSaveConfig = async (cfg) => {
    setSavingKey(cfg.key);
    try {
      let parsedValue = draftValues[cfg.key];
      if (!cfg.isSecret) {
        if (parsedValue === "true") parsedValue = true;
        else if (parsedValue === "false") parsedValue = false;
        else if (parsedValue !== "" && !Number.isNaN(Number(parsedValue))) {
          parsedValue = Number(parsedValue);
        }
      }

      const updated = await systemService.updateConfig(cfg.key, {
        value: parsedValue,
        category: cfg.category,
        description: cfg.description,
        isSecret: cfg.isSecret,
      });

      setConfigs((prev) => prev.map((item) => (item.key === cfg.key ? updated : item)));
      if (cfg.isSecret) {
        setDraftValues((prev) => ({ ...prev, [cfg.key]: "" }));
      }
      toast(
        cfg.isSecret
          ? `Đã mã hóa AES-256-GCM và lưu khóa bí mật "${cfg.key}"`
          : `Đã cập nhật cấu hình "${cfg.key}"`,
        "success",
      );
    } catch (err) {
      toast(err.response?.data?.message || "Không thể lưu cấu hình", "error");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name="settings" size={14} />
            Nhật ký Kiểm toán & Cấu hình Bảo mật Hệ thống
          </div>
          <h1>Quản trị hệ thống & Khóa tích hợp</h1>
          <p className="page-description">
            Theo dõi toàn bộ hoạt động trên bảng phân vùng <code>audit_logs</code> và quản lý khóa tích hợp
            quốc tế (NCBI API Key, GBIF) được mã hóa <strong>AES-256-GCM</strong> trong <code>system_config</code>.
          </p>
        </div>

        <div className="vi-segmented-group">
          <button
            type="button"
            className={activeTab === "audit" ? "active" : ""}
            onClick={() => setActiveTab("audit")}
          >
            Nhật ký Audit Log
          </button>
          <button
            type="button"
            className={activeTab === "config" ? "active" : ""}
            onClick={() => setActiveTab("config")}
          >
            Cấu hình & AES-256-GCM
          </button>
        </div>
      </div>

      {activeTab === "audit" ? (
        <>
          <section className="card panel" style={{ marginBottom: 18 }}>
            <div className="vi-filter-grid">
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label>Tìm tài khoản / Bảng / Đối tượng</label>
                <input
                  value={auditFilters.q}
                  onChange={(e) => setAuditFilters((p) => ({ ...p, q: e.target.value, page: 1 }))}
                  placeholder="VD: admin, specimens, ncbi_api_key..."
                />
              </div>

              <div className="form-field" style={{ marginBottom: 0 }}>
                <label>Loại thao tác (Action)</label>
                <select
                  value={auditFilters.actionType}
                  onChange={(e) =>
                    setAuditFilters((p) => ({ ...p, actionType: e.target.value, page: 1 }))
                  }
                >
                  <option value="">Tất cả thao tác</option>
                  <option value="LOGIN">LOGIN (Đăng nhập)</option>
                  <option value="CREATE">CREATE (Thêm mới)</option>
                  <option value="UPDATE">UPDATE (Chỉnh sửa)</option>
                  <option value="TOGGLE_PUBLIC">TOGGLE_PUBLIC (Đổi chia sẻ)</option>
                  <option value="UPLOAD_MEDIA">UPLOAD_MEDIA (Tải ảnh MinIO)</option>
                  <option value="UPDATE_CONFIG">UPDATE_CONFIG (Đổi cấu hình)</option>
                  <option value="DELETE">DELETE (Xóa bản ghi)</option>
                </select>
              </div>

              <div className="form-field" style={{ marginBottom: 0 }}>
                <label>Từ ngày</label>
                <input
                  type="date"
                  value={auditFilters.dateFrom}
                  onChange={(e) =>
                    setAuditFilters((p) => ({ ...p, dateFrom: e.target.value, page: 1 }))
                  }
                />
              </div>

              <div className="form-field" style={{ marginBottom: 0 }}>
                <label>Đến ngày</label>
                <input
                  type="date"
                  value={auditFilters.dateTo}
                  onChange={(e) =>
                    setAuditFilters((p) => ({ ...p, dateTo: e.target.value, page: 1 }))
                  }
                />
              </div>
            </div>
          </section>

          <section className="card" style={{ overflow: "hidden" }}>
            {loadingAudit ? (
              <LoadingState label="Đang đọc phân vùng nhật ký audit_logs..." />
            ) : auditItems.length === 0 ? (
              <EmptyState
                icon="shield"
                title="Chưa có bản ghi nhật ký khớp điều kiện"
                description="Mọi thao tác đăng nhập, thêm/sửa/xóa dữ liệu hoặc cấu hình đều sẽ tự động ghi vào đây."
              />
            ) : (
              <>
                <div className="vi-table-scroll">
                  <table className="vi-data-table">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Thao tác</th>
                        <th>Tài khoản</th>
                        <th>Bảng đích & ID</th>
                        <th>Địa chỉ IP</th>
                        <th>Chi tiết (JSONB)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditItems.map((log) => (
                        <tr key={`${log.id}-${log.timestamp}`}>
                          <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                            {new Date(log.timestamp).toLocaleString("vi-VN")}
                          </td>
                          <td>
                            <span
                              className="status-badge"
                              style={{
                                background: ACTION_COLORS[log.actionType] || "#111111",
                                color: "#FFFFFF",
                              }}
                            >
                              {log.actionType}
                            </span>
                          </td>
                          <td>
                            <strong>{log.adminUsername}</strong>
                          </td>
                          <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                            {log.targetTable || "—"} {log.targetId ? `#${log.targetId}` : ""}
                          </td>
                          <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                            {log.ipAddress || "local"}
                          </td>
                          <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--vi-muted)" }}>
                            {log.details ? JSON.stringify(log.details) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="vi-pagination-bar">
                  <div style={{ fontSize: 13, color: "var(--vi-muted)" }}>
                    Tổng cộng <strong>{auditPagination.total.toLocaleString()}</strong> sự kiện kiểm toán
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="button button-sm button-ghost"
                      disabled={auditPagination.page <= 1}
                      onClick={() => setAuditFilters((p) => ({ ...p, page: p.page - 1 }))}
                    >
                      ← Trước
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 800, padding: "0 8px" }}>
                      {auditPagination.page} / {Math.max(1, auditPagination.totalPages)}
                    </span>
                    <button
                      type="button"
                      className="button button-sm button-ghost"
                      disabled={auditPagination.page >= auditPagination.totalPages}
                      onClick={() => setAuditFilters((p) => ({ ...p, page: p.page + 1 }))}
                    >
                      Sau →
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      ) : (
        <section className="card panel">
          <div className="panel-title">
            <h2>Bảng Cấu hình & Khóa bí mật (system_config)</h2>
            <span>Mã hóa chuẩn AES-256-GCM (SRS §5.2)</span>
          </div>

          {loadingConfigs ? (
            <LoadingState label="Đang tải cấu hình hệ thống..." />
          ) : (
            <div className="placeholder-list">
              {configs.map((cfg) => (
                <div
                  key={cfg.key}
                  className="placeholder-row"
                  style={{ flexWrap: "wrap", alignItems: "center" }}
                >
                  <div style={{ flex: "1 1 320px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontFamily: "monospace", fontSize: 13 }}>{cfg.key}</strong>
                      <span className="status-badge" style={{ background: "#F2F7F2" }}>
                        {cfg.category}
                      </span>
                      {cfg.isSecret ? (
                        <span className="status-badge status-public">AES-256-GCM</span>
                      ) : null}
                    </div>
                    <span>{cfg.description}</span>
                    {cfg.isSecret && cfg.hasValue ? (
                      <div style={{ marginTop: 4, fontSize: 11, color: "#2E7D32", fontWeight: 700 }}>
                        Đang lưu khóa mã hóa: {cfg.value}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "1 1 280px" }}>
                    <input
                      type={cfg.isSecret ? "password" : "text"}
                      style={{
                        flex: 1,
                        minHeight: 38,
                        padding: "0 12px",
                        border: "1px solid #111111",
                        fontSize: 13,
                      }}
                      value={draftValues[cfg.key] ?? ""}
                      onChange={(e) =>
                        setDraftValues((prev) => ({ ...prev, [cfg.key]: e.target.value }))
                      }
                      placeholder={
                        cfg.isSecret
                          ? cfg.hasValue
                            ? "Nhập khóa mới để ghi đè (để trống nếu muốn xóa)..."
                            : "Nhập API Key cần mã hóa AES-256-GCM..."
                          : "Giá trị cấu hình..."
                      }
                    />
                    <button
                      type="button"
                      className="button button-sm button-primary"
                      style={{ minHeight: 38 }}
                      disabled={savingKey === cfg.key}
                      onClick={() => handleSaveConfig(cfg)}
                    >
                      {savingKey === cfg.key ? "Đang lưu..." : "Lưu"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
