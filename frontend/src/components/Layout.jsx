import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../App.css";
import { apiFetch } from "../api";
import { useAuth } from "../auth";
import ThemeToggle from "./ThemeToggle";

const USER_MENU = [
  { name: "Dashboard", icon: "⌂", path: "/dashboard" },
  { name: "Alarms", icon: "⏰", path: "/alarms" },
  { name: "Challenges", icon: "🧠", path: "/challenges" },
  { name: "Analytics", icon: "▥", path: "/analytics" },
  { name: "Reports", icon: "▤", path: "/reports" },
  { name: "Notifications", icon: "♧", path: "/notifications" },
  { name: "Settings", icon: "⚙", path: "/settings" },
];

const COACH_MENU = [
  { name: "Coach Dashboard", icon: "▥", path: "/coach" },
  { name: "Notifications", icon: "♧", path: "/notifications" },
  { name: "Settings", icon: "⚙", path: "/settings" },
];

const ADMIN_MENU = [
  { name: "Admin Dashboard", icon: "▥", path: "/admin" },
  { name: "Notifications", icon: "♧", path: "/notifications" },
  { name: "Settings", icon: "⚙", path: "/settings" },
];

function initials(name) {
  return (
    (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "?"
  );
}

const ROLE_LABEL = { user: "Member", coach: "Wellness Coach", admin: "Administrator" };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  const menu =
    user?.role === "admin" ? ADMIN_MENU : user?.role === "coach" ? COACH_MENU : USER_MENU;

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      apiFetch("/notifications/unread-count")
        .then((data) => !cancelled && setUnread(data.unread_count))
        .catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">🧠</div>
          <div>
            <h2>Cognitive</h2>
            <span>ALARM</span>
          </div>
        </div>

        <nav className="nav-menu">
          {menu.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon">✦</div>
            <strong>Build better habits</strong>
            <p>
              Complete your cognitive challenges consistently to improve your habit score.
            </p>
          </div>

          <div className="user-mini">
            <div className="avatar">{initials(user?.full_name)}</div>
            <div>
              <strong>{user?.full_name}</strong>
              <span>{ROLE_LABEL[user?.role] || "Member"}</span>
            </div>
          </div>
          <button className="nav-item" onClick={handleLogout} style={{ marginTop: 12 }}>
            <span className="nav-icon">⏻</span>
            Log out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <span>🧠</span>
            Cognitive Alarm
          </div>

          <div className="topbar-actions">
            <ThemeToggle />
            <button
              className="icon-button notification"
              onClick={() => navigate("/notifications")}
              title="Notifications"
              style={{ position: "relative" }}
            >
              ♧
              {unread > 0 && <span></span>}
            </button>

            <div className="top-profile">
              <div className="avatar small">{initials(user?.full_name)}</div>
              <div>
                <strong>{user?.full_name}</strong>
                <small>{greeting()}</small>
              </div>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

export default Layout;
