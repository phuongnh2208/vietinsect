import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import { useToast } from "../../../components/ui/ToastProvider";
import specimenService from "../specimen.service";
import SpecimenForm from "../components/SpecimenForm";

export default function SpecimenFormPage({ mode = "create" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const specimenId = searchParams.get("id");
  const { toast } = useToast();

  const isEdit = mode === "edit" || Boolean(specimenId);
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!specimenId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    specimenService
      .getSpecimenById(specimenId)
      .then((data) => setInitialData(data))
      .catch((err) => {
        toast(err.response?.data?.message || "Không tìm thấy mẫu vật để chỉnh sửa", "error");
        navigate("/admin/specimens");
      })
      .finally(() => setLoading(false));
  }, [specimenId, navigate, toast]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    try {
      if (isEdit && initialData?.id) {
        const updated = await specimenService.updateSpecimen(initialData.id, payload);
        toast(`Đã cập nhật mẫu vật ${updated.specimenCode}`, "success");
        navigate(`/admin/specimens/${updated.id}`);
      } else {
        const created = await specimenService.createSpecimen(payload);
        toast(`Đã thêm mẫu vật ${created.specimenCode}`, "success");
        navigate(`/admin/specimens/${created.id}`);
      }
    } catch (err) {
      toast(err.response?.data?.message || "Không thể lưu mẫu vật", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Icon name={isEdit ? "edit" : "plus"} size={14} />
            {isEdit ? "Chỉnh sửa mẫu vật" : "Thêm mới mẫu vật"}
          </div>
          <h1>{isEdit ? `Hiệu chỉnh hồ sơ ${initialData?.specimenCode || ""}` : "Nhập hồ sơ mẫu vật mới"}</h1>
          <p className="page-description">
            Chuẩn hóa dữ liệu định danh phân loại, tọa độ không gian WGS84 (PostGIS) và metadata Darwin Core.
          </p>
        </div>
        <button className="button button-ghost" onClick={() => navigate("/admin/specimens")}>
          Quay lại danh sách
        </button>
      </div>

      <section className="card panel">
        {loading ? (
          <LoadingState label="Đang tải dữ liệu mẫu vật..." />
        ) : isEdit && !specimenId ? (
          <div style={{ padding: "24px 0" }}>
            <p style={{ marginBottom: 14 }}>Vui lòng chọn một mẫu vật từ danh sách để chỉnh sửa.</p>
            <button className="button button-primary" onClick={() => navigate("/admin/specimens")}>
              Mở danh sách mẫu vật
            </button>
          </div>
        ) : (
          <SpecimenForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/admin/specimens")}
            submitting={submitting}
          />
        )}
      </section>
    </div>
  );
}
