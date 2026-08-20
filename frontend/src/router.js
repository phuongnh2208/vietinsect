import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import LoginPage from "./modules/auth/pages/LoginPage";
import AuthGuard from "./modules/auth/AuthGuard";
import AdminLayout from "./components/layout/AdminLayout";
import PublicLayout from "./components/layout/PublicLayout";
import AdminDashboardPage from "./modules/dashboard/pages/AdminDashboardPage";
import PublicHomePage from "./modules/dashboard/pages/PublicHomePage";
import TaxonomyTreePage from "./modules/taxonomy/pages/TaxonomyTreePage";
import SpeciesProfilePage from "./modules/taxonomy/pages/SpeciesProfilePage";
import TaxonEditorPage from "./modules/taxonomy/pages/TaxonEditorPage";
import RegistryScreenPage from "./pages/RegistryScreenPage";
import NotFound from "./pages/NotFound";

// Màn hình admin-only: mỗi entry chỉ có 1 route dưới /admin/*.
const adminOnlyRoutes = [
  ["change-password", "SCR-02"], ["specimens", "SCR-05"], ["specimens/new", "SCR-06"], ["specimens/edit", "SCR-07"], ["specimens/import", "SCR-09"], ["specimens/batch-edit", "SCR-10"], ["specimens/labels", "SCR-11"], ["map/layers", "SCR-19"], ["dna/new", "SCR-21"], ["ai/sdm", "SCR-24"], ["analytics", "SCR-25"], ["reports/kpi", "SCR-27"], ["reports/custom", "SCR-28"], ["sharing", "SCR-29"], ["system", "SCR-30"],
];

// Màn hình public-only: chỉ đăng ký dưới root "/", không có bản Admin.
const publicOnlyRoutes = [
  ["specimens/search", "SCR-15"], ["search/advanced", "SCR-16"],
];

// Màn hình dual-context: cùng 1 component, đăng ký ở cả publicPath và adminPath.
const dualContextRoutes = [
  { screenId: "SCR-08", publicPath: "specimens/:id", adminPath: "specimens/:id", element: <RegistryScreenPage screenId="SCR-08" /> },
  { screenId: "SCR-12", publicPath: "taxonomy", adminPath: "taxonomy", element: <TaxonomyTreePage /> },
  { screenId: "SCR-13", publicPath: "species/:slug", adminPath: "species/:slug", element: <SpeciesProfilePage /> },
  { screenId: "SCR-17", publicPath: "media", adminPath: "media", element: <RegistryScreenPage screenId="SCR-17" /> },
  { screenId: "SCR-18", publicPath: "map", adminPath: "map", element: <RegistryScreenPage screenId="SCR-18" /> },
  { screenId: "SCR-20", publicPath: "dna", adminPath: "dna", element: <RegistryScreenPage screenId="SCR-20" /> },
  { screenId: "SCR-22", publicPath: "dna/:id/fasta", adminPath: "dna/:id/fasta", element: <RegistryScreenPage screenId="SCR-22" /> },
  { screenId: "SCR-23", publicPath: "ai/species-identification", adminPath: "ai/species-identification", element: <RegistryScreenPage screenId="SCR-23" /> },
  { screenId: "SCR-26", publicPath: "reports", adminPath: "reports", element: <RegistryScreenPage screenId="SCR-26" /> },
];

const adminChildRoutes = [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: "dashboard", element: <AdminDashboardPage /> },
  { path: "taxonomy/editor", element: <TaxonEditorPage /> },
  ...adminOnlyRoutes.map(([path, screenId]) => ({ path, element: <RegistryScreenPage screenId={screenId} /> })),
  ...dualContextRoutes.map(({ adminPath, element }) => ({ path: adminPath, element })),
];

const publicChildRoutes = [
  { index: true, element: <PublicHomePage /> },
  ...publicOnlyRoutes.map(([path, screenId]) => ({ path, element: <RegistryScreenPage screenId={screenId} /> })),
  ...dualContextRoutes.map(({ publicPath, element }) => ({ path: publicPath, element })),
];

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/", element: <PublicLayout />, children: publicChildRoutes },
  { path: "/admin", element: <AuthGuard />, children: [{ element: <AdminLayout />, children: adminChildRoutes }] },
  { path: "/404", element: <NotFound /> },
  { path: "*", element: <NotFound /> },
]);

export default router;
