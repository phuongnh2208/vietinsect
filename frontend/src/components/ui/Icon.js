import React from "react";

const paths = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  filter: <path d="M4 5h16M7 12h10m-7 7h4" />,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15m6-12v15" /></>,
  tree: <><path d="M12 21V4" /><path d="m12 8 5-4m-5 8 6-3M12 14l-5-4m5 8-6-3" /><circle cx="12" cy="3" r="2" /><circle cx="17" cy="4" r="2" /><circle cx="18" cy="11" r="2" /><circle cx="7" cy="10" r="2" /><circle cx="6" cy="17" r="2" /></>,
  leaf: <><path d="M20.8 3.2C12.8 3.1 6.3 5.2 4.1 10.1c-1.5 3.3.6 6.5 3.9 6.5 5.2 0 8.7-4.3 10.1-9.5" /><path d="M3 21c3.2-6.5 7.2-9.3 13.2-12.1" /></>,
  bug: <><ellipse cx="12" cy="13" rx="4.5" ry="7" /><path d="M12 6V3m-3 4L7 5m8 2 2-2M7.5 12H3m4.5 5H4m8.5-5H21m-4.5 5H20M9 20l-1 2m7-2 1 2" /></>,
  dna: <><path d="M8 3c8 4 8 14 0 18M16 3c-8 4-8 14 0 18M6 7h12M6 12h12M6 17h12" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6m-6 4h6" /></>,
  chart: <><path d="M4 19V5m0 14h16" /><path d="m7 15 3-4 3 2 4-6" /><circle cx="7" cy="15" r="1" /><circle cx="10" cy="11" r="1" /><circle cx="13" cy="13" r="1" /><circle cx="17" cy="7" r="1" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.6v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.5-1H6v-2.6h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h2.6v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
  shield: <><path d="M12 3 20 6v5c0 5.2-3.4 8.8-8 10-4.6-1.2-8-4.8-8-10V6l8-3Z" /><path d="m8.5 12 2.3 2.3 4.8-5" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8m-2 0 2 2m-5 1 2 2" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  edit: <><path d="m4 16-.8 4.8L8 20l11.5-11.5a2.1 2.1 0 0 0-3-3L5 17Z" /><path d="m14.5 7.5 3 3" /></>,
  upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5M4 15v5h16v-5" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  tag: <><path d="M4 5v6l9 9 7-7-9-9H4Z" /><circle cx="8" cy="9" r="1" /></>,
  sparkles: <><path d="m12 3-1.4 4.6L6 9l4.6 1.4L12 15l1.4-4.6L18 9l-4.6-1.4L12 3ZM19 14l-.8 2.2L16 17l2.2.8L19 20l.8-2.2L22 17l-2.2-.8L19 14ZM5 15l-.6 1.4L3 17l1.4.6L5 19l.6-1.4L7 17l-1.4-.6L5 15Z" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z" />,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
  "arrow-up-right": <><path d="M7 17 17 7M7 7h10v10" /></>,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "more-horizontal": <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
};

export default function Icon({ name = "dashboard", size = 20, strokeWidth = 1.8, className = "", ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={`vi-icon ${className}`} aria-hidden="true" {...props}>
      {paths[name] || paths.dashboard}
    </svg>
  );
}
