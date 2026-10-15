import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { isDemoActive } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import NotificationCenter from "./NotificationCenter";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isDemo = isDemoActive();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  let user = null;
  try {
    const rawUser = localStorage.getItem("user");
    user = isDemo ? { name: "Demo User", role: "user" } : (rawUser ? JSON.parse(rawUser) : null);
  } catch {
    user = isDemo ? { name: "Demo User", role: "user" } : null;
  }

  function handleExitDemo() {
    sessionStorage.removeItem("demo_mode");
    localStorage.removeItem("demo_mode");
    navigate("/login");
  }

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const isActive = (path) => location.pathname === path;

  // Strict Menu Order requested by specification:
  // Dashboard -> Alarms -> Cognitive Alarm -> Analytics -> Reports -> Session History -> Profile
  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Alarms", path: "/alarms" },
    { label: "Cognitive Alarm", path: "/cognitive-alarm" },
    { label: "Analytics", path: "/analytics" },
    { label: "Reports", path: "/reports" },
    { label: "Session History", path: "/session-history" },
    { label: "Profile", path: "/profile" },
  ];

  if (user?.role === "wellness_coach" && !isDemo) {
    navItems.push({ label: "Coach", path: "/coach" });
  }

  if (user?.role === "admin" && !isDemo) {
    navItems.push({ label: "Admin", path: "/admin" });
  }

  return (
    <nav className="navbar menubar-nav" aria-label="Main Application Menubar">
      <div className="navbar-container">
        {/* Brand / Logo */}
        <div className="brand navbar-logo">
          <Link to="/dashboard" className="brand-link" aria-label="Cognitive Alarm Home">
            <span className="brand-icon" aria-hidden="true">🧠</span>
            <span className="brand-text">Cognitive Alarm</span>
          </Link>
          {isDemo && <span className="nav-demo-badge">DEMO</span>}
        </div>

        {/* Desktop Menubar */}
        <div className="menu-bar navbar-links" role="menubar" aria-label="Application Menu">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                role="menuitem"
                className={`menu-item nav-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
                tabIndex={0}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Menu Actions (Exit Demo, Theme Toggle, Mobile Hamburger) */}
        <div className="menu-actions">
          {isDemo && (
            <button
              type="button"
              className="nav-exit-demo-btn"
              onClick={handleExitDemo}
              title="Exit Demo Mode"
            >
              Exit Demo
            </button>
          )}

          {user && !isDemo && <NotificationCenter />}

          {/* Theme Toggle Button (Single Global Toggle) */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode (☀️)" : "Switch to Dark Mode (🌙)"}
            aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <span className="theme-toggle-icon">{theme === "dark" ? "☀️" : "🌙"}</span>
          </button>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="menu-hamburger-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
          >
            <span className="hamburger-icon" aria-hidden="true">
              {mobileMenuOpen ? "✕" : "☰"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <div
        id="mobile-nav-menu"
        className={`mobile-menu-drawer ${mobileMenuOpen ? "open" : ""}`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="mobile-menu-items" role="menu">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                role="menuitem"
                className={`mobile-menu-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="mobile-menu-label">{item.label}</span>
                {active && <span className="mobile-active-dot" aria-hidden="true" />}
              </Link>
            );
          })}

          {isDemo && (
            <button
              type="button"
              className="mobile-exit-demo-btn"
              onClick={() => {
                setMobileMenuOpen(false);
                handleExitDemo();
              }}
            >
              Exit Demo Mode
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;