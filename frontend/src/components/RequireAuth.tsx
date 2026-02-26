import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RequireAuth() {
  const { patron, loading } = useAuth();

  if (loading) return null;
  if (!patron) return <Navigate to="/signin" replace />;

  return <Outlet />;
}
