import React from "react";
import { useTranslation } from "react-i18next";
import { changeAppLanguage, normalizeLanguage } from "../../i18n";

function VietnamFlag({ size = 30 }) {
  const height = Math.round((size * 2) / 3);
  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 30 20"
      aria-hidden="true"
      focusable="false"
      data-testid="flag-svg-vi"
      style={{ display: "block", borderRadius: 0, flexShrink: 0 }}
    >
      <rect width="30" height="20" fill="#DA251D" />
      <polygon
        fill="#FFCD00"
        points="15,3.5 16.54,8.25 21.54,8.25 17.5,11.18 19.04,15.93 15,13 10.96,15.93 12.5,11.18 8.46,8.25 13.46,8.25"
      />
    </svg>
  );
}

function UkFlag({ size = 30 }) {
  const height = Math.round((size * 2) / 3);
  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 30 20"
      aria-hidden="true"
      focusable="false"
      data-testid="flag-svg-en"
      style={{ display: "block", borderRadius: 0, flexShrink: 0 }}
    >
      <rect width="30" height="20" fill="#012169" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#FFFFFF" strokeWidth="4" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" strokeWidth="2" />
      <path d="M15,0 V20 M0,10 H30" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M15,0 V20 M0,10 H30" stroke="#C8102E" strokeWidth="3.5" />
    </svg>
  );
}

/**
 * Reusable LanguageSwitcher component.
 * - variant="single": displays a single rectangular flag button (no text, no rounded corners).
 *   Clicking toggles immediately between Vietnamese (vi) and English (en).
 * - variant="segmented": displays both VI and EN options with active state.
 */
export default function LanguageSwitcher({ variant = "single", className = "" }) {
  const { t, i18n } = useTranslation();
  const currentLang = normalizeLanguage(i18n.language);
  const nextLang = currentLang === "vi" ? "en" : "vi";

  const handleToggle = () => {
    changeAppLanguage(nextLang);
  };

  if (variant === "segmented") {
    return (
      <div
        className={`language-toggle ${className}`.trim()}
        role="group"
        aria-label={t("common.language")}
      >
        <button
          type="button"
          className={currentLang === "vi" ? "active" : ""}
          aria-pressed={currentLang === "vi"}
          title={t("common.switchToVi")}
          onClick={() => changeAppLanguage("vi")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <VietnamFlag size={18} />
          <span>VI</span>
        </button>
        <button
          type="button"
          className={currentLang === "en" ? "active" : ""}
          aria-pressed={currentLang === "en"}
          title={t("common.switchToEn")}
          onClick={() => changeAppLanguage("en")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <UkFlag size={18} />
          <span>EN</span>
        </button>
      </div>
    );
  }

  const tooltip =
    currentLang === "vi" ? t("common.switchToEn") : t("common.switchToVi");

  return (
    <button
      type="button"
      className={`language-single-btn ${className}`.trim()}
      onClick={handleToggle}
      title={tooltip}
      aria-label={tooltip}
      data-testid="language-switcher-btn"
      data-lang={currentLang}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 20,
        boxSizing: "content-box",
        padding: 0,
        borderRadius: 0,
        border: "1px solid #d1d5db",
        background: "transparent",
        cursor: "pointer",
        lineHeight: 0,
        overflow: "hidden",
      }}
    >
      {currentLang === "vi" ? <VietnamFlag size={30} /> : <UkFlag size={30} />}
    </button>
  );
}
