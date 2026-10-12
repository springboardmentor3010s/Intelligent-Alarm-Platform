import React from "react";
import Logo from "./Logo";
import RoleBadge from "./RoleBadge";
import {
  LayoutDashboard,
  AlarmClock,
  Brain,
  BarChart3,
  User,
  Users,
  ShieldCheck,
  FileText,
  Moon,
  Bell,
  Settings,
  LogOut,
  Sliders
} from "lucide-react";

function Sidebar({ user, activeTab, setActiveTab, onLogout, isMobileOpen, closeMobileSidebar }) {
  const role = (user?.role || "USER").toUpperCase();

  let navItems = [];

  if (role === "USER") {
    navItems = [
      { id: "dashboard",   label: "Dashboard",   icon: LayoutDashboard },
      { id: "alarms",      label: "My Alarms",   icon: AlarmClock },
      { id: "challenges",  label: "Challenges",  icon: Brain },
      { id: "performance", label: "Performance", icon: BarChart3 },
      { id: "reports",     label: "Reports",     icon: FileText },
      { id: "notifications", label: "Reminders", icon: Bell },
      { id: "profile",     label: "Profile",     icon: User },
    ];

  } else if (role === "WELLNESS_COACH") {
    navItems = [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "my_workspace", label: "My User Workspace", icon: User },
      { id: "challenges", label: "Challenges", icon: Brain },
      { id: "users", label: "Users", icon: Users },
      { id: "reports", label: "Reports", icon: FileText },
      { id: "sleep_reports", label: "Sleep Trend Reports", icon: Moon },
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "profile", label: "Profile", icon: User },
    ];
  } else if (role === "ADMIN") {
    navItems = [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "users", label: "Users", icon: Users },
      { id: "wellness_coachs", label: "Wellness Coaches", icon: ShieldCheck },
      { id: "challenges", label: "Challenges", icon: Brain },
      { id: "alarms", label: "Alarms", icon: AlarmClock },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "system_reports", label: "System Reports", icon: FileText },
      { id: "notifications", label: "Announcements", icon: Bell },
      { id: "settings", label: "Settings", icon: Settings },
      { id: "profile", label: "Profile", icon: User },
    ];
  }

  return (
    <aside
      className={`app-sidebar ${isMobileOpen ? "mobile-open" : ""}`}
      style={{
        width: 250,
        height: "100vh",
        background: "#0f172a",
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "20px 16px",
        boxSizing: "border-box",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 50,
        transition: "transform 0.3s ease"
      }}
    >
      {/* TOP BRANDING LOGO */}
      <div>
        <div style={{ padding: "0 8px 24px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <Logo size="md" />
        </div>

        {/* ROLE CONTEXT INDICATOR */}
        <div style={{ padding: "16px 8px 8px" }}>
          <RoleBadge role={role} />
        </div>

        {/* NAVIGATION ITEMS */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (closeMobileSidebar) closeMobileSidebar();
                }}
                style={{
                  background: "transparent",
                  border: "1px solid transparent",
                  borderRadius: 10,
                  padding: "11px 14px",
                  color: isActive ? "#a78bfa" : "#94a3b8",
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                  transition: "all 0.2s ease",
                  boxShadow: "none"
                }}
              >
                <Icon size={18} color={isActive ? "#a78bfa" : "#64748b"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* FOOTER USER SUMMARY & LOGOUT */}
      <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 16 }}>
        <div className="sidebar-user-summary" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
          <div className="sidebar-user-avatar" style={{ width: 32, height: 32, borderRadius: "50%", background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c4b5fd", fontWeight: 700, fontSize: 12 }}>
            {user?.name?.slice(0, 1) || "U"}
          </div>
          <div className="sidebar-user-details" style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <div className="sidebar-user-name" style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
              {user?.name || "User"}
            </div>
            <div className="sidebar-user-email" style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
              {user?.email}
            </div>
          </div>

          <button
            className="sidebar-logout-button"
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
            style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "#fca5a5",
            borderRadius: "50%",
            width: 34,
            height: 34,
            padding: 0,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
