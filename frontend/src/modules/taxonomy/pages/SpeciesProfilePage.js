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
  const [status, setStatus] = useState("loading");
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
              ? t("taxonomy.errorNotFound", "Không tìm thấy hồ sơ loài yêu cầu.")
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

  if (status === "loading" || !profile) {
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

  const taxBreadcrumbs = [
    { rank: "Kingdom", name: profile.kingdomName || "Animalia" },
    { rank: "Phylum", name: profile.phylumName || "Arthropoda" },
    { rank: "Class", name: profile.className || "Insecta" },
    profile.orderName && { rank: "Order", name: profile.orderName },
    profile.familyName && { rank: "Family", name: profile.familyName },
    profile.genusName && { rank: "Genus", name: profile.genusName, italic: true },
  ].filter(Boolean);

  return (
    <div className="page-container page-content vi-page-enter" data-testid="species-profile-page">
      {/* Compact Breadcrumb & Taxonomic Classification Row */}
      <div className="vi-species-top-nav">
        <button
          type="button"
          className="vi-back-page-btn"
          onClick={handleGoBack}
          title="Quay lại trang trước"
        >
          <Icon name="chevron-left" size={14} />
          <span>Quay lại</span>
        </button>

        <nav className="vi-tax-breadcrumb-strip" aria-label="Taxonomic hierarchy">
          <Link to={isAdmin ? "/admin/taxonomy" : "/taxonomy"} className="vi-tax-crumb-link">
            Cây phân loại
          </Link>
          {taxBreadcrumbs.map((b) => (
            <React.Fragment key={`${b.rank}-${b.name}`}>
              <span className="vi-tax-crumb-sep">/</span>
              <span className="vi-tax-crumb-badge" title={b.rank}>
                <small>{b.rank}:</small>{" "}
                {b.italic ? <em>{b.name}</em> : <strong>{b.name}</strong>}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Compact Scientific Species Header */}
      <header className="card vi-species-compact-header">
        <div className="vi-species-header-main">
          <div className="vi-species-badges-row">
            <span className="vi-rank-pill">{profile.rank || "Species"}</span>
            <span className="vi-status-pill">
              {(profile.taxonomicStatus || "accepted").toUpperCase()}
            </span>
            {profile.iucnStatus ? (
              <span className="vi-iucn-pill" title="IUCN Red List Status">
                IUCN: {profile.iucnStatus}
              </span>
            ) : null}
          </div>

          <h1 className="vi-species-primary-title">
            <em>{profile.scientificName}</em>
            {profile.scientificNameAuthorship ? (
              <span className="vi-species-authorship"> {profile.scientificNameAuthorship}</span>
            ) : null}
          </h1>

          <div className="vi-species-vernacular-row">
            <span>
              <strong>Tên tiếng Việt:</strong>{" "}
              {profile.vernacularNameVn || t("common.notProvided", "Chưa cung cấp")}
            </span>
            <span className="vi-dot-sep">·</span>
            <span>
              <strong>Tên tiếng Anh:</strong>{" "}
              {profile.vernacularNameEn || t("common.notProvided", "Chưa cung cấp")}
            </span>
          </div>

          <div style={{ marginTop: 8 }}>
            <ExternalLinkBadges
              externalLinks={profile.externalLinks}
              iucnStatus={profile.iucnStatus}
            />
          </div>
        </div>

        <div className="vi-species-header-actions">
          <Link
            to={
              isAdmin
                ? `/admin/specimens?taxonId=${profile.id}`
                : `/specimens/search?taxonId=${profile.id}`
            }
            className="button button-sm button-secondary"
          >
            <Icon name="bug" size={15} />
            <span>
              Mẫu vật (<strong>{(profile.specimenCount || 0).toLocaleString("vi-VN")}</strong>)
            </span>
          </Link>
          <Link
            to={
              isAdmin
                ? `/admin/map?q=${encodeURIComponent(profile.scientificName)}`
                : `/map?q=${encodeURIComponent(profile.scientificName)}`
            }
            className="button button-sm button-ghost"
          >
            <Icon name="map" size={15} />
            <span>Bản đồ phân bố</span>
          </Link>
          {isAdmin ? (
            <button
              type="button"
              className="button button-sm button-primary"
              onClick={() => navigate("/admin/taxonomy/editor")}
            >
              <Icon name="edit" size={15} />
              <span>Sửa hồ sơ</span>
            </button>
          ) : null}
        </div>
      </header>

      {/* Main Tabbed Content Section */}
      <section className="card vi-species-tabs-card">
        <SpeciesProfileTabs profile={profile} />
      </section>
    </div>
  );
}
