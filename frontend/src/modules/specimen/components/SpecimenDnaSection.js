import React, { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../../components/ui/Icon";
import { useToast } from "../../../components/ui/ToastProvider";

const BASE_COLORS = {
  A: "#16A34A", // Adenine - Green (BOLD Standard)
  T: "#DC2626", // Thymine - Red
  G: "#D97706", // Guanine - Amber/Gold
  C: "#2563EB", // Cytosine - Blue
};

const RANK_LABELS_VN = {
  Species: "Cùng Loài (Species Reference)",
  Genus: "Đại diện cùng Giống (Genus Reference)",
  Family: "Đại diện cùng Họ (Family Reference)",
  Order: "Đại diện cùng Bộ (Order Reference)",
  Class: "Đại diện lớp Côn trùng (Class Reference)",
};

function analyzeSequence(fastaRaw, fallbackGc) {
  const clean = String(fastaRaw || "")
    .toUpperCase()
    .replace(/[^ATGC]/g, "");
  const total = clean.length;
  if (total === 0) {
    return {
      clean: "",
      total: 0,
      pctA: 0,
      pctT: 0,
      pctG: 0,
      pctC: 0,
      gcPct: fallbackGc != null ? Number(fallbackGc).toFixed(1) : "—",
      bars: [],
    };
  }

  let a = 0;
  let t = 0;
  let g = 0;
  let c = 0;
  for (let i = 0; i < total; i++) {
    const ch = clean[i];
    if (ch === "A") a++;
    else if (ch === "T") t++;
    else if (ch === "G") g++;
    else if (ch === "C") c++;
  }

  const maxBars = Math.min(total, 140);
  const bars = [];
  for (let i = 0; i < maxBars; i++) {
    const idx = Math.floor((i / maxBars) * total);
    bars.push(clean[idx]);
  }

  const gcCalc = (((g + c) / total) * 100).toFixed(1);

  return {
    clean,
    total,
    pctA: ((a / total) * 100).toFixed(1),
    pctT: ((t / total) * 100).toFixed(1),
    pctG: ((g / total) * 100).toFixed(1),
    pctC: ((c / total) * 100).toFixed(1),
    gcPct: fallbackGc != null ? Number(fallbackGc).toFixed(1) : gcCalc,
    bars,
  };
}

function formatGenBankOriginLines(cleanSeq, expanded = false) {
  if (!cleanSeq) return [];
  const limitChars = expanded ? cleanSeq.length : Math.min(cleanSeq.length, 180);
  const slice = cleanSeq.slice(0, limitChars);
  const lines = [];

  for (let i = 0; i < slice.length; i += 60) {
    const rowStr = slice.slice(i, i + 60);
    const blocks = [];
    for (let j = 0; j < rowStr.length; j += 10) {
      blocks.push(rowStr.slice(j, j + 10));
    }
    lines.push({
      pos: i + 1,
      text: blocks.join(" "),
    });
  }
  return lines;
}

function DnaBarcodeRecordCard({ seq, isDirect, specimenScientificName, isAdmin, onCopyFasta }) {
  const [expanded, setExpanded] = useState(false);
  const stats = analyzeSequence(seq.fastaSequence, seq.gcContentPct);
  const originLines = formatGenBankOriginLines(stats.clean, expanded);
  const displaySciName = seq.scientificName || specimenScientificName || "Insecta sp.";
  const fastaHeader = `>${seq.genbankAccession || `VIETINSECT_DNA_${seq.id}`} ${displaySciName} [${seq.geneMarker || "COI"} barcode, ${seq.sequenceLengthBp || stats.total} bp]`;

  const handleDownloadFasta = () => {
    if (!stats.clean) return;
    const wrapped = stats.clean.match(/.{1,70}/g)?.join("\n") || stats.clean;
    const content = `${fastaHeader}\n${wrapped}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(seq.genbankAccession || `dna-${seq.id}`).replace(/[^a-zA-Z0-9._-]/g, "_")}.fasta`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`vi-dna-barcode-card ${isDirect ? "is-direct" : "is-reference"}`}>
      {/* 1. Top Header Bar */}
      <div className="vi-dna-card-header">
        <div className="vi-dna-card-title-group">
          <span className="dna-marker-badge">{seq.geneMarker || "COI"}</span>
          {(seq.boldProcessId || seq.binUri) && (
            <a
              href={`https://boldsystems.org/index.php/Taxbrowser_Taxonpage?taxid=${encodeURIComponent(
                seq.boldProcessId || seq.binUri
              )}`}
              target="_blank"
              rel="noreferrer"
              className="vi-bold-blue-badge"
              title="Liên kết hồ sơ BOLD Systems (F-DN-03)"
            >
              BOLD: {seq.boldProcessId || seq.binUri} ↗
            </a>
          )}
          <strong className="vi-dna-accession-code">
            {seq.genbankAccession || seq.boldProcessId || `DNA-${seq.id}`}
          </strong>
          <span className="vi-dna-organism-name">
            <em>{displaySciName}</em>
          </span>
        </div>

        <div className="vi-dna-card-badges">
          {isDirect ? (
            <span className="vi-dna-match-badge is-direct-badge">
              Trích xuất trực tiếp từ mẫu vật
            </span>
          ) : (
            <span className="vi-dna-match-badge is-ref-badge">
              {RANK_LABELS_VN[seq.referenceMatchRank] || "Tham chiếu phân loại"}
              {seq.referenceTaxonName ? ` · ${seq.referenceTaxonName}` : ""}
            </span>
          )}
          <span className="vi-dna-length-pill">
            {seq.sequenceLengthBp || stats.total || "—"} bp
          </span>
        </div>
      </div>

      {/* 2. BOLD Systems Chromatic Barcode Strip (A/T/G/C Color Illustration) */}
      {stats.bars.length > 0 && (
        <div className="vi-dna-chromatic-box">
          <div className="vi-dna-chromatic-top">
            <span className="vi-dna-chromatic-label">
              PHỔ MÃ VẠCH PHÂN TỬ ({seq.geneMarker || "COI"} CHROMATIC BARCODE · 5&apos; → 3&apos;)
            </span>
            <div className="vi-dna-base-legend">
              <span>
                <i style={{ background: BASE_COLORS.A }} /> A: {stats.pctA}%
              </span>
              <span>
                <i style={{ background: BASE_COLORS.T }} /> T: {stats.pctT}%
              </span>
              <span>
                <i style={{ background: BASE_COLORS.G }} /> G: {stats.pctG}%
              </span>
              <span>
                <i style={{ background: BASE_COLORS.C }} /> C: {stats.pctC}%
              </span>
              <strong className="vi-dna-gc-chip">GC: {stats.gcPct}%</strong>
            </div>
          </div>

          <div
            className="vi-dna-barcode-strip"
            title={`Chuỗi mã vạch ${displaySciName} (${seq.sequenceLengthBp || stats.total} bp, GC: ${stats.gcPct}%)`}
          >
            {stats.bars.map((base, idx) => (
              <span
                key={idx}
                className="vi-dna-barcode-bar"
                style={{ backgroundColor: BASE_COLORS[base] || "#94A3B8" }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. Structured Molecular Metadata Grid */}
      <div className="vi-dna-meta-grid">
        <div className="vi-dna-meta-cell">
          <span className="vi-dna-meta-key">NCBI GenBank Accession</span>
          <span className="vi-dna-meta-val">
            {seq.genbankAccession ? (
              <a
                href={`https://www.ncbi.nlm.nih.gov/nuccore/${encodeURIComponent(seq.genbankAccession)}`}
                target="_blank"
                rel="noreferrer"
                className="dna-ext-link"
              >
                {seq.genbankAccession} <Icon name="external-link" size={12} />
              </a>
            ) : (
              "—"
            )}
          </span>
        </div>

        <div className="vi-dna-meta-cell">
          <span className="vi-dna-meta-key">BOLD Process ID / BIN URI (F-DN-03)</span>
          <span className="vi-dna-meta-val">
            {seq.boldProcessId || seq.binUri ? (
              <a
                href={`https://boldsystems.org/index.php/Taxbrowser_Taxonpage?taxid=${encodeURIComponent(
                  seq.boldProcessId || seq.binUri
                )}`}
                target="_blank"
                rel="noreferrer"
                className="dna-ext-link"
              >
                {seq.boldProcessId || seq.binUri} <Icon name="external-link" size={12} />
              </a>
            ) : (
              <a
                href={`https://boldsystems.org/index.php/Taxbrowser_Taxonpage?taxid=${encodeURIComponent(
                  displaySciName
                )}`}
                target="_blank"
                rel="noreferrer"
                className="dna-ext-link"
              >
                Tra cứu BOLD ({displaySciName}) <Icon name="external-link" size={12} />
              </a>
            )}
          </span>
        </div>

        <div className="vi-dna-meta-cell">
          <span className="vi-dna-meta-key">Vùng Gen & Tỷ lệ G-C</span>
          <span className="vi-dna-meta-val">
            <strong>{seq.geneMarker || "COI"}</strong> · {seq.sequenceLengthBp || stats.total || "—"} bp (GC:{" "}
            {stats.gcPct}%)
          </span>
        </div>

        <div className="vi-dna-meta-cell">
          <span className="vi-dna-meta-key">Tác giả & Nguồn CSDL</span>
          <span className="vi-dna-meta-val" title={seq.authorName || ""}>
            {seq.authorName || "INSDC / GenBank Consortium"} ({seq.sourceDb || "GENBANK"}
            {seq.submissionDate ? ` · ${seq.submissionDate}` : ""})
          </span>
        </div>
      </div>

      {/* 4. Inline FASTA Nucleotide Sequence Preview (GenBank ORIGIN format) */}
      {originLines.length > 0 && (
        <div className="vi-dna-fasta-preview">
          <div className="vi-dna-fasta-header">
            <span className="vi-dna-fasta-header-text">{fastaHeader}</span>
            {stats.clean.length > 180 && (
              <button
                type="button"
                className="vi-dna-expand-btn"
                onClick={() => setExpanded((prev) => !prev)}
              >
                {expanded
                  ? "Thu gọn trình tự ▲"
                  : `Mở rộng toàn bộ ${stats.clean.length} bp ▼`}
              </button>
            )}
          </div>
          <div className="vi-dna-origin-body">
            {originLines.map((line) => (
              <div key={line.pos} className="vi-dna-origin-line">
                <span className="vi-dna-origin-pos">{line.pos}</span>
                <span className="vi-dna-origin-seq">{line.text}</span>
              </div>
            ))}
            {!expanded && stats.clean.length > 180 && (
              <div className="vi-dna-origin-more">
                ... còn {stats.clean.length - 180} nucleotide (nhấn &ldquo;Mở rộng toàn bộ&rdquo; hoặc
                &ldquo;Hồ sơ FASTA&rdquo; để xem đầy đủ)
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Action Footer */}
      <div className="vi-dna-card-actions">
        <div className="vi-dna-actions-left">
          {stats.clean && (
            <>
              <button
                type="button"
                className="button button-sm button-ghost"
                onClick={() =>
                  onCopyFasta(`${fastaHeader}\n${stats.clean}`, seq.genbankAccession || seq.id)
                }
              >
                <Icon name="copy" size={13} /> Sao chép FASTA
              </button>
              <button
                type="button"
                className="button button-sm button-ghost"
                onClick={handleDownloadFasta}
              >
                <Icon name="download" size={13} /> Tải tệp .fasta
              </button>
            </>
          )}
        </div>

        <Link
          to={isAdmin ? `/admin/dna/${seq.id}/fasta` : `/dna/${seq.id}/fasta`}
          className="button button-sm button-primary"
        >
          Hồ sơ FASTA chi tiết →
        </Link>
      </div>
    </div>
  );
}

export default function SpecimenDnaSection({
  dnaSequences = [],
  speciesDnaSequences = [],
  scientificName = "",
  isAdmin = false,
}) {
  const { toast } = useToast();
  const hasDirect = dnaSequences.length > 0;
  const hasSpecies = speciesDnaSequences.length > 0;

  const handleCopyFasta = (fastaText, label) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(fastaText);
      toast(`Đã sao chép trình tự FASTA (${label}) vào bộ nhớ tạm`, "success");
    }
  };

  return (
    <section className="vi-specimen-dna-section card">
      <div className="dna-section-header">
        <div className="dna-header-left">
          <Icon name="dna" size={18} />
          <div>
            <h3>Dữ liệu Phân tử & Mã vạch DNA (Molecular Barcodes)</h3>
            <span className="dna-header-subtitle">
              GenBank (NCBI) · BOLD Systems · Chuẩn Barcode COI
            </span>
          </div>
        </div>
        <div className="dna-counts-badges">
          {hasDirect && (
            <span className="status-badge status-public">
              {dnaSequences.length} trình tự trực tiếp
            </span>
          )}
          {!hasDirect && hasSpecies && (
            <span className="status-badge" style={{ background: "#EFF6FF", color: "#1D4ED8" }}>
              {speciesDnaSequences.length} trình tự tham chiếu
            </span>
          )}
          <Link
            to={
              isAdmin
                ? `/admin/dna?q=${encodeURIComponent(scientificName || "")}`
                : `/dna?q=${encodeURIComponent(scientificName || "")}`
            }
            className="button button-sm button-ghost"
          >
            Kho dữ liệu DNA →
          </Link>
        </div>
      </div>

      {/* 1. Trình tự liên kết trực tiếp với mẫu vật */}
      {hasDirect && (
        <div className="dna-records-container">
          <div className="vi-dna-stack">
            {dnaSequences.map((seq) => (
              <DnaBarcodeRecordCard
                key={seq.id}
                seq={seq}
                isDirect={true}
                specimenScientificName={scientificName}
                isAdmin={isAdmin}
                onCopyFasta={handleCopyFasta}
              />
            ))}
          </div>
        </div>
      )}

      {/* 2. Trình tự tham chiếu theo hệ thống phân loại (Species → Genus → Family → Order) */}
      {!hasDirect && hasSpecies && (
        <div className="dna-records-container">
          <div className="dna-species-notice">
            <Icon name="info" size={16} />
            <span>
              Mẫu vật bảo tàng này chưa giải trình tự PCR riêng. Hệ thống tự động đối chiếu và hiển thị
              <strong> chuỗi mã vạch DNA chuẩn quốc tế (NCBI GenBank / BOLD Systems)</strong> tương ứng
              với đơn vị phân loại của <em>{scientificName || "mẫu vật"}</em>:
            </span>
          </div>

          <div className="vi-dna-stack" style={{ marginTop: 12 }}>
            {speciesDnaSequences.map((seq) => (
              <DnaBarcodeRecordCard
                key={seq.id}
                seq={seq}
                isDirect={false}
                specimenScientificName={scientificName}
                isAdmin={isAdmin}
                onCopyFasta={handleCopyFasta}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. Trường hợp dự phòng nếu DB chưa có bản ghi nào */}
      {!hasDirect && !hasSpecies && (
        <div className="dna-empty-state">
          <p>Chưa có dữ liệu giải trình tự mã vạch DNA cho mẫu vật hoặc nhánh phân loại này.</p>
          {scientificName && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
              <a
                href={`https://www.ncbi.nlm.nih.gov/nuccore/?term=${encodeURIComponent(
                  scientificName + " COI"
                )}`}
                target="_blank"
                rel="noreferrer"
                className="button button-sm button-ghost"
              >
                <Icon name="external-link" size={13} /> Tra cứu trên NCBI GenBank ↗
              </a>
              <a
                href={`https://portal.boldsystems.org/result?query=${encodeURIComponent(
                  scientificName
                )}`}
                target="_blank"
                rel="noreferrer"
                className="button button-sm button-ghost"
              >
                <Icon name="external-link" size={13} /> Tra cứu trên BOLD Systems ↗
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
