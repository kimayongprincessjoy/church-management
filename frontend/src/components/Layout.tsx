import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

const NAV = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/members", label: "Members", icon: "👥" },
  { to: "/events", label: "Events", icon: "📅" },
  { to: "/calendar", label: "Calendar", icon: "🗓️" },
  { to: "/attendance", label: "Attendance", icon: "✅" },
  { to: "/schedules", label: "Schedules", icon: "🔁" },
  { to: "/ministries", label: "Ministries", icon: "⛪" },
  { to: "/reports", label: "Reports", icon: "📈" },
  { to: "/church", label: "Church Settings", icon: "⚙️" },
];

export default function Layout() {
  const { user, church, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          {church?.logo_url ? (
            <img src={church.logo_url} alt="logo" className="brand-logo" />
          ) : (
            <div className="brand-mark">{church?.name?.charAt(0) ?? "C"}</div>
          )}
          <div>
            <div className="brand-name">{church?.name ?? "Church CMS"}</div>
            <div className="brand-sub">Management System</div>
          </div>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          {user?.role === "super_admin" && (
            <NavLink to="/users" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <span className="nav-icon">🔐</span>
              Users
            </NavLink>
          )}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{church?.name}</div>
          <div className="topbar-user">
            <span>{user?.full_name}</span>
            <span className="role-badge">{user?.role?.replace(/_/g, " ")}</span>
            <button className="btn btn-ghost" onClick={logout}>Logout</button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
