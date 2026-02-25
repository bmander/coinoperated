import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="layout">
      <header className="site-header">
        <Link to="/" className="site-title">CoinOperatedBrandon</Link>
        <Link to="/signin" className="btn btn-secondary">Sign In</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
