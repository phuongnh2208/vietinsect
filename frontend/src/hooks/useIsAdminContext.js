import { useLocation } from "react-router-dom";

export default function useIsAdminContext() {
  const { pathname } = useLocation();
  return pathname.startsWith("/admin");
}
