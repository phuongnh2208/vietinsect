import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TechnicalFrame from "../../../components/ui/TechnicalFrame";
import Icon from "../../../components/ui/Icon";
import HomeMapHero from "../components/HomeMapHero";
import specimenService from "../../specimen/specimen.service";
import { formatNumber } from "../../../utils/formatters";

const DEFAULT_HERO_IMAGE = process.env.PUBLIC_URL + "/Hero1.png";

export default function PublicHomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState(null);

  const loadPublicStats = useCallback(() => {
    specimenService
      .getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  // SRS §4.2 F-DB-04: Cập nhật số liệu mở tự động mỗi 30 giây
  useEffect(() => {
    loadPublicStats();
    const timer = setInterval(loadPublicStats, 30000);
    return () => clearInterval(timer);
  }, [loadPublicStats]);

  const dynamicCards = useMemo(() => {
    return [
      {
        title: t("home.card1Title"),
        desc: t("home.card1Desc"),
        link: "/search",
        actionText: t("home.card1Action"),
        badge: stats
          ? t("home.card1Badge", { count: formatNumber(stats.totalSpecimens ?? 0, i18n.language) })
          : "—",
        imageSrc:
          "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: t("home.card2Title"),
        desc: t("home.card2Desc"),
        link: "/map",
        actionText: t("home.card2Action"),
        badge: stats
          ? t("home.card2Badge", {
              covered: stats.provincesCovered ?? 0,
              total: stats.totalProvinces ?? 0,
            })
          : "—",
        imageSrc:
          "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: t("home.card3Title"),
        desc: t("home.card3Desc"),
        link: "/dna",
        actionText: t("home.card3Action"),
        badge: stats
          ? t("home.card3Badge", { count: formatNumber(stats.dnaCount ?? 0, i18n.language) })
          : "—",
        imageSrc:
          "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=800&q=80",
      },
      {
        title: t("home.card4Title"),
        desc: t("home.card4Desc"),
        link: "/taxonomy",
        actionText: t("home.card4Action"),
        badge: stats
          ? t("home.card4Badge", {
              count: formatNumber(
                stats.distinctSpeciesTaxa ?? stats.distinctBinomialSpecies ?? 0,
                i18n.language
              ),
            })
          : "—",
        imageSrc:
          "https://images.unsplash.com/photo-1508873696983-2df5293cb32b?auto=format&fit=crop&w=800&q=80",
      },
    ];
  }, [stats, t, i18n.language]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/search");
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <main className="editorial-homepage">
      {/* 1. HERO SECTION: GIỚI THIỆU VIETINSECT & TÌM KIẾM NHANH (GBIF-STYLE) */}
      <section className="hero-editorial-section">
        <div className="hero-frame-container">
          <TechnicalFrame
            markers="diagonal"
            cropExtension={26}
            aspectRatio="21/9"
            className="hero-technical-frame"
          >
            <div className="hero-image-slot">
              <img
                src={DEFAULT_HERO_IMAGE}
                alt="VietInsect Biodiversity Hero Plate"
                className="hero-media"
                onError={(e) => {
                  e.target.style.display = "none";
                  const placeholder = e.target.nextElementSibling;
                  if (placeholder) placeholder.style.display = "flex";
                }}
              />
              <div className="hero-media-placeholder" style={{ display: "none" }}>
                <Icon name="bug" size={48} />
                <span>[Khung ảnh Hero - Bạn có thể chèn ảnh tại public/Hero1.png]</span>
              </div>
            </div>

            <div className="hero-search-overlay">
              <form className="hero-pill-search-form" onSubmit={handleSearchSubmit}>
                <button type="submit" className="pill-search-icon-btn" aria-label={t("common.search")}>
                  <Icon name="search" size={20} strokeWidth={2.4} />
                </button>

                <input
                  type="text"
                  className="pill-search-input"
                  placeholder={t("home.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label={t("common.search")}
                />

                {searchQuery && (
                  <button
                    type="button"
                    className="pill-clear-btn"
                    onClick={handleClearSearch}
                    aria-label={t("common.reset")}
                  >
                    <Icon name="close" size={16} strokeWidth={2.4} />
                  </button>
                )}
              </form>
            </div>
          </TechnicalFrame>

          <div className="hero-editorial-footer">
            <h1 className="hero-manifesto-title">{t("home.heroTitle")}</h1>
            <div className="hero-quick-links">
              <Link to="/taxonomy" className="hero-sublink">
                {t("navigation.taxonomyTree")}
              </Link>
              <Link to="/dna" className="hero-sublink">
                {t("navigation.dnaBarcode")}
              </Link>
              <Link to="/search" className="hero-sublink highlight">
                {t("home.browseSpecimens")} →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. STATISTICAL METRICS STRIP (4 chỉ số dữ liệu mở gọn gàng kiểu GBIF) */}
      <section className="editorial-stat-section">
        <div className="editorial-container">
          <div className="stat-technical-grid">
            <div
              className="stat-box"
              style={{ cursor: "pointer" }}
              onClick={() => navigate("/search")}
            >
              <span className="stat-label">{t("home.statSpecimens")}</span>
              <strong className="stat-number">
                {stats ? formatNumber(stats.totalSpecimens ?? 0, i18n.language) : "—"}
              </strong>
              <span className="stat-sub">
                {stats
                  ? `${formatNumber(stats.withCoordinates ?? 0, i18n.language)} GPS`
                  : t("common.loading")}
              </span>
            </div>

            <div
              className="stat-box"
              style={{ cursor: "pointer" }}
              onClick={() => navigate("/taxonomy")}
            >
              <span className="stat-label">{t("home.statSpecies")}</span>
              <strong className="stat-number">
                {stats
                  ? formatNumber(
                      stats.distinctSpeciesTaxa ?? stats.distinctBinomialSpecies ?? 0,
                      i18n.language
                    )
                  : "—"}
              </strong>
              <span className="stat-sub">
                {stats
                  ? `${formatNumber(stats.taxa?.families ?? 0, i18n.language)} ${t("specimen.family")} · ${formatNumber(
                      stats.taxa?.genera ?? 0,
                      i18n.language
                    )} ${t("specimen.genus")}`
                  : t("common.loading")}
              </span>
            </div>

            <div className="stat-box" style={{ cursor: "pointer" }} onClick={() => navigate("/map")}>
              <span className="stat-label">{t("navigation.gisMap")}</span>
              <strong className="stat-number">
                {stats
                  ? `${stats.provincesCovered ?? 0} / ${stats.totalProvinces ?? 0}`
                  : "—"}
              </strong>
              <span className="stat-sub">{t("specimen.province")} (PostGIS)</span>
            </div>

            <div className="stat-box" style={{ cursor: "pointer" }} onClick={() => navigate("/dna")}>
              <span className="stat-label">{t("home.statDna")}</span>
              <strong className="stat-number">
                {stats ? formatNumber(stats.dnaCount ?? 0, i18n.language) : "—"}
              </strong>
              <span className="stat-sub">
                {stats
                  ? `COI · ${formatNumber(stats.imageCount ?? 0, i18n.language)} ${t("home.statMedia")}`
                  : t("common.loading")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. GIỚI THIỆU HỆ THỐNG VIETINSECT */}
      <section className="editorial-discovery-section">
        <div className="editorial-container">
          <div className="section-header-editorial">
            <span className="editorial-kicker">{t("home.modulesKicker")}</span>
            <h2 className="editorial-section-title">{t("home.modulesTitle")}</h2>
            <p className="editorial-section-desc">{t("home.modulesDesc")}</p>
          </div>

          <div className="editorial-cards-grid">
            {dynamicCards.map((card, idx) => (
              <article key={idx} className="editorial-feature-card">
                <div className="card-solid-frame">
                  <div className="card-image-slot">
                    {card.imageSrc ? (
                      <img
                        src={card.imageSrc}
                        alt={card.title}
                        className="card-img"
                        onError={(e) => {
                          e.target.style.display = "none";
                          const placeholder = e.target.nextElementSibling;
                          if (placeholder) placeholder.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className="card-placeholder-box"
                      style={{ display: card.imageSrc ? "none" : "flex" }}
                    >
                      <Icon name="tag" size={24} />
                    </div>
                    <span className="card-floating-badge">{card.badge}</span>
                  </div>
                </div>

                <div className="card-body">
                  <h3 className="card-title">{card.title}</h3>
                  <p className="card-desc">{card.desc}</p>
                  <Link to={card.link} className="card-action-link">
                    {card.actionText} <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4. BẢN ĐỒ PHÂN BỐ LỚN Ở CUỐI TRANG */}
      <section className="editorial-map-section">
        <div className="editorial-container">
          <HomeMapHero stats={stats} />
        </div>
      </section>
    </main>
  );
}
