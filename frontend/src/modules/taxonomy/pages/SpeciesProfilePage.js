import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/ui/EmptyState";
import useIsAdminContext from "../../../hooks/useIsAdminContext";
import taxonomyService from "../taxonomy.service";
import SpeciesProfileTabs from "../components/SpeciesProfileTabs";
import ExternalLinkBadges from "../components/ExternalLinkBadges";

export default function SpeciesProfilePage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const isAdmin = useIsAdminContext();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    async function load() {
      try {
        const data = await taxonomyService.getSpeciesProfile(slug);
        if (!cancelled) {
          setProfile(data);
          setStatus("success");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.status === 404
              ? t("taxonomy.errorNotFound")
              : err.response?.data?.message || err.message
          );
          setStatus("error");
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug, retryCount, t]);

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
            action={<button className="button button-ghost" onClick={() => setRetryCount((c) => c + 1)}><Icon name="arrow-up-right" size={16} />Thử lại</button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header species-profile-header">
        <div>
          <div className="eyebrow"><Icon name="leaf" size={14} />SCR-13 · Hồ sơ loài sinh học</div>
          <h1 className="taxonomy-name" style={{ fontSize: "clamp(28px, 3.5vw, 44px)", margin: "8px 0 4px" }}>
            {profile.scientificName}
          </h1>
          {profile.vernacularNameVn ? (
            <p className="page-description" style={{ fontSize: "15px", color: "#334E68", fontWeight: 600, margin: "4px 0 14px" }}>
              Tên tiếng Việt: {profile.vernacularNameVn}
            </p>
          ) : null}
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
