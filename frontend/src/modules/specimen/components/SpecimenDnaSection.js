import React from "react";
import { Link } from "react-router-dom";
import Icon from "../../../components/ui/Icon";

export default function SpecimenDnaSection({
  dnaSequences = [],
  speciesDnaSequences = [],
  scientificName = "",
  isAdmin = false,
}) {
  const hasDirect = dnaSequences.length > 0;
  const hasSpecies = speciesDnaSequences.length > 0;

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
              {dnaSequences.length} liên kết trực tiếp
            </span>
          )}
          {!hasDirect && hasSpecies && (
            <span className="status-badge" style={{ background: "#F0F4FF", color: "#1D4ED8" }}>
              {speciesDnaSequences.length} tham chiếu loài
            </span>
          )}
        </div>
      </div>

      {/* 1. Trình tự liên kết trực tiếp */}
      {hasDirect && (
        <div className="dna-records-container">
          <h4 className="dna-subgroup-title">Chuỗi mã vạch trích xuất từ mẫu vật này:</h4>
          <div className="dna-cards-grid">
            {dnaSequences.map((seq) => (
              <div key={seq.id} className="dna-record-card">
                <div className="dna-card-top">
                  <div className="dna-accession-box">
                    <span className="dna-marker-badge">{seq.geneMarker || "COI"}</span>
                    <strong>{seq.genbankAccession || `DNA #${seq.id}`}</strong>
                  </div>
                  <span className="dna-bp-chip">{seq.sequenceLengthBp || "—"} bp</span>
                </div>

                <div className="dna-card-body">
                  {seq.boldProcessId && (
                    <div className="dna-field-row">
                      <span>Mã BOLD Process ID:</span>
                      <a
                        href={`https://boldsystems.org/index.php/Taxbrowser_Taxonpage?taxid=${encodeURIComponent(seq.boldProcessId)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="dna-ext-link"
                      >
                        {seq.boldProcessId} <Icon name="external-link" size={12} />
                      </a>
                    </div>
                  )}
                  {seq.genbankAccession && (
                    <div className="dna-field-row">
                      <span>GenBank Accession:</span>
                      <a
                        href={`https://www.ncbi.nlm.nih.gov/nuccore/${seq.genbankAccession}`}
                        target="_blank"
                        rel="noreferrer"
                        className="dna-ext-link"
                      >
                        {seq.genbankAccession} <Icon name="external-link" size={12} />
                      </a>
                    </div>
                  )}
                  {seq.authorName && (
                    <div className="dna-field-row">
                      <span>Tác giả công bố:</span>
                      <span className="dna-author-val">{seq.authorName}</span>
                    </div>
                  )}
                </div>

                <div className="dna-card-footer">
                  <Link
                    to={isAdmin ? `/admin/dna/${seq.id}/fasta` : `/dna/${seq.id}/fasta`}
                    className="button button-sm button-primary"
                  >
                    Xem chuỗi FASTA →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Trình tự tham chiếu cấp loài */}
      {!hasDirect && hasSpecies && (
        <div className="dna-records-container">
          <div className="dna-species-notice">
            <Icon name="info" size={16} />
            <span>
              Mẫu vật khô này chưa qua phân tích PCR trực tiếp. Dưới đây là các chuỗi mã vạch DNA chuẩn
              quốc tế của loài <em>{scientificName}</em> đã được thẩm định trên NCBI GenBank / BOLD:
            </span>
          </div>

          <div className="dna-cards-grid" style={{ marginTop: 12 }}>
            {speciesDnaSequences.map((seq) => (
              <div key={seq.id} className="dna-record-card is-species-ref">
                <div className="dna-card-top">
                  <div className="dna-accession-box">
                    <span className="dna-marker-badge">{seq.geneMarker || "COI"}</span>
                    <strong>{seq.genbankAccession || `DNA #${seq.id}`}</strong>
                  </div>
                  <span className="dna-bp-chip">{seq.sequenceLengthBp || "—"} bp</span>
                </div>

                <div className="dna-card-body">
                  {seq.boldProcessId && (
                    <div className="dna-field-row">
                      <span>BOLD Systems:</span>
                      <a
                        href={`https://boldsystems.org/index.php/Taxbrowser_Taxonpage?taxid=${encodeURIComponent(seq.boldProcessId)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="dna-ext-link"
                      >
                        {seq.boldProcessId} <Icon name="external-link" size={12} />
                      </a>
                    </div>
                  )}
                  {seq.genbankAccession && (
                    <div className="dna-field-row">
                      <span>NCBI GenBank:</span>
                      <a
                        href={`https://www.ncbi.nlm.nih.gov/nuccore/${seq.genbankAccession}`}
                        target="_blank"
                        rel="noreferrer"
                        className="dna-ext-link"
                      >
                        {seq.genbankAccession} <Icon name="external-link" size={12} />
                      </a>
                    </div>
                  )}
                </div>

                <div className="dna-card-footer">
                  <Link
                    to={isAdmin ? `/admin/dna/${seq.id}/fasta` : `/dna/${seq.id}/fasta`}
                    className="button button-sm button-ghost"
                  >
                    Xem FASTA →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Trường hợp chưa có DNA */}
      {!hasDirect && !hasSpecies && (
        <div className="dna-empty-state">
          <p>Chưa có dữ liệu giải trình tự mã vạch DNA cho mẫu vật hoặc loài này.</p>
          {scientificName && (
            <a
              href={`https://www.ncbi.nlm.nih.gov/nuccore/?term=${encodeURIComponent(scientificName + " COI")}`}
              target="_blank"
              rel="noreferrer"
              className="button button-sm button-ghost"
              style={{ marginTop: 8 }}
            >
              <Icon name="external-link" size={13} />
              Tra cứu trình tự <em>{scientificName}</em> trên NCBI Nucleotide ↗
            </a>
          )}
        </div>
      )}
    </section>
  );
}
