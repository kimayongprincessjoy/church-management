import { useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const NAV = [
  { section: "MAIN", items: [
    { to: "/", label: "Dashboard" },
    { to: "/members", label: "Members" },
    { to: "/events", label: "Events" },
    { to: "/calendar", label: "Calendar" },
    { to: "/attendance", label: "Attendance" },
  ]},
  { section: "CHURCH MANAGEMENT", items: [
    { to: "/ministries", label: "Ministries" },
    { to: "/schedules", label: "Schedules" },
    { to: "/reports", label: "Reports" },
  ]},
  { section: "SETTINGS", items: [
    { to: "/church", label: "Church Settings" },
  ]},
];

export default function Layout() {
  const { user, church, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/members?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}>
        {!sidebarCollapsed && (
          <div className="brand">
            <div className="brand-text">
              <div className="brand-name">{church?.name ?? "Church CMS"}</div>
              <div className="brand-sub">Management System</div>
            </div>
          </div>
        )}
        <nav>
          {NAV.map((group) => (
            <div key={group.section} className="nav-section">
              {!sidebarCollapsed && <div className="nav-section-label">{group.section}</div>}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                  onClick={() => setSidebarOpen(false)}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  {!sidebarCollapsed && item.label}
                </NavLink>
              ))}
            </div>
          ))}
          {user?.role === "super_admin" && (
            <div className="nav-section">
              {!sidebarCollapsed && <div className="nav-section-label">SETTINGS</div>}
              <NavLink
                to="/users"
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? "User Management" : undefined}
              >
                {!sidebarCollapsed && "User Management"}
              </NavLink>
            </div>
          )}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="sidebar-toggle"
              onClick={() => {
                if (window.innerWidth <= 860) {
                  setSidebarOpen(!sidebarOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            <form className="search-bar" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search members or events…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="search-btn">🔍</button>
            </form>
          </div>
          <div className="topbar-right">
            <div className="notifications" title="Notifications">
              🔔
              <div className="notification-badge"></div>
            </div>
            <div className="user-profile">
              <div className="user-avatar">
                {user?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
              <div className="user-info">
                <span className="user-name">{user?.full_name}</span>
                <span className="user-role">{user?.role?.replace(/_/g, " ")}</span>
              </div>
              <span className="role-badge">{user?.role?.replace(/_/g, " ")}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}

export function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
