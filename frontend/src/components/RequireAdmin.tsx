import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RequireAdmin() {
  const { patron, loading } = useAuth();

  if (loading) return null;
  if (!patron) return <Navigate to="/signin" replace />;
  if (!patron.is_admin) return <Navigate to="/" replace />;

  return <Outlet />;
}
