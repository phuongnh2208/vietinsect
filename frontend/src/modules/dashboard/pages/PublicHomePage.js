import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  Treemap,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
} from "recharts";
import TechnicalFrame from "../../../components/ui/TechnicalFrame";
import Icon from "../../../components/ui/Icon";
import HomeMapHero from "../components/HomeMapHero";
import specimenService from "../../specimen/specimen.service";
import { getOrderColor } from "../../specimen/specimen.constants";
import { formatNumber } from "../../../utils/formatters";

const DEFAULT_HERO_IMAGE = process.env.PUBLIC_URL + "/Hero1.png";

const portalCards = [
  {
    title: "Kho mẫu vật số (Specimen Database)",
    desc: "Tra cứu hàng chục nghìn hồ sơ mẫu vật côn trùng chuẩn Darwin Core với hình ảnh thực địa và tọa độ thu mẫu.",
    link: "/specimens/search",
    actionText: "Khám phá mẫu vật",
    badge: "—",
    imagePlaceholderText: "Khung ảnh mẫu vật / Specimen Plate",
    imageSrc:
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Bản đồ phân bố sinh thái (GIS Map)",
    desc: "Khám phá tọa độ phát hiện loài, mật độ phân bố theo các tỉnh/thành phố và hệ thống Vườn Quốc Gia Việt Nam.",
    link: "/map",
    actionText: "Xem bản đồ GIS",
    badge: "—",
    imagePlaceholderText: "Khung ảnh bản đồ / GIS Map Plate",
    imageSrc:
      "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Dữ liệu mã vạch DNA (Genomic Data)",
    desc: "Liên kết chuỗi gen ty thể COI, phổ mã vạch phân tử, định dạng chuẩn FASTA và mã định danh quốc tế GenBank / BOLD.",
    link: "/dna",
    actionText: "Tra cứu DNA",
    badge: "—",
    imagePlaceholderText: "Khung ảnh DNA / Genomics Plate",
    imageSrc:
      "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Cây phân loại & Hồ sơ loài (Taxonomy)",
    desc: "Duyệt hệ thống phân loại học từ Giới đến Loài nhị danh theo chuẩn ICZN, Catalogue of Life và GBIF Backbone.",
    link: "/taxonomy",
    actionText: "Duyệt cây phân loại",
    badge: "—",
    imagePlaceholderText: "Khung ảnh phân loại / Taxonomy Plate",
    imageSrc:
      "https://images.unsplash.com/photo-1508873696983-2df5293cb32b?auto=format&fit=crop&w=800&q=80",
  },
];

function PublicOrderTreemapCell(props) {
  const { x, y, width, height, name, count, pct, onSelectOrder } = props;
  if (!width || !height || width < 18 || height < 18) return null;
  const fill = getOrderColor(name);

  return (
    <g
      onClick={() => onSelectOrder && name && onSelectOrder(name)}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill,
          stroke: "#FFFFFF",
          strokeWidth: 2,
        }}
      />
      {width > 68 && height > 34 && (
        <>
          <text
            x={x + 8}
            y={y + 18}
            fill="#FFFFFF"
            fontSize={width > 120 ? 13 : 11}
            fontWeight={800}
            fontFamily="Manrope, Inter, sans-serif"
          >
            {name}
          </text>
          <text
            x={x + 8}
            y={y + 34}
            fill="rgba(255,255,255,0.88)"
            fontSize={11}
            fontFamily="JetBrains Mono, Consolas, monospace"
          >
            {Number(count || 0).toLocaleString("vi-VN")} ({pct}%)
          </text>
        </>
      )}
    </g>
  );
}

export default function PublicHomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState(null);
  const [chartMode, setChartMode] = useState("treemap");

  const loadPublicStats = useCallback(() => {
    specimenService
      .getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  // SRS §4.2 F-DB-01 & F-DB-04: Cập nhật số liệu mở tự động mỗi 30 giây
  useEffect(() => {
    loadPublicStats();
    const timer = setInterval(loadPublicStats, 30000);
    return () => clearInterval(timer);
  }, [loadPublicStats]);

  const dynamicCards = useMemo(() => {
    const base = [
      {
        title: t("home.card1Title"),
        desc: t("home.card1Desc"),
        link: "/specimens/search",
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
    return base;
  }, [stats, t, i18n.language]);

  const orderChartData = useMemo(() => {
    const raw = stats?.byOrder || [];
    const total = raw.reduce((acc, r) => acc + Number(r.count || 0), 0) || 1;
    return raw.map((r) => ({
      name: r.order_name || "Khác",
      size: Number(r.count || 0),
      count: Number(r.count || 0),
      pct: ((Number(r.count || 0) / total) * 100).toFixed(1),
    }));
  }, [stats?.byOrder]);

  const topProvincesList = useMemo(() => {
    const raw = stats?.topProvinces || [];
    const maxCount = Number(raw[0]?.count || 1);
    return raw.slice(0, 8).map((p) => ({
      ...p,
      countNum: Number(p.count || 0),
      barPct: Math.max(6, Math.round((Number(p.count || 0) / maxCount) * 100)),
    }));
  }, [stats?.topProvinces]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/specimens/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/specimens/search");
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <main className="editorial-homepage">
      {/* 1. HERO SECTION: DUY NHẤT BANNER CHÍNH CÓ NÉT BO VIỀN CROPMARK & CORNER SQUARES */}
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
              <Link to="/specimens/search" className="hero-sublink highlight">
                {t("home.browseSpecimens")} →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. STATISTICAL METRICS STRIP (4 chỉ số dữ liệu mở theo SRS §4.2 F-DB-01 & F-DB-04) */}
      <section className="editorial-stat-section">
        <div className="editorial-container">
          <div className="stat-technical-grid">
            <div
              className="stat-box"
              style={{ cursor: "pointer" }}
              onClick={() => navigate("/specimens/search")}
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

      {/* 3. DASHBOARD TRỰC QUAN CHO NGƯỜI DÙNG */}
      <section className="editorial-discovery-section" style={{ paddingBottom: 16 }}>
        <div className="editorial-container">
          <div className="section-header-editorial">
            <span className="editorial-kicker">{t("home.realtimeKicker")}</span>
            <h2 className="editorial-section-title">{t("home.taxonomyDistTitle")}</h2>
            <p className="editorial-section-desc">{t("home.taxonomyDistDesc")}</p>
          </div>

          <div className="dashboard-grid" style={{ alignItems: "stretch" }}>
            <section className="card panel" style={{ display: "flex", flexDirection: "column" }}>
              <div className="panel-title">
                <div>
                  <h2>{t("home.orderDistTitle")}</h2>
                  <span style={{ fontSize: 12, color: "#555555" }}>
                    {t("home.orderDistSub", { count: orderChartData.length })}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className={`button button-sm ${
                      chartMode === "treemap" ? "button-primary" : "button-ghost"
                    }`}
                    onClick={() => setChartMode("treemap")}
                  >
                    Treemap 2D
                  </button>
                  <button
                    type="button"
                    className={`button button-sm ${
                      chartMode === "bar" ? "button-primary" : "button-ghost"
                    }`}
                    onClick={() => setChartMode("bar")}
                  >
                    {t("home.barChart")}
                  </button>
                </div>
              </div>

              <div style={{ width: "100%", height: 320, marginTop: 8 }}>
                {orderChartData.length > 0 ? (
                  chartMode === "treemap" ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <Treemap
                        data={orderChartData}
                        dataKey="size"
                        nameKey="name"
                        isAnimationActive={false}
                        content={
                          <PublicOrderTreemapCell
                            onSelectOrder={(orderName) =>
                              navigate(`/specimens/search?order=${encodeURIComponent(orderName)}`)
                            }
                          />
                        }
                      >
                        <RechartsTooltip
                          formatter={(val, _name, item) => [
                            `${formatNumber(val, i18n.language)} (${item?.payload?.pct || 0}%)`,
                            t("home.publicSpecimensCount"),
                          ]}
                        />
                      </Treemap>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={orderChartData.slice(0, 8)}
                        layout="vertical"
                        margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#111111" }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={96}
                          tick={{ fontSize: 11, fontWeight: 700, fill: "#111111" }}
                        />
                        <RechartsTooltip
                          formatter={(val) => [
                            formatNumber(val, i18n.language),
                            t("home.quantity"),
                          ]}
                        />
                        <Bar
                          dataKey="count"
                          onClick={(entry) =>
                            entry?.name &&
                            navigate(`/specimens/search?order=${encodeURIComponent(entry.name)}`)
                          }
                          style={{ cursor: "pointer" }}
                        >
                          {orderChartData.slice(0, 8).map((entry) => (
                            <Cell key={entry.name} fill={getOrderColor(entry.name)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )
                ) : null}
              </div>
            </section>

            {/* Bảng xếp hạng các Tỉnh/Thành phố giàu dữ liệu mẫu vật nhất */}
            <section className="card panel" style={{ display: "flex", flexDirection: "column" }}>
              <div className="panel-title">
                <div>
                  <h2>{t("home.hotspotsTitle")}</h2>
                  <span style={{ fontSize: 12, color: "#555555" }}>
                    {t("home.hotspotsSub")}
                  </span>
                </div>
                <Link to="/map" className="button button-sm button-ghost">
                  <Icon name="map" size={14} />
                  {t("navigation.gisMap")} →
                </Link>
              </div>

              <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
                {topProvincesList.map((prov, index) => (
                  <div
                    key={prov.province_id}
                    style={{ cursor: "pointer" }}
                    onClick={() =>
                      navigate(`/specimens/search?provinceId=${prov.province_id}`)
                    }
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12.5,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "#111111" }}>
                        #{index + 1} · {prov.province_name_vn}
                      </span>
                      <strong style={{ fontFamily: "monospace", color: "#0F3820" }}>
                        {t("home.specimensUnit", { count: formatNumber(prov.countNum, i18n.language) })}
                      </strong>
                    </div>
                    <div className="progress-track" style={{ height: 8 }}>
                      <div
                        className="progress-bar"
                        style={{
                          width: `${prov.barPct}%`,
                          background: index < 3 ? "#0F3820" : "#2E7D32",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      {/* 4. GIS DISTRIBUTION SECTION */}
      <section className="editorial-map-section">
        <div className="editorial-container">
          <div className="map-solid-frame">
            <HomeMapHero stats={stats} />
          </div>
        </div>
      </section>

      {/* 5. MẪU VẬT CÔNG KHAI MỚI GHI NHẬN TRONG CSDL */}
      {stats?.recentSpecimens && stats.recentSpecimens.length > 0 && (
        <section className="editorial-discovery-section" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <div className="editorial-container">
            <section className="card panel">
              <div className="panel-title">
                <div>
                  <h2>{t("home.recentSpecimensTitle")}</h2>
                  <span style={{ fontSize: 12, color: "#555555" }}>
                    {t("home.recentSpecimensSub")}
                  </span>
                </div>
                <Link to="/specimens/search" className="button button-sm button-primary">
                  {t("home.browseAllCount", { count: formatNumber(stats.totalSpecimens || 0, i18n.language) })}
                </Link>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="vi-data-table">
                  <thead>
                    <tr>
                      <th>{t("specimen.catalogNumber")}</th>
                      <th>{t("specimen.scientificName")}</th>
                      <th>{t("taxonomy.rank")}</th>
                      <th>{t("specimen.province")}</th>
                      <th>{t("specimen.eventDate")}</th>
                      <th style={{ textAlign: "right" }}>{t("home.colRecord")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentSpecimens.map((sp) => (
                      <tr key={sp.id}>
                        <td>
                          <Link to={`/specimens/${sp.id}`} className="vi-code-link">
                            {sp.specimenCode}
                          </Link>
                        </td>
                        <td>
                          <Link
                            to={`/specimens/${sp.id}`}
                            className="taxonomy-name"
                            style={{ fontSize: 13.5 }}
                          >
                            <em>{sp.scientificName}</em>
                          </Link>
                        </td>
                        <td>
                          <span className="status-badge status-public">{sp.taxonRank}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{sp.provinceNameVn || "Vietnam"}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                          {sp.collectionDate || "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Link
                            to={`/specimens/${sp.id}`}
                            className="button button-sm button-ghost"
                          >
                            {t("home.viewDetails")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      )}

      {/* 6. RESEARCH & DISCOVERY MODULES */}
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
                      <span>{card.imagePlaceholderText}</span>
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
    </main>
  );
}
