import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/ToastProvider";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import specimenService from "../specimen.service";

// Modular Redesign Components (GBIF Scientific Information Architecture)
import SpecimenHeader from "../components/SpecimenHeader";
import SpecimenImageGallery from "../components/SpecimenImageGallery";
import SpecimenTaxonomyHierarchy from "../components/SpecimenTaxonomyHierarchy";
import SpecimenDwcSections from "../components/SpecimenDwcSections";
import SpecimenMapSidebar from "../components/SpecimenMapSidebar";
import SpecimenDnaSection from "../components/SpecimenDnaSection";
import SpecimenAiSection from "../components/SpecimenAiSection";
import SpecimenAuditTimeline from "../components/SpecimenAuditTimeline";
import SpecimenLabelModal from "../components/SpecimenLabelModal";

export default function SpecimenDetailPage() {
  const { id } = useParams();
  const isAdmin = useIsAdminContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [specimen, setSpecimen] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [labelModalOpen, setLabelModalOpen] = useState(false);

  const loadDetail = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await specimenService.getSpecimenById(id);
      setSpecimen(data);
      setStatus("success");
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message ||
          t("specimenDetail.errorNotFound", "Không tìm thấy bản ghi mẫu vật"),
      );
      setStatus("error");
    }
  }, [id, t]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleCopyText = (text, successMsg) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      toast(successMsg || t("specimenDetail.copied", "Đã sao chép vào bộ nhớ tạm"), "success");
    }
  };

  const handleCopyCoordinates = () => {
    if (specimen?.latitude != null && specimen?.longitude != null) {
      const coordStr = `${specimen.latitude.toFixed(5)}, ${specimen.longitude.toFixed(5)}`;
      handleCopyText(coordStr, `Đã sao chép tọa độ: ${coordStr}`);
    }
  };

  const handleTogglePublic = async () => {
    if (!specimen) return;
    try {
      const updated = await specimenService.togglePublic(specimen.id, !specimen.isPublic);
      setSpecimen(updated);
      toast(
        updated.isPublic
          ? t("specimenDetail.makePublicSuccess", "Đã chuyển sang trạng thái Công khai (Public Open Data)")
          : t("specimenDetail.makePrivateSuccess", "Đã chuyển sang trạng thái Nội bộ (Internal Restricted)"),
        "success",
      );
    } catch (err) {
      toast(err.response?.data?.message || "Không thể thay đổi trạng thái", "error");
    }
  };

  const handleDeleteSpecimen = async () => {
    if (!specimen) return;
    try {
      await specimenService.deleteSpecimen(specimen.id);
      toast("Đã xóa mẫu vật thành công", "success");
      navigate(isAdmin ? "/admin/specimens" : "/specimens/search");
    } catch (err) {
      toast(err.response?.data?.message || "Không thể xóa mẫu vật", "error");
    }
  };

  if (status === "loading") {
    return (
      <div className="page-container page-content">
        <div className="card panel" style={{ padding: "48px 24px" }}>
          <LoadingState label={t("specimenDetail.loadingDetail")} />
        </div>
      </div>
    );
  }

  if (status === "error" || !specimen) {
    return (
      <div className="page-container page-content">
        <div className="card panel">
          <EmptyState
            icon="alert"
            title={t("specimenDetail.errorNotFound")}
            description={errorMsg}
            action={
              <button
                className="button button-primary"
                onClick={() => navigate(isAdmin ? "/admin/specimens" : "/specimens/search")}
              >
                {t("specimenDetail.backToList")}
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-content vi-page-enter vi-specimen-detail-page">
      {/* 1. Header & Identity Section */}
      <SpecimenHeader
        specimen={specimen}
        isAdmin={isAdmin}
        onTogglePublic={handleTogglePublic}
        onDelete={handleDeleteSpecimen}
        onOpenLabelModal={() => setLabelModalOpen(true)}
        onCopyText={handleCopyText}
      />

      {/* 2. Main 2-Column Scientific Grid (Desktop: 65% Left / 35% Right) */}
      <div className="vi-specimen-grid-layout">
        {/* CỘT TRÁI: Dữ liệu mẫu vật & Tài nguyên sinh học */}
        <main className="vi-specimen-main-col">
          {/* A. Bộ ảnh mẫu vật nổi bật (Prominent Gallery) */}
          <SpecimenImageGallery
            images={specimen.images || []}
            speciesImages={specimen.speciesImages || []}
            scientificName={specimen.scientificName}
            gbifOccurrenceId={specimen.gbifOccurrenceId}
          />

          {/* B. Vị trí phân loại học (Taxonomy Hierarchy Bar) */}
          <SpecimenTaxonomyHierarchy
            orderName={specimen.orderName}
            familyName={specimen.familyName}
            genusName={specimen.genusName}
            scientificName={specimen.scientificName}
            taxonRank={specimen.taxonRank}
            isAdmin={isAdmin}
          />

          {/* C. Các bảng dữ liệu chuẩn Darwin Core (DwC Table Sections) */}
          <SpecimenDwcSections specimen={specimen} />

          {/* D. Phân hệ DNA & Mã vạch phân tử (COI Barcode) */}
          <SpecimenDnaSection
            dnaSequences={specimen.dnaSequences || []}
            speciesDnaSequences={specimen.speciesDnaSequences || []}
            scientificName={specimen.scientificName}
            isAdmin={isAdmin}
          />

          {/* E. Phân hệ AI Species Identification (Dự phòng tích hợp tương lai) */}
          <SpecimenAiSection aiResults={specimen.aiResults || null} />

          {/* F. Lịch sử kiểm toán thay đổi dữ liệu (Admin Only) */}
          {isAdmin && <SpecimenAuditTimeline history={specimen.changeHistory || []} />}
        </main>

        {/* CỘT PHẢI: Thông tin không gian PostGIS & Bản quyền */}
        <SpecimenMapSidebar
          latitude={specimen.latitude}
          longitude={specimen.longitude}
          scientificName={specimen.scientificName}
          orderName={specimen.orderName}
          provinceNameVn={specimen.provinceNameVn}
          localityDetail={specimen.localityDetail}
          license={specimen.license}
          onCopyCoordinates={handleCopyCoordinates}
        />
      </div>

      {/* 3. Modal in nhãn tiêu bản bảo tàng (Herbarium/Entomological Pinned Label) */}
      <SpecimenLabelModal
        specimen={specimen}
        isOpen={labelModalOpen}
        onClose={() => setLabelModalOpen(false)}
      />
    </div>
  );
}
