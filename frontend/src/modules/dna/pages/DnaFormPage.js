import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import { useToast } from "../../../components/ui/ToastProvider";
import dnaService, { GENE_MARKERS, GENBANK_ACCESSION_REGEX } from "../dna.service";
import taxonomyService from "../../taxonomy/taxonomy.service";
import specimenService from "../../specimen/specimen.service";

const INITIAL_FORM = {
  genbankAccession: "",
  boldProcessId: "",
  binUri: "",
  taxonId: "",
  taxonLabel: "",
  specimenId: "",
  specimenLabel: "",
  scientificNameVerbatim: "",
  geneMarker: "COI",
  sourceDb: "NCBI",
  submissionDate: "",
  authorName: "",
  primersInfo: "",
  pcrConditions: "",
  fastaSequence: "",
  notes: "",
  isPublic: true,
};

function computeLiveComposition(rawSeq) {
  const clean = String(rawSeq || "")
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith(">"))
    .join("")
    .replace(/[\s0-9-]/g, "")
    .toUpperCase();
  if (!clean) return { lengthBp: 0, gcPct: 0 };
  let gc = 0;
  let atgc = 0;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === "A" || c === "T" || c === "G" || c === "C") {
      atgc++;
      if (c === "G" || c === "C") gc++;
    }
  }
  return {
    lengthBp: clean.length,
    gcPct: atgc > 0 ? ((gc / atgc) * 100).toFixed(1) : 0,
  };
}

export default function DnaFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const isEdit = Boolean(editId);
  const { toast } = useToast();

  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [syncingNcbi, setSyncingNcbi] = useState(false);
  const [syncedBanner, setSyncedBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Autocomplete Taxon & Specimen
  const [taxonQuery, setTaxonQuery] = useState("");
  const [taxonSuggestions, setTaxonSuggestions] = useState([]);
  const [specQuery, setSpecQuery] = useState("");
  const [specSuggestions, setSpecSuggestions] = useState([]);
  const taxonTimer = useRef(null);
  const specTimer = useRef(null);

  useEffect(() => {
    specimenService
      .getLookups()
      .then((res) => setOrders(res.orders || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    dnaService
      .getDnaById(editId)
      .then((data) => {
        setForm({
          genbankAccession: data.genbankAccession || "",
          boldProcessId: data.boldProcessId || "",
          binUri: data.binUri || "",
          taxonId: data.taxonId || "",
          taxonLabel: data.taxonName ? `${data.taxonName} (${data.taxonRank})` : "",
          specimenId: data.specimenId || "",
          specimenLabel: data.specimenCode
            ? `${data.specimenCode} · ${data.scientificName}`
            : "",
          scientificNameVerbatim: data.scientificNameVerbatim || data.scientificName || "",
          geneMarker: data.geneMarker || "COI",
          sourceDb: data.sourceDb || "NCBI",
          submissionDate: data.submissionDate || "",
          authorName: data.authorName || "",
          primersInfo: data.primersInfo || "",
          pcrConditions: data.pcrConditions || "",
          fastaSequence: data.fastaSequence || "",
          notes: data.notes || "",
          isPublic: data.isPublic ?? true,
        });
      })
      .catch((err) => {
        toast(err.response?.data?.message || "Không tìm thấy bản ghi DNA", "error");
        navigate("/admin/dna");
      })
      .finally(() => setLoading(false));
  }, [editId, navigate, toast]);

  useEffect(() => {
    if (taxonQuery.trim().length < 2) {
      setTaxonSuggestions([]);
      return undefined;
    }
    clearTimeout(taxonTimer.current);
    taxonTimer.current = setTimeout(async () => {
      try {
        const res = await taxonomyService.searchTaxa(taxonQuery.trim());
        setTaxonSuggestions(res);
      } catch {
        setTaxonSuggestions([]);
      }
    }, 280);
    return () => clearTimeout(taxonTimer.current);
  }, [taxonQuery]);

  useEffect(() => {
    if (specQuery.trim().length < 2) {
      setSpecSuggestions([]);
      return undefined;
    }
    clearTimeout(specTimer.current);
    specTimer.current = setTimeout(async () => {
      try {
        const res = await specimenService.getSpecimens({ q: specQuery.trim(), limit: 8 });
        setSpecSuggestions(res.items || []);
      } catch {
        setSpecSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(specTimer.current);
  }, [specQuery]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSyncGenBank = async () => {
    const acc = form.genbankAccession.trim();
    if (!acc || !GENBANK_ACCESSION_REGEX.test(acc)) {
      toast(
        "Mã GenBank Accession phải đúng chuẩn 5–8 chữ số (VD: KX894504.1, AF469881, NC_045512.2)",
        "warning",
      );
      return;
    }
    setSyncingNcbi(true);
    try {
      const meta = await dnaService.fetchGenBankMetadata(acc);
      setForm((prev) => ({
        ...prev,
        genbankAccession: meta.genbankAccession || acc,
        boldProcessId: meta.boldProcessId || prev.boldProcessId,
        scientificNameVerbatim: meta.scientificNameVerbatim || prev.scientificNameVerbatim,
        geneMarker: meta.geneMarker || prev.geneMarker,
        sourceDb: meta.sourceDb || "NCBI",
        submissionDate: meta.submissionDate || prev.submissionDate,
        authorName: meta.authorName || prev.authorName,
        primersInfo: meta.primersInfo || prev.primersInfo,
        fastaSequence: meta.fastaSequence || prev.fastaSequence,
        notes: meta.notes || prev.notes,
        taxonId: meta.matchedTaxon?.id || prev.taxonId,
        taxonLabel: meta.matchedTaxon
          ? `${meta.matchedTaxon.scientificName} (${meta.matchedTaxon.rank})`
          : prev.taxonLabel,
      }));
      setSyncedBanner(meta);
      toast(`Đã đồng bộ thành công ${meta.genbankAccession} (${meta.sequenceLengthBp} bp)`, "success");
    } catch (err) {
      toast(
        err.response?.data?.message || "Không tìm thấy mã Accession trên GenBank/INSDC",
        "error",
      );
    } finally {
      setSyncingNcbi(false);
    }
  };

  const liveComp = useMemo(
    () => computeLiveComposition(form.fastaSequence),
    [form.fastaSequence],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.taxonId) {
      toast("Vui lòng chọn Bộ hoặc Taxon phân loại cho chuỗi DNA", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        taxonId: Number(form.taxonId),
        specimenId: form.specimenId !== "" ? Number(form.specimenId) : null,
        genbankAccession: form.genbankAccession.trim() || null,
        boldProcessId: form.boldProcessId.trim() || null,
        binUri: form.binUri.trim() || null,
        scientificNameVerbatim: form.scientificNameVerbatim.trim() || null,
        geneMarker: form.geneMarker.trim() || "COI",
        sourceDb: form.sourceDb || "INTERNAL",
        submissionDate: form.submissionDate || null,
        authorName: form.authorName.trim() || null,
        primersInfo: form.primersInfo.trim() || null,
        pcrConditions: form.pcrConditions.trim() || null,
        fastaSequence: form.fastaSequence.trim() || null,
        notes: form.notes.trim() || null,
        isPublic: Boolean(form.isPublic),
      };

      if (isEdit) {
        const updated = await dnaService.updateDna(editId, payload);
        toast(`Đã cập nhật trình tự ${updated.genbankAccession || `#${updated.id}`}`, "success");
        navigate(`/admin/dna/${updated.id}/fasta`);
      } else {
        const created = await dnaService.createDna(payload);
        toast(`Đã lưu trình tự mới ${created.genbankAccession || `#${created.id}`}`, "success");
        navigate(`/admin/dna/${created.id}/fasta`);
      }
    } catch (err) {
      toast(err.response?.data?.message || "Không thể lưu bản ghi DNA", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name="dna" size={14} />
            SCR-21 · {isEdit ? "Hiệu chỉnh Trình tự DNA" : "Nhập Mới & Đồng bộ GenBank"}
          </div>
          <h1>{isEdit ? "Chỉnh sửa hồ sơ trình tự DNA" : "Khởi tạo hồ sơ trình tự mã vạch DNA"}</h1>
          <p className="page-description">
            Đồng bộ tự động từ mã NCBI GenBank Accession hoặc nhập trình tự giải mã nội bộ kèm quy trình
            nhiệt PCR & Primer chuẩn hóa.
          </p>
        </div>

        <button className="button button-ghost" onClick={() => navigate("/admin/dna")}>
          ← Danh sách DNA
        </button>
      </div>

      {loading ? (
        <div className="card panel">
          <LoadingState label="Đang tải hồ sơ trình tự DNA..." />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card panel">
          {/* 1. Khối tự động đồng bộ GenBank Accession */}
          <div className="vi-spatial-box" style={{ marginTop: 0, marginBottom: 20 }}>
            <label
              htmlFor="dna-acc"
              style={{ display: "block", fontSize: 12, fontWeight: 800, textTransform: "uppercase", marginBottom: 8 }}
            >
              Đồng bộ nhanh theo Mã GenBank Accession (INSDC / NCBI)
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                id="dna-acc"
                style={{
                  flex: 1,
                  minWidth: 240,
                  minHeight: 42,
                  padding: "0 14px",
                  border: "1px solid #111111",
                  fontFamily: "monospace",
                  fontSize: 14,
                  fontWeight: 700,
                }}
                value={form.genbankAccession}
                onChange={(e) => updateField("genbankAccession", e.target.value)}
                placeholder="Nhập mã Accession (VD: AF469881, AJ299393, MW481920)..."
              />
              <button
                type="button"
                className="button button-secondary"
                disabled={syncingNcbi}
                onClick={handleSyncGenBank}
              >
                <Icon name="sparkles" size={16} />
                {syncingNcbi ? "Đang tải từ GenBank..." : "Đồng bộ Metadata & FASTA"}
              </button>
            </div>

            {syncedBanner ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "12px 14px",
                  background: "#FFFFFF",
                  border: "1px solid #2E7D32",
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 12,
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: "var(--vi-muted)" }}>Loài xác thực</span>
                  <strong className="taxonomy-name" style={{ display: "block", marginTop: 2 }}>
                    {syncedBanner.scientificNameVerbatim || "—"}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "var(--vi-muted)" }}>Độ dài & Marker</span>
                  <strong style={{ display: "block", marginTop: 2 }}>
                    {syncedBanner.sequenceLengthBp} bp ({syncedBanner.geneMarker})
                  </strong>
                </div>
                <div>
                  <span style={{ color: "var(--vi-muted)" }}>Tỷ lệ G-C</span>
                  <strong style={{ display: "block", marginTop: 2 }}>
                    {syncedBanner.gcContentPct ?? "—"}%
                  </strong>
                </div>
                <div>
                  <span style={{ color: "var(--vi-muted)" }}>Khớp Taxon nội bộ</span>
                  <strong style={{ display: "block", marginTop: 2, color: "#2E7D32" }}>
                    {syncedBanner.matchedTaxon
                      ? `${syncedBanner.matchedTaxon.scientificName} (${syncedBanner.matchedTaxon.rank})`
                      : "Chọn thủ công bên dưới"}
                  </strong>
                </div>
              </div>
            ) : null}
          </div>

          {/* 2. Liên kết Phân loại học & Mẫu vật thực địa */}
          <div className="vi-form-grid-3">
            <div className="form-field">
              <label>Chọn nhanh Bộ côn trùng (Order) *</label>
              <select
                value={form.taxonId}
                onChange={(e) => {
                  const id = e.target.value;
                  const ord = orders.find((o) => String(o.id) === String(id));
                  updateField("taxonId", id);
                  if (ord) updateField("taxonLabel", `${ord.scientificName} (Order)`);
                }}
              >
                <option value="">-- Chọn Bộ hoặc tìm Taxon bên cạnh --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.scientificName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field" style={{ position: "relative" }}>
              <label>Tìm Họ / Giống / Loài cụ thể *</label>
              <input
                value={taxonQuery}
                onChange={(e) => setTaxonQuery(e.target.value)}
                placeholder={form.taxonLabel || "Gõ ≥ 2 ký tự (VD: Anopheles, Papilio)..."}
              />
              {taxonSuggestions.length > 0 ? (
                <div className="taxonomy-suggestions">
                  {taxonSuggestions.map((t) => (
                    <div
                      key={t.id}
                      className="taxonomy-suggestion-item"
                      onClick={() => {
                        updateField("taxonId", t.id);
                        updateField("taxonLabel", `${t.scientificName} (${t.rank})`);
                        if (!form.scientificNameVerbatim) {
                          updateField("scientificNameVerbatim", t.scientificName);
                        }
                        setTaxonQuery("");
                        setTaxonSuggestions([]);
                      }}
                    >
                      <em>{t.scientificName}</em>
                      <span>{t.rank}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {form.taxonLabel ? (
                <small style={{ color: "#2E7D32", fontWeight: 700, fontSize: 11 }}>
                  Đang gắn Taxon: {form.taxonLabel} (#{form.taxonId})
                </small>
              ) : null}
            </div>

            <div className="form-field" style={{ position: "relative" }}>
              <label>Liên kết Mẫu vật thực địa (Tùy chọn)</label>
              <input
                value={specQuery}
                onChange={(e) => setSpecQuery(e.target.value)}
                placeholder={form.specimenLabel || "Tìm mã GBIF- / VN- hoặc tên loài..."}
              />
              {specSuggestions.length > 0 ? (
                <div className="taxonomy-suggestions">
                  {specSuggestions.map((s) => (
                    <div
                      key={s.id}
                      className="taxonomy-suggestion-item"
                      onClick={() => {
                        updateField("specimenId", s.id);
                        updateField("specimenLabel", `${s.specimenCode} · ${s.scientificName}`);
                        setSpecQuery("");
                        setSpecSuggestions([]);
                      }}
                    >
                      <strong>{s.specimenCode}</strong>
                      <span>{s.scientificName}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {form.specimenId ? (
                <small style={{ color: "#0F3820", fontWeight: 700, fontSize: 11 }}>
                  Mẫu vật: {form.specimenLabel}{" "}
                  <button
                    type="button"
                    style={{ border: 0, background: "none", color: "#B0241A", fontWeight: 700 }}
                    onClick={() => {
                      updateField("specimenId", "");
                      updateField("specimenLabel", "");
                    }}
                  >
                    [Gỡ]
                  </button>
                </small>
              ) : null}
            </div>
          </div>

          {/* 3. Metadata Mã vạch phân tử */}
          <div className="vi-form-grid-4">
            <div className="form-field">
              <label>Tên khoa học trên GenBank / BOLD</label>
              <input
                value={form.scientificNameVerbatim}
                onChange={(e) => updateField("scientificNameVerbatim", e.target.value)}
                placeholder="VD: Anopheles epiroticus"
              />
            </div>

            <div className="form-field">
              <label>Chỉ thị Gen (Gene Marker)</label>
              <select
                value={form.geneMarker}
                onChange={(e) => updateField("geneMarker", e.target.value)}
              >
                {GENE_MARKERS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>BOLD Process ID (nếu có)</label>
              <input
                value={form.boldProcessId}
                onChange={(e) => updateField("boldProcessId", e.target.value)}
                placeholder="VD: BCVIE001-24"
              />
            </div>

            <div className="form-field">
              <label>Nguồn dữ liệu</label>
              <select
                value={form.sourceDb}
                onChange={(e) => updateField("sourceDb", e.target.value)}
              >
                <option value="NCBI">NCBI GenBank</option>
                <option value="BOLD">BOLD Systems</option>
                <option value="INTERNAL">Giải trình tự nội bộ</option>
              </select>
            </div>
          </div>

          <div className="vi-form-grid-3">
            <div className="form-field">
              <label>Thông tin cặp mồi Primer (Forward / Reverse)</label>
              <input
                value={form.primersInfo}
                onChange={(e) => updateField("primersInfo", e.target.value)}
                placeholder="VD: LCO1490 / HCO2198"
              />
            </div>
            <div className="form-field">
              <label>Tác giả / Mã Voucher lưu trữ</label>
              <input
                value={form.authorName}
                onChange={(e) => updateField("authorName", e.target.value)}
                placeholder="VD: Viện Sinh thái và Tài nguyên sinh vật (IEBR)"
              />
            </div>
            <div className="form-field">
              <label>Ngày công bố / Giải trình tự</label>
              <input
                type="date"
                value={form.submissionDate}
                onChange={(e) => updateField("submissionDate", e.target.value)}
              />
            </div>
          </div>

          {/* 4. Trình tự FASTA & Quy trình PCR */}
          <div className="vi-form-grid-2" style={{ gap: 16 }}>
            <div className="form-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>Chuỗi Nucleotide FASTA (A, T, G, C, N)</label>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#2E7D32" }}>
                  {liveComp.lengthBp.toLocaleString()} bp · G-C: {liveComp.gcPct}%
                </span>
              </div>
              <textarea
                rows={7}
                style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.5 }}
                value={form.fastaSequence}
                onChange={(e) => updateField("fastaSequence", e.target.value)}
                placeholder="Dán trực tiếp trình tự FASTA (có hoặc không có dòng >header)..."
              />
            </div>

            <div>
              <div className="form-field">
                <label>Chu trình nhiệt PCR (PCR Conditions)</label>
                <textarea
                  rows={3}
                  value={form.pcrConditions}
                  onChange={(e) => updateField("pcrConditions", e.target.value)}
                  placeholder="VD: Biến tính 94°C (30s) · Bắt cặp 50°C (45s) · Kéo dài 72°C (60s) × 35 chu kỳ"
                />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label>Ghi chú sinh học phân tử</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Mô tả chất lượng đỉnh sắc ký đồ hoặc xuất xứ mô..."
                />
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid #E2E8F0",
            }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => updateField("isPublic", e.target.checked)}
              />
              Công khai chuỗi FASTA trên Cổng dữ liệu mở VietInsect
            </label>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => navigate("/admin/dna")}
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button type="submit" className="button button-primary" disabled={submitting}>
                <Icon name="check" size={16} />
                {submitting ? "Đang lưu..." : isEdit ? "Lưu cập nhật" : "Lưu trình tự DNA"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
