import React from "react";

export default function LoadingState({ label = "Đang tải dữ liệu..." }) {
  return (
    <div className="async-state">
      <span className="async-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
