import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import LoginPage from "./modules/auth/pages/LoginPage";
import ChangePasswordPage from "./modules/auth/pages/ChangePasswordPage";
import AuthGuard from "./modules/auth/AuthGuard";
import AdminLayout from "./components/layout/AdminLayout";
import PublicLayout from "./components/layout/PublicLayout";
import AdminDashboardPage from "./modules/dashboard/pages/AdminDashboardPage";
import PublicHomePage from "./modules/dashboard/pages/PublicHomePage";
import TaxonomyTreePage from "./modules/taxonomy/pages/TaxonomyTreePage";
import SpeciesProfilePage from "./modules/taxonomy/pages/SpeciesProfilePage";
import TaxonEditorPage from "./modules/taxonomy/pages/TaxonEditorPage";
import SpecimenListPage from "./modules/specimen/pages/SpecimenListPage";
import SpecimenDetailPage from "./modules/specimen/pages/SpecimenDetailPage";
import SpecimenFormPage from "./modules/specimen/pages/SpecimenFormPage";
import {
  BulkImportWorkbenchPage,
  BatchEditPage,
  BatchLabelPrintPage,
} from "./modules/specimen/pages/SpecimenBatchPages";
import AdvancedSearchPage from "./modules/specimen/pages/AdvancedSearchPage";
import QueryBuilderPage from "./modules/search/pages/QueryBuilderPage";
import OccurrenceMapPage from "./modules/map/pages/OccurrenceMapPage";
import {
  LayerManagerPage,
  AiSpeciesIdPage,
  SdmPredictionPage,
} from "./modules/map/pages/GisAndAiPages";
import DnaListPage from "./modules/dna/pages/DnaListPage";
import DnaFormPage from "./modules/dna/pages/DnaFormPage";
import DnaFastaDetailPage from "./modules/dna/pages/DnaFastaDetailPage";
import MediaGalleryPage from "./modules/media/pages/MediaGalleryPage";
import AnalyticsDashboardPage from "./modules/analytics/pages/AnalyticsDashboardPage";
import {
  ReportsChecklistPage,
  DigitizationKpiPage,
  CustomReportBuilderPage,
} from "./modules/reports/pages/ReportsPages";
import SystemAdminPage from "./modules/system/pages/SystemAdminPage";
import PublicPrivateControlPage from "./modules/system/pages/PublicPrivateControlPage";
import NotFound from "./pages/NotFound";

// Màn hình dual-context: cùng 1 component, đăng ký ở cả publicPath và adminPath (100% Real UI - 30/30 màn hình).
const dualContextRoutes = [
  { screenId: "SCR-08", publicPath: "specimens/:id", adminPath: "specimens/:id", element: <SpecimenDetailPage /> },
  { screenId: "SCR-12", publicPath: "taxonomy", adminPath: "taxonomy", element: <TaxonomyTreePage /> },
  { screenId: "SCR-13", publicPath: "species/:slug", adminPath: "species/:slug", element: <SpeciesProfilePage /> },
  { screenId: "SCR-15", publicPath: "search", adminPath: "search", element: <AdvancedSearchPage /> },
  { screenId: "SCR-16", publicPath: "search/advanced", adminPath: "search/advanced", element: <QueryBuilderPage /> },
  { screenId: "SCR-17", publicPath: "media", adminPath: "media", element: <MediaGalleryPage /> },
  { screenId: "SCR-18", publicPath: "map", adminPath: "map", element: <OccurrenceMapPage /> },
  { screenId: "SCR-20", publicPath: "dna", adminPath: "dna", element: <DnaListPage /> },
  { screenId: "SCR-22", publicPath: "dna/:id/fasta", adminPath: "dna/:id/fasta", element: <DnaFastaDetailPage /> },
  { screenId: "SCR-23", publicPath: "ai/species-identification", adminPath: "ai/species-identification", element: <AiSpeciesIdPage /> },
  { screenId: "SCR-26", publicPath: "reports", adminPath: "reports", element: <ReportsChecklistPage /> },
];

const adminChildRoutes = [
  { index: true, element: <Navigate to="dashboard" replace /> },
  { path: "dashboard", element: <AdminDashboardPage /> },
  { path: "change-password", element: <ChangePasswordPage /> },
  { path: "specimens", element: <SpecimenListPage /> },
  { path: "specimens/new", element: <SpecimenFormPage mode="create" /> },
  { path: "specimens/edit", element: <SpecimenFormPage mode="edit" /> },
  { path: "specimens/import", element: <BulkImportWorkbenchPage /> },
  { path: "specimens/batch-edit", element: <BatchEditPage /> },
  { path: "specimens/labels", element: <BatchLabelPrintPage /> },
  { path: "dna/new", element: <DnaFormPage /> },
  { path: "taxonomy/editor", element: <TaxonEditorPage /> },
  { path: "map/layers", element: <LayerManagerPage /> },
  { path: "ai/sdm", element: <SdmPredictionPage /> },
  { path: "analytics", element: <AnalyticsDashboardPage /> },
  { path: "reports/kpi", element: <DigitizationKpiPage /> },
  { path: "reports/custom", element: <CustomReportBuilderPage /> },
  { path: "system", element: <SystemAdminPage /> },
  { path: "sharing", element: <PublicPrivateControlPage /> },
  ...dualContextRoutes.map(({ adminPath, element }) => ({ path: adminPath, element })),
];

const publicChildRoutes = [
  { index: true, element: <PublicHomePage /> },
  { path: "specimens/search", element: <SpecimenListPage /> },
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
