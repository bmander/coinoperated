import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const { patron, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="layout">
      <header className="site-header">
        <Link to="/" className="site-title">Coin Operated Brandon</Link>
        {patron ? (
          <div className="header-user">
            {pathname !== "/dashboard" && <Link to="/dashboard" className="btn btn-secondary">Dashboard</Link>}
            {patron.is_admin && <Link to="/admin" className="btn btn-secondary">Admin</Link>}
            <span className="header-user-name">{patron.display_name || patron.email}</span>
            <button onClick={logout} className="btn btn-secondary">Sign Out</button>
          </div>
        ) : (
          <Link to="/signin" className="btn btn-secondary">Sign In</Link>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
