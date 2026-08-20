import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import Icon from "../../../components/ui/Icon";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import SpeciesProfileTabs from "../components/SpeciesProfileTabs";

export default function SpeciesProfilePage() {
  const { slug } = useParams();
  const isAdmin = useIsAdminContext();
  const navigate = useNavigate();
  const displayName = slug ? slug.replace(/-/g, " ") : "Attacus atlas";

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Icon name="leaf" size={14} />SCR-13 · Phân loại học & Hồ sơ loài</div>
          <h1 className="taxonomy-name" style={{ textTransform: "capitalize" }}>{displayName}</h1>
          <p className="page-description">Hồ sơ loài đầy đủ: hình thái & sinh thái, mẫu vật, DNA, hoạt tính và phân bố.</p>
        </div>
        {isAdmin ? (
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => navigate("/admin/taxonomy/editor")}>
              <Icon name="edit" size={16} />Sửa hồ sơ loài
            </button>
          </div>
        ) : null}
      </div>

      <section className="card panel">
        <SpeciesProfileTabs />
      </section>
    </div>
  );
}
