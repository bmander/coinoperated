import { useCallback, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function randomSplash() {
  return splashes[Math.floor(Math.random() * splashes.length)];
}

const splashes = [
  "Acceptable!",
  "Bullshit utopianism!",
  "Email!",
  "Cranky!",
  "Actual size!",
  "Fully automated!",
  "Coin operated!",
  "Ideation!",
  "Cyber!",
  "Stochastic!",
  "Zug zug",
  "Mathematical!"
];

export default function Layout() {
  const { patron, logout } = useAuth();
  const { pathname } = useLocation();
  const [splash, setSplash] = useState(randomSplash);
  const isHome = pathname === "/";

  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    if (isHome) {
      e.preventDefault();
      setSplash(randomSplash());
    }
  }, [isHome]);

  return (
    <div className="layout">
      <header className="site-header">
        <div className="site-title-wrapper">
          <Link to="/" className="site-title" onClick={handleLogoClick}>Coin Operated Brandon</Link>
          <span className="splash-text">{splash}</span>
        </div>
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
