import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import LoginPage from "./modules/auth/pages/LoginPage";
import AuthGuard from "./modules/auth/AuthGuard";
import AdminLayout from "./components/layout/AdminLayout";
import PublicLayout from "./components/layout/PublicLayout";
import AdminDashboardPage from "./modules/dashboard/pages/AdminDashboardPage";
import PublicHomePage from "./modules/dashboard/pages/PublicHomePage";
import RegistryScreenPage from "./pages/RegistryScreenPage";
import NotFound from "./pages/NotFound";

const adminRoutes = [
  ["change-password", "SCR-02"], ["specimens", "SCR-05"], ["specimens/new", "SCR-06"], ["specimens/edit", "SCR-07"], ["specimens/import", "SCR-09"], ["specimens/batch-edit", "SCR-10"], ["specimens/labels", "SCR-11"], ["taxonomy/editor", "SCR-14"], ["map/layers", "SCR-19"], ["dna/new", "SCR-21"], ["ai/sdm", "SCR-24"], ["analytics", "SCR-25"], ["reports/kpi", "SCR-27"], ["reports/custom", "SCR-28"], ["sharing", "SCR-29"], ["system", "SCR-30"],
];

const publicRoutes = [
  ["specimens/search", "SCR-15"], ["search/advanced", "SCR-16"], ["media", "SCR-17"], ["map", "SCR-18"], ["taxonomy", "SCR-12"], ["species/:slug", "SCR-13"], ["dna", "SCR-20"], ["dna/:id/fasta", "SCR-22"], ["ai/species-identification", "SCR-23"], ["reports", "SCR-26"], ["specimens/:id", "SCR-08"],
];

const adminChildRoutes = [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: "dashboard", element: <AdminDashboardPage /> },
  ...adminRoutes.map(([path, screenId]) => ({ path, element: <RegistryScreenPage screenId={screenId} /> })),
];

const publicChildRoutes = [
  { index: true, element: <PublicHomePage /> },
  ...publicRoutes.map(([path, screenId]) => ({ path, element: <RegistryScreenPage screenId={screenId} /> })),
];

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/", element: <PublicLayout />, children: publicChildRoutes },
  { path: "/admin", element: <AuthGuard />, children: [{ element: <AdminLayout />, children: adminChildRoutes }] },
  { path: "/404", element: <NotFound /> },
  { path: "*", element: <NotFound /> },
]);

export default router;
