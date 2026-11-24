import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/ToastProvider";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import { formatNumber } from "../../../utils/formatters";
import dnaService from "../dna.service";
import { getOrderColor } from "../../specimen/specimen.constants";

export default function DnaFastaDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const isAdmin = useIsAdminContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [record, setRecord] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const loadDetail = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await dnaService.getDnaById(id);
      setRecord(data);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Không tìm thấy trình tự DNA");
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const fastaLines = useMemo(() => {
    const seq = record?.fastaSequence || "";
    const out = [];
    for (let i = 0; i < seq.length; i += 70) {
      out.push({ pos: i + 1, text: seq.slice(i, i + 70) });
    }
    return out;
  }, [record]);

  const handleCopyFasta = async () => {
    if (!record?.fastaFormatted) return;
    try {
      await navigator.clipboard.writeText(record.fastaFormatted);
      toast("Đã sao chép trình tự chuẩn FASTA vào bộ nhớ tạm", "success");
    } catch {
      toast("Không thể truy cập clipboard trình duyệt", "error");
    }
  };

  const handleDownloadFasta = () => {
    if (!record?.fastaFormatted) return;
    const blob = new Blob([record.fastaFormatted], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${record.genbankAccession || record.boldProcessId || `dna-${record.id}`}.fasta`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Đã tải xuống tệp .fasta", "success");
  };

  if (status === "loading") {
    return (
      <div className="page-container page-content">
        <div className="card panel">
          <LoadingState label={t("dna.loadingFasta")} />
        </div>
      </div>
    );
  }

  if (status === "error" || !record) {
    return (
      <div className="page-container page-content">
        <div className="card panel">
          <EmptyState
            icon="alert"
            title={t("dna.notFoundFasta")}
            description={errorMsg}
            action={
              <button
                className="button button-primary"
                onClick={() => navigate(isAdmin ? "/admin/dna" : "/dna")}
              >
                {t("dna.backToDnaList")}
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const comp = record.composition || {
    counts: { A: 0, T: 0, G: 0, C: 0 },
    percentages: { A: 0, T: 0, G: 0, C: 0 },
  };
  const orderColor = getOrderColor(record.orderName);

  const baseBars = [
    { base: "A", label: "Adenine", pct: comp.percentages.A, count: comp.counts.A, color: "#2E7D32" },
    { base: "T", label: "Thymine", pct: comp.percentages.T, count: comp.counts.T, color: "#0F3820" },
    { base: "C", label: "Cytosine", pct: comp.percentages.C, count: comp.counts.C, color: "#9C7A1F" },
    { base: "G", label: "Guanine", pct: comp.percentages.G, count: comp.counts.G, color: "#1D4ED8" },
  ];

  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(isAdmin ? "/admin/dna" : "/dna");
    }
  };

  return (
    <div className="page-container page-content vi-page-enter">
      {/* Top Back & Breadcrumb Bar */}
      <div className="vi-header-nav-row" style={{ marginBottom: 14 }}>
        <div className="vi-header-nav-left">
          <button
            type="button"
            className="vi-back-page-btn"
            onClick={handleGoBack}
            title={t("common.back")}
          >
            <Icon name="chevron-left" size={15} />
            <span>{t("common.back")}</span>
          </button>

          <nav className="vi-specimen-breadcrumb" aria-label="Breadcrumb">
            <Link to={isAdmin ? "/admin/dashboard" : "/"}>{t("navigation.home")}</Link>
            <Icon name="chevron-right" size={12} />
            <Link to={isAdmin ? "/admin/dna" : "/dna"}>{t("dna.title")}</Link>
            <Icon name="chevron-right" size={12} />
            <span className="breadcrumb-current">
              {record.genbankAccession || record.boldProcessId || `DNA-${record.id}`}
            </span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name="dna" size={14} />
            {t("dna.fastaEyebrow", { marker: record.geneMarker })}
          </div>
          <h1 className="taxonomy-name" style={{ fontSize: "clamp(26px, 3vw, 40px)" }}>
            <em>{record.scientificName}</em>
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <span
              className="status-badge"
              style={{ background: orderColor, color: "#FFFFFF", borderColor: "#D1D5DB" }}
            >
              {t("specimenDetail.orderPrefix")}: {record.orderName || record.taxonName}
            </span>
            <span className="status-badge" style={{ background: "#E8F5E9", color: "#0F3820" }}>
              Marker: {record.geneMarker} · {record.sequenceLengthBp || 0} bp
            </span>
            <span className="status-badge" style={{ background: "#FFFFFF" }}>
              {t("specimenDetail.source")}: {record.sourceDb}
            </span>
            <span className={`status-badge ${record.isPublic ? "status-public" : "status-private"}`}>
              {record.isPublic ? "PUBLIC OPEN DATA" : "INTERNAL ONLY"}
            </span>
          </div>
        </div>

        <div className="hero-actions" style={{ marginTop: 0 }}>
          <button type="button" className="button button-ghost" onClick={handleCopyFasta}>
            <Icon name="copy" size={16} />
            {t("dna.copyFasta")}
          </button>
          <button type="button" className="button button-secondary" onClick={handleDownloadFasta}>
            <Icon name="download" size={16} />
            {t("dna.downloadFasta")}
          </button>
          {isAdmin ? (
            <button
              type="button"
              className="button button-primary"
              onClick={() => navigate(`/admin/dna/new?id=${record.id}`)}
            >
              <Icon name="edit" size={16} />
              {t("common.edit")}
            </button>
          ) : null}
        </div>
      </div>

      {/* Bố cục 2 cột: Khung FASTA + Phân bố Base (Trái) & Metadata (Phải) */}
      <div className="screen-placeholder-grid" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          {/* 1. Dark Emerald FASTA Viewer */}
          <section className="vi-fasta-terminal">
            <div className="vi-fasta-terminal-head">
              <span>FASTA SEQUENCE · IUPAC NUCLEOTIDE FORMAT</span>
              <span>
                {record.genbankAccession || record.boldProcessId || `DNA-${record.id}`}
              </span>
            </div>

            <div className="vi-fasta-terminal-body">
              <div className="vi-fasta-header-line">
                &gt;{record.genbankAccession || record.boldProcessId || `VIETINSECT-${record.id}`} |{" "}
                {record.scientificName} | {record.geneMarker} marker | {record.sequenceLengthBp || 0}{" "}
                bp
              </div>
              {fastaLines.length > 0 ? (
                fastaLines.map((line) => (
                  <div key={line.pos} className="vi-fasta-seq-row">
                    <span className="vi-fasta-pos">{String(line.pos).padStart(5, " ")}</span>
                    <span className="vi-fasta-bases">{line.text}</span>
                  </div>
                ))
              ) : (
                <div style={{ color: "#A0B8A6", padding: "12px 0" }}>
                  (Chưa đính kèm chuỗi nucleotide thô cho bản ghi này)
                </div>
              )}
            </div>

            <div className="vi-fasta-terminal-foot">
              <div>
                <span>G-C Content:</span>{" "}
                <strong>{comp.gcContentPct ?? record.gcContentPct ?? 0}%</strong>
              </div>
              <div>
                <span>A-T Content:</span>{" "}
                <strong>
                  {comp.atContentPct != null
                    ? `${comp.atContentPct}%`
                    : record.gcContentPct != null
                      ? `${(100 - record.gcContentPct).toFixed(2)}%`
                      : "0%"}
                </strong>
              </div>
              <div>
                <span>{t("dna.totalLength")}</span>{" "}
                <strong>{formatNumber(record.sequenceLengthBp || 0, i18n.language)} bp</strong>
              </div>
            </div>
          </section>

          {/* 2. Biểu đồ phân bố 4 loại Base A - T - C - G */}
          <section className="card panel">
            <div className="panel-title">
              <h2>{t("dna.baseDistTitle")}</h2>
              <span>{t("dna.baseDistSub")}</span>
            </div>

            <div className="vi-base-chart-grid">
              {baseBars.map((b) => (
                <div key={b.base} className="vi-base-bar-card">
                  <div className="vi-base-bar-track">
                    <div
                      className="vi-base-bar-fill"
                      style={{
                        height: `${Math.min(100, Math.max(6, b.pct * 1.8))}%`,
                        background: b.color,
                      }}
                    />
                  </div>
                  <strong style={{ fontSize: 18, marginTop: 8 }}>{b.base}</strong>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#111111" }}>{b.pct}%</span>
                  <small style={{ fontSize: 11, color: "var(--vi-muted)" }}>
                    {b.label} ({b.count} bp)
                  </small>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Cột phải: Metadata, Liên kết Mẫu vật & Quốc tế */}
        <aside className="card panel">
          <div className="panel-title">
            <h2>{t("dna.molecularInfoTitle")}</h2>
            <Icon name="dna" size={18} />
          </div>

          <div className="placeholder-list">
            <div className="placeholder-row">
              <div>
                <strong>GenBank Accession</strong>
                <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#111111" }}>
                  {record.genbankAccession || t("dna.notRegisteredGenbank")}
                </span>
              </div>
              {record.externalLinks?.ncbi ? (
                <a
                  href={record.externalLinks.ncbi}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-sm button-ghost"
                >
                  NCBI ↗
                </a>
              ) : null}
            </div>

            {record.boldProcessId ? (
              <div className="placeholder-row">
                <div>
                  <strong>BOLD Process ID</strong>
                  <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                    {record.boldProcessId}
                  </span>
                </div>
                {record.externalLinks?.bold ? (
                  <a
                    href={record.externalLinks.bold}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-sm button-ghost"
                  >
                    BOLD ↗
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="placeholder-row">
              <div>
                <strong>{t("dna.voucherFieldLabel")}</strong>
                <span>
                  {record.specimenCode
                    ? t("dna.linkedCode", { code: record.specimenCode })
                    : t("dna.standaloneRef")}
                </span>
              </div>
              {record.specimenId ? (
                <Link
                  to={
                    isAdmin
                      ? `/admin/specimens/${record.specimenId}`
                      : `/specimens/${record.specimenId}`
                  }
                  className="button button-sm button-secondary"
                >
                  {t("nav.catalog")} →
                </Link>
              ) : null}
            </div>

            <div className="placeholder-row">
              <div>
                <strong>{t("dna.linkedTaxonomy")}</strong>
                <span>
                  {[record.orderName, record.familyName, record.genusName]
                    .filter(Boolean)
                    .join(" → ") || record.taxonName}
                </span>
              </div>
            </div>

            <div className="placeholder-row">
              <div>
                <strong>{t("dna.authorVoucher")}</strong>
                <span>{record.authorName || "—"}</span>
              </div>
            </div>

            <div className="placeholder-row">
              <div>
                <strong>{t("dna.submissionDate")}</strong>
                <span>{record.submissionDate || "—"}</span>
              </div>
            </div>

            {record.primersInfo ? (
              <div className="placeholder-row">
                <div>
                  <strong>{t("dna.primersInfo")}</strong>
                  <span>{record.primersInfo}</span>
                </div>
              </div>
            ) : null}

            {record.pcrConditions ? (
              <div className="placeholder-row">
                <div>
                  <strong>{t("dna.pcrConditions")}</strong>
                  <span>{record.pcrConditions}</span>
                </div>
              </div>
            ) : null}

            {record.notes ? (
              <div className="placeholder-row">
                <div>
                  <strong>{t("dna.genbankDef")}</strong>
                  <span>{record.notes}</span>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
