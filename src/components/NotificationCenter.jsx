import React, { useEffect, useState, useRef } from "react";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteUserNotification,
} from "../services/api";
import {
  getStoredPreferences,
  savePreferences,
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showBrowserNotification,
} from "../services/notificationService";

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [data, setData] = useState({
    notifications: [],
    announcements: [],
    unread_count: 0,
    bedtime_reminder: null,
    advance_wake_reminders: [],
    habit_alerts: [],
    challenge_reminders: [],
    progress_notifications: [],
  });
  const [activeTab, setActiveTab] = useState("all");
  const [permissionState, setPermissionState] = useState(getNotificationPermission());
  const [preferences, setPreferences] = useState(getStoredPreferences());
  const [loading, setLoading] = useState(false);

  const containerRef = useRef(null);

  // Load notifications from API
  async function loadNotifications() {
    try {
      const res = await getUserNotifications();
      setData(res);

      // Check for high-priority browser notifications if permitted & enabled
      if (permissionState === "granted") {
        if (preferences.challenge_reminders_enabled && res.challenge_reminders?.length > 0) {
          const topChallenge = res.challenge_reminders[0];
          showBrowserNotification(topChallenge.title, { body: topChallenge.message });
        }
      }
    } catch (err) {
      // Graceful fallback for demo or unauthenticated state
    }
  }

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 60000); // Poll every minute
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsPreferencesOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function handleRequestPermission() {
    const res = await requestNotificationPermission();
    setPermissionState(res.status);
    if (res.granted) {
      showBrowserNotification("🧠 Cognitive Alarm", {
        body: "Browser alerts are now active for bedtime, wake-up, and challenges!",
      });
    }
  }

  async function handleMarkRead(id) {
    try {
      await markNotificationRead(id);
      setData((prev) => ({
        ...prev,
        unread_count: Math.max(0, prev.unread_count - 1),
        notifications: prev.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        ),
      }));
    } catch (err) {
      console.warn("Failed to mark read:", err);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setData((prev) => ({
        ...prev,
        unread_count: 0,
        notifications: prev.notifications.map((n) => ({ ...n, is_read: true })),
      }));
    } catch (err) {
      console.warn("Failed to mark all read:", err);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteUserNotification(id);
      setData((prev) => {
        const item = prev.notifications.find((n) => n.id === id);
        return {
          ...prev,
          unread_count: item && !item.is_read ? Math.max(0, prev.unread_count - 1) : prev.unread_count,
          notifications: prev.notifications.filter((n) => n.id !== id),
        };
      });
    } catch (err) {
      console.warn("Failed to delete notification:", err);
    }
  }

  function handlePreferenceChange(key, value) {
    const updated = savePreferences({ [key]: value });
    setPreferences(updated);
  }

  // Filtered list
  const filteredNotifications = (data.notifications || []).filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "reminders") return item.category === "bedtime" || item.category === "wake_advance";
    if (activeTab === "habits") return item.category === "habit";
    if (activeTab === "progress") return item.category === "progress";
    if (activeTab === "announcements") return item.category === "announcement";
    return true;
  });

  return (
    <div className="notification-center-container" ref={containerRef} style={{ position: "relative" }}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        className="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications & Reminders"
        aria-label="Notifications"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "18px",
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          borderRadius: "8px",
          color: "inherit",
        }}
      >
        <span>🔔</span>
        {data.unread_count > 0 && (
          <span
            className="notification-unread-badge"
            style={{
              position: "absolute",
              top: "2px",
              right: "4px",
              background: "#ef4444",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 800,
              minWidth: "16px",
              height: "16px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {data.unread_count > 99 ? "99+" : data.unread_count}
          </span>
        )}
      </button>

      {/* Notification Dropdown Drawer */}
      {isOpen && (
        <div
          className="notification-dropdown-panel"
          style={{
            position: "absolute",
            top: "42px",
            right: "0",
            width: "380px",
            maxWidth: "92vw",
            background: "var(--card-bg, #0f172a)",
            border: "1px solid var(--border-color, rgba(255,255,255,0.12))",
            borderRadius: "14px",
            boxShadow: "0 14px 38px rgba(0,0,0,0.5)",
            zIndex: 1000,
            overflow: "hidden",
            color: "var(--text-color, #e2e8f0)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border-color, rgba(255,255,255,0.1))",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 700, fontSize: "15px" }}>Notifications</span>
              {data.unread_count > 0 && (
                <span
                  style={{
                    background: "rgba(59, 130, 246, 0.2)",
                    color: "#60a5fa",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  {data.unread_count} unread
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {data.unread_count > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#38bdf8",
                    fontSize: "12px",
                    cursor: "pointer",
                    padding: "2px 4px",
                  }}
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsPreferencesOpen(!isPreferencesOpen)}
                title="Settings"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  padding: "2px",
                  opacity: 0.8,
                }}
              >
                ⚙️
              </button>
            </div>
          </div>

          {/* Preferences Overlay Panel */}
          {isPreferencesOpen && (
            <div
              style={{
                padding: "14px 16px",
                background: "rgba(30, 41, 59, 0.95)",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                fontSize: "13px",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: "10px", display: "flex", justifyContent: "space-between" }}>
                <span>Notification Preferences</span>
                <span style={{ cursor: "pointer" }} onClick={() => setIsPreferencesOpen(false)}>✕</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <span>🌙 Bedtime Reminders</span>
                  <input
                    type="checkbox"
                    checked={preferences.bedtime_reminders_enabled}
                    onChange={(e) => handlePreferenceChange("bedtime_reminders_enabled", e.target.checked)}
                  />
                </label>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <span>⏰ Advance Wake Alerts</span>
                  <input
                    type="checkbox"
                    checked={preferences.advance_wake_reminders_enabled}
                    onChange={(e) => handlePreferenceChange("advance_wake_reminders_enabled", e.target.checked)}
                  />
                </label>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <span>🎯 Habit Goals</span>
                  <input
                    type="checkbox"
                    checked={preferences.habit_alerts_enabled}
                    onChange={(e) => handlePreferenceChange("habit_alerts_enabled", e.target.checked)}
                  />
                </label>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <span>🧠 Challenge Reminders</span>
                  <input
                    type="checkbox"
                    checked={preferences.challenge_reminders_enabled}
                    onChange={(e) => handlePreferenceChange("challenge_reminders_enabled", e.target.checked)}
                  />
                </label>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <span>🏆 Progress Milestones</span>
                  <input
                    type="checkbox"
                    checked={preferences.progress_notifications_enabled}
                    onChange={(e) => handlePreferenceChange("progress_notifications_enabled", e.target.checked)}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Browser Permission Banner */}
          {isNotificationSupported() && permissionState !== "granted" && (
            <div
              style={{
                padding: "8px 14px",
                background: "rgba(59, 130, 246, 0.1)",
                borderBottom: "1px solid rgba(59, 130, 246, 0.2)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "12px",
              }}
            >
              <span>{permissionState === "denied" ? "⚠️ Browser alerts blocked" : "🔔 Get desktop sound alerts"}</span>
              {permissionState !== "denied" && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  style={{
                    background: "#2563eb",
                    border: "none",
                    color: "#fff",
                    borderRadius: "6px",
                    padding: "3px 8px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  Enable
                </button>
              )}
            </div>
          )}

          {/* Platform Announcements Banner (if any) */}
          {(data.announcements || []).map((ann) => (
            <div
              key={ann.id}
              style={{
                padding: "10px 14px",
                background:
                  ann.priority === "urgent"
                    ? "rgba(239, 68, 68, 0.15)"
                    : ann.priority === "warning"
                    ? "rgba(245, 158, 11, 0.15)"
                    : "rgba(16, 185, 129, 0.15)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginBottom: "3px" }}>
                <span>📢 {ann.title}</span>
                <span style={{ fontSize: "10px", textTransform: "uppercase", opacity: 0.8 }}>{ann.priority}</span>
              </div>
              <p style={{ margin: 0, opacity: 0.9, lineHeight: "1.4" }}>{ann.message}</p>
            </div>
          ))}

          {/* Active Bedtime / Advance Reminder Highlight */}
          {preferences.bedtime_reminders_enabled && data.bedtime_reminder && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(168, 85, 247, 0.1)",
                borderBottom: "1px solid rgba(168, 85, 247, 0.2)",
                fontSize: "12px",
              }}
            >
              <div style={{ fontWeight: 700, color: "#c084fc", marginBottom: "2px" }}>
                {data.bedtime_reminder.title}
              </div>
              <p style={{ margin: 0, opacity: 0.9 }}>{data.bedtime_reminder.message}</p>
            </div>
          )}

          {/* Category Filter Tabs */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              padding: "8px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              overflowX: "auto",
              fontSize: "11px",
              background: "rgba(0,0,0,0.1)",
            }}
          >
            {[
              { id: "all", label: "All" },
              { id: "reminders", label: "Reminders" },
              { id: "habits", label: "Habits" },
              { id: "progress", label: "Progress" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id ? "rgba(59, 130, 246, 0.2)" : "transparent",
                  color: activeTab === tab.id ? "#60a5fa" : "inherit",
                  border: "none",
                  borderRadius: "12px",
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontWeight: activeTab === tab.id ? 700 : 500,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notification List Scrollable Area */}
          <div style={{ maxHeight: "320px", overflowY: "auto" }}>
            {filteredNotifications.length === 0 ? (
              <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--text-muted, #94a3b8)", fontSize: "13px" }}>
                <span>✨ No notifications</span>
                <p style={{ margin: "6px 0 0", fontSize: "11px", opacity: 0.7 }}>
                  All scheduled reminders and goals are up to date.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: item.is_read ? "transparent" : "rgba(59, 130, 246, 0.05)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "8px",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                      {!item.is_read && (
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
                      )}
                      <span style={{ fontWeight: item.is_read ? 600 : 700, fontSize: "13px" }}>{item.title}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", opacity: 0.85, lineHeight: "1.4" }}>{item.message}</p>
                    <span style={{ fontSize: "10px", opacity: 0.5, marginTop: "4px", display: "inline-block" }}>
                      {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    {!item.is_read && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(item.id)}
                        title="Mark as read"
                        style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "12px", color: "#10b981", padding: "2px" }}
                      >
                        ✓
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      title="Dismiss"
                      style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "12px", opacity: 0.4, padding: "2px" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
