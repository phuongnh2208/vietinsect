import React from "react";
import { NavLink, Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandLogo from "../ui/BrandLogo";
import LanguageSwitcher from "../ui/LanguageSwitcher";

const publicNavItems = [
  { labelKey: "navigation.specimenSearch", path: "/search" },
  { labelKey: "navigation.gisMap", path: "/map" },
  { labelKey: "navigation.taxonomyTree", path: "/taxonomy" },
  { labelKey: "navigation.dnaBarcode", path: "/dna" },
  { labelKey: "navigation.mediaGallery", path: "/media" },
];

export default function PublicLayout() {
  const { t } = useTranslation();

  return (
    <div className="app-shell public-shell editorial-theme">
      {/* Top Main Navigation Bar */}
      <header className="public-editorial-header">
        <div className="header-container">
          <Link to="/" className="brand-logo-link" aria-label={t("navigation.home")}>
            <BrandLogo />
          </Link>

          <nav className="editorial-nav" aria-label={t("navigation.mainNav")}>
            <div className="nav-links-wrapper">
              {publicNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-link-item ${isActive ? "active" : ""}`}
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
              <LanguageSwitcher variant="single" />
            </div>
          </nav>
        </div>
      </header>

      {/* Main Page Outlet */}
      <div className="public-page-body">
        <Outlet />
      </div>

      {/* Editorial Footer */}
      <footer className="editorial-footer">
        <div className="footer-container">
          <div className="footer-brand-col">
            <BrandLogo showSubtitle={true} />
            <p className="footer-mission">{t("footer.mission")}</p>
          </div>

          <div className="footer-links-grid">
            <div className="footer-col">
              <h4>{t("footer.dataExploration")}</h4>
              <Link to="/search">{t("footer.digitalSpecimens")}</Link>
              <Link to="/taxonomy">{t("footer.taxonomyTree")}</Link>
              <Link to="/dna">{t("footer.dnaRepository")}</Link>
              <Link to="/media">{t("footer.mediaLibrary")}</Link>
            </div>
            <div className="footer-col">
              <h4>{t("footer.toolsAndMaps")}</h4>
              <Link to="/map">{t("footer.gisDistributionMap")}</Link>
              <Link to="/ai/species-identification">{t("footer.aiSpeciesId")}</Link>
              <Link to="/search/advanced">{t("footer.advancedSearch")}</Link>
            </div>
            <div className="footer-col">
              <h4>{t("footer.standardsAndAdmin")}</h4>
              <Link to="/reports">{t("footer.biodiversityReports")}</Link>
              <a href="https://www.gbif.org" target="_blank" rel="noreferrer">
                {t("footer.gbifStandard")}
              </a>
              <Link to="/login">{t("footer.adminArea")}</Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div className="footer-container bottom-flex">
            <span>{t("footer.copyright", { year: new Date().getFullYear() })}</span>
            <span className="footer-tagline">{t("footer.tagline")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
