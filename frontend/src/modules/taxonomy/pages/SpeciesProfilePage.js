import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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

  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(isAdmin ? "/admin/taxonomy" : "/taxonomy");
    }
  };

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
    return () => {
      cancelled = true;
    };
  }, [slug, retryCount, t]);

  if (status === "loading") {
    return (
      <div className="page-container page-content vi-page-enter">
        <div className="card panel">
          <LoadingState label="Đang tải hồ sơ loài..." />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="page-container page-content vi-page-enter">
        <div className="card panel">
          <EmptyState
            icon="alert"
            title="Không tải được hồ sơ loài"
            description={error}
            action={
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button type="button" className="button button-ghost" onClick={handleGoBack}>
                  ← Quay lại
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setRetryCount((c) => c + 1)}
                >
                  <Icon name="arrow-up-right" size={16} />
                  Thử lại
                </button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-content vi-page-enter">
      {/* Top Back & Breadcrumb Bar */}
      <div className="vi-header-nav-row" style={{ marginBottom: 14 }}>
        <div className="vi-header-nav-left">
          <button
            type="button"
            className="vi-back-page-btn"
            onClick={handleGoBack}
            title="Quay lại trang trước"
          >
            <Icon name="chevron-left" size={15} />
            <span>Quay lại</span>
          </button>

          <nav className="vi-specimen-breadcrumb" aria-label="Breadcrumb">
            <Link to={isAdmin ? "/admin/dashboard" : "/"}>Trang chủ</Link>
            <Icon name="chevron-right" size={12} />
            <Link to={isAdmin ? "/admin/taxonomy" : "/taxonomy"}>
              Cây phân loại học
            </Link>
            <Icon name="chevron-right" size={12} />
            <span className="breadcrumb-current">
              <em>{profile.scientificName}</em>
            </span>
          </nav>
        </div>
      </div>

      <div className="page-header species-profile-header">
        <div>
          <div className="eyebrow">
            <Icon name="leaf" size={14} />
            Hồ sơ loài sinh học ({profile.rank})
          </div>
          <h1
            className="taxonomy-name"
            style={{ fontSize: "clamp(28px, 3.5vw, 44px)", margin: "8px 0 4px" }}
          >
            <em>{profile.scientificName}</em>
          </h1>
          {profile.vernacularNameVn ? (
            <p
              className="page-description"
              style={{ fontSize: "15px", color: "#334E68", fontWeight: 600, margin: "4px 0 14px" }}
            >
              Tên tiếng Việt: {profile.vernacularNameVn}
            </p>
          ) : null}
          <ExternalLinkBadges
            externalLinks={profile.externalLinks}
            iucnStatus={profile.iucnStatus}
          />
        </div>

        <div className="hero-actions">
          <Link
            to={
              isAdmin
                ? `/admin/specimens?taxonId=${profile.id}`
                : `/specimens/search?taxonId=${profile.id}`
            }
            className="button button-ghost"
          >
            <Icon name="bug" size={16} />
            Mẫu vật ({profile.specimenCount || 0})
          </Link>
          <Link
            to={
              isAdmin
                ? `/admin/map?q=${encodeURIComponent(profile.scientificName)}`
                : `/map?q=${encodeURIComponent(profile.scientificName)}`
            }
            className="button button-ghost"
          >
            <Icon name="map" size={16} />
            Bản đồ phân bố
          </Link>
          {isAdmin ? (
            <button
              type="button"
              className="button button-primary"
              onClick={() => navigate("/admin/taxonomy/editor")}
            >
              <Icon name="edit" size={16} />
              Sửa hồ sơ loài
            </button>
          ) : null}
        </div>
      </div>

      <section className="card panel">
        <SpeciesProfileTabs profile={profile} />
      </section>
    </div>
  );
}
