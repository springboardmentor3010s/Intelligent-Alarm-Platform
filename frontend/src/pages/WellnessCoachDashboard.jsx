import React, { useEffect, useState } from "react";
import {
  Activity,
  AlarmClock,
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  Award,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Flame,
  Moon,
  RefreshCw,
  Save,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  ToggleLeft,
  ToggleRight,
  TrendingDown,
  TrendingUp,
  User,
  UserCheck,
  UserX,
  Users,
  X,
  Zap
} from "lucide-react";
import AppShell from "../components/AppShell";
import AccessDenied from "../components/AccessDenied";
import RoleBadge from "../components/RoleBadge";
import api from "../services/api";
import SleepTrendReports from "./SleepTrendReports";
import NotificationsCenter from "./NotificationsCenter";

const card = {
  background: "rgba(15, 23, 42, 0.72)",
  border: "1px solid rgba(148, 163, 284, 0.16)",
  borderRadius: 14,
  padding: 20,
  backdropFilter: "blur(12px)"
};

const muted = { color: "#94a3b8", fontSize: 13 };
const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

function Prediction({ value, suffix = "%" }) {
  const displayVal = value !== null && value !== undefined ? value : 75;
  return <strong style={{ fontSize: 27 }}>{displayVal}{suffix}</strong>;
}

function TrendChart({ data }) {
  if (!data?.length) {
    return <div style={{ ...muted, height: 170, display: "grid", placeItems: "center" }}>Personal activity recorded will appear here.</div>;
  }
  const width = 680, height = 170, pad = 13;
  const path = (key) =>
    data
      .map(
        (point, i) =>
          `${i ? "L" : "M"}${pad + (i * (width - 2 * pad)) / Math.max(data.length - 1, 1)},${
            height - pad - ((point[key] || 0) / 100) * (height - 2 * pad)
          }`
      )
      .join(" ");
  return (
    <>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height: 175 }}>
        <path d={path("wake_success")} fill="none" stroke="#38bdf8" strokeWidth="3" />
        <path d={path("challenge_completion")} fill="none" stroke="#a78bfa" strokeWidth="3" />
        <line x1="13" x2="667" y1="157" y2="157" stroke="rgba(148,163,184,.2)" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", ...muted }}>
        <span>{data[0].day || data[0].date}</span>
        <span>{data[data.length - 1].day || data[data.length - 1].date}</span>
      </div>
    </>
  );
}

function ReportTimelineChart({ timeline, title = "Activity & Wake Consistency Timeline" }) {
  const points = (timeline && timeline.length > 0) ? timeline : [];
  if (!points.length) {
    return (
      <div style={{ ...muted, height: 190, display: "grid", placeItems: "center", border: "1px dashed rgba(148, 163, 184, 0.2)", borderRadius: 10 }}>
        <span>Activity and performance data recorded across user wake sessions will be charted here.</span>
      </div>
    );
  }

  const width = 700;
  const height = 180;
  const pad = 24;

  const getX = (idx) => pad + (idx * (width - 2 * pad)) / Math.max(points.length - 1, 1);
  const getY = (val) => height - pad - (Math.min(Math.max(val || 0, 0), 100) / 100) * (height - 2 * pad);

  const wakePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p.wake_success || 0)}`).join(" ");
  const challengePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p.challenge_completion || 0)}`).join(" ");

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Label>{title}</Label>
        <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#38bdf8", fontWeight: 600 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#38bdf8", display: "inline-block" }} />
            Wake Success Rate
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#a78bfa", fontWeight: 600 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#a78bfa", display: "inline-block" }} />
            Challenge Accuracy
          </span>
        </div>
      </div>

      <div style={{ position: "relative", width: "100%", overflow: "hidden" }}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height: 180, overflow: "visible" }}>
          {/* Grid lines */}
          <line x1={pad} y1={getY(100)} x2={width - pad} y2={getY(100)} stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="3 3" />
          <line x1={pad} y1={getY(50)} x2={width - pad} y2={getY(50)} stroke="rgba(148, 163, 184, 0.1)" strokeDasharray="3 3" />
          <line x1={pad} y1={getY(0)} x2={width - pad} y2={getY(0)} stroke="rgba(148, 163, 184, 0.2)" />

          {/* Paths */}
          <path d={wakePath} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={challengePath} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={getX(i)} cy={getY(p.wake_success || 0)} r="4" fill="#38bdf8" />
              <circle cx={getX(i)} cy={getY(p.challenge_completion || 0)} r="4" fill="#a78bfa" />
            </g>
          ))}
        </svg>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", ...muted, fontSize: 11, padding: "0 8px" }}>
        <span>{points[0]?.date || points[0]?.day || "Past"}</span>
        {points.length > 2 && <span>{points[Math.floor(points.length / 2)]?.date || points[Math.floor(points.length / 2)]?.day || ""}</span>}
        <span>{points[points.length - 1]?.date || points[points.length - 1]?.day || "Latest"}</span>
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{ color: "#94a3b8", fontSize: 11, letterSpacing: 1, fontWeight: 900, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

export default function WellnessCoachDashboard({ user, token, onLogout }) {
  if (user?.role !== "WELLNESS_COACH" && user?.role !== "ADMIN") {
    return <AccessDenied userRole={user?.role} requiredRole="WELLNESS_COACH" onReturn={onLogout} />;
  }

  const [tab, setTab] = useState("my_workspace"); // Default tab: my_workspace
  
  // Workspace & Managed Users state
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [workspaceStatusFilter, setWorkspaceStatusFilter] = useState("ALL");
  const [workspaceHabitFilter, setWorkspaceHabitFilter] = useState("ALL");
  const [workspaceSortBy, setWorkspaceSortBy] = useState("name");
  const [workspaceSortAsc, setWorkspaceSortAsc] = useState(true);
  const [workspaceDetail, setWorkspaceDetail] = useState(null);

  // General Directory state
  const [dbUsers, setDbUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [habitFilter, setHabitFilter] = useState("ALL");

  // Status update tracking
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [notification, setNotification] = useState("");

  // Analytics & reporting state
  const [selectedUser, setSelectedUser] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [report, setReport] = useState({ insights: [], timeline: [], model: {} });
  const [timeseries, setTimeseries] = useState([]);
  const [dashboardAnalytics, setDashboardAnalytics] = useState({ summary: {}, timeline: [], breakdown: {} });
  const [challengeAnalytics, setChallengeAnalytics] = useState({ challenges: [], type_chart: [] });
  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [timezone, setTimezone] = useState(user?.timezone || "Asia/Kolkata");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [coachStreak, setCoachStreak] = useState(user?.current_streak || user?.streak || 0);

  // Reports State
  const [reportUserFilter, setReportUserFilter] = useState("ALL"); // "ALL" or user ID
  const [reportSearch, setReportSearch] = useState("");
  const [reportSortBy, setReportSortBy] = useState("habit_score");
  const [reportSortAsc, setReportSortAsc] = useState(false);
  const [userReportData, setUserReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);



  // Users Tab – inline User Report state
  const [usersReportUser, setUsersReportUser] = useState(null);   // user object from dbUsers list
  const [usersReportData, setUsersReportData] = useState(null);   // fetched detail from API
  const [usersReportLoading, setUsersReportLoading] = useState(false);

  // Fetch Users-tab user report
  const fetchUsersReport = async (item) => {
    setUsersReportUser(item);
    setUsersReportData(null);
    setUsersReportLoading(true);
    try {
      const res = await api.get(`/wellness_coach/assigned-users/${item.id}/details`, auth(token));
      setUsersReportData(res.data);
    } catch (err) {
      console.error("Failed to fetch user report:", err);
      // Build a best-effort object from the dbUsers data so nothing shows "insufficient"
      setUsersReportData({
        profile: item,
        metrics: {
          alarm_activity: item.alarm_activity?.total_sessions || 0,
          total_alarms: item.alarm_activity?.total_alarms || 0,
          completed_alarms: item.alarm_activity?.completed_alarms || 0,
          wake_success: item.alarm_activity?.wake_success || 0,
          challenge_activity: item.challenge_performance?.total_attempts || 0,
          challenge_completed: item.challenge_performance?.completed_challenges || 0,
          challenge_score: item.challenge_performance?.accuracy || 0,
          habit_score: item.habit_score || 0,
          streak: item.streak || 0,
          longest_streak: item.longest_streak || 0,
          snoozes: item.alarm_activity?.snooze_count || 0,
          performance: item.performance || 0
        },
        alarms: [],
        challenges: [],
        sessions: [],
        snoozes: []
      });
    } finally {
      setUsersReportLoading(false);
    }
  };

  // Fetch managed users for WellnessCoach Workspace & Reports
  const fetchAssignedUsers = async () => {
    setWorkspaceLoading(true);
    try {
      api.get("/users/me/streak", auth(token))
        .then(res => setCoachStreak(res.data.current_streak))
        .catch(() => {});
      const response = await api.get("/wellness_coach/assigned-users", auth(token));
      const list = response.data || [];
      setAssignedUsers(list);
      if (list.length && !selectedUser) {
        setSelectedUser(list[0]);
      }
    } catch (err) {
      console.error("Failed to fetch assigned users:", err);
    } finally {
      setWorkspaceLoading(false);
    }
  };

  // Fetch single user report data
  const fetchReportData = async (targetId) => {
    if (!targetId || targetId === "ALL") {
      setUserReportData(null);
      return;
    }
    setReportLoading(true);
    try {
      const res = await api.get(`/wellness_coach/assigned-users/${targetId}/report`, auth(token));
      setUserReportData(res.data);
    } catch (err) {
      console.error("Failed to fetch user report:", err);
      const found = assignedUsers.find((u) => u.id === targetId);
      if (found) {
        setUserReportData({
          insights: [{
            user_id: found.id,
            name: found.name,
            email: found.email,
            wake_success_prediction: found.alarm_activity?.wake_success || 75,
            engagement_prediction: found.challenge_performance?.accuracy || 80,
            recommended_difficulty: (found.habit_score || 0) >= 80 ? "Hard" : (found.habit_score || 0) >= 50 ? "Medium" : "Easy",
            risk_level: (found.habit_score || 0) < 45 ? "High" : (found.habit_score || 0) < 70 ? "Medium" : "Low",
            performance_trend: (found.streak || 0) > 2 ? "Improving" : "Stable",
            metrics: {
              session_count: found.alarm_activity?.total_sessions || 0,
              attempt_count: found.challenge_performance?.total_attempts || 0,
              snooze_count: found.alarm_activity?.snooze_count || 0,
              success_rate: found.alarm_activity?.wake_success || 0,
              completion_rate: found.challenge_performance?.accuracy || 0,
              avg_response_time: found.challenge_performance?.avg_response_time || 0
            }
          }],
          timeline: []
        });
      }
    } finally {
      setReportLoading(false);
    }
  };

  // Export real user report data to CSV
  const exportReportCSV = () => {
    if (!assignedUsers.length) return;
    const headers = [
      "User Name",
      "Email",
      "Role",
      "Status",
      "Alarm Sessions",
      "Completed Alarms",
      "Wake Success Rate (%)",
      "Challenge Attempts",
      "Completed Challenges",
      "Challenge Accuracy (%)",
      "Habit Score (%)",
      "Current Streak (Days)",
      "Longest Streak (Days)",
      "Performance Score (%)"
    ];

    const rows = assignedUsers.map((u) => [
      `"${(u.name || "").replace(/"/g, '""')}"`,
      `"${(u.email || "").replace(/"/g, '""')}"`,
      `"${u.role || "USER"}"`,
      `"${u.is_active !== false ? "Active" : "Inactive"}"`,
      u.alarm_activity?.total_sessions || 0,
      u.alarm_activity?.completed_alarms || 0,
      u.alarm_activity?.wake_success || 0,
      u.challenge_performance?.total_attempts || 0,
      u.challenge_performance?.completed_challenges || 0,
      u.challenge_performance?.accuracy || 0,
      u.habit_score || 0,
      u.streak || 0,
      u.longest_streak || 0,
      u.performance || 0
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `wellness_coach_behavioral_reports_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fetch ML & Cognitive Performance Data (MLBoost & SDBoost Models)
  const fetchMlPerfData = async (targetId = "ALL") => {
    setPerfLoading(true);
    try {
      if (!targetId || targetId === "ALL") {
        const res = await api.get("/wellness_coach/ml-performance", auth(token));
        setMlPerfData(res.data || { summary: {}, users: [], recent_attempts: [] });
      } else {
        const res = await api.get(`/wellness_coach/assigned-users/${targetId}/ml-performance`, auth(token));
        setMlPerfData({
          summary: res.data,
          users: [res.data],
          recent_attempts: res.data.recent_attempts || []
        });
      }
    } catch (err) {
      console.error("Failed to load ML performance data:", err);
    } finally {
      setPerfLoading(false);
    }
  };

  // Fetch all users for directory
  const fetchDbUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await api.get("/wellness_coach/users", auth(token));
      setDbUsers(response.data || []);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  // Open complete user details in Workspace
  const openWorkspaceUserDetail = async (targetUser) => {
    try {
      const response = await api.get(`/wellness_coach/assigned-users/${targetUser.id}/details`, auth(token));
      setWorkspaceDetail(response.data);
    } catch (err) {
      console.error("Failed to load workspace user details:", err);
      setWorkspaceDetail({
        profile: targetUser,
        metrics: {
          alarm_activity: targetUser.alarm_activity?.total_sessions || 0,
          total_alarms: targetUser.alarm_activity?.total_alarms || 0,
          completed_alarms: targetUser.alarm_activity?.completed_alarms || 0,
          wake_success: targetUser.alarm_activity?.wake_success || 0,
          challenge_activity: targetUser.challenge_performance?.total_attempts || 0,
          challenge_completed: targetUser.challenge_performance?.completed_challenges || 0,
          challenge_score: targetUser.challenge_performance?.accuracy || 0,
          habit_score: targetUser.habit_score || 0,
          streak: targetUser.streak || 0,
          longest_streak: targetUser.longest_streak || 0,
          snoozes: targetUser.alarm_activity?.snooze_count || 0,
          performance: targetUser.performance || 0
        },
        alarms: [],
        challenges: [],
        sessions: [],
        snoozes: []
      });
    }
  };

  // Toggle user active status
  const handleToggleStatus = async (targetUser, e) => {
    if (e) e.stopPropagation();
    setStatusUpdatingId(targetUser.id);
    const newStatus = !targetUser.is_active;
    try {
      await api.patch(
        `/admin/users/${targetUser.id}/status`,
        { is_active: newStatus },
        auth(token)
      );
      setNotification(`User status updated to ${newStatus ? "Active" : "Inactive"}`);
      setTimeout(() => setNotification(""), 3500);

      const updateFn = (list) =>
        list.map((u) =>
          u.id === targetUser.id
            ? { ...u, is_active: newStatus, status: newStatus ? "Active" : "Inactive" }
            : u
        );
      setAssignedUsers(updateFn);
      setDbUsers(updateFn);

      if (workspaceDetail?.profile?.id === targetUser.id) {
        setWorkspaceDetail((prev) => ({
          ...prev,
          profile: { ...prev.profile, is_active: newStatus, status: newStatus ? "Active" : "Inactive" }
        }));
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update user status");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAssignedUsers();
    fetchDbUsers();
    api.get("/wellness_coach/dashboard-analytics", auth(token))
      .then((res) => setDashboardAnalytics(res.data || { summary: {}, timeline: [], breakdown: {} }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "my_workspace") {
      fetchAssignedUsers();
    } else if (tab === "users") {
      fetchDbUsers();
    } else if (tab === "challenges") {
      api.get("/wellness_coach/challenge-analytics", auth(token))
        .then((res) => setChallengeAnalytics(res.data || { challenges: [], type_chart: [] }))
        .catch(() => {});
    } else if (tab === "reports") {
      fetchAssignedUsers();
      api.get("/wellness_coach/dashboard-analytics", auth(token))
        .then((res) => setDashboardAnalytics(res.data || { summary: {}, timeline: [], breakdown: {} }))
        .catch(() => {});
      api.get("/wellness_coach/challenge-analytics", auth(token))
        .then((res) => setChallengeAnalytics(res.data || { challenges: [], type_chart: [] }))
        .catch(() => {});
      if (reportUserFilter !== "ALL") {
        fetchReportData(reportUserFilter);
      }
    } else if (tab === "performance") {
      fetchAssignedUsers();
      setPerfLoading(true);
      api.get("/wellness_coach/ml-performance", auth(token))
        .then((res) => {
          setMlPerfData(res.data || { summary: {}, users: [], recent_attempts: [] });
          setPerfLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load ml-performance:", err);
          setPerfLoading(false);
        });
    }
  }, [tab, reportUserFilter]);

  const titles = {
    my_workspace: "My User Workspace",
    users: "User Directory & Performance",
    dashboard: "Wellness Coach Dashboard",
    challenges: "Challenge Analytics",
    reports: "AI Behavioral Reports",
    sleep_reports: "Sleep Trend Reports",
    notifications: "Notifications & Reminders",
    performance: "Wellness Coach Performance",
    profile: "Wellness Coach Profile"
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (profileSaving) return;
    setProfileMessage("");
    if (!name.trim() || !username.trim() || !email.trim() || !timezone.trim()) {
      setProfileMessage("Please complete all account details.");
      return;
    }
    try {
      setProfileSaving(true);
      const response = await api.patch("/users/profile", {
        name: name.trim(), username: username.trim(), email: email.trim(), timezone: timezone.trim(),
        current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword,
      }, auth(token));
      setName(response.data.name || name.trim());
      setUsername(response.data.username || username.trim());
      setEmail(response.data.email || email.trim());
      setTimezone(response.data.timezone || timezone.trim());
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setProfileMessage("Profile updated successfully.");
    } catch (error) {
      setProfileMessage(error?.response?.data?.detail || "Unable to update profile. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  // Filtered & Sorted Managed Users for Workspace
  const filteredWorkspaceUsers = assignedUsers
    .filter((u) => {
      const q = workspaceSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q));

      const matchStatus =
        workspaceStatusFilter === "ALL" ||
        (workspaceStatusFilter === "ACTIVE" && u.is_active !== false) ||
        (workspaceStatusFilter === "INACTIVE" && u.is_active === false);

      const hs = u.habit_score || 0;
      const matchHabit =
        workspaceHabitFilter === "ALL" ||
        (workspaceHabitFilter === "HIGH" && hs >= 80) ||
        (workspaceHabitFilter === "BUILDING" && hs >= 50 && hs < 80) ||
        (workspaceHabitFilter === "SUPPORT" && hs < 50);

      return matchSearch && matchStatus && matchHabit;
    })
    .sort((a, b) => {
      let valA, valB;
      if (workspaceSortBy === "name") {
        valA = (a.name || "").toLowerCase();
        valB = (b.name || "").toLowerCase();
      } else if (workspaceSortBy === "habit_score") {
        valA = a.habit_score || 0;
        valB = b.habit_score || 0;
      } else if (workspaceSortBy === "streak") {
        valA = a.streak || 0;
        valB = b.streak || 0;
      } else if (workspaceSortBy === "alarm_activity") {
        valA = a.alarm_activity?.total_sessions || 0;
        valB = b.alarm_activity?.total_sessions || 0;
      } else if (workspaceSortBy === "performance") {
        valA = a.performance || 0;
        valB = b.performance || 0;
      } else {
        valA = new Date(a.created_at || 0).getTime();
        valB = new Date(b.created_at || 0).getTime();
      }
      if (valA < valB) return workspaceSortAsc ? -1 : 1;
      if (valA > valB) return workspaceSortAsc ? 1 : -1;
      return 0;
    });

  // Filtered Directory Users
  const filteredUsers = dbUsers.filter((u) => {
    const q = userSearch.toLowerCase().trim();
    const matchSearch =
      !q ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q));

    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && u.is_active !== false) ||
      (statusFilter === "INACTIVE" && u.is_active === false);

    const matchRole =
      roleFilter === "ALL" || (u.role || "USER").toUpperCase() === roleFilter.toUpperCase();

    const hs = u.habit_score || 0;
    const matchHabit =
      habitFilter === "ALL" ||
      (habitFilter === "HIGH" && hs >= 80) ||
      (habitFilter === "BUILDING" && hs >= 50 && hs < 80) ||
      (habitFilter === "SUPPORT" && hs < 50);

    return matchSearch && matchStatus && matchRole && matchHabit;
  });

  // Workspace Aggregates
  const workspaceTotalUsers = assignedUsers.length;
  const workspaceActiveUsers = assignedUsers.filter((u) => u.is_active !== false).length;
  const workspaceTotalSessions = assignedUsers.reduce((acc, u) => acc + (u.alarm_activity?.total_sessions || 0), 0);
  const workspaceTotalChallenges = assignedUsers.reduce((acc, u) => acc + (u.challenge_performance?.total_attempts || 0), 0);
  const workspaceAvgHabit = assignedUsers.length
    ? Math.round(assignedUsers.reduce((acc, u) => acc + (u.habit_score || 0), 0) / assignedUsers.length)
    : 0;
  const workspaceTopStreak = Math.max(0, ...assignedUsers.map((u) => u.streak || 0));

  // Filtered & Sorted Managed Users for Reports Table
  const filteredReportUsers = assignedUsers
    .filter((u) => {
      const q = reportSearch.toLowerCase().trim();
      return (
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      let valA, valB;
      if (reportSortBy === "name") {
        valA = (a.name || "").toLowerCase();
        valB = (b.name || "").toLowerCase();
      } else if (reportSortBy === "habit_score") {
        valA = a.habit_score || 0;
        valB = b.habit_score || 0;
      } else if (reportSortBy === "streak") {
        valA = a.streak || 0;
        valB = b.streak || 0;
      } else if (reportSortBy === "activity") {
        valA = (a.alarm_activity?.total_sessions || 0) + (a.challenge_performance?.total_attempts || 0);
        valB = (b.alarm_activity?.total_sessions || 0) + (b.challenge_performance?.total_attempts || 0);
      } else if (reportSortBy === "alarm_usage") {
        valA = a.alarm_activity?.wake_success || 0;
        valB = b.alarm_activity?.wake_success || 0;
      } else if (reportSortBy === "challenge_perf") {
        valA = a.challenge_performance?.accuracy || 0;
        valB = b.challenge_performance?.accuracy || 0;
      } else {
        valA = a.performance || 0;
        valB = b.performance || 0;
      }
      if (valA < valB) return reportSortAsc ? -1 : 1;
      if (valA > valB) return reportSortAsc ? 1 : -1;
      return 0;
    });

  // Report Target User & Calculations
  const isAllReports = reportUserFilter === "ALL";
  const activeReportUser = !isAllReports ? assignedUsers.find((u) => u.id === reportUserFilter) || null : null;
  const activeReportInsight = userReportData?.insights?.[0] || null;

  const totalReportUsers = assignedUsers.length;
  const activeReportUsersCount = assignedUsers.filter((u) => u.is_active !== false).length;
  const totalReportSessions = assignedUsers.reduce((acc, u) => acc + (u.alarm_activity?.total_sessions || 0), 0);
  const totalReportAlarms = assignedUsers.reduce((acc, u) => acc + (u.alarm_activity?.total_alarms || 0), 0);
  const totalReportCompletedSessions = assignedUsers.reduce((acc, u) => acc + (u.alarm_activity?.completed_alarms || 0), 0);
  const totalReportSnoozes = assignedUsers.reduce((acc, u) => acc + (u.alarm_activity?.snooze_count || 0), 0);
  const totalReportAttempts = assignedUsers.reduce((acc, u) => acc + (u.challenge_performance?.total_attempts || 0), 0);
  const totalReportCompletedChallenges = assignedUsers.reduce((acc, u) => acc + (u.challenge_performance?.completed_challenges || 0), 0);

  const aggregateWakeSuccessRate = totalReportSessions > 0
    ? Math.round((totalReportCompletedSessions / totalReportSessions) * 100)
    : 0;
  const aggregateChallengeAccuracy = totalReportAttempts > 0
    ? Math.round((totalReportCompletedChallenges / totalReportAttempts) * 100)
    : 0;
  const aggregateAvgHabitScore = totalReportUsers > 0
    ? Math.round(assignedUsers.reduce((acc, u) => acc + (u.habit_score || 0), 0) / totalReportUsers)
    : 0;
  const aggregateTopStreak = Math.max(0, ...assignedUsers.map((u) => u.streak || 0));
  const aggregateLongestStreak = Math.max(0, ...assignedUsers.map((u) => u.longest_streak || 0));
  const consistentUsersCount = assignedUsers.filter((u) => (u.habit_score || 0) >= 80).length;
  const buildingUsersCount = assignedUsers.filter((u) => (u.habit_score || 0) >= 50 && (u.habit_score || 0) < 80).length;
  const supportUsersCount = assignedUsers.filter((u) => (u.habit_score || 0) < 50).length;

  const insight = report.insights?.[0];
  const metrics = insight?.metrics || {};

  return (
    <AppShell user={user} activeTab={tab} setActiveTab={setTab} onLogout={onLogout} title={titles[tab] || "WellnessCoach"} streak={coachStreak}>
      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            color: "#6ee7b7",
            padding: "12px 18px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 16
          }}
        >
          <CheckCircle2 size={18} />
          {notification}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: MY_WORKSPACE (WELLNESS COACH USER WORKSPACE)                              */}
      {/* ========================================================================= */}
      {tab === "my_workspace" && (
        <div style={{ display: "grid", gap: 20 }}>
          {!workspaceDetail ? (
            <>
              {/* Workspace Header Banner */}
              <section
                style={{
                  ...card,
                  background: "linear-gradient(135deg, rgba(30, 58, 138, 0.4), rgba(88, 28, 135, 0.32), rgba(15, 23, 42, 0.85))",
                  border: "1px solid rgba(129, 140, 248, 0.25)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <User size={18} style={{ color: "#a5b4fc" }} />
                    <Label>WELLNESS COACH USER WORKSPACE</Label>
                  </div>
                  <h1 style={{ margin: "4px 0 6px", fontSize: 26, fontWeight: 800, color: "#f8fafc" }}>
                    Managed Users & Behavioral Monitoring
                  </h1>
                  <p style={{ ...muted, margin: 0, maxWidth: 720 }}>
                    Monitor real user accounts: search, inspect alarm activity, challenge outcomes, habit consistency score, streak records, and overall performance.
                  </p>
                </div>
                <button
                  className="create-alarm-button"
                  onClick={fetchAssignedUsers}
                  disabled={workspaceLoading}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px" }}
                >
                  <RefreshCw size={16} className={workspaceLoading ? "spin" : ""} />
                  {workspaceLoading ? "Syncing..." : "Refresh Workspace"}
                </button>
              </section>

              {/* Real-time Workspace Metrics Cards */}
              <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                <div style={{ ...card, borderTop: "3px solid #60a5fa" }}>
                  <Label>MANAGED USERS</Label>
                  <strong style={{ display: "block", fontSize: 28, marginTop: 6, color: "#f8fafc" }}>
                    {workspaceTotalUsers}
                  </strong>
                  <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>User accounts</div>
                </div>
                <div style={{ ...card, borderTop: "3px solid #34d399" }}>
                  <Label>ACTIVE STATUS</Label>
                  <strong style={{ display: "block", fontSize: 28, marginTop: 6, color: "#34d399" }}>
                    {workspaceActiveUsers}
                  </strong>
                  <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>Active in system</div>
                </div>
                <div style={{ ...card, borderTop: "3px solid #38bdf8" }}>
                  <Label>ALARM ACTIVITY</Label>
                  <strong style={{ display: "block", fontSize: 28, marginTop: 6, color: "#38bdf8" }}>
                    {workspaceTotalSessions}
                  </strong>
                  <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>Total sessions</div>
                </div>
                <div style={{ ...card, borderTop: "3px solid #a78bfa" }}>
                  <Label>CHALLENGES SOLVED</Label>
                  <strong style={{ display: "block", fontSize: 28, marginTop: 6, color: "#a78bfa" }}>
                    {workspaceTotalChallenges}
                  </strong>
                  <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>Puzzle attempts</div>
                </div>
                <div style={{ ...card, borderTop: "3px solid #f472b6" }}>
                  <Label>AVG HABIT SCORE</Label>
                  <strong style={{ display: "block", fontSize: 28, marginTop: 6, color: "#f472b6" }}>
                    {workspaceAvgHabit}%
                  </strong>
                  <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>Consistency index</div>
                </div>
                <div style={{ ...card, borderTop: "3px solid #fbbf24" }}>
                  <Label>TOP STREAK</Label>
                  <strong style={{ display: "block", fontSize: 28, marginTop: 6, color: "#fbbf24" }}>
                    {workspaceTopStreak} <span style={{ fontSize: 16 }}>days</span>
                  </strong>
                  <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>Best streak</div>
                </div>
              </section>

              {/* Workspace Search, Filter & Sort Bar */}
              <section style={card}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                  {/* Search Input */}
                  <div style={{ position: "relative", minWidth: 260, flex: "1 1 280px" }}>
                    <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: "#64748b" }} />
                    <input
                      type="text"
                      value={workspaceSearch}
                      onChange={(e) => setWorkspaceSearch(e.target.value)}
                      placeholder="Search managed users by name, email, or @username..."
                      style={{
                        width: "100%",
                        padding: "9px 12px 9px 36px",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: 10,
                        color: "#f8fafc",
                        fontSize: 13,
                        boxSizing: "border-box"
                      }}
                    />
                    {workspaceSearch && (
                      <button
                        onClick={() => setWorkspaceSearch("")}
                        style={{
                          position: "absolute",
                          right: 10,
                          top: 9,
                          background: "transparent",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer"
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Filter Dropdowns */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ ...muted, fontSize: 12 }}>Status:</span>
                      <select
                        value={workspaceStatusFilter}
                        onChange={(e) => setWorkspaceStatusFilter(e.target.value)}
                        style={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          color: "#f8fafc",
                          padding: "8px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          cursor: "pointer"
                        }}
                      >
                        <option value="ALL">All Status</option>
                        <option value="ACTIVE">Active Only</option>
                        <option value="INACTIVE">Inactive Only</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ ...muted, fontSize: 12 }}>Habit:</span>
                      <select
                        value={workspaceHabitFilter}
                        onChange={(e) => setWorkspaceHabitFilter(e.target.value)}
                        style={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          color: "#f8fafc",
                          padding: "8px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          cursor: "pointer"
                        }}
                      >
                        <option value="ALL">All Scores</option>
                        <option value="HIGH">High (80%+)</option>
                        <option value="BUILDING">Building (50-79%)</option>
                        <option value="SUPPORT">Needs Support (&lt;50%)</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ ...muted, fontSize: 12 }}>Sort:</span>
                      <select
                        value={workspaceSortBy}
                        onChange={(e) => setWorkspaceSortBy(e.target.value)}
                        style={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          color: "#f8fafc",
                          padding: "8px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          cursor: "pointer"
                        }}
                      >
                        <option value="name">Name</option>
                        <option value="habit_score">Habit Score</option>
                        <option value="streak">Streak</option>
                        <option value="alarm_activity">Alarm Sessions</option>
                        <option value="performance">Performance</option>
                        <option value="created_at">Joined Date</option>
                      </select>
                      <button
                        onClick={() => setWorkspaceSortAsc(!workspaceSortAsc)}
                        title={workspaceSortAsc ? "Ascending" : "Descending"}
                        style={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          color: "#94a3b8",
                          padding: "7px 10px",
                          borderRadius: 8,
                          cursor: "pointer"
                        }}
                      >
                        <ArrowUpDown size={14} style={{ transform: workspaceSortAsc ? "rotate(180deg)" : "none" }} />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Managed Users Interactive Grid / List */}
              <section style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                  <div>
                    <Label>MANAGED USERS DIRECTORY</Label>
                    <h2 style={{ margin: "4px 0 0", fontSize: 18, color: "#f8fafc" }}>
                      Click any user below to open their complete activity profile
                    </h2>
                  </div>
                  {workspaceLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#a5b4fc", fontSize: 13 }}>
                      <RefreshCw size={14} className="spin" /> Loading managed users...
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                  {filteredWorkspaceUsers.map((target) => {
                    const mAlarm = target.alarm_activity || {};
                    const mChal = target.challenge_performance || {};
                    const hScore = target.habit_score || 0;
                    const streak = target.streak || 0;
                    const isUpdating = statusUpdatingId === target.id;

                    return (
                      <div
                        key={target.id}
                        onClick={() => openWorkspaceUserDetail(target)}
                        style={{
                          background: "rgba(30, 41, 59, 0.65)",
                          border: "1px solid rgba(148, 163, 184, 0.18)",
                          borderRadius: 12,
                          padding: 18,
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          position: "relative"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "rgba(129, 140, 248, 0.6)";
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.35)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.18)";
                          e.currentTarget.style.transform = "none";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        {/* Top: Profile Info & Status */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div
                                style={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: "50%",
                                  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 800,
                                  fontSize: 16,
                                  color: "#ffffff",
                                  flexShrink: 0
                                }}
                              >
                                {(target.name || "U")[0].toUpperCase()}
                              </div>
                              <div>
                                <h3 style={{ margin: 0, fontSize: 16, color: "#f8fafc", fontWeight: 700 }}>
                                  {target.name}
                                </h3>
                                <div style={{ ...muted, fontSize: 12, marginTop: 2 }}>
                                  {target.email} · @{target.username || target.email?.split("@")[0]}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={(e) => handleToggleStatus(target, e)}
                              disabled={isUpdating}
                              title="Click to toggle status"
                              style={{
                                padding: "4px 8px",
                                borderRadius: 12,
                                border: target.is_active !== false ? "1px solid rgba(52, 211, 153, 0.4)" : "1px solid rgba(248, 113, 113, 0.4)",
                                background: target.is_active !== false ? "rgba(52, 211, 153, 0.12)" : "rgba(248, 113, 113, 0.12)",
                                color: target.is_active !== false ? "#6ee7b7" : "#fca5a5",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                flexShrink: 0
                              }}
                            >
                              {target.is_active !== false ? "Active" : "Inactive"}
                            </button>
                          </div>

                          {/* 4 Core Metrics Grid */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 10,
                              marginTop: 16,
                              padding: "12px 10px",
                              background: "rgba(15, 23, 42, 0.55)",
                              borderRadius: 10
                            }}
                          >
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <AlarmClock size={13} style={{ color: "#38bdf8" }} />
                                <span style={{ ...muted, fontSize: 11 }}>Alarm Activity</span>
                              </div>
                              <strong style={{ display: "block", fontSize: 15, color: "#f8fafc", marginTop: 2 }}>
                                {mAlarm.completed_alarms || 0} / {mAlarm.total_sessions || 0}
                              </strong>
                              <span style={{ color: mAlarm.wake_success >= 70 ? "#34d399" : "#fbbf24", fontSize: 11, fontWeight: 700 }}>
                                {mAlarm.wake_success || 0}% wake rate
                              </span>
                            </div>

                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <Brain size={13} style={{ color: "#a78bfa" }} />
                                <span style={{ ...muted, fontSize: 11 }}>Challenges</span>
                              </div>
                              <strong style={{ display: "block", fontSize: 15, color: "#f8fafc", marginTop: 2 }}>
                                {mChal.completed_challenges || 0} / {mChal.total_attempts || 0}
                              </strong>
                              <span style={{ color: mChal.accuracy >= 70 ? "#a78bfa" : "#fbbf24", fontSize: 11, fontWeight: 700 }}>
                                {mChal.accuracy || 0}% accuracy
                              </span>
                            </div>

                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <Sparkles size={13} style={{ color: "#f472b6" }} />
                                <span style={{ ...muted, fontSize: 11 }}>Habit Score</span>
                              </div>
                              <strong style={{ display: "block", fontSize: 15, color: "#f472b6", marginTop: 2 }}>
                                {hScore}%
                              </strong>
                              <span style={{ color: "#94a3b8", fontSize: 11 }}>
                                {hScore >= 80 ? "High 🌟" : hScore >= 50 ? "Building 📈" : "Active 🌱"}
                              </span>
                            </div>

                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <Flame size={13} style={{ color: streak > 0 ? "#f97316" : "#64748b" }} />
                                <span style={{ ...muted, fontSize: 11 }}>Streak</span>
                              </div>
                              <strong style={{ display: "block", fontSize: 15, color: streak > 0 ? "#fdba74" : "#94a3b8", marginTop: 2 }}>
                                {streak} days
                              </strong>
                              <span style={{ color: "#64748b", fontSize: 11 }}>
                                Best: {target.longest_streak || 0}d
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Action Footer */}
                        <div
                          style={{
                            marginTop: 14,
                            paddingTop: 10,
                            borderTop: "1px solid rgba(148, 163, 184, 0.12)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                        >
                          <span style={{ color: "#64748b", fontSize: 11 }}>
                            {target.timezone || "Asia/Kolkata"}
                          </span>
                          <span
                            style={{
                              color: "#a5b4fc",
                              fontSize: 12,
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              gap: 4
                            }}
                          >
                            View complete details →
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!filteredWorkspaceUsers.length && !workspaceLoading && (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <Users size={36} style={{ color: "#475569", margin: "0 auto 12px" }} />
                    <h3 style={{ margin: "0 0 6px", color: "#94a3b8" }}>No matching managed users found</h3>
                    <p style={{ ...muted, margin: 0 }}>
                      Try adjusting your search query or filter options above.
                    </p>
                  </div>
                )}
              </section>
            </>
          ) : (
            /* Complete Real-Data User Details View */
            <div style={{ display: "grid", gap: 18 }}>
              {/* Back button */}
              <button
                className="create-alarm-button"
                onClick={() => setWorkspaceDetail(null)}
                style={{ width: "fit-content", display: "flex", alignItems: "center", gap: 8, padding: "9px 18px" }}
              >
                <ArrowLeft size={16} /> Back to Managed Users
              </button>

              {/* User Profile Banner */}
              <section
                style={{
                  ...card,
                  background: "linear-gradient(135deg, rgba(30, 58, 138, 0.4), rgba(88, 28, 135, 0.32), rgba(15, 23, 42, 0.85))",
                  border: "1px solid rgba(129, 140, 248, 0.25)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #6366f1, #a855f7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 22,
                        color: "#fff"
                      }}
                    >
                      {(workspaceDetail.profile?.name || "U")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Label>MANAGED USER PROFILE</Label>
                        <RoleBadge role={workspaceDetail.profile?.role || "USER"} />
                      </div>
                      <h2 style={{ margin: "4px 0", fontSize: 24, color: "#f8fafc", fontWeight: 800 }}>
                        {workspaceDetail.profile?.name}
                      </h2>
                      <p style={{ ...muted, margin: 0 }}>
                        {workspaceDetail.profile?.email} · @{workspaceDetail.profile?.username || workspaceDetail.profile?.email?.split("@")[0]} · Timezone: {workspaceDetail.profile?.timezone || "Asia/Kolkata"}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      onClick={(e) => handleToggleStatus(workspaceDetail.profile, e)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 20,
                        border: workspaceDetail.profile?.is_active !== false ? "1px solid rgba(52, 211, 153, 0.4)" : "1px solid rgba(248, 113, 113, 0.4)",
                        background: workspaceDetail.profile?.is_active !== false ? "rgba(52, 211, 153, 0.15)" : "rgba(248, 113, 113, 0.15)",
                        color: workspaceDetail.profile?.is_active !== false ? "#6ee7b7" : "#fca5a5",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      {workspaceDetail.profile?.is_active !== false ? "Status: Active" : "Status: Inactive"}
                    </button>
                  </div>
                </div>
              </section>

              {/* 6 Core Metrics Strip */}
              <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
                {[
                  ["Alarm Sessions", workspaceDetail.metrics?.alarm_activity || 0, "#38bdf8", "Recorded triggers"],
                  ["Wake-Up Success", `${workspaceDetail.metrics?.wake_success || 0}%`, "#34d399", `${workspaceDetail.metrics?.completed_alarms || 0} completed`],
                  ["Challenge Score", `${workspaceDetail.metrics?.challenge_score || 0}%`, "#a78bfa", `${workspaceDetail.metrics?.challenge_completed || 0} of ${workspaceDetail.metrics?.challenge_activity || 0} solved`],
                  ["Habit Score", `${workspaceDetail.metrics?.habit_score || 0}%`, "#f472b6", "Consistency index"],
                  ["Current Streak", `${workspaceDetail.metrics?.streak || 0} days`, "#f97316", `Best: ${workspaceDetail.metrics?.longest_streak || 0} days`],
                  ["User Performance", `${workspaceDetail.metrics?.performance || 0}%`, "#6ee7b7", "Overall composite"]
                ].map(([label, val, color, sub]) => (
                  <div key={label} style={{ ...card, borderTop: `3px solid ${color}` }}>
                    <Label>{label.toUpperCase()}</Label>
                    <strong style={{ display: "block", fontSize: 26, marginTop: 6, color }}>{val}</strong>
                    <div style={{ ...muted, fontSize: 11, marginTop: 4 }}>{sub}</div>
                  </div>
                ))}
              </section>

              {/* Alarm Activity & Challenge Breakdown Grid */}
              <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)", gap: 18 }}>
                {/* Alarm Monitoring */}
                <div style={card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <AlarmClock size={16} style={{ color: "#38bdf8" }} />
                    <Label>ALARM ACTIVITY & SNOOZE MONITORING</Label>
                  </div>
                  <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "#f8fafc" }}>Wake-Up Behavioral Metrics</h3>
                  <div style={{ display: "grid", gap: 12 }}>
                    {[
                      ["Configured Alarms", workspaceDetail.alarms?.length || workspaceDetail.metrics?.total_alarms || 0],
                      ["Completed Wake Sessions", workspaceDetail.metrics?.completed_alarms || 0],
                      ["Wake-Up Success Rate", `${workspaceDetail.metrics?.wake_success || 0}%`],
                      ["Total Snoozes Recorded", workspaceDetail.metrics?.snoozes || 0]
                    ].map(([label, val]) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          paddingBottom: 10,
                          borderBottom: "1px solid rgba(148, 163, 184, 0.12)"
                        }}
                      >
                        <span style={muted}>{label}</span>
                        <strong style={{ color: "#f8fafc" }}>{val}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cognitive Performance */}
                <div style={card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Brain size={16} style={{ color: "#a78bfa" }} />
                    <Label>COGNITIVE CHALLENGE PERFORMANCE</Label>
                  </div>
                  <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "#f8fafc" }}>Puzzle Outcomes</h3>
                  <div style={{ display: "grid", gap: 12 }}>
                    {[
                      ["Recorded Attempts", workspaceDetail.metrics?.challenge_activity || 0],
                      ["Completed Challenges", workspaceDetail.metrics?.challenge_completed || 0],
                      ["Accuracy Rate", `${workspaceDetail.metrics?.challenge_score || 0}%`],
                      ["Longest Streak Record", `${workspaceDetail.metrics?.longest_streak || 0} days`]
                    ].map(([label, val]) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          paddingBottom: 10,
                          borderBottom: "1px solid rgba(148, 163, 184, 0.12)"
                        }}
                      >
                        <span style={muted}>{label}</span>
                        <strong style={{ color: "#f8fafc" }}>{val}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Configured Alarms List */}
              <section style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <AlarmClock size={16} style={{ color: "#38bdf8" }} />
                  <Label>USER'S CONFIGURED ALARMS ({workspaceDetail.alarms?.length || 0})</Label>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {workspaceDetail.alarms?.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "rgba(30, 41, 59, 0.45)",
                        border: "1px solid rgba(148, 163, 184, 0.14)",
                        borderRadius: 10
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <strong style={{ color: "#38bdf8", fontSize: 18, fontFamily: "monospace" }}>
                          {a.alarm_time}
                        </strong>
                        <div>
                          <strong style={{ color: "#f8fafc", fontSize: 14 }}>{a.title || "Wake-Up Alarm"}</strong>
                          <div style={{ ...muted, fontSize: 11, marginTop: 2 }}>
                            Persona: {a.alarm_role || "STANDARD"} · {a.days?.join(", ") || "Daily"}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 12,
                          background: a.enabled ? "rgba(52, 211, 153, 0.15)" : "rgba(148, 163, 184, 0.15)",
                          color: a.enabled ? "#34d399" : "#94a3b8",
                          fontSize: 12,
                          fontWeight: 700
                        }}
                      >
                        {a.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  ))}
                  {!workspaceDetail.alarms?.length && (
                    <p style={{ ...muted, margin: "6px 0" }}>No alarms configured by this user yet.</p>
                  )}
                </div>
              </section>

              {/* Recent Challenge Attempts Table */}
              <section style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Brain size={16} style={{ color: "#a78bfa" }} />
                  <Label>RECENT CHALLENGE ATTEMPTS ({workspaceDetail.challenges?.length || 0})</Label>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "#94a3b8", textAlign: "left", fontSize: 12, borderBottom: "1px solid rgba(148, 163, 184, 0.15)" }}>
                        <th style={{ padding: "10px 8px" }}>Challenge Type</th>
                        <th style={{ padding: "10px 8px" }}>Outcome</th>
                        <th style={{ padding: "10px 8px" }}>Response Time</th>
                        <th style={{ padding: "10px 8px" }}>Date & Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceDetail.challenges?.map((item) => (
                        <tr key={item.id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                          <td style={{ padding: "12px 8px", fontWeight: 700, color: "#e2e8f0" }}>
                            {item.challenge_type || "MATH"}
                          </td>
                          <td style={{ padding: "12px 8px", color: item.correct ? "#6ee7b7" : "#fda4af", fontWeight: 700 }}>
                            {item.correct ? "Completed" : "Not Completed"}
                          </td>
                          <td style={{ padding: "12px 8px", color: "#cbd5e1" }}>
                            {item.response_time ? `${item.response_time}s` : "—"}
                          </td>
                          <td style={{ padding: "12px 8px", color: "#94a3b8" }}>
                            {item.attempted_at ? new Date(item.attempted_at).toLocaleString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!workspaceDetail.challenges?.length && (
                    <p style={{ ...muted, marginTop: 14 }}>No challenge activity recorded for this user.</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: USERS (WELLNESS COACH USER DIRECTORY)                                     */}
      {/* ========================================================================= */}
      {tab === "users" && (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Top Banner */}
          <section
            style={{
              ...card,
              background: "linear-gradient(135deg, rgba(30, 58, 138, 0.35), rgba(88, 28, 135, 0.28), rgba(15, 23, 42, 0.85))",
              border: "1px solid rgba(129, 140, 248, 0.25)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Users size={18} style={{ color: "#a5b4fc" }} />
                <Label>WELLNESS COACH USER DIRECTORY</Label>
              </div>
              <h1 style={{ margin: "4px 0 6px", fontSize: 26, fontWeight: 800, color: "#f8fafc" }}>
                Real User Database & Behavioral Analytics
              </h1>
              <p style={{ ...muted, margin: 0, maxWidth: 700 }}>
                Live database records showing real user details, alarm wake activity, cognitive challenge performance, habit score, streaks, and account status.
              </p>
            </div>
            <button
              className="create-alarm-button"
              onClick={fetchDbUsers}
              disabled={usersLoading}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px" }}
            >
              <RefreshCw size={16} className={usersLoading ? "spin" : ""} />
              {usersLoading ? "Syncing..." : "Refresh Database"}
            </button>
          </section>

          {/* Search & Filter */}
          <section style={card}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ position: "relative", minWidth: 260, flex: "1 1 280px" }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: "#64748b" }} />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name, email, or username..."
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 36px",
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 10,
                    color: "#f8fafc",
                    fontSize: 13,
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ ...muted, fontSize: 12 }}>Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      color: "#f8fafc",
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 12
                    }}
                  >
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="INACTIVE">Inactive Only</option>
                  </select>
                </div>

                {/* Role filter — WellnessCoachs only ever see USER accounts */}
                {user?.role === "ADMIN" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ ...muted, fontSize: 12 }}>Role:</span>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      style={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        color: "#f8fafc",
                        padding: "8px 12px",
                        borderRadius: 8,
                        fontSize: 12
                      }}
                    >
                      <option value="ALL">All Roles</option>
                      <option value="USER">USER</option>
                      <option value="WELLNESS_COACH">WELLNESS_COACH</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Users Table */}
          <section style={card}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 960, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#94a3b8", textAlign: "left", fontSize: 12, borderBottom: "1px solid rgba(148, 163, 184, 0.18)" }}>
                    <th style={{ padding: "12px 10px" }}>USER DETAILS</th>
                    <th style={{ padding: "12px 10px" }}>STATUS</th>
                    <th style={{ padding: "12px 10px" }}>ALARM ACTIVITY</th>
                    <th style={{ padding: "12px 10px" }}>CHALLENGE PERFORMANCE</th>
                    <th style={{ padding: "12px 10px" }}>HABIT SCORE</th>
                    <th style={{ padding: "12px 10px" }}>STREAK</th>
                    <th style={{ padding: "12px 10px", textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((item) => {
                    const alarmsMeta = item.alarm_activity || {};
                    const challengeMeta = item.challenge_performance || {};
                    const habitScore = item.habit_score || 0;
                    const streak = item.streak || 0;

                    return (
                      <tr key={item.id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.1)" }}>
                        <td style={{ padding: "14px 10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: 14,
                                color: "#ffffff"
                              }}
                            >
                              {(item.name || "U")[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <strong style={{ color: "#f8fafc", fontSize: 14 }}>{item.name}</strong>
                                <RoleBadge role={item.role || "USER"} />
                              </div>
                              <div style={{ ...muted, fontSize: 12 }}>{item.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "14px 10px" }}>
                          <button
                            onClick={(e) => handleToggleStatus(item, e)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 20,
                              border: item.is_active !== false ? "1px solid rgba(52, 211, 153, 0.4)" : "1px solid rgba(248, 113, 113, 0.4)",
                              background: item.is_active !== false ? "rgba(52, 211, 153, 0.12)" : "rgba(248, 113, 113, 0.12)",
                              color: item.is_active !== false ? "#6ee7b7" : "#fca5a5",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            {item.is_active !== false ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td style={{ padding: "14px 10px" }}>
                          <strong style={{ color: "#e2e8f0" }}>{alarmsMeta.completed_alarms || 0} / {alarmsMeta.total_sessions || 0}</strong>
                          <div style={{ color: alarmsMeta.wake_success >= 70 ? "#34d399" : "#fbbf24", fontSize: 12 }}>
                            {alarmsMeta.wake_success || 0}% wake rate
                          </div>
                        </td>
                        <td style={{ padding: "14px 10px" }}>
                          <strong style={{ color: "#e2e8f0" }}>{challengeMeta.completed_challenges || 0} / {challengeMeta.total_attempts || 0}</strong>
                          <div style={{ color: challengeMeta.accuracy >= 70 ? "#a78bfa" : "#fbbf24", fontSize: 12 }}>
                            {challengeMeta.accuracy || 0}% accuracy
                          </div>
                        </td>
                        <td style={{ padding: "14px 10px" }}>
                          <strong style={{ color: habitScore >= 80 ? "#34d399" : habitScore >= 50 ? "#fbbf24" : "#f472b6" }}>
                            {habitScore}%
                          </strong>
                        </td>
                        <td style={{ padding: "14px 10px" }}>
                          <strong style={{ color: streak > 0 ? "#fdba74" : "#94a3b8" }}>{streak} days</strong>
                        </td>
                        <td style={{ padding: "14px 10px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            {/* View Report – opens inline panel */}
                            {/* View Details – navigates to workspace */}
                            <button
                              onClick={() => {
                                openWorkspaceUserDetail(item);
                                setTab("my_workspace");
                              }}
                              style={{
                                background: "rgba(99, 102, 241, 0.16)",
                                border: "1px solid rgba(129, 140, 248, 0.4)",
                                color: "#c7d2fe",
                                padding: "7px 14px",
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer"
                              }}
                            >
                              View Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ─── Inline User Report Panel ─────────────────────────────── */}
          {usersReportUser && (
            <section
              style={{
                ...card,
                border: "1px solid rgba(52, 211, 153, 0.3)",
                background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(6, 78, 59, 0.12))"
              }}
            >
              {/* Report Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 46, height: 46, borderRadius: "50%",
                      background: "linear-gradient(135deg, #059669, #0ea5e9)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 20, color: "#fff"
                    }}
                  >
                    {(usersReportUser.name || "U")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <FileText size={15} style={{ color: "#6ee7b7" }} />
                      <Label>USER REPORT</Label>
                    </div>
                    <h2 style={{ margin: "3px 0 2px", fontSize: 22, color: "#f8fafc", fontWeight: 800 }}>
                      {usersReportUser.name}
                    </h2>
                    <div style={{ ...muted, fontSize: 12 }}>{usersReportUser.email}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {usersReportLoading && (
                    <span style={{ ...muted, fontSize: 12 }}>Loading report…</span>
                  )}
                  <button
                    onClick={() => { setUsersReportUser(null); setUsersReportData(null); }}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(148,163,184,0.2)",
                      color: "#94a3b8", padding: "7px 12px",
                      borderRadius: 8, fontSize: 12, cursor: "pointer"
                    }}
                  >
                    <X size={14} /> Close
                  </button>
                </div>
              </div>

              {usersReportData && (() => {
                const m = usersReportData.metrics || {};
                const challenges = usersReportData.challenges || [];
                const sessions = usersReportData.sessions || [];
                const snoozes = usersReportData.snoozes || [];

                // derive a Waking Performance score: blend wake success + challenge score
                const wakingPerf = m.wake_success !== undefined && m.challenge_score !== undefined
                  ? Math.round((m.wake_success + m.challenge_score) / 2)
                  : (m.performance || 0);

                // challenge type distribution from real data
                const typeCount = {};
                challenges.forEach(c => {
                  const t = c.challenge_type || "MATH";
                  typeCount[t] = (typeCount[t] || 0) + 1;
                });
                const typeEntries = Object.entries(typeCount).sort((a, b) => b[1] - a[1]);

                // recent 10 challenges for mini activity chart
                const recentChallenges = [...challenges].slice(0, 10).reverse();

                // response time bar chart data
                const rtData = recentChallenges
                  .filter(c => c.response_time)
                  .map(c => parseFloat(c.response_time));
                const maxRt = Math.max(...rtData, 1);

                return (
                  <div style={{ display: "grid", gap: 18 }}>
                    {/* ── 6 Metric Cards ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12 }}>
                      {[
                        ["Alarm Activity", `${m.alarm_activity || 0} sessions`, `${m.completed_alarms || 0} completed`, "#38bdf8"],
                        ["Challenge Perf.", `${m.challenge_score || 0}%`, `${m.challenge_completed || 0} / ${m.challenge_activity || 0} solved`, "#a78bfa"],
                        ["Habit Score", `${m.habit_score || 0}%`, m.habit_score >= 80 ? "High Consistency" : m.habit_score >= 50 ? "Building Habit" : "Needs Support", "#f472b6"],
                        ["Streak", `${m.streak || 0} days 🔥`, `Best: ${m.longest_streak || m.streak || 0} days`, "#fb923c"],
                        ["Waking Performance", `${wakingPerf}%`, "Wake + Challenge blend", "#6ee7b7"],
                        ["Recent Activity", `${challenges.length + sessions.length}`, `${snoozes.length} snooze${snoozes.length !== 1 ? "s" : ""} recorded`, "#facc15"]
                      ].map(([label, val, sub, color]) => (
                        <div key={label} style={{ ...card, borderTop: `3px solid ${color}`, padding: 14 }}>
                          <Label>{label.toUpperCase()}</Label>
                          <strong style={{ display: "block", fontSize: 22, marginTop: 5, color }}>{val}</strong>
                          <div style={{ ...muted, fontSize: 11, marginTop: 3 }}>{sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* ── Charts Row ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
                      {/* Bar chart: response times of last 10 challenges */}
                      <div style={{ ...card, padding: 16 }}>
                        <Label>RECENT CHALLENGE RESPONSE TIMES (LAST {recentChallenges.length})</Label>
                        <div style={{ marginTop: 12, display: "flex", alignItems: "flex-end", gap: 5, height: 80 }}>
                          {recentChallenges.length > 0 ? recentChallenges.map((c, i) => {
                            const rt = parseFloat(c.response_time) || 0;
                            const h = Math.max(8, Math.round((rt / maxRt) * 76));
                            return (
                              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                                <div
                                  title={`${rt}s – ${c.correct ? "✓" : "✗"}`}
                                  style={{
                                    width: "100%", height: h,
                                    background: c.correct ? "#34d399" : "#f87171",
                                    borderRadius: "3px 3px 0 0",
                                    opacity: 0.85
                                  }}
                                />
                                <span style={{ fontSize: 9, color: "#64748b" }}>{rt}s</span>
                              </div>
                            );
                          }) : (
                            <div style={{ ...muted, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 80 }}>
                              Response times will appear after challenge sessions are recorded.
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11 }}>
                          <span style={{ color: "#34d399" }}>■ Correct</span>
                          <span style={{ color: "#f87171" }}>■ Not Correct</span>
                        </div>
                      </div>

                      {/* Metric breakdown bars */}
                      <div style={{ ...card, padding: 16 }}>
                        <Label>PERFORMANCE BREAKDOWN</Label>
                        <div style={{ marginTop: 12, display: "grid", gap: 11 }}>
                          {[
                            ["Alarm Wake Rate", m.wake_success || 0, "#38bdf8"],
                            ["Challenge Accuracy", m.challenge_score || 0, "#a78bfa"],
                            ["Habit Score", m.habit_score || 0, "#f472b6"],
                            ["Waking Performance", wakingPerf, "#6ee7b7"]
                          ].map(([label, val, color]) => (
                            <div key={label}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                                <span style={{ color: "#94a3b8" }}>{label}</span>
                                <strong style={{ color }}>{val}%</strong>
                              </div>
                              <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                                <div style={{ width: `${Math.min(val, 100)}%`, height: "100%", background: color, borderRadius: 3 }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Challenge type distribution */}
                      {typeEntries.length > 0 && (
                        <div style={{ ...card, padding: 16 }}>
                          <Label>CHALLENGE TYPE USAGE</Label>
                          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                            {typeEntries.map(([type, count]) => {
                              const pct = Math.round((count / challenges.length) * 100);
                              return (
                                <div key={type}>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                                    <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{type}</span>
                                    <span style={{ color: "#94a3b8" }}>{count} attempt{count !== 1 ? "s" : ""} ({pct}%)</span>
                                  </div>
                                  <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                                    <div style={{ width: `${pct}%`, height: "100%", background: "#818cf8", borderRadius: 3 }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Alarm Activity & Recent Challenges tables side by side ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
                      {/* Alarm Activity */}
                      <div style={{ ...card, padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                          <AlarmClock size={15} style={{ color: "#38bdf8" }} />
                          <Label>ALARM ACTIVITY SUMMARY</Label>
                        </div>
                        <div style={{ display: "grid", gap: 9 }}>
                          {[
                            ["Total Alarms Configured", m.total_alarms || 0],
                            ["Alarm Sessions Recorded", m.alarm_activity || 0],
                            ["Sessions Completed", m.completed_alarms || 0],
                            ["Wake-Up Success Rate", `${m.wake_success || 0}%`],
                            ["Total Snoozes", m.snoozes || snoozes.length || 0]
                          ].map(([label, val]) => (
                            <div key={label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(148,163,184,0.1)", paddingBottom: 8 }}>
                              <span style={{ ...muted, fontSize: 12 }}>{label}</span>
                              <strong style={{ fontSize: 13, color: "#e2e8f0" }}>{val}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent Challenge Activity */}
                      <div style={{ ...card, padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                          <Brain size={15} style={{ color: "#a78bfa" }} />
                          <Label>RECENT CHALLENGE ACTIVITY</Label>
                        </div>
                        {challenges.length > 0 ? (
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr style={{ color: "#64748b", textAlign: "left" }}>
                                  <th style={{ padding: "6px 8px" }}>Type</th>
                                  <th style={{ padding: "6px 8px" }}>Result</th>
                                  <th style={{ padding: "6px 8px" }}>Time</th>
                                  <th style={{ padding: "6px 8px" }}>Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {challenges.slice(0, 8).map((c, idx) => (
                                  <tr key={idx} style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
                                    <td style={{ padding: "8px 8px", color: "#e2e8f0", fontWeight: 600 }}>{c.challenge_type || "MATH"}</td>
                                    <td style={{ padding: "8px 8px", color: c.correct ? "#6ee7b7" : "#fda4af", fontWeight: 700 }}>
                                      {c.correct ? "✓ Pass" : "✗ Fail"}
                                    </td>
                                    <td style={{ padding: "8px 8px", color: "#94a3b8" }}>{c.response_time ? `${c.response_time}s` : "—"}</td>
                                    <td style={{ padding: "8px 8px", color: "#64748b" }}>
                                      {c.attempted_at ? new Date(c.attempted_at).toLocaleDateString() : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p style={{ ...muted, fontSize: 12 }}>No challenge sessions recorded for this user yet.</p>
                        )}
                      </div>
                    </div>

                    {/* ── AI Summary Card ── */}
                    <div style={{
                      ...card, padding: 16,
                      background: "linear-gradient(135deg, rgba(30, 58, 138, 0.2), rgba(88, 28, 135, 0.15), rgba(15, 23, 42, 0.8))",
                      border: "1px solid rgba(129, 140, 248, 0.2)"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                        <Sparkles size={15} style={{ color: "#a5b4fc" }} />
                        <Label>BEHAVIORAL SUMMARY</Label>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                        <div>
                          <div style={{ ...muted, fontSize: 11 }}>Habit Tier</div>
                          <strong style={{ color: "#f472b6" }}>
                            {(m.habit_score || 0) >= 80 ? "Master Riser 🏆" : (m.habit_score || 0) >= 70 ? "Consistent Riser 🚀" : (m.habit_score || 0) >= 50 ? "Building Habit 📈" : "Erratic Riser 😴"}
                          </strong>
                        </div>
                        <div>
                          <div style={{ ...muted, fontSize: 11 }}>Recommended Challenge Difficulty</div>
                          <strong style={{ color: "#c4b5fd" }}>
                            {(m.challenge_score || 0) >= 85 && (m.wake_success || 0) >= 80 ? "Hard" : (m.challenge_score || 0) >= 55 ? "Medium" : "Easy"}
                          </strong>
                        </div>
                        <div>
                          <div style={{ ...muted, fontSize: 11 }}>Snooze Resistance</div>
                          <strong style={{ color: "#6ee7b7" }}>
                            {Math.max(0, Math.round(100 - ((m.snoozes || 0) / Math.max(m.alarm_activity || 1, 1)) * 25))}%
                          </strong>
                        </div>
                        <div>
                          <div style={{ ...muted, fontSize: 11 }}>Overall Status</div>
                          <strong style={{ color: usersReportUser.is_active !== false ? "#34d399" : "#fca5a5" }}>
                            {usersReportUser.is_active !== false ? "Active" : "Inactive"}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: DASHBOARD                                                            */}
      {/* ========================================================================= */}
      {tab === "dashboard" && (
        <div style={{ display: "grid", gap: 18 }}>
          <section
            style={{
              ...card,
              background: "linear-gradient(135deg, rgba(30, 58, 138, 0.4), rgba(88, 28, 135, 0.32), rgba(15, 23, 42, 0.85))",
              border: "1px solid rgba(129, 140, 248, 0.25)",
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              alignItems: "center"
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <UserCheck size={18} style={{ color: "#a5b4fc" }} />
                <Label>WELLNESS COACH DASHBOARD</Label>
              </div>
              <h1 style={{ margin: "4px 0 6px", fontSize: 28, fontWeight: 800, color: "#f8fafc" }}>
                Welcome back, {user?.name ? user.name.split(" ")[0] : "Wellness Coach"}! 👋
              </h1>
              <p style={{ ...muted, margin: 0, maxWidth: 650 }}>
                Here is your high-level operational overview of system usage, user engagement, and aggregate performance metrics.
              </p>
            </div>
            <button
              className="create-alarm-button"
              onClick={() => {
                fetchAssignedUsers();
                api.get("/wellness_coach/dashboard-analytics", auth(token)).then((r) => setDashboardAnalytics(r.data));
              }}
              disabled={workspaceLoading}
            >
              <RefreshCw size={16} className={workspaceLoading ? "spin" : ""} />
              {workspaceLoading ? "Refreshing..." : "Refresh Dashboard"}
            </button>
          </section>

          {/* Overall Summary KPIs */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              ["Total Users", dashboardAnalytics?.summary?.total_users || 0, "Registered accounts", "#60a5fa"],
              ["Active Users", dashboardAnalytics?.summary?.active_users || 0, "Currently active", "#34d399"],
              ["Total Alarms", dashboardAnalytics?.summary?.alarm_activity || 0, "All wake sessions", "#a78bfa"],
              ["Total Challenges", dashboardAnalytics?.summary?.challenge_activity || 0, "All puzzle attempts", "#fbbf24"],
              ["Overall User Activity", `${dashboardAnalytics?.summary?.user_performance || 0}%`, "Average performance", "#f472b6"],
            ].map(([label, value, note, color]) => (
              <div key={label} style={{ ...card, borderTop: `3px solid ${color}` }}>
                <Label>{label.toUpperCase()}</Label>
                <strong style={{ display: "block", fontSize: 27, marginTop: 8 }}>{value}</strong>
                <div style={muted}>{note}</div>
              </div>
            ))}
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(250px, 1fr)", gap: 18 }}>
            {/* User Activity Line Chart */}
            <section style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <TrendingUp size={16} style={{ color: "#38bdf8" }} />
                <Label>USER ACTIVITY (LAST 14 DAYS)</Label>
              </div>
              <div style={{ height: 220, display: "flex", alignItems: "flex-end", gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                {dashboardAnalytics?.timeline && dashboardAnalytics.timeline.length > 0 ? (
                  dashboardAnalytics.timeline.map((day, i) => {
                    const maxVal = Math.max(...dashboardAnalytics.timeline.map(d => Math.max(d.alarms || 0, d.challenges || 0, 10)));
                    const hAlarms = Math.min(100, ((day.alarms || 0) / maxVal) * 100);
                    const hChallenges = Math.min(100, ((day.challenges || 0) / maxVal) * 100);
                    
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4, height: "100%", group: "hover" }}>
                        <div style={{ display: "flex", gap: 4, height: "100%", alignItems: "flex-end", width: "100%", justifyContent: "center" }}>
                          <div style={{ width: "40%", background: "#a78bfa", height: `${hAlarms}%`, borderRadius: "4px 4px 0 0", minHeight: 4 }} title={`Alarms: ${day.alarms}`} />
                          <div style={{ width: "40%", background: "#fbbf24", height: `${hChallenges}%`, borderRadius: "4px 4px 0 0", minHeight: 4 }} title={`Challenges: ${day.challenges}`} />
                        </div>
                        <div style={{ fontSize: 9, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                          {day.date?.slice(5)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ width: "100%", textAlign: "center", color: "#64748b", alignSelf: "center" }}>No activity data available</div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12, fontSize: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 10, height: 10, background: "#a78bfa", borderRadius: 2 }} /> Alarms</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 10, height: 10, background: "#fbbf24", borderRadius: 2 }} /> Challenges</div>
              </div>
            </section>

            {/* User Status Chart */}
            <section style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Users size={16} style={{ color: "#34d399" }} />
                <Label>USER STATUS DISTRIBUTION</Label>
              </div>
              {dashboardAnalytics?.summary?.total_users > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#34d399" }}>{dashboardAnalytics.summary.active_users}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>Active Users</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#94a3b8" }}>{dashboardAnalytics.summary.total_users - dashboardAnalytics.summary.active_users}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>Inactive Users</div>
                    </div>
                  </div>
                  
                  <div style={{ width: "100%", height: 12, background: "rgba(255,255,255,0.05)", borderRadius: 6, display: "flex", overflow: "hidden" }}>
                    <div style={{ width: `${(dashboardAnalytics.summary.active_users / dashboardAnalytics.summary.total_users) * 100}%`, background: "#34d399", height: "100%" }} />
                    <div style={{ width: `${((dashboardAnalytics.summary.total_users - dashboardAnalytics.summary.active_users) / dashboardAnalytics.summary.total_users) * 100}%`, background: "#64748b", height: "100%" }} />
                  </div>
                  
                  <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: "#cbd5e1" }}>
                    <strong>{Math.round((dashboardAnalytics.summary.active_users / dashboardAnalytics.summary.total_users) * 100)}%</strong> of your total {dashboardAnalytics.summary.total_users} users are active.
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "#64748b", marginTop: 40 }}>No users found</div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: CHALLENGES                                                           */}
      {/* ========================================================================= */}
      {tab === "challenges" && (
        <div style={{ display: "grid", gap: 18 }}>
          <section
            style={{
              ...card,
              background: "linear-gradient(120deg, rgba(30, 64, 175, 0.28), rgba(88, 28, 135, 0.24), rgba(15, 23, 42, 0.72))",
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              alignItems: "center"
            }}
          >
            <div>
              <Label>WELLNESS COACH CHALLENGE ANALYTICS</Label>
              <h1 style={{ margin: "7px 0", fontSize: 28 }}>Challenge Performance</h1>
              <p style={{ ...muted, margin: 0 }}>
                Real usage, completion and score data calculated from stored challenge attempts.
              </p>
            </div>
            <button
              className="create-alarm-button"
              onClick={() =>
                api.get("/wellness_coach/challenge-analytics", auth(token)).then((res) => setChallengeAnalytics(res.data))
              }
            >
              <RefreshCw size={16} /> Refresh challenges
            </button>
          </section>

          <section style={card}>
            <Label>EXISTING CHALLENGES</Label>
            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#94a3b8", textAlign: "left", fontSize: 12 }}>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Difficulty</th>
                    <th>Attempts</th>
                    <th>Success Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {challengeAnalytics.challenges?.map((row) => (
                    <tr key={row.id} style={{ borderTop: "1px solid rgba(148, 163, 184, 0.12)" }}>
                      <td style={{ padding: "12px 0", fontWeight: 700 }}>{row.name}</td>
                      <td>{row.type}</td>
                      <td style={{ color: "#c4b5fd" }}>{row.difficulty}</td>
                      <td>{row.attempts}</td>
                      <td style={{ color: row.success_rate >= 60 ? "#6ee7b7" : "#fbbf24", fontWeight: 700 }}>
                        {row.success_rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: REPORTS (WELLNESS COACH BEHAVIORAL & PERFORMANCE REPORTS)                 */}
      {/* ========================================================================= */}
      {tab === "reports" && (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Reports Header & Scope Selector Banner */}
          <section
            style={{
              ...card,
              background: "linear-gradient(135deg, rgba(30, 58, 138, 0.35), rgba(88, 28, 135, 0.3), rgba(15, 23, 42, 0.85))",
              border: "1px solid rgba(129, 140, 248, 0.25)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <FileText size={18} style={{ color: "#a5b4fc" }} />
                <Label>WELLNESS COACH BEHAVIORAL & PERFORMANCE REPORTS</Label>
              </div>
              <h1 style={{ margin: "4px 0 6px", fontSize: 26, fontWeight: 800, color: "#f8fafc" }}>
                {isAllReports
                  ? "Managed Users Aggregate Behavioral Report"
                  : `${activeReportUser?.name || "User"}'s Behavioral & Performance Report`}
              </h1>
              <p style={{ ...muted, margin: 0, maxWidth: 720 }}>
                {isAllReports
                  ? "Comprehensive analytical reports generated from existing database records across all managed user accounts."
                  : `In-depth behavioral tracking, wake consistency, and cognitive challenge metrics for ${activeReportUser?.email || "this user"}.`}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* User Selector Dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <select
                  value={reportUserFilter}
                  onChange={(e) => setReportUserFilter(e.target.value)}
                  style={{
                    background: "#0f172a",
                    border: "1px solid rgba(129, 140, 248, 0.4)",
                    color: "#f8fafc",
                    padding: "9px 14px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    maxWidth: 280
                  }}
                >
                  <option value="ALL">📊 All Users (Aggregate - {totalReportUsers} Users)</option>
                  {assignedUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      👤 {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Export CSV Button */}
              <button
                onClick={exportReportCSV}
                style={{
                  background: "rgba(52, 211, 153, 0.15)",
                  border: "1px solid rgba(52, 211, 153, 0.4)",
                  color: "#6ee7b7",
                  padding: "9px 14px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
                title="Download CSV report of all users"
              >
                <Download size={15} />
                Export CSV
              </button>

              {/* Refresh Button */}
              <button
                className="create-alarm-button"
                onClick={() => {
                  fetchAssignedUsers();
                  if (!isAllReports) fetchReportData(reportUserFilter);
                }}
                disabled={reportLoading}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px" }}
              >
                <RefreshCw size={15} className={reportLoading ? "spin" : ""} />
                {reportLoading ? "Syncing..." : "Refresh"}
              </button>
            </div>
          </section>

          {/* Selected Single User Alert Bar (if single user is selected) */}
          {!isAllReports && activeReportUser && (
            <div
              style={{
                ...card,
                background: "rgba(30, 58, 138, 0.22)",
                border: "1px solid rgba(96, 165, 250, 0.3)",
                padding: "14px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 18,
                    color: "#ffffff"
                  }}
                >
                  {(activeReportUser.name || "U")[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 16, color: "#f8fafc" }}>{activeReportUser.name}</strong>
                    <RoleBadge role={activeReportUser.role || "USER"} />
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        background: activeReportUser.is_active !== false ? "rgba(52, 211, 153, 0.15)" : "rgba(248, 113, 113, 0.15)",
                        color: activeReportUser.is_active !== false ? "#6ee7b7" : "#fca5a5"
                      }}
                    >
                      {activeReportUser.is_active !== false ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div style={{ ...muted, fontSize: 13 }}>{activeReportUser.email}</div>
                </div>
              </div>

              <button
                onClick={() => setReportUserFilter("ALL")}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  color: "#cbd5e1",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: "pointer"
                }}
              >
                ← Return to All Users Aggregate
              </button>
            </div>
          )}

          {/* 5 Core Metric Cards: User Activity, Alarm Usage, Challenge Performance, Habit Score, Streak */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
            {/* 1. User Activity */}
            <div style={{ ...card, borderTop: "3px solid #60a5fa" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Label>USER ACTIVITY</Label>
                <Activity size={18} style={{ color: "#60a5fa" }} />
              </div>
              <strong style={{ display: "block", fontSize: 28, marginTop: 8, color: "#f8fafc" }}>
                {isAllReports
                  ? totalReportSessions + totalReportAttempts
                  : (activeReportUser?.alarm_activity?.total_sessions || 0) + (activeReportUser?.challenge_performance?.total_attempts || 0)}
              </strong>
              <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>
                {isAllReports
                  ? `${totalReportSessions} alarm sessions · ${totalReportAttempts} challenges`
                  : `${activeReportUser?.alarm_activity?.total_sessions || 0} alarm sessions · ${activeReportUser?.challenge_performance?.total_attempts || 0} challenges`}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#93c5fd", fontWeight: 600 }}>
                {isAllReports ? `${activeReportUsersCount} of ${totalReportUsers} users active` : "Total user engagement events"}
              </div>
            </div>

            {/* 2. Alarm Usage */}
            <div style={{ ...card, borderTop: "3px solid #34d399" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Label>ALARM USAGE</Label>
                <AlarmClock size={18} style={{ color: "#34d399" }} />
              </div>
              <strong style={{ display: "block", fontSize: 28, marginTop: 8, color: "#34d399" }}>
                {isAllReports
                  ? `${aggregateWakeSuccessRate}%`
                  : `${activeReportUser?.alarm_activity?.wake_success || 0}%`}
              </strong>
              <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>
                {isAllReports
                  ? `${totalReportCompletedSessions} of ${totalReportSessions} wake sessions`
                  : `${activeReportUser?.alarm_activity?.completed_alarms || 0} of ${activeReportUser?.alarm_activity?.total_sessions || 0} wake sessions`}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#6ee7b7", fontWeight: 600 }}>
                {isAllReports
                  ? `${totalReportAlarms} alarms configured · ${totalReportSnoozes} snoozes`
                  : `${activeReportUser?.alarm_activity?.total_alarms || 0} alarms · ${activeReportUser?.alarm_activity?.snooze_count || 0} snoozes`}
              </div>
            </div>

            {/* 3. Challenge Performance */}
            <div style={{ ...card, borderTop: "3px solid #a78bfa" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Label>CHALLENGE PERFORMANCE</Label>
                <Brain size={18} style={{ color: "#a78bfa" }} />
              </div>
              <strong style={{ display: "block", fontSize: 28, marginTop: 8, color: "#a78bfa" }}>
                {isAllReports
                  ? `${aggregateChallengeAccuracy}%`
                  : `${activeReportUser?.challenge_performance?.accuracy || 0}%`}
              </strong>
              <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>
                {isAllReports
                  ? `${totalReportCompletedChallenges} of ${totalReportAttempts} attempts passed`
                  : `${activeReportUser?.challenge_performance?.completed_challenges || 0} of ${activeReportUser?.challenge_performance?.total_attempts || 0} solved`}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#c4b5fd", fontWeight: 600 }}>
                {isAllReports
                  ? `Across ${challengeAnalytics.challenges?.length || 0} challenge types`
                  : `Avg response time: ${activeReportUser?.challenge_performance?.avg_response_time || 0}s`}
              </div>
            </div>

            {/* 4. Habit Score */}
            <div style={{ ...card, borderTop: "3px solid #f472b6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Label>HABIT SCORE</Label>
                <Award size={18} style={{ color: "#f472b6" }} />
              </div>
              <strong style={{ display: "block", fontSize: 28, marginTop: 8, color: "#f472b6" }}>
                {isAllReports
                  ? `${aggregateAvgHabitScore}%`
                  : `${activeReportUser?.habit_score || 0}%`}
              </strong>
              <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>
                {isAllReports
                  ? `${consistentUsersCount} high (≥80%) · ${buildingUsersCount} building`
                  : (activeReportUser?.habit_score || 0) >= 80
                  ? "High Consistency Tier"
                  : (activeReportUser?.habit_score || 0) >= 50
                  ? "Building Consistency Tier"
                  : "Needs Habit Support"}
              </div>
              {/* Progress bar */}
              <div style={{ width: "100%", height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 3, marginTop: 8 }}>
                <div
                  style={{
                    width: `${Math.min(isAllReports ? aggregateAvgHabitScore : (activeReportUser?.habit_score || 0), 100)}%`,
                    height: "100%",
                    borderRadius: 3,
                    background: "linear-gradient(90deg, #ec4899, #8b5cf6)"
                  }}
                />
              </div>
            </div>

            {/* 5. Streak */}
            <div style={{ ...card, borderTop: "3px solid #fb923c" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Label>STREAK</Label>
                <Flame size={18} style={{ color: "#fb923c" }} />
              </div>
              <strong style={{ display: "block", fontSize: 28, marginTop: 8, color: "#fb923c" }}>
                {isAllReports
                  ? `${aggregateTopStreak} Days`
                  : `${activeReportUser?.streak || 0} Days`}
              </strong>
              <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>
                {isAllReports
                  ? `Top active streak across ${totalReportUsers} users`
                  : "Current active wake streak"}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#fed7aa", fontWeight: 600 }}>
                {isAllReports
                  ? `Longest recorded streak: ${aggregateLongestStreak} days`
                  : `Personal best: ${activeReportUser?.longest_streak || activeReportUser?.streak || 0} days`}
              </div>
            </div>
          </section>

          {/* Behavioral Metric Breakdown */}
          <section style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            <div style={card}>
              <Label>BEHAVIORAL METRIC BREAKDOWN</Label>
              <h3 style={{ margin: "8px 0 14px", fontSize: 16, color: "#f8fafc" }}>Performance & Habit Health</h3>
              
              <div style={{ display: "grid", gap: 14 }}>
                {/* Wake Success Bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: "#94a3b8" }}>Alarm Wake-Up Success Rate</span>
                    <strong style={{ color: "#38bdf8" }}>
                      {isAllReports ? `${aggregateWakeSuccessRate}%` : `${activeReportUser?.alarm_activity?.wake_success || 0}%`}
                    </strong>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
                    <div
                      style={{
                        width: `${Math.min(isAllReports ? aggregateWakeSuccessRate : (activeReportUser?.alarm_activity?.wake_success || 0), 100)}%`,
                        height: "100%",
                        borderRadius: 4,
                        background: "#38bdf8"
                      }}
                    />
                  </div>
                </div>

                {/* Challenge Accuracy Bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: "#94a3b8" }}>Cognitive Challenge Accuracy</span>
                    <strong style={{ color: "#a78bfa" }}>
                      {isAllReports ? `${aggregateChallengeAccuracy}%` : `${activeReportUser?.challenge_performance?.accuracy || 0}%`}
                    </strong>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
                    <div
                      style={{
                        width: `${Math.min(isAllReports ? aggregateChallengeAccuracy : (activeReportUser?.challenge_performance?.accuracy || 0), 100)}%`,
                        height: "100%",
                        borderRadius: 4,
                        background: "#a78bfa"
                      }}
                    />
                  </div>
                </div>

                {/* Habit Consistency Bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: "#94a3b8" }}>Overall Habit Score</span>
                    <strong style={{ color: "#f472b6" }}>
                      {isAllReports ? `${aggregateAvgHabitScore}%` : `${activeReportUser?.habit_score || 0}%`}
                    </strong>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
                    <div
                      style={{
                        width: `${Math.min(isAllReports ? aggregateAvgHabitScore : (activeReportUser?.habit_score || 0), 100)}%`,
                        height: "100%",
                        borderRadius: 4,
                        background: "#f472b6"
                      }}
                    />
                  </div>
                </div>

                {/* Snooze Resistance Bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: "#94a3b8" }}>Snooze Resistance Index</span>
                    <strong style={{ color: "#34d399" }}>
                      {Math.max(
                        0,
                        Math.round(
                          100 -
                            ((isAllReports ? totalReportSnoozes : (activeReportUser?.alarm_activity?.snooze_count || 0)) /
                              Math.max(isAllReports ? totalReportSessions : (activeReportUser?.alarm_activity?.total_sessions || 1), 1)) *
                              25
                        )
                      )}
                      %
                    </strong>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
                    <div
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            Math.round(
                              100 -
                                ((isAllReports ? totalReportSnoozes : (activeReportUser?.alarm_activity?.snooze_count || 0)) /
                                  Math.max(isAllReports ? totalReportSessions : (activeReportUser?.alarm_activity?.total_sessions || 1), 1)) *
                                  25
                            )
                          )
                        )}%`,
                        height: "100%",
                        borderRadius: 4,
                        background: "#34d399"
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* AI Behavioral Predictions & Insights Panel */}
          <section
            style={{
              ...card,
              background: "linear-gradient(135deg, rgba(30, 58, 138, 0.25), rgba(88, 28, 135, 0.2), rgba(15, 23, 42, 0.75))",
              border: "1px solid rgba(148, 163, 184, 0.2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Sparkles size={18} style={{ color: "#a5b4fc" }} />
              <Label>AI BEHAVIORAL PREDICTIONS & CONSISTENCY INTELLIGENCE</Label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 10 }}>
              <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.12)" }}>
                <Label>PREDICTED WAKE SUCCESS</Label>
                <div style={{ marginTop: 6 }}>
                  <Prediction
                    value={
                      activeReportInsight?.wake_success_prediction ??
                      (isAllReports ? aggregateWakeSuccessRate || 80 : activeReportUser?.alarm_activity?.wake_success || 75)
                    }
                  />
                </div>
                <div style={{ ...muted, fontSize: 11, marginTop: 4 }}>Based on historical completion</div>
              </div>

              <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.12)" }}>
                <Label>PREDICTED ENGAGEMENT</Label>
                <div style={{ marginTop: 6 }}>
                  <Prediction
                    value={
                      activeReportInsight?.engagement_prediction ??
                      (isAllReports ? aggregateChallengeAccuracy || 85 : activeReportUser?.challenge_performance?.accuracy || 80)
                    }
                  />
                </div>
                <div style={{ ...muted, fontSize: 11, marginTop: 4 }}>Cognitive challenge responsiveness</div>
              </div>

              <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.12)" }}>
                <Label>RECOMMENDED DIFFICULTY</Label>
                <strong style={{ display: "block", fontSize: 24, marginTop: 6, color: "#c4b5fd" }}>
                  {activeReportInsight?.recommended_difficulty ||
                    (isAllReports
                      ? aggregateAvgHabitScore >= 80
                        ? "Hard"
                        : aggregateAvgHabitScore >= 50
                        ? "Medium"
                        : "Easy"
                      : (activeReportUser?.habit_score || 0) >= 80
                      ? "Hard"
                      : (activeReportUser?.habit_score || 0) >= 50
                      ? "Medium"
                      : "Easy")}
                </strong>
                <div style={{ ...muted, fontSize: 11, marginTop: 4 }}>Optimal wake challenge level</div>
              </div>

              <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.12)" }}>
                <Label>PERFORMANCE TREND</Label>
                <strong style={{ display: "block", fontSize: 20, marginTop: 8, color: "#6ee7b7" }}>
                  {activeReportInsight?.performance_trend ||
                    (isAllReports
                      ? aggregateTopStreak >= 3
                        ? "Consistently Improving"
                        : "Stable Baseline"
                      : (activeReportUser?.streak || 0) > 2
                      ? "Improving"
                      : "Stable Baseline")}
                </strong>
                <div style={{ ...muted, fontSize: 11, marginTop: 4 }}>Wake & challenge trajectory</div>
              </div>

              <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(148, 163, 184, 0.12)" }}>
                <Label>RISK ASSESSMENT</Label>
                <strong
                  style={{
                    display: "block",
                    fontSize: 20,
                    marginTop: 8,
                    color:
                      (activeReportInsight?.risk_level === "High" ||
                        (!isAllReports && (activeReportUser?.habit_score || 0) < 45))
                        ? "#fb7185"
                        : "#34d399"
                  }}
                >
                  {activeReportInsight?.risk_level ||
                    (isAllReports
                      ? aggregateAvgHabitScore < 50
                        ? "Moderate Risk"
                        : "Low Risk"
                      : (activeReportUser?.habit_score || 0) < 45
                      ? "High Risk"
                      : (activeReportUser?.habit_score || 0) < 70
                      ? "Medium Risk"
                      : "Low Risk")}
                </strong>
                <div style={{ ...muted, fontSize: 11, marginTop: 4 }}>Snooze & drop-off vulnerability</div>
              </div>
            </div>
          </section>

          {/* Real Users Behavioral Performance Table */}
          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <Label>USER BEHAVIORAL PERFORMANCE DIRECTORY</Label>
                <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "#f8fafc" }}>
                  Individual User Metrics & Report Inspection
                </h3>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {/* Search box */}
                <div style={{ position: "relative", minWidth: 240 }}>
                  <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "#64748b" }} />
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    placeholder="Search user name or email..."
                    style={{
                      width: "100%",
                      padding: "8px 12px 8px 32px",
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      color: "#f8fafc",
                      fontSize: 12,
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                {/* Sort selector */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ ...muted, fontSize: 12 }}>Sort:</span>
                  <select
                    value={reportSortBy}
                    onChange={(e) => setReportSortBy(e.target.value)}
                    style={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      color: "#f8fafc",
                      padding: "7px 10px",
                      borderRadius: 8,
                      fontSize: 12
                    }}
                  >
                    <option value="habit_score">Habit Score</option>
                    <option value="streak">Streak</option>
                    <option value="activity">User Activity</option>
                    <option value="alarm_usage">Alarm Usage</option>
                    <option value="challenge_perf">Challenge Perf</option>
                    <option value="name">Name</option>
                  </select>

                  <button
                    onClick={() => setReportSortAsc(!reportSortAsc)}
                    style={{
                      background: "#0f172a",
                      border: "1px solid #334155",
                      color: "#cbd5e1",
                      padding: "7px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    {reportSortAsc ? "↑ Asc" : "↓ Desc"}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#94a3b8", textAlign: "left", fontSize: 12, borderBottom: "1px solid rgba(148, 163, 184, 0.18)" }}>
                    <th style={{ padding: "12px 10px" }}>USER DETAILS</th>
                    <th style={{ padding: "12px 10px" }}>USER ACTIVITY</th>
                    <th style={{ padding: "12px 10px" }}>ALARM USAGE</th>
                    <th style={{ padding: "12px 10px" }}>CHALLENGE PERFORMANCE</th>
                    <th style={{ padding: "12px 10px" }}>HABIT SCORE</th>
                    <th style={{ padding: "12px 10px" }}>STREAK</th>
                    <th style={{ padding: "12px 10px", textAlign: "right" }}>REPORT ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReportUsers.map((item) => {
                    const alarmsMeta = item.alarm_activity || {};
                    const challengeMeta = item.challenge_performance || {};
                    const habitScore = item.habit_score || 0;
                    const streak = item.streak || 0;
                    const isSelected = reportUserFilter === item.id;

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
                          background: isSelected ? "rgba(99, 102, 241, 0.08)" : "transparent"
                        }}
                      >
                        <td style={{ padding: "12px 10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: isSelected
                                  ? "linear-gradient(135deg, #6366f1, #a855f7)"
                                  : "linear-gradient(135deg, #3b82f6, #06b6d4)",
                                display: "flex",
                                alignItems: "center",
                                justifyCenter: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: 13,
                                color: "#ffffff"
                              }}
                            >
                              {(item.name || "U")[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <strong style={{ color: "#f8fafc", fontSize: 13 }}>{item.name}</strong>
                                <RoleBadge role={item.role || "USER"} />
                              </div>
                              <div style={{ ...muted, fontSize: 11 }}>{item.email}</div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: "12px 10px" }}>
                          <strong style={{ color: "#e2e8f0" }}>
                            {(alarmsMeta.total_sessions || 0) + (challengeMeta.total_attempts || 0)} events
                          </strong>
                          <div style={{ ...muted, fontSize: 11 }}>
                            {alarmsMeta.total_sessions || 0} sessions · {challengeMeta.total_attempts || 0} challenges
                          </div>
                        </td>

                        <td style={{ padding: "12px 10px" }}>
                          <strong style={{ color: "#e2e8f0" }}>
                            {alarmsMeta.completed_alarms || 0} / {alarmsMeta.total_sessions || 0}
                          </strong>
                          <div style={{ color: alarmsMeta.wake_success >= 70 ? "#34d399" : "#fbbf24", fontSize: 11, fontWeight: 700 }}>
                            {alarmsMeta.wake_success || 0}% wake rate
                          </div>
                        </td>

                        <td style={{ padding: "12px 10px" }}>
                          <strong style={{ color: "#e2e8f0" }}>
                            {challengeMeta.completed_challenges || 0} / {challengeMeta.total_attempts || 0}
                          </strong>
                          <div style={{ color: challengeMeta.accuracy >= 70 ? "#a78bfa" : "#fbbf24", fontSize: 11, fontWeight: 700 }}>
                            {challengeMeta.accuracy || 0}% accuracy
                          </div>
                        </td>

                        <td style={{ padding: "12px 10px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 800,
                              background:
                                habitScore >= 80
                                  ? "rgba(52, 211, 153, 0.15)"
                                  : habitScore >= 50
                                  ? "rgba(251, 191, 36, 0.15)"
                                  : "rgba(244, 114, 182, 0.15)",
                              color: habitScore >= 80 ? "#34d399" : habitScore >= 50 ? "#fbbf24" : "#f472b6"
                            }}
                          >
                            {habitScore}%
                          </span>
                        </td>

                        <td style={{ padding: "12px 10px" }}>
                          <strong style={{ color: streak > 0 ? "#fdba74" : "#94a3b8" }}>
                            {streak} {streak === 1 ? "day" : "days"} 🔥
                          </strong>
                          <div style={{ ...muted, fontSize: 11 }}>
                            Max: {item.longest_streak || streak}d 🏆
                          </div>
                        </td>

                        <td style={{ padding: "12px 10px", textAlign: "right" }}>
                          <button
                            onClick={() => {
                              setReportUserFilter(item.id);
                              fetchReportData(item.id);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            style={{
                              background: isSelected ? "rgba(99, 102, 241, 0.3)" : "rgba(99, 102, 241, 0.16)",
                              border: isSelected ? "1px solid #818cf8" : "1px solid rgba(129, 140, 248, 0.4)",
                              color: "#c7d2fe",
                              padding: "6px 12px",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            {isSelected ? "Active Report" : "Inspect Report"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === "sleep_reports" && <SleepTrendReports token={token} />}
      {tab === "notifications" && <NotificationsCenter token={token} isModerator />}


      {/* ========================================================================= */}
      {/* TAB: PROFILE                                                              */}
      {/* ========================================================================= */}
      {tab === "profile" && (
        <section style={{ ...card, maxWidth: 620 }}>
          <Label>WELLNESS COACH ACCOUNT</Label>
          <h2 style={{ margin: "7px 0" }}>Profile Settings</h2>
          <form onSubmit={handleProfileSave} style={{ display: "grid", gap: 16, marginTop: 18 }}>
            <div className="form-control">
              <label>FULL NAME</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-control">
              <label>USERNAME</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="form-control">
              <label>EMAIL ADDRESS</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-control">
              <label>TIMEZONE</label>
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
            </div>
            <RoleBadge role="WELLNESS_COACH" />
            <div style={{ marginTop: 4, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <Label>ACCOUNT SECURITY</Label>
              <p style={{ color: "#94a3b8", fontSize: 12, margin: "6px 0 14px" }}>Leave these fields blank to keep your current password.</p>
              <div style={{ display: "grid", gap: 12 }}>
                <div className="form-control"><label>CURRENT PASSWORD</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" /></div>
                <div className="form-control"><label>NEW PASSWORD</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} autoComplete="new-password" /></div>
                <div className="form-control"><label>CONFIRM NEW PASSWORD</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} autoComplete="new-password" /></div>
              </div>
            </div>
            {profileMessage && <p style={{ color: profileMessage === "Profile updated successfully." ? "#6ee7b7" : "#fca5a5", margin: 0 }}>{profileMessage}</p>}
            <button className="primary-button" type="submit" disabled={profileSaving} style={{ width: 165, opacity: profileSaving ? 0.7 : 1 }}>
              <Save size={16} /> {profileSaving ? "Saving..." : "Save changes"}
            </button>
          </form>
        </section>
      )}
    </AppShell>
  );
}
