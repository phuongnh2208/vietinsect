import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";

const features = [
  { icon: "database", title: "Kho mẫu vật số", copy: "Tra cứu dữ liệu định danh, thu mẫu và hình ảnh từ các bộ sưu tập." },
  { icon: "map", title: "Bản đồ phân bố", copy: "Khám phá các điểm ghi nhận và vùng phân bố của loài tại Việt Nam." },
  { icon: "dna", title: "Dữ liệu DNA", copy: "Liên kết chuỗi DNA, FASTA và GenBank trong cùng một hồ sơ khoa học." },
];

export default function PublicHomePage() {
  const { t } = useTranslation();
  return (
    <>
      <main>
        <section className="screen-hero vi-page-enter">
          <div className="hero-content"><span className="hero-kicker">VietInsect BigData System · SCR-04</span><h1 className="hero-title">Dữ liệu côn trùng cho những khám phá bền vững.</h1><p className="hero-copy">{t("appSubtitle")} — nền tảng kết nối mẫu vật, loài, hình ảnh, bản đồ và dữ liệu DNA phục vụ nghiên cứu, giáo dục và bảo tồn.</p><div className="hero-actions"><Link to="/specimens/search" className="button button-primary"><Icon name="search" size={16} />Khám phá dữ liệu</Link><Link to="/map" className="button button-ghost"><Icon name="map" size={16} />Xem bản đồ phân bố</Link></div></div>
        </section>
        <section className="public-stat-strip"><div className="public-stat"><strong>24,680</strong><span>Mẫu vật đã số hóa</span></div><div className="public-stat"><strong>3,842</strong><span>Loài được ghi nhận</span></div><div className="public-stat"><strong>63</strong><span>Tỉnh thành có dữ liệu</span></div></section>
        <section className="page-container feature-grid">{features.map((feature) => <article key={feature.title} className="card feature-card vi-hover-lift"><div className="feature-icon"><Icon name={feature.icon} size={21} /></div><h3>{feature.title}</h3><p>{feature.copy}</p></article>)}</section>
      </main>
    </>
  );
}
