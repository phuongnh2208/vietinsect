import React, { useEffect, useRef, useState } from "react";
import Icon from "../../../components/ui/Icon";
import taxonomyService from "../../taxonomy/taxonomy.service";
import specimenService from "../specimen.service";
import { BASIS_OF_RECORD_LABELS } from "../specimen.constants";

const INITIAL_FORM = {
  specimenCode: "",
  taxonId: "",
  taxonLabel: "",
  gbifScientificName: "",
  commonNameVn: "",
  commonNameEn: "",
  provinceId: "",
  habitatId: "",
  lifeStageId: "",
  statusId: "",
  district: "",
  commune: "",
  localityDetail: "",
  latitude: "",
  longitude: "",
  gpsAccuracyM: "",
  collectionDate: new Date().toISOString().slice(0, 10),
  sex: "",
  individualCount: 1,
  basisOfRecord: "PRESERVED_SPECIMEN",
  recordedBy: "",
  institutionCode: "",
  catalogNumber: "",
  storageNumber: "",
  occurrenceRemarks: "",
  notes: "",
  isPublic: true,
};

export default function SpecimenForm({ initialData = null, onSubmit, onCancel, submitting = false }) {
  const [lookups, setLookups] = useState({
    orders: [],
    provinces: [],
    habitats: [],
    lifeStages: [],
    statuses: [],
  });
  const [form, setForm] = useState(INITIAL_FORM);
  const [taxonQuery, setTaxonQuery] = useState("");
  const [taxonSuggestions, setTaxonSuggestions] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    specimenService.getLookups().then(setLookups).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialData) {
      setForm({
        specimenCode: initialData.specimenCode || "",
        taxonId: initialData.taxonId || "",
        taxonLabel: initialData.taxonName
          ? `${initialData.taxonName} (${initialData.taxonRank || "Taxon"})`
          : "",
        gbifScientificName: initialData.gbifScientificName || initialData.scientificName || "",
        commonNameVn: initialData.commonNameVn || "",
        commonNameEn: initialData.commonNameEn || "",
        provinceId: initialData.provinceId ?? "",
        habitatId: initialData.habitatId ?? "",
        lifeStageId: initialData.lifeStageId ?? "",
        statusId: initialData.statusId ?? "",
        district: initialData.district || "",
        commune: initialData.commune || "",
        localityDetail: initialData.localityDetail || "",
        latitude: initialData.latitude ?? "",
        longitude: initialData.longitude ?? "",
        gpsAccuracyM: initialData.gpsAccuracyM ?? "",
        collectionDate: initialData.collectionDate || new Date().toISOString().slice(0, 10),
        sex: initialData.sex || "",
        individualCount: initialData.individualCount || 1,
        basisOfRecord: initialData.basisOfRecord || "PRESERVED_SPECIMEN",
        recordedBy: initialData.recordedBy || "",
        institutionCode: initialData.institutionCode || "",
        catalogNumber: initialData.catalogNumber || "",
        storageNumber: initialData.storageNumber || "",
        occurrenceRemarks: initialData.occurrenceRemarks || "",
        notes: initialData.notes || "",
        isPublic: initialData.isPublic ?? true,
      });
    } else {
      setForm(INITIAL_FORM);
    }
  }, [initialData]);

  useEffect(() => {
    if (taxonQuery.trim().length < 2) {
      setTaxonSuggestions([]);
      return undefined;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await taxonomyService.searchTaxa(taxonQuery.trim());
        setTaxonSuggestions(res);
      } catch {
        setTaxonSuggestions([]);
      }
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [taxonQuery]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      specimenCode: form.specimenCode.trim() || undefined,
      taxonId: Number(form.taxonId),
      gbifScientificName: form.gbifScientificName.trim() || null,
      commonNameVn: form.commonNameVn.trim() || null,
      commonNameEn: form.commonNameEn.trim() || null,
      provinceId: form.provinceId !== "" ? Number(form.provinceId) : null,
      habitatId: form.habitatId !== "" ? Number(form.habitatId) : null,
      lifeStageId: form.lifeStageId !== "" ? Number(form.lifeStageId) : null,
      statusId: form.statusId !== "" ? Number(form.statusId) : null,
      district: form.district.trim() || null,
      commune: form.commune.trim() || null,
      localityDetail: form.localityDetail.trim() || null,
      latitude: form.latitude !== "" ? Number(form.latitude) : null,
      longitude: form.longitude !== "" ? Number(form.longitude) : null,
      gpsAccuracyM: form.gpsAccuracyM !== "" ? Number(form.gpsAccuracyM) : null,
      collectionDate: form.collectionDate,
      sex: form.sex || null,
      individualCount: Number(form.individualCount) || 1,
      basisOfRecord: form.basisOfRecord || "PRESERVED_SPECIMEN",
      recordedBy: form.recordedBy.trim() || null,
      institutionCode: form.institutionCode.trim() || null,
      catalogNumber: form.catalogNumber.trim() || null,
      storageNumber: form.storageNumber.trim() || null,
      occurrenceRemarks: form.occurrenceRemarks.trim() || null,
      notes: form.notes.trim() || null,
      isPublic: Boolean(form.isPublic),
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="vi-specimen-form">
      <div className="vi-form-grid-3">
        <div className="form-field">
          <label htmlFor="sp-code">Mã mẫu vật (tự sinh nếu để trống)</label>
          <input
            id="sp-code"
            value={form.specimenCode}
            onChange={(e) => updateField("specimenCode", e.target.value)}
            placeholder="VD: VN-2026-001024"
          />
        </div>

        <div className="form-field">
          <label htmlFor="sp-order-quick">Chọn nhanh theo Bộ (Order) *</label>
          <select
            id="sp-order-quick"
            value={form.taxonId}
            onChange={(e) => {
              const id = e.target.value;
              const ord = lookups.orders.find((o) => String(o.id) === String(id));
              updateField("taxonId", id);
              if (ord) updateField("taxonLabel", `${ord.scientificName} (Order)`);
            }}
          >
            <option value="">-- Chọn Bộ hoặc tìm Taxon chi tiết --</option>
            {lookups.orders.map((ord) => (
              <option key={ord.id} value={ord.id}>
                {ord.scientificName} {ord.vernacularNameVn ? `(${ord.vernacularNameVn})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field" style={{ position: "relative" }}>
          <label htmlFor="sp-taxon-search">Hoặc tìm Họ / Giống / Loài cụ thể</label>
          <input
            id="sp-taxon-search"
            value={taxonQuery}
            onChange={(e) => setTaxonQuery(e.target.value)}
            placeholder={form.taxonLabel || "Gõ ≥ 2 ký tự (VD: Papilio)..."}
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
                    if (!form.gbifScientificName && (t.rank === "Species" || t.rank === "Genus")) {
                      updateField("gbifScientificName", t.scientificName);
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
              Đang liên kết: {form.taxonLabel} (#{form.taxonId})
            </small>
          ) : null}
        </div>
      </div>

      <div className="vi-form-grid-3">
        <div className="form-field">
          <label htmlFor="sp-sciname">Tên khoa học định danh (Darwin Core)</label>
          <input
            id="sp-sciname"
            value={form.gbifScientificName}
            onChange={(e) => updateField("gbifScientificName", e.target.value)}
            placeholder="VD: Papilio memnon Linnaeus, 1758"
          />
        </div>
        <div className="form-field">
          <label htmlFor="sp-vnname">Tên thông thường (Tiếng Việt)</label>
          <input
            id="sp-vnname"
            value={form.commonNameVn}
            onChange={(e) => updateField("commonNameVn", e.target.value)}
            placeholder="VD: Bướm phượng lớn"
          />
        </div>
        <div className="form-field">
          <label htmlFor="sp-basis">Loại bản ghi (basisOfRecord)</label>
          <select
            id="sp-basis"
            value={form.basisOfRecord}
            onChange={(e) => updateField("basisOfRecord", e.target.value)}
          >
            {Object.entries(BASIS_OF_RECORD_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label} ({code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="vi-form-grid-4">
        <div className="form-field">
          <label htmlFor="sp-date">Ngày thu mẫu *</label>
          <input
            id="sp-date"
            type="date"
            min="1800-01-01"
            max="2050-12-31"
            value={form.collectionDate}
            onChange={(e) => updateField("collectionDate", e.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="sp-prov">Tỉnh / Thành phố</label>
          <select
            id="sp-prov"
            value={form.provinceId}
            onChange={(e) => updateField("provinceId", e.target.value)}
          >
            <option value="">-- Chọn tỉnh/thành --</option>
            {lookups.provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameVn}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="sp-lat">Vĩ độ (Latitude WGS84)</label>
          <input
            id="sp-lat"
            type="number"
            step="any"
            min="-90"
            max="90"
            value={form.latitude}
            onChange={(e) => updateField("latitude", e.target.value)}
            placeholder="VD: 20.3167"
          />
        </div>
        <div className="form-field">
          <label htmlFor="sp-lon">Kinh độ (Longitude WGS84)</label>
          <input
            id="sp-lon"
            type="number"
            step="any"
            min="-180"
            max="180"
            value={form.longitude}
            onChange={(e) => updateField("longitude", e.target.value)}
            placeholder="VD: 105.6083"
          />
        </div>
      </div>

      <div className="vi-form-grid-4">
        <div className="form-field">
          <label htmlFor="sp-habitat">Sinh cảnh</label>
          <select
            id="sp-habitat"
            value={form.habitatId}
            onChange={(e) => updateField("habitatId", e.target.value)}
          >
            <option value="">-- Chọn sinh cảnh --</option>
            {lookups.habitats.map((h) => (
              <option key={h.id} value={h.id}>
                {h.labelVn}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="sp-stage">Giai đoạn phát triển</label>
          <select
            id="sp-stage"
            value={form.lifeStageId}
            onChange={(e) => updateField("lifeStageId", e.target.value)}
          >
            <option value="">-- Chọn giai đoạn --</option>
            {lookups.lifeStages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.labelVn}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="sp-sex">Giới tính</label>
          <select id="sp-sex" value={form.sex} onChange={(e) => updateField("sex", e.target.value)}>
            <option value="">-- Chưa xác định --</option>
            <option value="male">Đực (♂)</option>
            <option value="female">Cái (♀)</option>
            <option value="unknown">Không rõ</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="sp-count">Số lượng cá thể</label>
          <input
            id="sp-count"
            type="number"
            min="1"
            value={form.individualCount}
            onChange={(e) => updateField("individualCount", e.target.value)}
          />
        </div>
      </div>

      <div className="vi-form-grid-3">
        <div className="form-field">
          <label htmlFor="sp-locality">Địa điểm thu mẫu chi tiết</label>
          <input
            id="sp-locality"
            value={form.localityDetail}
            onChange={(e) => updateField("localityDetail", e.target.value)}
            placeholder="VD: Vườn quốc gia Cúc Phương, độ cao 450m"
          />
        </div>
        <div className="form-field">
          <label htmlFor="sp-collector">Người thu mẫu (recordedBy)</label>
          <input
            id="sp-collector"
            value={form.recordedBy}
            onChange={(e) => updateField("recordedBy", e.target.value)}
            placeholder="VD: Nguyễn Văn A"
          />
        </div>
        <div className="form-field">
          <label htmlFor="sp-inst">Đơn vị lưu trữ / Mã bảo tàng</label>
          <input
            id="sp-inst"
            value={form.institutionCode}
            onChange={(e) => updateField("institutionCode", e.target.value)}
            placeholder="VD: IEBR / VNMN"
          />
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="sp-notes">Ghi chú mẫu vật / Sinh học</label>
        <textarea
          id="sp-notes"
          rows={2}
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Ghi chú đặc điểm nhận dạng, phương pháp bẫy đèn/vợt..."
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 12, paddingTop: 14, borderTop: "1px solid #E2E8F0" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(e) => updateField("isPublic", e.target.checked)}
          />
          Công khai bản ghi ra Cổng dữ liệu mở (Public Access)
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          {onCancel ? (
            <button type="button" className="button button-ghost" onClick={onCancel} disabled={submitting}>
              Hủy bỏ
            </button>
          ) : null}
          <button type="submit" className="button button-primary" disabled={submitting || !form.taxonId}>
            <Icon name="check" size={16} />
            {submitting ? "Đang lưu..." : initialData ? "Lưu cập nhật" : "Tạo mẫu vật mới"}
          </button>
        </div>
      </div>
    </form>
  );
}
