import { createBrowserRouter, Navigate } from "react-router-dom";
import LoginPage from "./modules/auth/pages/LoginPage";
import AuthGuard from "./modules/auth/AuthGuard";
import AdminLayout from "./components/layout/AdminLayout";
import AdminDashboardPage from "./modules/dashboard/pages/AdminDashboardPage";
import PublicHomePage from "./modules/dashboard/pages/PublicHomePage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicHomePage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/admin",
    element: <AuthGuard />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: "dashboard", element: <AdminDashboardPage /> },
        ],
      },
    ],
  },
]);

export default router;
