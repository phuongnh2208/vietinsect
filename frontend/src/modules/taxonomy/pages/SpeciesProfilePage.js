import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/ui/EmptyState";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import taxonomyService from "../taxonomy.service";
import SpeciesProfileTabs from "../components/SpeciesProfileTabs";
import ExternalLinkBadges from "../components/ExternalLinkBadges";

export default function SpeciesProfilePage() {
  const { slug } = useParams();
  const isAdmin = useIsAdminContext();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await taxonomyService.getSpeciesProfile(slug);
      setProfile(data);
      setStatus("success");
    } catch (err) {
      setError(err.response?.status === 404 ? "Không tìm thấy hồ sơ loài này." : err.response?.data?.message || err.message);
      setStatus("error");
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (status === "loading") {
    return <div className="page-container page-content vi-page-enter"><div className="card panel"><LoadingState label="Đang tải hồ sơ loài..." /></div></div>;
  }

  if (status === "error") {
    return (
      <div className="page-container page-content vi-page-enter">
        <div className="card panel">
          <EmptyState
            icon="alert"
            title="Không tải được hồ sơ loài"
            description={error}
            action={<button className="button button-ghost" onClick={load}><Icon name="arrow-up-right" size={16} />Thử lại</button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Icon name="leaf" size={14} />SCR-13 · Phân loại học & Hồ sơ loài</div>
          <h1 className="taxonomy-name">{profile.scientificName}</h1>
          {profile.vernacularNameVn ? <p className="page-description">{profile.vernacularNameVn}</p> : null}
          <ExternalLinkBadges externalLinks={profile.externalLinks} iucnStatus={profile.iucnStatus} />
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
        <SpeciesProfileTabs profile={profile} />
      </section>
    </div>
  );
}
