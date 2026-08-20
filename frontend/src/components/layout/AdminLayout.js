import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { AdminSidebar, Topbar } from "./AdminChrome";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell admin-shell">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Topbar onMenuClick={() => setSidebarOpen((current) => !current)} />
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
