import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { Moon, Sun } from "lucide-react";
import api from "./services/api";
import "./style.css";

import Login from "./pages/Login";
import RoleSelection from "./pages/RoleSelection";
import Register from "./pages/Register";
import UserDashboard from "./pages/UserDashboard";
import WellnessCoachDashboard from "./pages/WellnessCoachDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import LandingPage from "./pages/LandingPage";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(window.location.pathname || "/login");

  // Keep state synced with browser history
  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const fetchCurrentUser = async (authToken) => {
    try {
      setLoading(true);
      const response = await api.get("/auth/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const userData = response.data;
      setUser(userData);

      // Post-login / Session-restore Role Redirect Guard
      const roleSlug = (userData.role || "USER").toLowerCase();
      const current = window.location.pathname;

      if (current === "/" || current === "/login" || current.startsWith("/register")) {
        navigate(`/${roleSlug}/dashboard`);
      } else if (!current.startsWith(`/${roleSlug}`)) {
        // Prevent accessing unauthorized role routes (e.g. USER typing /admin/dashboard)
        navigate(`/${roleSlug}/dashboard`);
      }
    } catch (error) {
      console.error("Session restoration failed:", error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const loginSuccess = async (newToken) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    await fetchCurrentUser(newToken);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setLoading(false);
    window.history.replaceState({}, "", "/login");
    setCurrentPath("/login");
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif"
      }}>
        <div style={{ textAlign: "center" }}>
          <div className="brain-logo" style={{ margin: "0 auto 20px", animation: "spin 2s linear infinite" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4c0 .5-.1 1-.2 1.5A4 4 0 0 1 19 11a4 4 0 0 1-1 2.7A3 3 0 0 1 15 17v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1a3 3 0 0 1-3-3.3A4 4 0 0 1 5 11a4 4 0 0 1 3.2-3.5C8.1 7 8 6.5 8 6a4 4 0 0 1 4-4z"/>
            </svg>
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, background: "linear-gradient(135deg, #c4b5fd, #f9a8d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CognitiveWake</h2>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: 14 }}>Authenticating session...</p>
        </div>
      </div>
    );
  }

  // --- UNAUTHENTICATED USER ROUTING ---
  if (!token || !user) {
    // Landing page — default route
    if (currentPath === "/" || currentPath === "") {
      return (
        <LandingPage
          onNavigateLogin={() => navigate("/login")}
          onNavigateRegister={() => navigate("/register")}
        />
      );
    }
    if (currentPath === "/register") {
      return (
        <RoleSelection
          onSelectRole={(role) => navigate(`/register/${role}`)}
          onBackToLogin={() => navigate("/login")}
        />
      );
    }
    if (currentPath === "/register/user") {
      return (
        <Register
          role="USER"
          onBackToLogin={() => navigate("/login")}
          onLoginSuccess={loginSuccess}
        />
      );
    }
    if (currentPath === "/register/wellness_coach") {
      return (
        <Register
          role="WELLNESS_COACH"
          onBackToLogin={() => navigate("/login")}
          onLoginSuccess={loginSuccess}
        />
      );
    }
    if (currentPath === "/register/admin") {
      return (
        <Register
          role="ADMIN"
          onBackToLogin={() => navigate("/login")}
          onLoginSuccess={loginSuccess}
        />
      );
    }

    // Default unauthenticated route: /login
    return (
      <Login
        onLogin={(newToken) => {
          loginSuccess(newToken);
        }}
        onNavigateToRegister={(selectedRole) => {
          const roleSlug = (selectedRole || "USER").toLowerCase();
          navigate(`/register/${roleSlug}`);
        }}
      />
    );
  }

  // --- AUTHENTICATED USER ROUTING & ROLE-BASED DASHBOARD PROTECTION ---
  const userRole = (user.role || "USER").toUpperCase();

  if (userRole === "ADMIN") {
    return (
      <AdminDashboard
        user={user}
        token={token}
        onLogout={logout}
      />
    );
  }

  if (userRole === "WELLNESS_COACH") {
    return (
      <WellnessCoachDashboard
        user={user}
        token={token}
        onLogout={logout}
      />
    );
  }

  // USER ROLE
  return (
    <UserDashboard
      user={user}
      token={token}
      onLogout={logout}
    />
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem("cognitivewake-theme") || "dark");
  const [mountTarget, setMountTarget] = useState(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    localStorage.setItem("cognitivewake-theme", theme);
  }, [theme]);

  useEffect(() => {
    const findMountTarget = () => setMountTarget(document.getElementById("theme-toggle-slot"));
    findMountTarget();
    const observer = new MutationObserver(findMountTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!mountTarget) return null;

  const isDark = theme === "dark";
  return createPortal(
    <button
      className="theme-toggle"
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>,
    mountTarget
  );
}

createRoot(document.getElementById("root")).render(
  <>
    <App />
    <ThemeToggle />
  </>
);
