import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TechnicalFrame from "../../../components/ui/TechnicalFrame";
import Icon from "../../../components/ui/Icon";
import HomeMapHero from "../components/HomeMapHero";

// GỢI Ý CHO NGƯỜI DÙNG: Đường dẫn ảnh Hero chính trong thư mục public
const DEFAULT_HERO_IMAGE = process.env.PUBLIC_URL + "/Hero1.png";

const portalCards = [
  {
    title: "Kho mẫu vật số (Specimen Database)",
    desc: "Tra cứu hàng chục nghìn hồ sơ mẫu vật côn trùng với hình ảnh vi thể độ phân giải cao và vị trí thu mẫu.",
    link: "/specimens/search",
    actionText: "Khám phá mẫu vật",
    badge: "24,680 records",
    imagePlaceholderText: "Khung ảnh mẫu vật / Specimen Plate",
    imageSrc: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Bản đồ phân bố sinh thái (GIS Map)",
    desc: "Khám phá tọa độ phát hiện loài, mật độ phân bố theo sinh cảnh rừng và các khu bảo tồn thiên nhiên.",
    link: "/map",
    actionText: "Xem bản đồ GIS",
    badge: "63 tỉnh thành",
    imagePlaceholderText: "Khung ảnh bản đồ / GIS Map Plate",
    imageSrc: "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Dữ liệu mã vạch DNA (Genomic Data)",
    desc: "Liên kết chuỗi gen ty thể COI, định dạng chuẩn FASTA và mã định danh quốc tế GenBank/NCBI.",
    link: "/dna",
    actionText: "Tra cứu DNA",
    badge: "1,420 sequences",
    imagePlaceholderText: "Khung ảnh DNA / Genomics Plate",
    imageSrc: "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Nhận diện loài AI (AI Species ID)",
    desc: "Phân loại nhanh họ, bộ và loài côn trùng từ ảnh chụp thực địa bằng mô hình Deep Learning.",
    link: "/ai/species-identification",
    actionText: "Thử nghiệm AI",
    badge: "Vision AI",
    imagePlaceholderText: "Khung ảnh AI / Detection Plate",
    imageSrc: "https://images.unsplash.com/photo-1508873696983-2df5293cb32b?auto=format&fit=crop&w=800&q=80",
  },
];

export default function PublicHomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

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
            {/* Slot ảnh Hero */}
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

            {/* Thanh tìm kiếm Pill nổi trên Hero Banner */}
            <div className="hero-search-overlay">
              <form className="hero-pill-search-form" onSubmit={handleSearchSubmit}>
                <button
                  type="submit"
                  className="pill-search-icon-btn"
                  aria-label="Tìm kiếm"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>

                <input
                  type="text"
                  className="pill-search-input"
                  placeholder="Tìm kiếm loài, mẫu vật, họ, bộ hoặc địa phương..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Tìm kiếm dữ liệu côn trùng"
                />

                {searchQuery && (
                  <button
                    type="button"
                    className="pill-clear-btn"
                    onClick={handleClearSearch}
                    aria-label="Xóa từ khóa"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </form>
            </div>
          </TechnicalFrame>

          {/* Dòng tuyên ngôn và Quick Links ngay dưới khung Hero */}
          <div className="hero-editorial-footer">
            <h1 className="hero-manifesto-title">
              FREE AND OPEN ACCESS TO BIODIVERSITY DATA
            </h1>
            <div className="hero-quick-links">
              <Link to="/reports" className="hero-sublink">What is VietInsect?</Link>
              <Link to="/reports" className="hero-sublink">About VietInsect</Link>
              <Link to="/specimens/search" className="hero-sublink highlight">Explore Catalog →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. STATISTICAL METRICS STRIP (Khối dữ liệu khoa học dạng ô lưới kỹ thuật) */}
      <section className="editorial-stat-section">
        <div className="editorial-container">
          <div className="stat-technical-grid">
            <div className="stat-box">
              <span className="stat-label">MẪU VẬT ĐÃ SỐ HÓA</span>
              <strong className="stat-number">24,680</strong>
              <span className="stat-sub">Specimens digitized</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">LOÀI GHI NHẬN</span>
              <strong className="stat-number">3,842</strong>
              <span className="stat-sub">Identified species</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">TỈNH / THÀNH DỮ LIỆU</span>
              <strong className="stat-number">63</strong>
              <span className="stat-sub">Provinces covered</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">TRÌNH TỰ GEN COI</span>
              <strong className="stat-number">1,420</strong>
              <span className="stat-sub">DNA Barcode sequences</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. RESEARCH & DISCOVERY MODULES VỚI VIỀN MẢNG ĐEN / XANH LÁ ĐẬM SẮC NÉT (KHÔNG CROPMARKS) */}
      <section className="editorial-discovery-section">
        <div className="editorial-container">
          <div className="section-header-editorial">
            <span className="editorial-kicker">KHOA HỌC DỮ LIỆU ĐA DẠNG SINH HỌC</span>
            <h2 className="editorial-section-title">Các Phân Hệ Nghiên Cứu Chuyên Sâu</h2>
            <p className="editorial-section-desc">
              Hệ thống cung cấp công cụ toàn diện từ số hóa mẫu vật thực địa, phân tích phân tử, GIS không gian đến mô hình học sâu.
            </p>
          </div>

          <div className="editorial-cards-grid">
            {portalCards.map((card, idx) => (
              <article key={idx} className="editorial-feature-card">
                {/* Khung ảnh viền mảng đen / xanh đậm sắc nét, gọn gàng */}
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

      {/* 4. GIS DISTRIBUTION SECTION */}
      <section className="editorial-map-section">
        <div className="editorial-container">
          <div className="section-header-editorial">
            <span className="editorial-kicker">KHÔNG GIAN ĐỊA LÝ SINH THÁI</span>
            <h2 className="editorial-section-title">Bản Đồ Phân Bố Côn Trùng Việt Nam</h2>
          </div>

          <div className="map-solid-frame">
            <HomeMapHero />
          </div>
        </div>
      </section>
    </main>
  );
}
