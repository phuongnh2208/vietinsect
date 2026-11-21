import React from "react";
import { Bug } from "lucide-react";

export default function BrandLogo({ className = "", showSubtitle = false }) {
  return (
    <div className={`vietinsect-brand-logo ${className}`}>
      <Bug className="brand-insect-icon" size={30} strokeWidth={1.8} aria-hidden="true" />
      <div className="brand-text">
        <span className="brand-title">VietInsect</span>
        {showSubtitle && <span className="brand-subtitle">Biodiversity BigData</span>}
      </div>
    </div>
  );
}
