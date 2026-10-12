import React, { useEffect, useState } from "react";
import {
  Crown,
  Users,
  Shield,
  Brain,
  BarChart3,
  Settings,
  User,
  LogOut,
  Bell,
  RefreshCw,
  Search,
  CheckCircle2,
  Activity,
  Save,
  Loader2,
  Trash2,
  UserPlus,
  Pencil,
  AlarmClock,
  Target,
  ListChecks,
  Eye,
  Download,
  ChevronUp,
  ChevronDown,
  X,
  KeyRound,
  Ban
} from "lucide-react";
import AppShell from "../components/AppShell";
import AccessDenied from "../components/AccessDenied";
import RoleBadge from "../components/RoleBadge";
import api from "../services/api";
import AdminSystemReports from "./AdminSystemReports";
import NotificationsCenter from "./NotificationsCenter";



function AdminDashboard({ user, token, onLogout }) {
  // Access Protection Guard
  if (user?.role !== "ADMIN") {
    return <AccessDenied userRole={user?.role} requiredRole="ADMIN" onReturn={onLogout} />;
  }

  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname;
    return path === "/admin/alarms" ? "alarms" : path === "/admin/analytics" ? "analytics" : "dashboard";
  });
  const [stats, setStats] = useState({ total_users: 0, active_users: 0, total_alarms: 0, challenge_attempts: 0 });
  const [usersList, setUsersList] = useState([]);
  const [wellness_coachsList, setWellnessCoachsList] = useState([]);
  const [challengesList, setChallengesList] = useState([]);
  const [wellness_coachActivity, setWellnessCoachActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [notification, setNotification] = useState("");
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileTimezone, setProfileTimezone] = useState(user?.timezone || "Asia/Kolkata");
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [activityRange, setActivityRange] = useState(7);
  const [joinDateFilter, setJoinDateFilter] = useState("");
  const [streakFilter, setStreakFilter] = useState("ALL");
  const [userSort, setUserSort] = useState({ key: "created_at", direction: "desc" });
  const [userPage, setUserPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [challengeForm, setChallengeForm] = useState(null);
  const [alarmsList, setAlarmsList] = useState([]);
  const [alarmConfigForm, setAlarmConfigForm] = useState(null);
  const [alarmSaving, setAlarmSaving] = useState(false);
  const [alarmUserFilter, setAlarmUserFilter] = useState("ALL");
  const [alarmChallengeFilter, setAlarmChallengeFilter] = useState("ALL");
  const [alarmStatusFilter, setAlarmStatusFilter] = useState("ALL");
  const [selectedAlarmIds, setSelectedAlarmIds] = useState([]);
  const [globalAlarmRules, setGlobalAlarmRules] = useState({ max_snoozes: 2, default_challenge: "MATH", default_difficulty: "MEDIUM", gradual_volume: false });
  const [missedAlarmReport, setMissedAlarmReport] = useState({ total_sessions: 0, completed_sessions: 0, missed_alarms: 0, recent_missed: [] });
  const [analyticsStart, setAnalyticsStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); });
  const [analyticsEnd, setAnalyticsEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [analyticsData, setAnalyticsData] = useState({ series: [], avg_solve_time_by_difficulty: [], peak_alarm_hours: [], snooze_vs_dismiss: { snoozes: 0, dismisses: 0 } });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [settingsData, setSettingsData] = useState({});
  const [settingsTab, setSettingsTab] = useState("general");
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [adminStreak, setAdminStreak] = useState(user?.current_streak || user?.streak || 0);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      api.get("/users/me/streak", { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setAdminStreak(res.data.current_streak))
        .catch(() => {});
      const requests = await Promise.allSettled([
        api.get("/admin/statistics", { headers: { Authorization: `Bearer ${token}` } }),
        api.get("/admin/users", { headers: { Authorization: `Bearer ${token}` } }),
        api.get("/admin/users?role=WELLNESS_COACH", { headers: { Authorization: `Bearer ${token}` } }),
        api.get("/wellness_coach/challenges", { headers: { Authorization: `Bearer ${token}` } }),
        api.get("/admin/wellness_coach-activity", { headers: { Authorization: `Bearer ${token}` } }),
        api.get("/admin/alarms", { headers: { Authorization: `Bearer ${token}` } }),
        api.get("/admin/alarm-rules", { headers: { Authorization: `Bearer ${token}` } }),
        api.get("/admin/alarms/missed-report", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const values = requests.map(result => result.status === "fulfilled" ? result.value.data : null);
      const [statsData, usersData, wellness_coachsData, challengesData, activityData, alarmsData, rulesData, missedData] = values;
      if (statsData) setStats(statsData);
      if (usersData) setUsersList(usersData);
      if (wellness_coachsData) setWellnessCoachsList(wellness_coachsData);
      if (challengesData) setChallengesList(challengesData);
      if (activityData) setWellnessCoachActivity(activityData);
      if (alarmsData) setAlarmsList(alarmsData);
      if (rulesData) setGlobalAlarmRules(rulesData);
      if (missedData) setMissedAlarmReport(missedData);
      if (requests.some(result => result.status === "rejected")) setNotification("Some admin data could not be refreshed. Available data is still shown.");
    } catch (err) {
      console.error("Admin data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const response = await api.get(`/admin/analytics?start=${analyticsStart}&end=${analyticsEnd}`, { headers: { Authorization: `Bearer ${token}` } });
      setAnalyticsData(response.data);
    } catch (err) { console.error("Analytics load error:", err); }
    finally { setAnalyticsLoading(false); }
  };
  useEffect(() => { if (activeTab === "analytics") loadAnalytics(); }, [activeTab]);
  const loadSettings = async () => {
    try { setSettingsLoading(true); const response = await api.get("/admin/settings", { headers: { Authorization: `Bearer ${token}` } }); setSettingsData(response.data); setSettingsDirty(false); }
    catch (err) { console.error("Settings load error:", err); } finally { setSettingsLoading(false); }
  };
  useEffect(() => { if (activeTab === "settings") loadSettings(); }, [activeTab]);
  useEffect(() => { const warn = event => { if (settingsDirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [settingsDirty]);

  const handleRoleChange = async (userId, currentRole) => {
    const newRole = prompt(`Change role for user (Current: ${currentRole}). Enter USER, WELLNESS_COACH, or ADMIN:`, currentRole);
    if (!newRole || newRole.toUpperCase() === currentRole) return;

    const targetRole = newRole.toUpperCase();
    if (!["USER", "WELLNESS_COACH", "ADMIN"].includes(targetRole)) {
      alert("Invalid role! Must be USER, WELLNESS_COACH, or ADMIN.");
      return;
    }

    try {
      await api.patch(
        `/admin/users/${userId}/role`,
        { role: targetRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotification(`Successfully updated user role to ${targetRole}`);
      setTimeout(() => setNotification(""), 3000);
      loadAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update role");
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to permanently delete the account of "${userName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
      setNotification(`User "${userName}" deleted successfully.`);
      setTimeout(() => setNotification(""), 3000);
      loadAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete user");
    }
  };

  const handleWellnessCoachAssignment = async (target) => {
    const choices = wellness_coachsList.map(m => `${m.name} (${m.email})`).join("\n");
    const selected = prompt(`Assign ${target.name} to a wellness coach. Enter the wellness_coach name, email, username, or ID. Leave blank to remove assignment:\n${choices}`, target.wellness_coach_id || "");
    if (selected === null) return;
    try {
      await api.patch(`/admin/users/${target.id}/wellness_coach`, { wellness_coach_id: selected.trim() || null }, { headers: { Authorization: `Bearer ${token}` } });
      setNotification("Wellness coach assignment updated.");
      loadAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update wellness coach assignment");
    }
  };

  const handleCreateWellnessCoach = async () => {
    const name = prompt("Wellness Coach name:");
    if (name === null) return;
    const email = prompt("Wellness Coach email:");
    if (email === null) return;
    const password = prompt("Temporary password (at least 6 characters):");
    if (password === null) return;
    try {
      await api.post(
        "/admin/wellness_coachs",
        { name, email, password },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotification(`Wellness Coach "${name}" created successfully.`);
      setTimeout(() => setNotification(""), 3000);
      loadAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create wellness coach");
    }
  };

  const handleEditWellnessCoach = async (wellness_coach) => {
    const name = prompt("Wellness Coach name:", wellness_coach.name || "");
    if (name === null) return;
    const email = prompt("Wellness Coach email:", wellness_coach.email || "");
    if (email === null) return;
    try {
      await api.patch(
        `/admin/wellness_coachs/${wellness_coach.id}`,
        { name, email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotification(`Wellness Coach "${name}" updated successfully.`);
      setTimeout(() => setNotification(""), 3000);
      loadAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update wellness coach");
    }
  };

  const handleManageWellnessCoachUsers = async (wellness_coach) => {
    const standardUsers = usersList.filter(item => item.role === "USER");
    const assignedUsers = standardUsers.filter(item => item.wellness_coach_id === wellness_coach.id);
    const choices = standardUsers.map(item => `${item.name} (${item.email})`).join("\n");
    const selected = prompt(
      `Manage users assigned to ${wellness_coach.name}. Enter a user name, email, username, or ID:\n\nCurrently assigned (${assignedUsers.length}): ${assignedUsers.map(item => item.name).join(", ") || "None"}\n\nAvailable users:\n${choices}`
    );
    if (!selected) return;
    const target = standardUsers.find(item =>
      [item.id, item.name, item.email, item.username].filter(Boolean).some(value => value.toLowerCase() === selected.trim().toLowerCase())
    );
    if (!target) {
      alert("User not found. Enter an exact name, email, username, or ID from the list.");
      return;
    }
    const isAssigned = target.wellness_coach_id === wellness_coach.id;
    try {
      await api.patch(
        `/admin/users/${target.id}/wellness_coach`,
        { wellness_coach_id: isAssigned ? null : wellness_coach.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotification(`${target.name} ${isAssigned ? "removed from" : "assigned to"} ${wellness_coach.name}.`);
      setTimeout(() => setNotification(""), 3000);
      loadAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update wellness coach assignment");
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileUpdating(true);
    setProfileMessage("");
    try {
      await api.patch(
        "/users/profile",
        { name: profileName, timezone: profileTimezone },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfileMessage("✅ Profile updated successfully!");
    } catch (err) {
      setProfileMessage("❌ Failed to update profile.");
    } finally {
      setProfileUpdating(false);
    }
  };

  const filteredUsers = usersList.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [statusFilter, setStatusFilter] = useState("ALL");
  const managedUsers = filteredUsers
    .filter(u => statusFilter === "ALL" || (u.account_status || (u.is_active === false ? "SUSPENDED" : "ACTIVE")) === statusFilter)
    .filter(u => !joinDateFilter || (u.created_at && new Date(u.created_at) >= new Date(joinDateFilter)))
    .filter(u => streakFilter === "ALL" || Number(u.current_streak || 0) >= Number(streakFilter))
    .sort((a, b) => {
      const left = userSort.key === "streak" ? Number(a.current_streak || 0) : (a[userSort.key] || "");
      const right = userSort.key === "streak" ? Number(b.current_streak || 0) : (b[userSort.key] || "");
      const comparison = typeof left === "number" ? left - right : String(left).localeCompare(String(right));
      return userSort.direction === "asc" ? comparison : -comparison;
    });
  const usersPerPage = 8;
  const totalUserPages = Math.max(1, Math.ceil(managedUsers.length / usersPerPage));
  const pagedUsers = managedUsers.slice((userPage - 1) * usersPerPage, userPage * usersPerPage);
  const toggleUserSort = (key) => {
    setUserSort(current => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
    setUserPage(1);
  };

  const handleStatusToggle = async (u) => {
    const newStatus = u.is_active === false ? true : false;
    try {
      await api.patch(
        `/admin/users/${u.id}/status`,
        { is_active: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotification(`${u.name} has been ${newStatus ? "activated" : "deactivated"}.`);
      setTimeout(() => setNotification(""), 3000);
      loadAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update status");
    }
  };

  const openUserDetail = async (target) => {
    setSelectedUser(target);
    setUserDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const response = await api.get(`/admin/users/${target.id}/detail`, { headers: { Authorization: `Bearer ${token}` } });
      setUserDetail(response.data);
    } catch (err) {
      setDetailError(err.response?.data?.detail || "Could not load the additional user details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const manageUserAlarms = (target) => {
    setAlarmUserFilter(target.name || target.username || target.email || "ALL");
    setSelectedUser(null);
    setActiveTab("alarms");
  };

  const updateAccountState = async (target, action) => {
    const messages = { SUSPENDED: "Suspend", BANNED: "Ban", ACTIVE: "Reactivate" };
    if (action !== "ACTIVE" && !confirm(`${messages[action]} ${target.name || target.email}?`)) return;
    try {
      await api.patch(`/admin/users/${target.id}/account`, { action }, { headers: { Authorization: `Bearer ${token}` } });
      setNotification(`${target.name || "User"} is now ${action.toLowerCase()}.`);
      loadAdminData();
      if (selectedUser?.id === target.id) setSelectedUser({ ...target, account_status: action, is_active: action === "ACTIVE" });
    } catch (err) { alert(err.response?.data?.detail || "Could not update account status."); }
  };

  const handlePasswordReset = async (target) => {
    const password = prompt(`Set a temporary password for ${target.name || target.email} (minimum 6 characters):`);
    if (password === null) return;
    try {
      await api.patch(`/admin/users/${target.id}/account`, { action: "RESET_PASSWORD", password }, { headers: { Authorization: `Bearer ${token}` } });
      setNotification("Temporary password set successfully.");
    } catch (err) { alert(err.response?.data?.detail || "Could not reset password."); }
  };

  const exportUsersCsv = () => {
    const rows = managedUsers.map(u => [u.name || "", u.email || "", u.account_status || (u.is_active === false ? "SUSPENDED" : "ACTIVE"), fmt(u.created_at), u.current_streak || 0, fmt(u.last_active)]);
    const csv = [["Name", "Email", "Status", "Join Date", "Streak", "Last Active"], ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "cognitivewake-users.csv"; link.click(); URL.revokeObjectURL(url);
  };

  const saveChallenge = async (event) => {
    event.preventDefault();
    const { id, ...payload } = challengeForm;
    try {
      await (id ? api.put(`/admin/challenges/${id}`, payload, { headers: { Authorization: `Bearer ${token}` } }) : api.post("/admin/challenges", payload, { headers: { Authorization: `Bearer ${token}` } }));
      setChallengeForm(null); setNotification(`Challenge ${id ? "updated" : "created"}.`); loadAdminData();
    } catch (err) { alert(err.response?.data?.detail || "Could not save challenge."); }
  };
  const deleteChallenge = async (challenge) => {
    if (!confirm(`Delete “${challenge.title || challenge.question}”?`)) return;
    try { await api.delete(`/admin/challenges/${challenge.id}`, { headers: { Authorization: `Bearer ${token}` } }); setNotification("Challenge deleted."); loadAdminData(); } catch (err) { alert(err.response?.data?.detail || "Could not delete challenge."); }
  };

  const saveAlarmConfiguration = async (event) => {
    event.preventDefault();
    if (!alarmConfigForm) return;
    const { id, created_at, ...payload } = alarmConfigForm;
    try {
      setAlarmSaving(true);
      await api.patch(`/admin/alarms/${id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setAlarmConfigForm(null);
      setNotification("Alarm configuration updated.");
      loadAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not update alarm configuration.");
    } finally {
      setAlarmSaving(false);
    }
  };

  const deleteAlarmConfiguration = async (alarm) => {
    if (!confirm("Delete this alarm configuration? This cannot be undone.")) return;
    try {
      await api.delete(`/admin/alarms/${alarm.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setNotification("Alarm configuration deleted.");
      loadAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not delete alarm configuration.");
    }
  };
  const saveGlobalAlarmRules = async () => {
    try {
      await api.put("/admin/alarm-rules", globalAlarmRules, { headers: { Authorization: `Bearer ${token}` } });
      setNotification("Global alarm rules saved.");
    } catch (err) { alert(err.response?.data?.detail || "Could not save global alarm rules."); }
  };
  const applyBulkAlarmStatus = async (enabled) => {
    if (!selectedAlarmIds.length) return;
    try {
      await api.patch("/admin/alarms/bulk-status", { alarm_ids: selectedAlarmIds, enabled }, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedAlarmIds([]);
      setNotification(`Selected alarms ${enabled ? "enabled" : "disabled"}.`);
      loadAdminData();
    } catch (err) { alert(err.response?.data?.detail || "Could not update selected alarms."); }
  };
  const exportAnalyticsCsv = () => {
    const rows = [["Date", "User Growth", "Retention %", "Wake-up Success %", "Challenge Completion %", "Accuracy %"], ...analyticsData.series.map(item => [item.date, item.user_growth, item.retention, item.wake_success, item.challenge_completion, item.accuracy])];
    const csv = rows.map(row => row.join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = `cognitivewake-analytics-${analyticsStart}-to-${analyticsEnd}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  const exportAnalyticsPdf = () => {
    const report = window.open("", "_blank");
    if (!report) return;
    report.document.write(`<title>CognitiveWake Analytics</title><h1>CognitiveWake Analytics Report</h1><p>${analyticsStart} to ${analyticsEnd}</p><table border="1" cellspacing="0" cellpadding="6"><tr><th>Date</th><th>User growth</th><th>Retention</th><th>Wake success</th><th>Challenge completion</th><th>Accuracy</th></tr>${analyticsData.series.map(item => `<tr><td>${item.date}</td><td>${item.user_growth}</td><td>${item.retention}%</td><td>${item.wake_success}%</td><td>${item.challenge_completion}%</td><td>${item.accuracy}%</td></tr>`).join("")}</table>`);
    report.document.close(); report.print();
  };
  const updateSetting = (section, key, value) => { setSettingsData(current => ({ ...current, [section]: { ...current[section], [key]: value } })); setSettingsDirty(true); };
  const saveSettings = async () => { try { await api.put("/admin/settings", { values: settingsData }, { headers: { Authorization: `Bearer ${token}` } }); setSettingsDirty(false); setNotification("Settings saved."); } catch (err) { alert(err.response?.data?.detail || "Could not save settings."); } };
  const resetSettings = async () => { if (!confirm("Reset all settings to their defaults?")) return; try { await api.delete("/admin/settings", { headers: { Authorization: `Bearer ${token}` } }); await loadSettings(); setNotification("Settings reset to defaults."); } catch (err) { alert(err.response?.data?.detail || "Could not reset settings."); } };
  const toggleChallenge = async (challenge) => {
    const payload = { title: challenge.title || challenge.question || "Untitled challenge", type: challenge.type || "MATH", difficulty: challenge.difficulty || "MEDIUM", time_limit: challenge.time_limit || 30, points: challenge.points || 10, question: challenge.question || "", hint: challenge.hint || "", active: challenge.active === false };
    try { await api.put(`/admin/challenges/${challenge.id}`, payload, { headers: { Authorization: `Bearer ${token}` } }); loadAdminData(); } catch (err) { alert(err.response?.data?.detail || "Could not update challenge."); }
  };

  const fmt = (raw) => {
    if (!raw) return "—";
    const d = new Date(raw);
    return isNaN(d) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const pageTitleMap = {
    dashboard: "Dashboard",
    users: "User Management",
    wellness_coachs: "Wellness Coach Management",
    roles: "Role Management",
    challenges: "Challenge Library",
    alarms: "Alarm Management",
    analytics: "Platform Analytics",
    system_reports: "System Reports",
    notifications: "Announcements",
    settings: "System Settings",
    profile: "Admin Profile"
  };

  const dashboard = stats.dashboard || {};
  const activeWellnessCoaches = wellness_coachsList.filter((coach) => coach.is_active !== false);
  const analyticsSeries = analyticsData.series || [];
  const analyticsTotal = (key) => analyticsSeries.reduce((total, item) => total + Number(item[key] || 0), 0);
  const analyticsAverage = (key) => analyticsSeries.length ? analyticsTotal(key) / analyticsSeries.length : 0;
  const analyticsActiveDays = analyticsSeries.filter(item => Number(item.challenge_completion || 0) > 0).length;
  const settingsSections = [
    ["general", "General", "Platform name, timezone, and language."],
    ["alarm_defaults", "Alarm defaults", "Defaults used when users create new alarms."],
    ["challenge_defaults", "Challenge defaults", "Default challenge type, difficulty, and time limit."],
    ["notifications", "Notifications", "Control email and push notification delivery."],
    ["security", "Security", "Session and account-security requirements."],
    ["integrations", "Integrations", "Optional API key and webhook connection details."],
    ["appearance", "Appearance", "Visual theme preferences."],
    ["data_backup", "Data and backup", "Data retention and backup schedule."],
  ];
  const selectedSettingsSection = settingsSections.find(([id]) => id === settingsTab) || settingsSections[0];
  const dailyActiveUsers = (dashboard.daily_active_users || []).slice(-activityRange);
  const maxDailyActive = Math.max(...dailyActiveUsers.map(day => day.count), 1);
  const dailyPoints = dailyActiveUsers.map((day, index) => {
    const x = dailyActiveUsers.length === 1 ? 50 : (index / (dailyActiveUsers.length - 1)) * 100;
    const y = 88 - ((day.count / maxDailyActive) * 70);
    return `${x},${y}`;
  }).join(" ");
  const relativeTime = (raw) => {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "Recently";
    const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (mins < 2) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  };

  if (false) {
    return (
      <div style={{ position: "relative" }}>
        <div style={{ background: "rgba(139, 92, 246, 0.15)", borderBottom: "1px solid rgba(139, 92, 246, 0.3)", color: "#c4b5fd", padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600 }}>
          <span>👤 Viewing Personal User Workspace (Alarms, Cognitive Puzzles & Wake Streaks)</span>
          <button
            onClick={() => { setViewMode("ADMIN"); setActiveTab("dashboard"); }}
            style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <Crown size={14} /> Return to Admin Panel
          </button>
        </div>
        <UserDashboard user={user} token={token} onLogout={onLogout} />
      </div>
    );
  }

  return (
    <AppShell
      user={user}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onLogout={onLogout}
      title={pageTitleMap[activeTab] || "Admin Workspace"}
      streak={adminStreak}
    >
      {/* NOTIFICATION */}
      {notification && (
        <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#6ee7b7", padding: "12px 16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <CheckCircle2 size={18} /> {notification}
        </div>
      )}

      {/* DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="welcome-section">
            <div><h1>Welcome back, {user?.name || "Admin"}!</h1><p>We’re glad to have you here. Here’s what’s happening across CognitiveWake today.</p></div>
            <button className="create-alarm-button" onClick={loadAdminData} disabled={loading}><RefreshCw size={17} className={loading ? "spin" : ""} /> {loading ? "Refreshing" : "Refresh"}</button>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 14 }}>
            {[
              ["Total Users", stats.total_users, "Registered accounts", "#818cf8", Users],
              ["Active Wellness Coaches", activeWellnessCoaches.length, "Available coach accounts", "#34d399", Shield],
              ["Active Users Today", dashboard.active_users_today, "Challenge activity", "#38bdf8", Activity],
              ["Alarms Set Today", dashboard.alarms_set_today, "New wake-up plans", "#fbbf24", AlarmClock],
              ["Challenges Solved", dashboard.challenges_solved, "Correct answers", "#34d399", Brain],
              ["Success Rate", dashboard.success_rate != null ? `${dashboard.success_rate}%` : "—", "Correct attempts", "#a78bfa", Target]
            ].map(([label, value, note, color, Icon]) => <div key={label} style={{ background: "rgba(15,23,42,.78)", border: "1px solid rgba(148,163,184,.14)", borderTop: `3px solid ${color}`, borderRadius: 14, padding: "17px 18px" }}><div style={{ color, display: "flex", alignItems: "center", gap: 7, fontSize: 10, fontWeight: 800, letterSpacing: .65, textTransform: "uppercase" }}><Icon size={15} />{label}</div><div style={{ marginTop: 11, color: "#f8fafc", fontSize: 26, fontWeight: 850 }}>{value ?? "—"}</div><div style={{ marginTop: 4, color: "#64748b", fontSize: 11 }}>{note}</div></div>)}
          </section>

          <section className="admin-dashboard-chart-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(260px, .85fr)", gap: 18 }}>
            <div style={{ background: "rgba(15,23,42,.78)", border: "1px solid rgba(148,163,184,.14)", borderRadius: 14, padding: 20, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 15 }}><div><div style={{ color: "#f8fafc", fontWeight: 800 }}>Daily active users</div><div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>Unique users completing challenges</div></div><div style={{ display: "flex", background: "rgba(148,163,184,.1)", padding: 3, borderRadius: 8 }}>{[7, 30].map(days => <button key={days} onClick={() => setActivityRange(days)} style={{ cursor: "pointer", border: 0, borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, color: activityRange === days ? "#fff" : "#94a3b8", background: activityRange === days ? "#6366f1" : "transparent" }}>{days}D</button>)}</div></div>
              <div style={{ height: 185 }}>{dailyActiveUsers.length ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible" }}><line x1="0" y1="88" x2="100" y2="88" stroke="rgba(148,163,184,.25)" vectorEffect="non-scaling-stroke" /><polyline points={dailyPoints} fill="none" stroke="#818cf8" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg> : <div style={{ color: "#64748b", textAlign: "center", paddingTop: 75 }}>No activity data yet</div>}</div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 10 }}>{dailyActiveUsers.filter((_, i) => i === 0 || i === dailyActiveUsers.length - 1 || (activityRange === 30 && i % 7 === 0)).map(day => <span key={day.date}>{new Date(`${day.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>)}</div>
            </div>
            <div style={{ background: "rgba(15,23,42,.78)", border: "1px solid rgba(148,163,184,.14)", borderRadius: 14, padding: 20 }}><div style={{ color: "#f8fafc", fontWeight: 800 }}>Most-used challenge types</div><div style={{ color: "#64748b", fontSize: 12, margin: "3px 0 17px" }}>By attempt volume</div>{(dashboard.challenge_types || []).length ? dashboard.challenge_types.map((item, index) => <div key={item.type} style={{ marginBottom: 14 }}><div style={{ color: "#cbd5e1", display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}><span>{item.type}</span><b>{item.count}</b></div><div style={{ height: 7, borderRadius: 8, background: "rgba(148,163,184,.12)" }}><div style={{ height: "100%", width: `${item.count / Math.max(...dashboard.challenge_types.map(x => x.count), 1) * 100}%`, borderRadius: 8, background: ["#818cf8", "#38bdf8", "#34d399", "#fbbf24"][index % 4] }} /></div></div>) : <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", paddingTop: 45 }}>No challenges attempted yet</div>}</div>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
            <div style={{ background: "rgba(15,23,42,.78)", border: "1px solid rgba(148,163,184,.14)", borderRadius: 14, padding: 20 }}>
              <div style={{ color: "#f8fafc", display: "flex", alignItems: "center", gap: 8, fontWeight: 800, marginBottom: 12 }}>
                <Activity size={17} color="#38bdf8" />Recent activity
              </div>
              {(dashboard.recent_activity || []).length ? (
                dashboard.recent_activity.map((item, index) => (
                  <div key={`${item.at}-${index}`} style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: index ? "1px solid rgba(148,163,184,.1)" : "none" }}>
                    <span style={{ width: 8, height: 8, marginTop: 5, flexShrink: 0, borderRadius: "50%", background: item.kind === "alarm" ? "#fbbf24" : item.kind === "user" ? "#a78bfa" : "#34d399" }} />
                    <span style={{ color: "#cbd5e1", fontSize: 13, flex: 1 }}>{item.text}</span>
                    <small style={{ color: "#64748b", whiteSpace: "nowrap" }}>{relativeTime(item.at)}</small>
                  </div>
                ))
              ) : (
                <div style={{ color: "#64748b", fontSize: 13 }}>No platform activity yet.</div>
              )}
            </div>

            <div style={{ background: "rgba(15,23,42,.78)", border: "1px solid rgba(148,163,184,.14)", borderRadius: 14, padding: 20 }}>
              <div style={{ color: "#f8fafc", display: "flex", alignItems: "center", gap: 8, fontWeight: 800, marginBottom: 12 }}>
                <Shield size={17} color="#34d399" />Recent Wellness Coaches
              </div>
              {wellness_coachsList && wellness_coachsList.length > 0 ? (
                [...wellness_coachsList]
                  .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                  .slice(0, 5)
                  .map((coach, index) => (
                    <div key={coach.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: index ? "1px solid rgba(148,163,184,.1)" : "none" }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, color: "#fff", fontSize: 12, fontWeight: 800, background: "linear-gradient(135deg, #10b981, #0ea5e9)" }}>
                        {(coach.name || coach.email || "W")[0].toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {coach.name || coach.username}
                        </div>
                        <div style={{ color: "#64748b", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {coach.email}
                        </div>
                      </div>
                      <span style={{ color: coach.account_status === "ACTIVE" ? "#6ee7b7" : "#94a3b8", background: coach.account_status === "ACTIVE" ? "rgba(16,185,129,.12)" : "rgba(148,163,184,.12)", border: `1px solid ${coach.account_status === "ACTIVE" ? "rgba(52,211,153,.3)" : "rgba(148,163,184,.3)"}`, padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800 }}>
                        {coach.account_status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ))
              ) : (
                <div style={{ color: "#64748b", fontSize: 13 }}>No wellness coaches found.</div>
              )}
            </div>
          </section>

          {selectedUser && <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(2,6,23,.65)", display: "flex", justifyContent: "flex-end" }} onClick={() => setSelectedUser(null)}><aside onClick={e => e.stopPropagation()} style={{ width: "min(520px, 100%)", height: "100%", overflowY: "auto", background: "#0f172a", borderLeft: "1px solid rgba(148,163,184,.25)", padding: 24, boxSizing: "border-box" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}><div><div style={{ color: "#f8fafc", fontSize: 20, fontWeight: 800 }}>{selectedUser.name}</div><div style={{ color: "#94a3b8", fontSize: 13 }}>{selectedUser.email}</div></div><button onClick={() => setSelectedUser(null)} style={{ background: "transparent", border: 0, color: "#94a3b8", cursor: "pointer" }}><X /></button></div>{detailLoading ? <div style={{ color: "#94a3b8", padding: "50px 0", textAlign: "center" }}>Loading profile…</div> : userDetail && <div style={{ display: "grid", gap: 20, marginTop: 24 }}><div><div style={{ color: "#f8fafc", fontWeight: 750 }}>Wake-up success rate: {userDetail.wake_success_rate}%</div><div style={{ height: 90, display: "flex", alignItems: "end", gap: 6, marginTop: 10 }}>{userDetail.wake_success_trend.map(day => <div key={day.date} title={`${day.date}: ${day.rate}%`} style={{ flex: 1, minHeight: 4, height: `${day.rate}%`, background: "#34d399", borderRadius: "5px 5px 0 0" }} />)}</div></div><div><div style={{ color: "#f8fafc", fontWeight: 750, marginBottom: 8 }}>Alarms</div>{userDetail.alarms.length ? userDetail.alarms.map(a => <div key={a.id} style={{ color: "#cbd5e1", fontSize: 13, padding: "7px 0", borderBottom: "1px solid rgba(148,163,184,.1)" }}>{a.title} · {a.alarm_time}</div>) : <div style={{ color: "#64748b", fontSize: 13 }}>No alarms.</div>}</div><div><div style={{ color: "#f8fafc", fontWeight: 750, marginBottom: 8 }}>Challenge history</div>{userDetail.challenges.length ? userDetail.challenges.map(a => <div key={a.id} style={{ color: "#cbd5e1", fontSize: 13, padding: "7px 0", borderBottom: "1px solid rgba(148,163,184,.1)" }}>{a.challenge_type || "Challenge"} · {a.correct ? "Solved" : "Not solved"}</div>) : <div style={{ color: "#64748b", fontSize: 13 }}>No challenge attempts.</div>}</div></div>}</aside></div>}
        </div>
      )}

      {/* Legacy dashboard kept below while individual management tabs are migrated. */}
      {false && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Welcome Header */}
          <section className="welcome-section">
            <div>
              <p className="small-label">ADMINISTRATOR CONTROL PANEL</p>
              <h1>Welcome back, {user?.name || "Admin"} 👋</h1>
              <p>System-level overview of platform usage, registered accounts, and activity metrics.</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="create-alarm-button"
                onClick={() => setViewMode("USER")}
                style={{ background: "rgba(99, 102, 241, 0.2)", border: "1px solid rgba(99, 102, 241, 0.4)", color: "#c4b5fd" }}
              >
                <User size={18} /> My User Workspace
              </button>
              <button className="create-alarm-button" onClick={loadAdminData} disabled={loading}>
                <RefreshCw size={18} className={loading ? "spin" : ""} />
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </section>

          {/* 5 KPI Summary Cards */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
            {[
              { label: "Total Users",      value: stats.total_users,       note: "All registered accounts",   color: "#818cf8", Icon: Users },
              { label: "Active Wellness Coaches", value: activeWellnessCoaches.length, note: "Available coach accounts", color: "#34d399", Icon: Shield },
              { label: "Active Users",     value: stats.active_users,      note: "Currently active",          color: "#38bdf8", Icon: Activity },
              { label: "Active Alarms",    value: stats.total_alarms,      note: "System-wide alarms",        color: "#fbbf24", Icon: Bell },
              { label: "Total Challenges", value: stats.challenge_attempts, note: "All challenge attempts",   color: "#f472b6", Icon: Brain },
            ].map(({ label, value, note, color, Icon }) => (
              <div key={label} style={{
                background: "rgba(15, 23, 42, 0.72)",
                border: "1px solid rgba(148,163,184,0.12)",
                borderTop: `3px solid ${color}`,
                borderRadius: 14,
                padding: "18px 20px",
                backdropFilter: "blur(12px)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Icon size={16} style={{ color }} />
                  <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
                </div>
                <strong style={{ display: "block", fontSize: 30, fontWeight: 900, color: "#f8fafc", lineHeight: 1 }}>{value ?? "—"}</strong>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>{note}</div>
              </div>
            ))}
          </section>

          {/* User Growth Chart from registration dates */}
          <section style={{
            background: "rgba(15, 23, 42, 0.72)",
            border: "1px solid rgba(148,163,184,0.12)",
            borderRadius: 14,
            padding: "20px 22px",
            backdropFilter: "blur(12px)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <BarChart3 size={16} style={{ color: "#818cf8" }} />
              <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8 }}>
                User Registrations — By Month
              </div>
            </div>
            {(() => {
              const monthMap = {};
              usersList.forEach(u => {
                const raw = u.created_at;
                if (!raw) return;
                const d = new Date(raw);
                if (isNaN(d.getTime())) return;
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                monthMap[key] = (monthMap[key] || 0) + 1;
              });
              const entries = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
              const maxVal = Math.max(...entries.map(([, v]) => v), 1);
              if (entries.length === 0) {
                return <div style={{ textAlign: "center", padding: 40, color: "#64748b", fontSize: 13 }}>No registration data available yet.</div>;
              }
              return (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 180, borderBottom: "1px solid rgba(255,255,255,0.07)", minWidth: entries.length * 56, paddingBottom: 4 }}>
                      {entries.map(([month, count]) => {
                        const hPct = Math.max(8, (count / maxVal) * 100);
                        const shortMonth = new Date(`${month}-01`).toLocaleString("en", { month: "short" });
                        const year = month.slice(2, 4);
                        return (
                          <div key={month} style={{ width: 42, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 5 }}>
                            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800 }}>{count}</div>
                            <div
                              style={{ width: 32, height: `${hPct}%`, background: "linear-gradient(180deg, #a5b4fc, #6366f1)", borderRadius: "5px 5px 0 0", minHeight: 6, transition: "height 0.4s ease" }}
                              title={`${shortMonth} '${year}: ${count} registrations`}
                            />
                            <div style={{ fontSize: 10, color: "#475569", whiteSpace: "nowrap", fontWeight: 600 }}>{shortMonth} '{year}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12, fontSize: 11, color: "#64748b", alignItems: "center" }}>
                    <div style={{ width: 10, height: 10, background: "#6366f1", borderRadius: 2 }} />
                    New registrations per month (last 12 months)
                  </div>
                </>
              );
            })()}
          </section>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Header */}
          <section style={{
            background: "linear-gradient(135deg, rgba(30,58,138,0.38), rgba(88,28,135,0.28), rgba(15,23,42,0.85))",
            border: "1px solid rgba(129,140,248,0.22)",
            borderRadius: 14,
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 14
          }}>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>ADMIN · USER MANAGEMENT</div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>Manage Users</h2>
              <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13 }}>View, activate/deactivate or remove registered accounts.</p>
            </div>
            <button className="create-alarm-button" onClick={loadAdminData} disabled={loading}>
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </section>

          {/* Search + Filter bar */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", paddingLeft: 38, height: 40, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#fff", fontSize: 13 }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ height: 40, background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", padding: "0 14px", borderRadius: 10, fontSize: 13, cursor: "pointer" }}
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="BANNED">Banned</option>
            </select>
            <input type="date" value={joinDateFilter} onChange={(e) => { setJoinDateFilter(e.target.value); setUserPage(1); }} title="Joined on or after" style={{ height: 40, background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", padding: "0 10px", borderRadius: 10, fontSize: 13 }} />
            <select value={streakFilter} onChange={(e) => { setStreakFilter(e.target.value); setUserPage(1); }} style={{ height: 40, background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", color: "#f8fafc", padding: "0 14px", borderRadius: 10, fontSize: 13 }}><option value="ALL">Any streak</option><option value="1">1+ day streak</option><option value="7">7+ day streak</option><option value="30">30+ day streak</option></select>
            <button onClick={exportUsersCsv} style={{ height: 40, display: "flex", alignItems: "center", gap: 7, background: "rgba(129,140,248,.13)", border: "1px solid rgba(129,140,248,.35)", color: "#c7d2fe", borderRadius: 10, padding: "0 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}><Download size={15} /> Export CSV</button>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Showing <strong style={{ color: "#f8fafc" }}>
                {managedUsers.length}
              </strong> of {usersList.length} users
            </div>
          </div>

          {/* Users Table */}
          <section style={{ background: "rgba(15,23,42,0.72)", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 1040, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {[{ label: "User", key: "name" }, { label: "Email", key: "email" }, { label: "Status", key: "account_status" }, { label: "Join Date", key: "created_at" }, { label: "Streak", key: "streak" }, { label: "Last Active", key: "last_active" }, { label: "Actions" }].map(h => (
                      <th key={h.label} onClick={() => h.key && toggleUserSort(h.key)} style={{ padding: "12px 16px", textAlign: "left", color: "#64748b", fontWeight: 900, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7, whiteSpace: "nowrap", cursor: h.key ? "pointer" : "default" }}>{h.label} {h.key && userSort.key === h.key && (userSort.direction === "asc" ? " ▲" : " ▼")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.map((u) => {
                      const accountStatus = u.account_status || (u.is_active === false ? "SUSPENDED" : "ACTIVE");
                      const isActive = accountStatus === "ACTIVE";
                      return (
                        <tr
                          key={u.id}
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#fff", flexShrink: 0 }}>
                                {(u.name || "U")[0].toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: "#f1f5f9" }}>{u.name || "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", color: "#94a3b8", fontSize: 12 }}>{u.email || "—"}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{
                              padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                              background: isActive ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                              color: isActive ? "#6ee7b7" : "#fca5a5",
                              border: `1px solid ${isActive ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`
                            }}>
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ padding: "14px 16px", color: "#94a3b8", fontSize: 12 }}>{fmt(u.created_at)}</td>
                          <td style={{ padding: "14px 16px", color: "#fbbf24", fontWeight: 800 }}>{u.current_streak || 0}d</td>
                          <td style={{ padding: "14px 16px", color: "#94a3b8", fontSize: 12 }}>{fmt(u.last_active)}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <button onClick={() => openUserDetail(u)} title="View profile" style={{ background: "rgba(96,165,250,.12)", border: "1px solid rgba(96,165,250,.28)", color: "#93c5fd", padding: "5px 8px", borderRadius: 8, cursor: "pointer" }}><Eye size={14} /></button>
                              <button onClick={() => handlePasswordReset(u)} title="Reset password" style={{ background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.28)", color: "#fde68a", padding: "5px 8px", borderRadius: 8, cursor: "pointer" }}><KeyRound size={14} /></button>
                              {isActive && <button onClick={() => updateAccountState(u, "BANNED")} title="Ban user" style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.28)", color: "#fca5a5", padding: "5px 8px", borderRadius: 8, cursor: "pointer" }}><Ban size={14} /></button>}
                              <button
                                onClick={() => handleStatusToggle(u)}
                                style={{
                                  background: isActive ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.1)",
                                  border: `1px solid ${isActive ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.3)"}`,
                                  color: isActive ? "#fca5a5" : "#6ee7b7",
                                  padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap"
                                }}
                              >
                                {isActive ? "Deactivate" : "Activate"}
                              </button>
                              {u.id !== user.id && (
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.name)}
                                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", padding: "5px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center" }}
                                  title="Delete user"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
          {selectedUser && <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(2,6,23,.65)", display: "flex", justifyContent: "flex-end" }} onClick={() => setSelectedUser(null)}><aside onClick={e => e.stopPropagation()} style={{ width: "min(520px,100%)", overflowY: "auto", background: "#0f172a", padding: 24 }}><button onClick={() => setSelectedUser(null)} style={{ float: "right", background: "transparent", border: 0, color: "#94a3b8" }}><X /></button><h2>{selectedUser.name}</h2><p style={{ color: "#94a3b8" }}>{selectedUser.email}</p><p style={{ color: "#cbd5e1", fontSize: 13 }}>Role: {selectedUser.role || "USER"} · Status: {selectedUser.account_status || "ACTIVE"}</p>{detailLoading ? "Loading profile…" : detailError ? <p style={{ color: "#fca5a5" }}>{detailError}</p> : userDetail && <><h3>Wake-up success: {userDetail.wake_success_rate}%</h3><div style={{ height: 80, display: "flex", alignItems: "end", gap: 5 }}>{(userDetail.wake_success_trend || []).map(day => <div key={day.date} style={{ flex: 1, height: `${day.rate}%`, minHeight: 3, background: "#34d399" }} />)}</div><h3>Alarms</h3>{userDetail.alarms?.length ? userDetail.alarms.map(a => <p key={a.id}>{a.title || "Alarm"} · {a.alarm_time}</p>) : <p style={{ color: "#94a3b8" }}>No alarms configured for this user.</p>}<h3>Challenge history</h3>{userDetail.challenges?.length ? userDetail.challenges.map(a => <p key={a.id}>{a.challenge_type || "Challenge"} · {a.correct ? "Solved" : "Not solved"}</p>) : <p style={{ color: "#94a3b8" }}>No challenge attempts recorded.</p>}</>}</aside></div>}
        </div>
      )}

      {/* WELLNESS_COACHS TAB */}
      {activeTab === "wellness_coachs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <section style={{
            background: "linear-gradient(135deg, rgba(30,58,138,0.38), rgba(88,28,135,0.28), rgba(15,23,42,0.85))",
            border: "1px solid rgba(129,140,248,0.22)",
            borderRadius: 14,
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 14
          }}>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>ADMIN · WELLNESS COACH MANAGEMENT</div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>Manage Wellness Coaches</h2>
              <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13 }}>Create and manage wellness coach accounts and their user assignments.</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="create-alarm-button" onClick={loadAdminData} disabled={loading}>
                <RefreshCw size={16} className={loading ? "spin" : ""} />
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <button className="create-alarm-button" onClick={handleCreateWellnessCoach}>
                <UserPlus size={16} /> Create Wellness Coach
              </button>
            </div>
          </section>

          <section style={{ background: "rgba(15,23,42,0.72)", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 940, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Wellness Coach Name", "Email", "Status", "Assigned Users", "Last Active", "Actions"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#64748b", fontWeight: 900, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wellness_coachsList.map((wellness_coach) => {
                    const isActive = wellness_coach.is_active !== false;
                    const assignedCount = usersList.filter(item => item.role === "USER" && item.wellness_coach_id === wellness_coach.id).length;
                    return (
                      <tr key={wellness_coach.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "14px 16px", fontWeight: 700, color: "#f1f5f9" }}>{wellness_coach.name || "—"}</td>
                        <td style={{ padding: "14px 16px", color: "#94a3b8", fontSize: 12 }}>{wellness_coach.email || "—"}</td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                            background: isActive ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                            color: isActive ? "#6ee7b7" : "#fca5a5",
                            border: `1px solid ${isActive ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`
                          }}>{isActive ? "Active" : "Inactive"}</span>
                        </td>
                        <td style={{ padding: "14px 16px", color: "#f1f5f9", fontWeight: 700 }}>{assignedCount}</td>
                        <td style={{ padding: "14px 16px", color: "#94a3b8", fontSize: 12 }}>{fmt(wellness_coach.updated_at || wellness_coach.last_active)}</td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <button onClick={() => handleEditWellnessCoach(wellness_coach)} style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)", color: "#93c5fd", padding: "5px 9px", borderRadius: 8, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }} title="Edit wellness_coach"><Pencil size={13} /> Edit</button>
                            <button onClick={() => handleManageWellnessCoachUsers(wellness_coach)} style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd", padding: "5px 9px", borderRadius: 8, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>Manage Users</button>
                            <button onClick={() => handleStatusToggle(wellness_coach)} style={{ background: isActive ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.1)", border: `1px solid ${isActive ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.3)"}`, color: isActive ? "#fca5a5" : "#6ee7b7", padding: "5px 9px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{isActive ? "Deactivate" : "Activate"}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!wellness_coachsList.length && (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#64748b" }}>No wellness coach accounts found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ROLES TAB */}
      {activeTab === "roles" && (
        <section className="progress-card">
          <h2>Role Management</h2>
          <p style={{ color: "#94a3b8" }}>System role definitions and permissions overview. Only ADMIN can assign elevated roles.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
            {[
              { role: "USER", desc: "Personal wake-up experience", perms: ["Create & manage own alarms", "Complete cognitive challenges", "View own performance", "Edit own profile"] },
              { role: "WELLNESS_COACH", desc: "Manage challenges and users", perms: ["All USER permissions", "View all users", "Manage cognitive challenges", "View compliance reports", "Activate/deactivate users"] },
              { role: "ADMIN", desc: "Full platform management", perms: ["All WELLNESS_COACH permissions", "Assign/change user roles", "Delete user accounts", "Access platform analytics", "Configure system settings"] }
            ].map(item => (
              <div key={item.role} style={{ background: "rgba(15, 23, 42, 0.5)", padding: 20, borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <RoleBadge role={item.role} />
                  <span style={{ color: "#94a3b8", fontSize: 14 }}>{item.desc}</span>
                  <span style={{ marginLeft: "auto", color: "#64748b", fontSize: 13 }}>
                    {usersList.filter(u => u.role === item.role).length} users
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {item.perms.map(p => (
                    <span key={p} style={{ background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.2)", color: "#c4b5fd", padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CHALLENGES TAB */}
      {activeTab === "challenges" && (
        <section className="progress-card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><div><h2 style={{ margin: 0 }}>Challenge Management</h2><p style={{ color: "#94a3b8", marginBottom: 0 }}>Create and maintain the challenges available on the platform.</p></div><button className="create-alarm-button" onClick={() => setChallengeForm({ title: "", type: "MATH", difficulty: "MEDIUM", time_limit: 30, points: 10, question: "", hint: "", active: true })}>Create Challenge</button></div>
          {challengeForm && <form onSubmit={saveChallenge} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, padding: 16, background: "rgba(99,102,241,.1)", borderRadius: 12 }}>
            {[['title','Challenge name'],['question','Question'],['hint','Hint']].map(([key,label]) => <input key={key} required={key === 'title'} placeholder={label} value={challengeForm[key]} onChange={e => setChallengeForm({ ...challengeForm, [key]: e.target.value })} style={{ padding: 10, borderRadius: 8, border: "1px solid #475569", background: "#0f172a", color: "#fff" }} />)}
            <select value={challengeForm.type} onChange={e => setChallengeForm({ ...challengeForm, type: e.target.value })} style={{ padding: 10, borderRadius: 8 }}>{["MATH","MEMORY","LOGIC","PATTERN","WORD","TYPING","PUZZLE"].map(x => <option key={x}>{x}</option>)}</select><select value={challengeForm.difficulty} onChange={e => setChallengeForm({ ...challengeForm, difficulty: e.target.value })} style={{ padding: 10, borderRadius: 8 }}>{["EASY","MEDIUM","HARD"].map(x => <option key={x}>{x}</option>)}</select><input type="number" min="1" value={challengeForm.time_limit} onChange={e => setChallengeForm({ ...challengeForm, time_limit: Number(e.target.value) })} placeholder="Time limit" /><input type="number" min="0" value={challengeForm.points} onChange={e => setChallengeForm({ ...challengeForm, points: Number(e.target.value) })} placeholder="Points" /><label style={{ color: "#cbd5e1" }}><input type="checkbox" checked={challengeForm.active} onChange={e => setChallengeForm({ ...challengeForm, active: e.target.checked })} /> Active</label><div style={{ display: "flex", gap: 8 }}><button className="create-alarm-button" type="submit">Save</button><button type="button" onClick={() => setChallengeForm(null)}>Cancel</button></div></form>}
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}><thead><tr>{["Challenge Name","Challenge Type","Difficulty","Status","Created Date","Actions"].map(h => <th key={h} style={{ textAlign: "left", padding: 12, color: "#94a3b8", fontSize: 11 }}>{h}</th>)}</tr></thead><tbody>{challengesList.map(c => <tr key={c.id} style={{ borderTop: "1px solid rgba(148,163,184,.14)" }}><td style={{ padding: 12, color: "#f8fafc", fontWeight: 700 }}>{c.title || c.question || "Untitled challenge"}</td><td style={{ padding: 12, color: "#cbd5e1" }}>{c.type}</td><td style={{ padding: 12, color: "#cbd5e1" }}>{c.difficulty}</td><td style={{ padding: 12, color: c.active === false ? "#fca5a5" : "#6ee7b7" }}>{c.active === false ? "Disabled" : "Enabled"}</td><td style={{ padding: 12, color: "#94a3b8" }}>{fmt(c.created_at)}</td><td style={{ padding: 12, display: "flex", gap: 7 }}><button onClick={() => setChallengeForm({ ...c, title: c.title || c.question || "", active: c.active !== false, time_limit: c.time_limit || 30, points: c.points || 10, hint: c.hint || "" })}>Edit</button><button onClick={() => saveChallenge({ preventDefault: () => {}, target: null })} style={{ display: "none" }}>x</button><button onClick={() => setChallengeForm({ ...c, title: c.title || c.question || "", active: !(c.active !== false), time_limit: c.time_limit || 30, points: c.points || 10, hint: c.hint || "" })}>{c.active === false ? "Enable" : "Disable"}</button><button onClick={() => deleteChallenge(c)} style={{ color: "#fca5a5" }}>Delete</button></td></tr>)}</tbody></table></div>
        </section>
      )}

      {activeTab === "analytics" && (
        <section className="progress-card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", justifyContent: "space-between" }}><div><h2 style={{ margin: 0 }}>Platform Analytics</h2><p style={{ color: "#94a3b8", marginBottom: 0 }}>A clear summary of registrations, alarm results, and challenge performance.</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}><label>From<input type="date" value={analyticsStart} max={analyticsEnd} onChange={e => setAnalyticsStart(e.target.value)} /></label><label>To<input type="date" value={analyticsEnd} min={analyticsStart} onChange={e => setAnalyticsEnd(e.target.value)} /></label><button onClick={loadAnalytics}>Apply dates</button><button onClick={exportAnalyticsCsv}><Download size={15} /> CSV</button></div></div>
          {analyticsLoading ? <p style={{ color: "#94a3b8" }}>Loading analytics...</p> : <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>{[["New users", analyticsTotal("user_growth"), "Registered during this period", "#818cf8"], ["New wellness coaches", analyticsTotal("wellness_coach_growth"), "Registered during this period", "#34d399"], ["Wake-up success", `${analyticsAverage("wake_success").toFixed(1)}%`, "Completed alarm sessions", "#fbbf24"], ["Challenge accuracy", `${analyticsAverage("accuracy").toFixed(1)}%`, "Correct challenge answers", "#38bdf8"], ["Active challenge days", analyticsActiveDays, "Days with completed challenges", "#f472b6"]].map(([label, value, note, color]) => <div key={label} style={{ padding: 18, border: "1px solid rgba(148,163,184,.16)", borderTop: `3px solid ${color}`, borderRadius: 12 }}><div style={{ color: "#cbd5e1", fontWeight: 700 }}>{label}</div><div style={{ color: "#f8fafc", fontSize: 30, fontWeight: 800, marginTop: 8 }}>{value}</div><div style={{ color: "#94a3b8", fontSize: 12, marginTop: 5 }}>{note}</div></div>)}</div>
            <div style={{ border: "1px solid rgba(148,163,184,.16)", borderRadius: 12, overflow: "hidden" }}><div style={{ padding: "14px 18px", color: "#f8fafc", fontWeight: 750 }}>Daily activity</div><div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 660, borderCollapse: "collapse", fontSize: 13 }}><thead><tr>{["Date", "New users", "New wellness coaches", "Wake-up success", "Challenge accuracy"].map(header => <th key={header} style={{ textAlign: "left", padding: "10px 18px", color: "#94a3b8", fontSize: 11 }}>{header}</th>)}</tr></thead><tbody>{analyticsSeries.map(day => <tr key={day.date} style={{ borderTop: "1px solid rgba(148,163,184,.12)" }}><td style={{ padding: "10px 18px", color: "#cbd5e1" }}>{fmt(day.date)}</td><td style={{ padding: "10px 18px", color: "#f8fafc" }}>{day.user_growth}</td><td style={{ padding: "10px 18px", color: "#f8fafc" }}>{day.wellness_coach_growth || 0}</td><td style={{ padding: "10px 18px", color: "#fbbf24" }}>{day.wake_success}%</td><td style={{ padding: "10px 18px", color: "#38bdf8" }}>{day.accuracy}%</td></tr>)}{!analyticsSeries.length && <tr><td colSpan={5} style={{ padding: 20, color: "#94a3b8" }}>No analytics recorded for this period.</td></tr>}</tbody></table></div></div>
            {false && <><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}><div style={{ padding: 15, border: "1px solid rgba(148,163,184,.16)", borderRadius: 12 }}><h3 style={{ marginTop: 0, fontSize: 15 }}>Avg. Solve Time by Difficulty</h3>{analyticsData.avg_solve_time_by_difficulty.map(item => <div key={item.difficulty} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: "1px solid rgba(148,163,184,.1)", color: "#cbd5e1" }}><span>{item.difficulty}</span><strong>{item.seconds}s</strong></div>)}</div><div style={{ padding: 15, border: "1px solid rgba(148,163,184,.16)", borderRadius: 12 }}><h3 style={{ marginTop: 0, fontSize: 15 }}>Snooze vs. Dismiss Ratio</h3><div style={{ display: "flex", gap: 18, alignItems: "center", color: "#cbd5e1" }}><strong style={{ color: "#fbbf24", fontSize: 28 }}>{analyticsData.snooze_vs_dismiss.snoozes}</strong> Snoozes <strong style={{ color: "#34d399", fontSize: 28 }}>{analyticsData.snooze_vs_dismiss.dismisses}</strong> Dismisses</div></div></div>
            <div style={{ padding: 15, border: "1px solid rgba(148,163,184,.16)", borderRadius: 12 }}><h3 style={{ marginTop: 0, fontSize: 15 }}>Peak Alarm Hours</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 3 }}>{analyticsData.peak_alarm_hours.map(item => <div key={item.hour} title={`${item.hour}:00 — ${item.count} alarms`} style={{ height: 34, borderRadius: 3, background: `rgba(129,140,248,${Math.max(.08, item.count / Math.max(...analyticsData.peak_alarm_hours.map(x => x.count), 1))})` }} />)}</div><div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: 11, marginTop: 6 }}><span>00:00</span><span>12:00</span><span>23:00</span></div></div>
            </>}
          </>}
        </section>
      )}

      {activeTab === "system_reports" && <AdminSystemReports token={token} />}
      {activeTab === "notifications" && <NotificationsCenter token={token} isAdmin />}

      {/* ANALYTICS TAB */}
      {activeTab === "analytics" && false && (
        <section className="progress-card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h2>Platform Behavioral Analytics</h2>
            <p style={{ color: "#94a3b8" }}>System-wide wake-up metrics, cognitive benchmarks, and predictive evaluations</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: 20, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 style={{ margin: 0, color: "#34d399", fontSize: 28, fontWeight: 900 }}>{stats.system_adherence_rate ?? 98.6}%</h3>
              <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>System Awakening Adherence</p>
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: 20, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 style={{ margin: 0, color: "#c4b5fd", fontSize: 28, fontWeight: 900 }}>{stats.global_avg_response_time ?? 12.4}s</h3>
              <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Global Avg Response Time</p>
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: 20, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 style={{ margin: 0, color: "#a78bfa", fontSize: 28, fontWeight: 900 }}>{stats.avg_wakefulness ?? 78.5}%</h3>
              <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Avg Wakefulness Readiness</p>
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: 20, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 style={{ margin: 0, color: "#38bdf8", fontSize: 28, fontWeight: 900 }}>{stats.avg_csi ?? 82.0}%</h3>
              <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Avg Cognitive Stability (CSI)</p>
            </div>
          </div>

          {/* User Difficulty Distribution Breakdown */}
          <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: 20, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 16 }}>User Difficulty Tier Distribution</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#34d399", fontWeight: 700, marginBottom: 4 }}>
                  <span>EASY TIER</span>
                  <span>{stats.difficulty_distribution?.easy_pct ?? 33.3}%</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.1)", height: 8, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ background: "#34d399", height: "100%", width: `${stats.difficulty_distribution?.easy_pct ?? 33.3}%` }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#38bdf8", fontWeight: 700, marginBottom: 4 }}>
                  <span>MEDIUM TIER</span>
                  <span>{stats.difficulty_distribution?.medium_pct ?? 44.4}%</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.1)", height: 8, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ background: "#38bdf8", height: "100%", width: `${stats.difficulty_distribution?.medium_pct ?? 44.4}%` }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#f43f5e", fontWeight: 700, marginBottom: 4 }}>
                  <span>HARD TIER</span>
                  <span>{stats.difficulty_distribution?.hard_pct ?? 22.3}%</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.1)", height: 8, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ background: "#f43f5e", height: "100%", width: `${stats.difficulty_distribution?.hard_pct ?? 22.3}%` }} />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "settings" && (
        <section className="progress-card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div><h2 style={{ margin: 0 }}>System Settings</h2><p style={{ color: "#94a3b8", marginBottom: 0 }}>Manage platform configuration, security, integrations, and data retention.</p></div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", borderBottom: "1px solid rgba(148,163,184,.15)", paddingBottom: 12 }}>{settingsSections.map(([id, label]) => <button key={id} type="button" onClick={() => { if (!settingsDirty || confirm("You have unsaved settings. Switch tabs without saving?")) setSettingsTab(id); }} style={{ background: settingsTab === id ? "#6366f1" : "rgba(255,255,255,.06)", color: "#fff", border: 0, borderRadius: 8, padding: "8px 10px" }}>{label}</button>)}</div>
          {settingsLoading ? <p style={{ color: "#94a3b8" }}>Loading settings...</p> : <><div style={{ padding: "14px 16px", background: "rgba(99,102,241,.08)", border: "1px solid rgba(129,140,248,.2)", borderRadius: 10 }}><div style={{ color: "#f8fafc", fontWeight: 750 }}>{selectedSettingsSection[1]}</div><div style={{ color: "#94a3b8", fontSize: 13, marginTop: 3 }}>{selectedSettingsSection[2]}</div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>{Object.entries(settingsData[settingsTab] || {}).map(([key, value]) => <label key={key} style={{ color: "#cbd5e1", fontSize: 12, textTransform: "capitalize", padding: 14, border: "1px solid rgba(148,163,184,.14)", borderRadius: 10 }}>{key.replaceAll("_", " ")}{typeof value === "boolean" ? <span style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, color: "#94a3b8", textTransform: "none" }}><input type="checkbox" checked={value} onChange={e => updateSetting(settingsTab, key, e.target.checked)} /> {value ? "Enabled" : "Disabled"}</span> : key.includes("template") ? <textarea value={value} onChange={e => updateSetting(settingsTab, key, e.target.value)} style={{ width: "100%", boxSizing: "border-box", minHeight: 88, marginTop: 8, padding: 10, borderRadius: 8 }} /> : <input type={typeof value === "number" ? "number" : key.includes("api_key") ? "password" : "text"} value={value} onChange={e => updateSetting(settingsTab, key, typeof value === "number" ? Number(e.target.value) : e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 10, borderRadius: 8 }} />}</label>)}</div></>}
          {settingsDirty && <div style={{ color: "#fbbf24", fontSize: 13 }}>You have unsaved changes. Save them before leaving this page.</div>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="create-alarm-button" onClick={saveSettings} disabled={!settingsDirty}>Save Changes</button><button type="button" onClick={resetSettings}>Reset to Defaults</button></div>
        </section>
      )}

      {/* SETTINGS TAB */}
      {activeTab === "settings" && false && (
        <section className="progress-card">
          <h2>System Settings</h2>
          <p style={{ color: "#94a3b8" }}>Configure system-wide parameters and RBAC policies</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
            {[
              { label: "Mandatory Alarm Policy", desc: "Allow wellness_coachs to assign mandatory alarms to users", checked: true },
              { label: "Drill Sergeant Zero-Snooze", desc: "Automatically disable snooze for Drill Sergeant persona alarms", checked: true },
              { label: "User Self-Registration", desc: "Allow public users to create USER accounts", checked: true },
              { label: "Cognitive Challenge Required", desc: "Require challenge completion to dismiss alarms", checked: true }
            ].map(item => (
              <div key={item.label} style={{ background: "rgba(15, 23, 42, 0.6)", padding: 16, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div>
                  <strong style={{ color: "#fff" }}>{item.label}</strong>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>{item.desc}</p>
                </div>
                <input type="checkbox" defaultChecked={item.checked} style={{ width: 18, height: 18 }} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PROFILE TAB */}
      {activeTab === "profile" && (
        <div style={{ maxWidth: 640 }}>
          <section className="progress-card">
            <h2>Admin Profile</h2>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Manage your administrator account details.</p>

            <form onSubmit={handleProfileSave} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
              <div className="form-control">
                <label>FULL NAME</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                />
              </div>
              <div className="form-control">
                <label>USERNAME (READ-ONLY)</label>
                <input type="text" value={user?.username || ""} disabled style={{ opacity: 0.6, cursor: "not-allowed" }} />
              </div>
              <div className="form-control">
                <label>EMAIL ADDRESS (READ-ONLY)</label>
                <input type="email" value={user?.email || ""} disabled style={{ opacity: 0.6, cursor: "not-allowed" }} />
              </div>
              <div className="form-control">
                <label>ACCOUNT ROLE (READ-ONLY)</label>
                <div style={{ paddingTop: 4 }}><RoleBadge role="ADMIN" /></div>
              </div>
              <div className="form-control">
                <label>TIMEZONE</label>
                <select
                  value={profileTimezone}
                  onChange={(e) => setProfileTimezone(e.target.value)}
                  style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 14px", color: "#fff" }}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              {profileMessage && (
                <div style={{ padding: 12, borderRadius: 10, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: 13 }}>
                  {profileMessage}
                </div>
              )}

              <button type="submit" className="primary-button" disabled={profileUpdating} style={{ width: 180, marginTop: 8 }}>
                {profileUpdating ? <Loader2 size={16} className="spin" /> : <><Save size={16} /> Save Changes</>}
              </button>
            </form>
          </section>
        </div>
      )}

      {activeTab === "alarms" && (
        <section className="progress-card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Alarm Management</h2>
              <p style={{ color: "#94a3b8", marginBottom: 0 }}>Review and manage alarm configurations.</p>
            </div>
            <button className="create-alarm-button" onClick={loadAdminData} disabled={loading}>
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              {loading ? "Refreshing..." : "Refresh Report"}
            </button>
          </div>
          {alarmConfigForm && (
            <form onSubmit={saveAlarmConfiguration} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, padding: 16, background: "rgba(99,102,241,.1)", border: "1px solid rgba(129,140,248,.28)", borderRadius: 12 }}>
              <label style={{ color: "#cbd5e1", fontSize: 12 }}>Alarm Type<select value={alarmConfigForm.alarm_role || "STANDARD"} onChange={e => setAlarmConfigForm({ ...alarmConfigForm, alarm_role: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8 }}>{['STANDARD', 'DRILL_SERGEANT', 'ZEN_GURU', 'CORPORATE_EXEC', 'MAD_SCIENTIST', 'FITNESS_COACH'].map(role => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}</select></label>
              <label style={{ color: "#cbd5e1", fontSize: 12 }}>Alarm Time<input required type="time" value={alarmConfigForm.alarm_time || ""} onChange={e => setAlarmConfigForm({ ...alarmConfigForm, alarm_time: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8 }} /></label>
              <label style={{ color: "#cbd5e1", fontSize: 12 }}>Repeat<select value={alarmConfigForm.repeat_type || "daily"} onChange={e => setAlarmConfigForm({ ...alarmConfigForm, repeat_type: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8 }}>{['once', 'daily', 'weekly', 'monthly'].map(type => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select></label>
              <label style={{ color: "#cbd5e1", fontSize: 12 }}>Assigned challenge<select value={alarmConfigForm.challenge_type || "MATH"} onChange={e => setAlarmConfigForm({ ...alarmConfigForm, challenge_type: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8 }}>{["MATH", "MEMORY", "LOGIC", "PATTERN", "WORD", "TYPING", "PUZZLE"].map(type => <option key={type}>{type}</option>)}</select></label>
              <label style={{ color: "#cbd5e1", fontSize: 12 }}>Difficulty<select value={alarmConfigForm.difficulty || "MEDIUM"} onChange={e => setAlarmConfigForm({ ...alarmConfigForm, difficulty: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8 }}>{["EASY", "MEDIUM", "HARD", "AUTO"].map(level => <option key={level}>{level}</option>)}</select></label>
              <label style={{ color: "#cbd5e1", fontSize: 12 }}>Sound<input value={alarmConfigForm.sound || "default"} onChange={e => setAlarmConfigForm({ ...alarmConfigForm, sound: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8 }} /></label>
              <label style={{ color: "#cbd5e1", fontSize: 12 }}>Volume ({alarmConfigForm.volume ?? 80}%)<input type="range" min="0" max="100" value={alarmConfigForm.volume ?? 80} onChange={e => setAlarmConfigForm({ ...alarmConfigForm, volume: Number(e.target.value) })} style={{ width: "100%", marginTop: 10 }} /></label>
              <label style={{ color: "#cbd5e1", fontSize: 12 }}>Timezone<input value={alarmConfigForm.timezone || "Asia/Kolkata"} onChange={e => setAlarmConfigForm({ ...alarmConfigForm, timezone: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8 }} /></label>
              <label style={{ color: "#cbd5e1", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={Boolean(alarmConfigForm.snooze_enabled)} onChange={e => setAlarmConfigForm({ ...alarmConfigForm, snooze_enabled: e.target.checked })} /> Enable snooze</label>
              <label style={{ color: "#cbd5e1", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={Boolean(alarmConfigForm.is_mandatory)} onChange={e => setAlarmConfigForm({ ...alarmConfigForm, is_mandatory: e.target.checked })} /> Mandatory alarm</label>
              <div style={{ display: "flex", gap: 8, alignItems: "end" }}><button className="create-alarm-button" type="submit" disabled={alarmSaving}>{alarmSaving ? "Saving..." : "Save Configuration"}</button><button type="button" onClick={() => setAlarmConfigForm(null)}>Cancel</button></div>
            </form>
          )}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, padding: 16, border: "1px solid rgba(148,163,184,.16)", borderRadius: 12 }}>
            <div style={{ gridColumn: "1 / -1", color: "#f8fafc", fontWeight: 800 }}>Global Alarm Rules</div>
            <label style={{ color: "#cbd5e1", fontSize: 12 }}>Max snoozes<input type="number" min="0" value={globalAlarmRules.max_snoozes} onChange={e => setGlobalAlarmRules({ ...globalAlarmRules, max_snoozes: Number(e.target.value) })} style={{ width: "100%", marginTop: 6, padding: 9, borderRadius: 8 }} /></label>
            <label style={{ color: "#cbd5e1", fontSize: 12 }}>Default challenge<select value={globalAlarmRules.default_challenge} onChange={e => setGlobalAlarmRules({ ...globalAlarmRules, default_challenge: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 9, borderRadius: 8 }}>{["MATH", "MEMORY", "LOGIC", "PATTERN", "WORD", "TYPING", "PUZZLE"].map(x => <option key={x}>{x}</option>)}</select></label>
            <label style={{ color: "#cbd5e1", fontSize: 12 }}>Default difficulty<select value={globalAlarmRules.default_difficulty} onChange={e => setGlobalAlarmRules({ ...globalAlarmRules, default_difficulty: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 9, borderRadius: 8 }}>{["EASY", "MEDIUM", "HARD", "AUTO"].map(x => <option key={x}>{x}</option>)}</select></label>
            <label style={{ color: "#cbd5e1", display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}><input type="checkbox" checked={globalAlarmRules.gradual_volume} onChange={e => setGlobalAlarmRules({ ...globalAlarmRules, gradual_volume: e.target.checked })} /> Gradual-volume option</label>
            <button className="create-alarm-button" type="button" onClick={saveGlobalAlarmRules}>Save Rules</button>
          </section>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={alarmUserFilter} onChange={e => setAlarmUserFilter(e.target.value)}><option value="ALL">All users</option>{[...new Set(alarmsList.map(a => a.user))].sort().map(name => <option key={name}>{name}</option>)}</select>
            <select value={alarmChallengeFilter} onChange={e => setAlarmChallengeFilter(e.target.value)}><option value="ALL">All challenges</option>{[...new Set(alarmsList.map(a => a.assigned_challenge))].sort().map(type => <option key={type}>{type}</option>)}</select>
            <select value={alarmStatusFilter} onChange={e => setAlarmStatusFilter(e.target.value)}><option value="ALL">All statuses</option><option value="ON">On</option><option value="OFF">Off</option></select>
            <button type="button" disabled={!selectedAlarmIds.length} onClick={() => applyBulkAlarmStatus(true)}>Enable selected</button><button type="button" disabled={!selectedAlarmIds.length} onClick={() => applyBulkAlarmStatus(false)}>Disable selected</button>
          </div>
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 1000, borderCollapse: "collapse" }}><thead><tr>{["", "User", "Time", "Repeat Days", "Assigned Challenge", "Difficulty", "Status", "Snooze Count", "Actions"].map(header => <th key={header || "select"} style={{ textAlign: "left", padding: 10, color: "#94a3b8", fontSize: 11 }}>{header}</th>)}</tr></thead><tbody>
            {alarmsList.filter(a => (alarmUserFilter === "ALL" || a.user === alarmUserFilter) && (alarmChallengeFilter === "ALL" || a.assigned_challenge === alarmChallengeFilter) && (alarmStatusFilter === "ALL" || (alarmStatusFilter === "ON" ? a.enabled !== false : a.enabled === false))).map(alarm => <tr key={alarm.id} style={{ borderTop: "1px solid rgba(148,163,184,.14)" }}><td style={{ padding: 10 }}><input type="checkbox" checked={selectedAlarmIds.includes(alarm.id)} onChange={e => setSelectedAlarmIds(ids => e.target.checked ? [...ids, alarm.id] : ids.filter(id => id !== alarm.id))} /></td><td style={{ padding: 10, color: "#f8fafc", fontWeight: 700 }}>{alarm.user}</td><td style={{ padding: 10, color: "#cbd5e1" }}>{alarm.alarm_time}</td><td style={{ padding: 10, color: "#cbd5e1" }}>{alarm.repeat_days?.length ? alarm.repeat_days.join(", ") : alarm.repeat_type || "Daily"}</td><td style={{ padding: 10, color: "#cbd5e1" }}>{alarm.assigned_challenge}</td><td style={{ padding: 10, color: "#cbd5e1" }}>{alarm.difficulty || "MEDIUM"}</td><td style={{ padding: 10, color: alarm.enabled === false ? "#fca5a5" : "#6ee7b7" }}>{alarm.enabled === false ? "Off" : "On"}</td><td style={{ padding: 10, color: "#cbd5e1" }}>{alarm.snooze_count}</td><td style={{ padding: 10, display: "flex", gap: 7 }}><button onClick={() => setAlarmConfigForm({ ...alarm, repeat_days: alarm.repeat_days || [] })}>Edit</button><button onClick={() => deleteAlarmConfiguration(alarm)} style={{ color: "#fca5a5" }}>Delete</button></td></tr>)}
          </tbody></table></div>
          <section style={{ border: "1px solid rgba(244,114,182,.22)", borderRadius: 12, padding: 16 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div><h3 style={{ margin: 0 }}>Alarm Failure / Missed-Alarm Report</h3><p style={{ color: "#94a3b8", margin: "5px 0 0", fontSize: 13 }}>{missedAlarmReport.missed_alarms} missed of {missedAlarmReport.total_sessions} recorded sessions · {missedAlarmReport.completed_sessions} completed</p></div></div><div style={{ marginTop: 12, overflowX: "auto" }}><table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" }}><thead><tr>{["User", "Triggered", "Status", "Snoozes"].map(x => <th key={x} style={{ textAlign: "left", padding: 8, color: "#94a3b8", fontSize: 11 }}>{x}</th>)}</tr></thead><tbody>{missedAlarmReport.recent_missed?.map(item => <tr key={item.id} style={{ borderTop: "1px solid rgba(148,163,184,.14)" }}><td style={{ padding: 8 }}>{item.user}</td><td style={{ padding: 8 }}>{fmt(item.triggered_at)}</td><td style={{ padding: 8, color: "#fca5a5" }}>{item.status}</td><td style={{ padding: 8 }}>{item.snoozed_count}</td></tr>)}{!missedAlarmReport.recent_missed?.length && <tr><td colSpan={4} style={{ padding: 14, color: "#64748b" }}>No missed alarms recorded.</td></tr>}</tbody></table></div></section>
          <div style={{ overflowX: "auto", display: "none" }}><table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse" }}><thead><tr>{["Alarm Type", "Status", "Configuration", "Created Date", "Actions"].map(header => <th key={header} style={{ textAlign: "left", padding: 12, color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: .5 }}>{header}</th>)}</tr></thead><tbody>
            {alarmsList.map(alarm => { const config = [alarm.alarm_time, alarm.timezone, alarm.repeat_type, `Sound: ${alarm.sound || "default"}`, `Volume: ${alarm.volume ?? 80}%`, alarm.snooze_enabled ? `Snooze: ${alarm.snooze_duration || 5} min` : "Snooze off", alarm.is_mandatory ? "Mandatory" : null].filter(Boolean).join(" · "); return <tr key={alarm.id} style={{ borderTop: "1px solid rgba(148,163,184,.14)" }}><td style={{ padding: 12, color: "#f8fafc", fontWeight: 700 }}>{(alarm.alarm_role || "STANDARD").replaceAll("_", " ")}</td><td style={{ padding: 12 }}><span style={{ color: alarm.enabled === false ? "#fca5a5" : "#6ee7b7", background: alarm.enabled === false ? "rgba(239,68,68,.12)" : "rgba(16,185,129,.12)", borderRadius: 999, padding: "4px 9px", fontSize: 12, fontWeight: 700 }}>{alarm.enabled === false ? "Disabled" : "Enabled"}</span></td><td style={{ padding: 12, color: "#cbd5e1", fontSize: 13 }}>{config}</td><td style={{ padding: 12, color: "#94a3b8", fontSize: 13 }}>{fmt(alarm.created_at)}</td><td style={{ padding: 12, display: "flex", gap: 8 }}><button onClick={() => setAlarmConfigForm({ ...alarm, repeat_days: alarm.repeat_days || [] })}><Pencil size={15} /> Edit</button><button onClick={() => deleteAlarmConfiguration(alarm)} style={{ color: "#fca5a5" }}><Trash2 size={15} /> Delete</button></td></tr>; })}
            {!alarmsList.length && <tr><td colSpan={5} style={{ padding: 32, color: "#64748b", textAlign: "center" }}>No alarm configurations found.</td></tr>}
          </tbody></table></div>
        </section>
      )}

      {/* ALARMS MONITOR TAB */}
      {activeTab === "alarms" && false && (
        <section className="progress-card">
          <h2>Alarm Monitor</h2>
          <p style={{ color: "#94a3b8" }}>System-wide alarm tracking across all user accounts.</p>
          <div style={{ marginTop: 16, padding: 40, textAlign: "center", color: "#64748b" }}>
            <Bell size={48} style={{ margin: "0 auto 12px" }} />
            <p>Alarm monitoring dashboard — shows all registered user alarms in system.</p>
            <p style={{ fontSize: 13 }}>{stats.total_alarms} total alarms registered in the platform.</p>
          </div>
        </section>
      )}
    </AppShell>
  );
}

export default AdminDashboard;
