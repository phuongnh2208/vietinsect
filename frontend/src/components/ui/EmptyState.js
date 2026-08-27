import React from "react";
import Icon from "./Icon";

export default function EmptyState({ icon = "database", title, description, action }) {
  return (
    <div className="async-state async-state-empty">
      <Icon name={icon} size={26} />
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {action}
    </div>
  );
}
