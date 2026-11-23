import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import Icon from "./Icon";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();
  const resolvedConfirm = confirmLabel || t("common.confirm");
  const resolvedCancel = cancelLabel || t("common.cancel");

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className={`dialog-icon dialog-icon-${tone}`}>
          <Icon name={tone === "warning" ? "alert" : "shield"} size={23} />
        </div>
        <button className="icon-button dialog-close" onClick={onCancel} aria-label={resolvedCancel}>
          <Icon name="close" size={18} />
        </button>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{message}</p>
        <div className="dialog-actions">
          <button type="button" className="button button-ghost" onClick={onCancel}>
            {resolvedCancel}
          </button>
          <button type="button" className={`button button-${tone}`} onClick={onConfirm}>
            {resolvedConfirm}
          </button>
        </div>
      </section>
    </div>
  );
}
