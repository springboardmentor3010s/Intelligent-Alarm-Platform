import React from "react";
import {
  AlarmClock,
  BarChart3,
  Brain,
  FileText,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  User as UserIcon,
  Users
} from "lucide-react";
import RoleBadge from "./RoleBadge";

function Header({ title, activeTab, user, streak, onLogout, toggleMobileSidebar }) {
  const name = user?.name || "User";
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const pageIcons = {
    dashboard: LayoutDashboard,
    alarms: AlarmClock,
    challenges: Brain,
    performance: BarChart3,
    analytics: BarChart3,
    profile: UserIcon,
    users: Users,
    wellness_coachs: ShieldCheck,
    settings: Settings,
    my_workspace: UserIcon,
    reports: FileText,
    sleep_reports: Moon
  };
  const PageIcon = pageIcons[activeTab] || LayoutDashboard;

  return (
    <header
      className="app-header"
      style={{
        height: 64,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        position: "sticky",
        top: 0,
        zIndex: 40
      }}
    >
      {/* LEFT: CURRENT PAGE */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          className="mobile-toggle-btn"
          onClick={toggleMobileSidebar}
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#fff",
            borderRadius: 8,
            padding: 6,
            cursor: "pointer",
            display: "none"
          }}
        >
          <Menu size={20} />
        </button>

        <div className="header-page-heading">
          <PageIcon className="header-page-icon" size={23} strokeWidth={2.5} aria-hidden="true" />
          <h2 className="header-page-title" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
            {title}
          </h2>
        </div>
      </div>

      {/* RIGHT: USER STREAK BADGE, USER AVATAR, REAL NAME, ROLE BADGE, LOGOUT */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {(() => {
          const displayStreak = streak ?? user?.current_streak ?? user?.streak ?? 0;
          return (
            <div
              title={`${displayStreak} Day Active Streak — Maintained daily`}
              aria-label={`${displayStreak} day streak`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                padding: "5px 12px",
                borderRadius: 20,
                color: "#fcd34d",
                fontSize: 13,
                fontWeight: 700,
                boxShadow: "0 0 12px rgba(245, 158, 11, 0.15)"
              }}
            >
              <Flame size={15} color="#f59e0b" />
              <span>{displayStreak}</span>
            </div>
          );
        })()}
        <div id="theme-toggle-slot" className="theme-toggle-slot" />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 13,
              boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)"
            }}
          >
            {initials || <UserIcon size={16} />}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>
              {name}
            </span>
            <div style={{ marginTop: 2 }}>
              <RoleBadge role={user?.role} size="small" />
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          type="button"
          aria-label="Log out"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#fca5a5",
            borderRadius: "50%",
            width: 44,
            height: 44,
            padding: 0,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease"
          }}
          title="Sign out of CognitiveWake"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

export default Header;
