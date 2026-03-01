import { useMemo } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const splashes = [
  "Now with 50% more Brandon!",
  "Batteries not included!",
  "Insert coin to continue",
  "Limited edition!",
  "As seen on the internet!",
  "Some assembly required",
  "May contain traces of code",
  "Not a real vending machine",
  "Results may vary!",
  "Handle with care!",
  "Freshly deployed!",
  "Open source!",
  "No refunds!",
  "Artisanal software",
  "Locally sourced bugs",
  "Free range developer",
  "Handcrafted with care",
];

export default function Layout() {
  const { patron, logout } = useAuth();
  const { pathname } = useLocation();
  const splash = useMemo(() => splashes[Math.floor(Math.random() * splashes.length)], []);

  return (
    <div className="layout">
      <header className="site-header">
        <div className="site-title-wrapper">
          <Link to="/" className="site-title">Coin Operated Brandon</Link>
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
