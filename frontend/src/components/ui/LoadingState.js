import React from "react";
import { useTranslation } from "react-i18next";

export default function LoadingState({ label }) {
  const { t } = useTranslation();
  return (
    <div className="async-state">
      <span className="async-spinner" aria-hidden="true" />
      <span>{label || t("common.loading")}</span>
    </div>
  );
}
