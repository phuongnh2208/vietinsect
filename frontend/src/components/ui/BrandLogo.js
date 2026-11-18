import React from "react";

export default function BrandLogo({ className = "", showSubtitle = false }) {
  return (
    <div className={`vietinsect-brand-logo ${className}`}>
      <svg
        className="brand-insect-icon"
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Thorax and Abdomen */}
        <ellipse cx="58" cy="46" rx="6" ry="12" transform="rotate(-30 58 46)" fill="#2C3E50" stroke="#111" strokeWidth="1.5" />
        <ellipse cx="49" cy="36" rx="5" ry="7" transform="rotate(-30 49 36)" fill="#34495E" stroke="#111" strokeWidth="1.5" />
        {/* Head */}
        <circle cx="43" cy="29" r="4.5" fill="#1A252F" stroke="#111" strokeWidth="1.5" />
        {/* Eyes & Antennae */}
        <circle cx="41.5" cy="27.5" r="1.5" fill="#fff" />
        <path d="M41 26 C36 21 32 18 27 19" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M43 25 C40 18 38 13 36 10" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
        {/* Forewing - sketched botanical/entomological style */}
        <path
          d="M51 34 C58 15 78 6 92 12 C96 23 88 38 68 44 C59 46 53 40 51 34 Z"
          fill="rgba(100, 140, 180, 0.22)"
          stroke="#111"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Wing venation lines */}
        <path d="M53 34 C64 24 78 18 89 15" stroke="#111" strokeWidth="1" strokeOpacity="0.7" />
        <path d="M65 24 C72 28 82 29 88 27" stroke="#111" strokeWidth="0.8" strokeOpacity="0.6" />
        <path d="M72 19 C76 24 82 25 86 24" stroke="#111" strokeWidth="0.8" strokeOpacity="0.6" />
        <path d="M58 31 C67 36 76 39 82 37" stroke="#111" strokeWidth="0.8" strokeOpacity="0.6" />
        {/* Hindwing */}
        <path
          d="M54 38 C60 26 76 22 84 29 C86 38 78 48 64 50 C57 51 54 44 54 38 Z"
          fill="rgba(70, 110, 150, 0.18)"
          stroke="#111"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M56 38 C65 33 74 33 80 34" stroke="#111" strokeWidth="0.8" strokeOpacity="0.6" />
        {/* Legs with delicate joints */}
        <path d="M48 40 L42 48 L37 54" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M53 43 L48 54 L44 63" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M58 48 L56 60 L53 69" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="brand-text">
        <span className="brand-title">VietInsect</span>
        {showSubtitle && <span className="brand-subtitle">Biodiversity BigData</span>}
      </div>
    </div>
  );
}
