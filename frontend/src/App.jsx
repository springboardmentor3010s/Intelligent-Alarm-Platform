import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

import NotificationsBell from "./components/NotificationsBell.jsx";
import {
  completeAlarm,
  getProfile,
  getDashboardStats,
  getPerformanceStats,
  getRecommendations,
  triggerAlarm,
} from "./services/api";
import { PageShell, StatCard } from "./components/ChartKit.jsx";
import { COLORS, statGrid } from "./components/chartTokens.js";

import "./App.css";

const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const Alarm = lazy(() => import("./pages/alarms.jsx"));
const Challenge = lazy(() => import("./pages/Challenge.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const Habits = lazy(() => import("./pages/Habits.jsx"));
const Results = lazy(() => import("./pages/Results.jsx"));
const CoachRecommendations = lazy(() => import("./pages/CoachRecommendations.jsx"));
const RoleDashboard = lazy(() => import("./pages/RoleDashboard.jsx").then((module) => ({
  default: module.RoleDashboard,
})));
const Visualizations = lazy(() => import("./components/Visualizations.jsx"));

/* ─────────────────────────────────────────────────────────────
   Priority styling helpers
───────────────────────────────────────────────────────────── */
const PRIORITY_CONFIG = {
  high: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
    icon: "🔴",
    label: "High",
  },
  medium: {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
    icon: "🟡",
    label: "Medium",
  },
  low: {
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.35)",
    icon: "🟢",
    label: "Low",
  },
};

const CATEGORY_ICON = {
  difficulty: "🧩",
  snooze_control: "😴",
  consistency: "📅",
  cognitive_performance: "⚡",
  positive_reinforcement: "🏆",
  onboarding: "🚀",
  general: "💡",
};

const DIFFICULTY_COLOR = {
  beginner: COLORS.emerald,
  easy: COLORS.emerald,
  medium: COLORS.amber,
  hard: "#ef4444",
  expert: "#dc2626",
};

/* ─────────────────────────────────────────────────────────────
   Recommendation Card
───────────────────────────────────────────────────────────── */
function RecommendationCard({ rec }) {
  const p = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG.medium;
  const catIcon = CATEGORY_ICON[rec.category] || "💡";

  return (
    <div
      style={{
        background: p.bg,
        border: `1px solid ${p.border}`,
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "transform 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{catIcon}</span>
          <strong style={{ color: "#fff", fontSize: 14, lineHeight: 1.3 }}>{rec.title}</strong>
        </div>
        <span
          style={{
            background: p.bg,
            color: p.color,
            border: `1px solid ${p.border}`,
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 10px",
            whiteSpace: "nowrap",
            letterSpacing: 0.5,
          }}
        >
          {p.icon} {p.label}
        </span>
      </div>

      {/* Reason */}
      <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>
        {rec.reason}
      </div>

      {/* Supporting metric */}
      {rec.supporting_metric && (
        <div
          style={{
            fontSize: 11,
            color: "#94a3b8",
            background: "rgba(0,0,0,0.2)",
            borderRadius: 8,
            padding: "4px 10px",
            fontFamily: "monospace",
          }}
        >
          📊 {rec.supporting_metric}
        </div>
      )}

      {/* Action */}
      <div
        style={{
          fontSize: 13,
          color: "#dbeafe",
          borderTop: "1px solid rgba(148,163,184,0.1)",
          paddingTop: 8,
          lineHeight: 1.5,
        }}
      >
        <span style={{ fontWeight: 600, color: "#60a5fa" }}>→ Action: </span>
        {rec.suggested_action}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Habit Score Breakdown tooltip-style card
───────────────────────────────────────────────────────────── */
function HabitScoreCard({ score, breakdown }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const pct = score ?? 0;
  const color = pct >= 75 ? COLORS.emerald : pct >= 50 ? COLORS.amber : "#ef4444";

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: 12, letterSpacing: 1.1, textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>
        Habit Score
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
        {/* Circular gauge */}
        <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
            <circle
              cx="40" cy="40" r="34" fill="none"
              stroke={color} strokeWidth="8"
              strokeDasharray={`${(pct / 100) * 213.6} 213.6`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          </svg>
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, color,
          }}>
            {score == null ? "?" : Math.round(pct)}
          </div>
        </div>

        <div>
          <div style={{ color: "#fff", fontSize: 28, fontWeight: 800, lineHeight: 1 }}>
            {score == null ? "—" : `${Math.round(pct)}`}
            <span style={{ fontSize: 16, color: "#94a3b8", fontWeight: 400 }}>/100</span>
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
            {score == null
              ? "Needs measured sleep-adherence data"
              : pct >= 75
              ? "Excellent habit formation 🌟"
              : pct >= 50
              ? "Making good progress 📈"
              : "Room for improvement 🎯"}
          </div>
        </div>
      </div>

      {/* Breakdown toggle */}
      {breakdown && (
        <>
          <button
            onClick={() => setShowBreakdown((v) => !v)}
            style={{
              background: "none", border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: 8, color: "#94a3b8", fontSize: 12, cursor: "pointer",
              padding: "4px 12px", width: "100%",
            }}
          >
            {showBreakdown ? "▲ Hide breakdown" : "▼ Show score breakdown"}
          </button>

          {showBreakdown && (
            <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
              {[
                { label: "Wake-Up Consistency", key: "wake_up_consistency" },
                { label: "Challenge Completion Success", key: "challenge_completion_success" },
                { label: "Snooze Reduction", key: "snooze_reduction" },
                { label: "Sleep Schedule Adherence", key: "sleep_schedule_adherence" },
              ].map((item) => {
                const value = breakdown[item.key];
                const weight = Math.round((breakdown.weights?.[item.key] ?? 0) * 100);
                return (
                <div key={item.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: "#cbd5e1" }}>{item.label}</span>
                    <span style={{ color: "#94a3b8" }}>{value == null ? "Not measured" : `${value}%`} <span style={{ opacity: 0.5 }}>({weight}%)</span></span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4 }}>
                    <div
                      style={{
                        height: "100%", width: `${value ?? 0}%`, borderRadius: 4,
                        background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.cyan})`,
                        transition: "width 0.5s ease",
                        maxWidth: "100%",
                      }}
                    />
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Adaptive Difficulty Card
───────────────────────────────────────────────────────────── */
function DifficultyCard({ difficulty, reason }) {
  const color = DIFFICULTY_COLOR[difficulty] || COLORS.amber;
  const diffLabel = difficulty
    ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
    : "Medium";

  const icons = { easy: "🌱", medium: "⚡", hard: "🔥" };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: 12, letterSpacing: 1.1, textTransform: "uppercase", color: "#94a3b8", marginBottom: 12 }}>
        Adaptive Difficulty Engine
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 14,
            background: `linear-gradient(135deg, ${color}22, ${color}44)`,
            border: `1.5px solid ${color}66`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24,
          }}
        >
          {icons[difficulty] || "⚡"}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color }}>
            {diffLabel}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Current Challenge Level</div>
        </div>
      </div>

      {/* Difficulty bar */}
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 6, marginBottom: 12, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: difficulty === "easy" ? "33%" : difficulty === "hard" ? "100%" : "66%",
            background: `linear-gradient(90deg, ${COLORS.emerald}, ${color})`,
            borderRadius: 6,
            transition: "width 0.6s ease",
          }}
        />
      </div>

      <p style={{ color: "#cbd5e1", margin: 0, lineHeight: 1.6, fontSize: 13 }}>
        {reason || "Complete a few challenges to unlock adaptive difficulty analysis."}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main App
───────────────────────────────────────────────────────────── */
function App() {
  const [page, setPage] = useState("dashboard");
  const [user, setUser] = useState(() => {
    if (!localStorage.getItem("access_token")) {
      localStorage.removeItem("cognitive_alarm_user");
      return null;
    }

    try {
      const cachedUser = localStorage.getItem("cognitive_alarm_user");
      return cachedUser ? JSON.parse(cachedUser) : null;
    } catch {
      return null;
    }
  });
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [performanceStats, setPerformanceStats] = useState(null);
  const [structuredRecs, setStructuredRecs] = useState(null); // from /api/dashboard/recommendations
  const [dashboardReady, setDashboardReady] = useState(false);
  const [recsLoading, setRecsLoading] = useState(false);
  const [performanceRevision, setPerformanceRevision] = useState(0);
  const [profileLoadError, setProfileLoadError] = useState("");

  const alarmAudioRef = useRef(null);
  const [audioReady, setAudioReady] = useState(false);
  const [ringingAlarm, setRingingAlarm] = useState(null);
  const [snoozedUntil, setSnoozedUntil] = useState({});
  const [completedAlarmIds, setCompletedAlarmIds] = useState(new Set());

  useEffect(() => {
    function handleSessionExpired() {
      localStorage.removeItem("cognitive_alarm_user");
      setUser(null);
      setPage("login");
    }

    window.addEventListener("cognitive-alarm:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("cognitive-alarm:session-expired", handleSessionExpired);
    };
  }, []);

  useEffect(() => {
    if (!user?.id || user.role === "admin") return undefined;
    let cancelled = false;
    getProfile()
      .then((profile) => {
        if (!cancelled) {
          setUser((currentUser) => (
            currentUser?.id === profile.id
              ? { ...currentUser, ...profile }
              : currentUser
          ));
          setProfileLoadError("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setProfileLoadError(
            typeof error === "string" ? error : "Unable to load your time-zone and profile settings."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    function refreshPerformance() {
      setPerformanceRevision((revision) => revision + 1);
    }

    window.addEventListener(
      "cognitive-alarm:performance-updated",
      refreshPerformance
    );
    return () => {
      window.removeEventListener(
        "cognitive-alarm:performance-updated",
        refreshPerformance
      );
    };
  }, []);

  const initial = (user?.name || "U").charAt(0).toUpperCase();
  const currentDifficulty = dashboardStats?.recommended_difficulty || dashboardStats?.current_difficulty || "medium";
  const difficultyReason = dashboardStats?.difficulty_reason || "Complete a few more tasks to establish your baseline.";

  const navItems = useMemo(() => {
    if (user?.role === "admin") {
      return [
        { key: "dashboard", label: "Platform Overview", icon: "📊" },
        { key: "coach", label: "Wellness Coach", icon: "🩺" },
        { key: "coach-recommendations", label: "Coach Recommendations", icon: "💡" },
      ];
    }

    const items = [
      { key: "dashboard", label: "Overview", icon: "📊" },
      { key: "alarms", label: "Alarms", icon: "⏰" },
      { key: "results", label: "Analytics", icon: "📈" },
      { key: "habits", label: "Habits", icon: "🌱" },
      { key: "coach-recommendations", label: "Coach Recommendations", icon: "🩺" },
      { key: "profile", label: "Profile", icon: "⚙️" },
    ];
    if (user?.role === "wellness_coach") {
      items.push({ key: "coach", label: "Wellness Coach", icon: "🩺" });
    }
    return items;
  }, [user?.role]);

  // Load dashboard stats + performance
  useEffect(() => {
    if (!user || user.role === "admin") return undefined;
    let cancelled = false;

    Promise.all([getDashboardStats(), getPerformanceStats()])
      .then(([stats, performance]) => {
        if (cancelled) return;
        setDashboardStats(stats);
        setPerformanceStats(performance);
        setDashboardReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setDashboardStats(null);
        setPerformanceStats(null);
        setDashboardReady(true);
      });

    return () => { cancelled = true; };
  }, [user, performanceRevision]);

  // Load structured recommendations (separate call so it can be refreshed independently)
  useEffect(() => {
    if (!user || user.role === "admin") return undefined;
    let cancelled = false;

    getRecommendations()
      .then((data) => {
        if (cancelled) return;
        const recList = Array.isArray(data) ? data : (data?.recommendations ?? []);
        setStructuredRecs(recList);
      })
      .catch(() => {
        if (cancelled) return;
        setStructuredRecs([]);
      })
      .finally(() => {
        if (!cancelled) setRecsLoading(false);
      });

    return () => { cancelled = true; };
  }, [user, performanceRevision]);

  async function enableAlarmSound() {
    if (!alarmAudioRef.current) {
      alarmAudioRef.current = new Audio("/sounds/alarm.mp3");
      alarmAudioRef.current.loop = true;
    }
    try {
      await alarmAudioRef.current.play();
      alarmAudioRef.current.pause();
      alarmAudioRef.current.currentTime = 0;
      setAudioReady(true);
      return true;
    } catch {
      return false;
    }
  }

  async function startRinging(alarm) {
    if (!alarmAudioRef.current) {
      alarmAudioRef.current = new Audio("/sounds/alarm.mp3");
      alarmAudioRef.current.loop = true;
    }
    try { await triggerAlarm(alarm.id); } catch { /* continue */ }
    setRingingAlarm(alarm);
    try {
      alarmAudioRef.current.currentTime = 0;
      await alarmAudioRef.current.play();
    } catch {
      if (navigator.vibrate) navigator.vibrate([500, 250, 500, 250, 800]);
    }
  }

  function stopRinging() {
    if (alarmAudioRef.current) {
      alarmAudioRef.current.pause();
      alarmAudioRef.current.currentTime = 0;
    }
    setRingingAlarm(null);
  }

  function snoozeRinging(alarmId) {
    stopRinging();
    setSnoozedUntil((prev) => ({
      ...prev,
      [alarmId]: Date.now() + 2 * 60 * 1000,
    }));
  }

  async function finishChallenge(sessionId) {
    stopRinging();
    if (selectedAlarm) {
      await completeAlarm(selectedAlarm.id, sessionId);
      setCompletedAlarmIds((prev) => {
        const next = new Set(prev);
        next.add(selectedAlarm.id);
        return next;
      });
    }
    setSelectedAlarm(null);
    setPage("alarms");
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("cognitive_alarm_user");
    setUser(null);
    setPage("login");
  }

  // ── AUTH SCREENS ────────────────────────────────────────────────────
  if (!user) {
    if (page === "register") {
      return (
        <Suspense fallback={<div className="auth-wrapper">Loading registration...</div>}>
          <Register
            onRegisterSuccess={() => setPage("login")}
            onBackToLogin={() => setPage("login")}
          />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<div className="auth-wrapper">Loading sign-in...</div>}>
        <Login
          onLoginSuccess={(loggedInUser) => {
            const safeUser =
              loggedInUser && typeof loggedInUser === "object" && loggedInUser.user
                ? loggedInUser.user
                : loggedInUser && typeof loggedInUser === "object" && loggedInUser.email
                  ? loggedInUser
                  : null;
            if (safeUser) {
              localStorage.setItem("cognitive_alarm_user", JSON.stringify(safeUser));
              setUser(safeUser);
            }
            setPage("dashboard");
          }}
          onSwitchToRegister={() => setPage("register")}
          onCreateAccount={() => setPage("register")}
        />
      </Suspense>
    );
  }

  // ── AUTHENTICATED APP SHELL ─────────────────────────────────────────
  return (
    <div className="app">
      {/* GLOBAL HEADER */}
      <header className="saas-header">
        <div className="saas-header-inner">
          <button className="saas-brand" onClick={() => setPage("dashboard")}>
            <div className="saas-brand-icon">🧠</div>
            <div className="saas-brand-text">
              <span className="saas-brand-name">Cognitive Alarm</span>
              <span className="saas-brand-tag">AI Assistant</span>
            </div>
          </button>

          <nav className="saas-nav-links">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`saas-nav-item ${page === item.key ? "active" : ""}`}
                onClick={() => setPage(item.key)}
              >
                <span>{item.icon}</span>
                <span className="nav-text">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="saas-header-right">
            {user.role !== "admin" && <NotificationsBell />}
            <div className="saas-user-chip" title={user.email}>
              <div className="saas-user-avatar">{initial}</div>
              <span className="saas-user-name">{user.name || "User"}</span>
            </div>
            <button className="saas-logout-btn" onClick={handleLogout} title="Sign out">
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* RINGING ALARM MODAL */}
      {ringingAlarm && (
        <div className="ringing-backdrop">
          <div className="ringing-modal">
            <div className="ringing-pulse-ring">⏰</div>
            <div className="ringing-time">{ringingAlarm.alarm_time}</div>
            <h2 className="ringing-title">{ringingAlarm.title}</h2>
            <div className="ringing-meta">
              <span className="badge badge-purple">{ringingAlarm.difficulty || "medium"} difficulty</span>
              <span className="badge badge-cyan">{ringingAlarm.challenge_type || "cognitive"} puzzle</span>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 22, lineHeight: 1.5 }}>
              Wake up your brain! Complete the cognitive challenge to dismiss this alarm.
            </p>
            <div className="ringing-actions">
              <button className="btn btn-secondary" onClick={() => snoozeRinging(ringingAlarm.id)}>
                😴 Snooze 2m
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  setSelectedAlarm(ringingAlarm);
                  stopRinging();
                  setPage("challenge");
                }}
              >
                🧠 Start Challenge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN ROUTING */}
      <main style={{ flex: 1, padding: "24px 0" }}>
        {profileLoadError && user.role !== "admin" && (
          <div className="saas-container">
            <div className="alert-box alert-error" role="alert">{profileLoadError}</div>
          </div>
        )}
        <Suspense fallback={<div className="saas-container">Loading your dashboard...</div>}>
        {page === "profile" && user.role !== "admin" && (
          <Profile user={user} onProfileUpdated={setUser} onBack={() => setPage("dashboard")} />
        )}
        {page === "habits" && user.role !== "admin" && (
          <Habits onContinue={() => setPage("dashboard")} onBack={() => setPage("profile")} onProfileUpdated={setUser} />
        )}
        {page === "results" && user.role !== "admin" && <Results onBack={() => setPage("dashboard")} />}
        {page === "coach-recommendations" && (
          <CoachRecommendations isAdmin={user.role === "admin"} onBack={() => setPage("dashboard")} />
        )}
        {page === "coach" && (user.role === "wellness_coach" || user.role === "admin") && (
          <RoleDashboard role="wellness_coach" user={user} onBack={() => setPage("dashboard")} />
        )}
        {page === "dashboard" && user.role === "admin" && (
          <RoleDashboard role="admin" onBack={() => setPage("dashboard")} />
        )}
        {page === "challenge" && user.role !== "admin" && selectedAlarm && (
          <Challenge
            alarm={selectedAlarm}
            onBack={() => setPage("alarms")}
            onChallengeComplete={(sessionId) => finishChallenge(sessionId)}
          />
        )}
        {page === "alarms" && user.role !== "admin" && (
          <Alarm
            audioReady={audioReady}
            onEnableSound={enableAlarmSound}
            timeZone={user.timezone}
            ringingAlarmId={ringingAlarm?.id}
            snoozedUntil={snoozedUntil}
            completedAlarmIds={completedAlarmIds}
            onAlarmTriggered={startRinging}
            onSnoozeRinging={snoozeRinging}
            onBack={() => setPage("dashboard")}
            onStartChallenge={async (alarm) => {
              setSelectedAlarm(alarm);
              stopRinging();
              setPage("challenge");
            }}
          />
        )}

        {/* ── DASHBOARD ──────────────────────────────────────────────── */}
        {page === "dashboard" && user.role !== "admin" && (
          <PageShell
            eyebrow="Intelligence Dashboard"
            title={`Welcome back, ${user.name}`}
            subtitle="Your real-time habit score, adaptive difficulty, and AI-powered recommendations."
            action={
              <button className="btn btn-primary btn-sm" onClick={() => setPage("alarms")}>
                + New Alarm
              </button>
            }
          >
            {/* ── ROW 1: Key Stats ─────────────────────────────────── */}
            <div style={statGrid}>
              <StatCard
                icon="🏆"
                label="Habit Score"
                value={
                  !dashboardReady
                    ? "..."
                    : dashboardStats?.habit_score == null
                    ? "—"
                    : `${Math.round(dashboardStats.habit_score)}`
                }
                accent={COLORS.primary}
                subtitle={dashboardStats?.habit_score != null ? "/100" : "Sleep adherence not measured"}
              />
              <StatCard
                icon="📅"
                label="7-Day Consistency"
                value={
                  !dashboardReady
                    ? "..."
                    : `${dashboardStats?.days_with_completion_7d ?? 0}/7`
                }
                accent={COLORS.emerald}
                subtitle="days with completed alarm"
              />
              <StatCard
                icon="🎯"
                label="Challenge Accuracy"
                value={
                  !dashboardReady
                    ? "..."
                    : dashboardStats?.challenge_accuracy == null
                    ? "—"
                    : `${Math.round(dashboardStats.challenge_accuracy)}%`
                }
                accent={COLORS.cyan}
                subtitle="all-time correct answers"
              />
              <StatCard
                icon="⏱️"
                label="Avg Response Time"
                value={
                  !dashboardReady
                    ? "..."
                    : dashboardStats?.average_challenge_time == null
                    ? "—"
                    : `${Math.round(dashboardStats.average_challenge_time)}s`
                }
                accent={COLORS.amber}
                subtitle="per challenge question"
              />
              <StatCard
                icon="⏰"
                label="Completions"
                value={dashboardReady ? dashboardStats?.alarm_completions ?? "0" : "..."}
                accent={COLORS.emerald}
                subtitle="total alarm completions"
              />
              <StatCard
                icon="😴"
                label="Snooze Count"
                value={dashboardReady ? dashboardStats?.snooze_count ?? "0" : "..."}
                accent="#f87171"
                subtitle="total snooze actions"
              />
            </div>

            <div style={{ ...statGrid, marginTop: 16 }}>
              <StatCard
                icon="✅"
                label="Completed Challenges"
                value={dashboardReady ? dashboardStats?.completed_challenges ?? 0 : "..."}
                accent={COLORS.emerald}
                subtitle="fully correct challenge sessions"
              />
              <StatCard
                icon="🎯"
                label="Successful Challenges"
                value={dashboardReady ? dashboardStats?.successful_challenges ?? 0 : "..."}
                accent={COLORS.cyan}
                subtitle="verified in the database"
              />
              <StatCard
                icon="❌"
                label="Failed Challenges"
                value={dashboardReady ? dashboardStats?.failed_challenges ?? 0 : "..."}
                accent="#f87171"
                subtitle="fully answered, not passed"
              />
              <StatCard
                icon="📝"
                label="Challenge Attempts"
                value={dashboardReady ? dashboardStats?.challenge_attempts ?? 0 : "..."}
                accent={COLORS.primary}
                subtitle="recorded answer submissions"
              />
              <StatCard
                icon="🚨"
                label="Missed Alarms"
                value={dashboardReady ? dashboardStats?.missed_alarms ?? 0 : "..."}
                accent="#f87171"
                subtitle="triggered and unresolved"
              />
              <StatCard
                icon="📈"
                label="Alarm Completion"
                value={dashboardReady ? `${dashboardStats?.alarm_completion_rate ?? 0}%` : "..."}
                accent={COLORS.amber}
                subtitle="completions per recorded trigger"
              />
              <StatCard
                icon="📉"
                label="Recent Accuracy Trend"
                value={
                  dashboardReady && dashboardStats?.recent_accuracy_trend_pct != null
                    ? `${dashboardStats.recent_accuracy_trend_pct > 0 ? "+" : ""}${dashboardStats.recent_accuracy_trend_pct}%`
                    : dashboardReady
                    ? "—"
                    : "..."
                }
                accent={COLORS.cyan}
                subtitle="this 7 days vs the prior 7 days"
              />
              <StatCard
                icon="🌱"
                label="Habit Score Trend"
                value={
                  dashboardReady && dashboardStats?.habit_score_trend != null
                    ? `${dashboardStats.habit_score_trend > 0 ? "+" : ""}${dashboardStats.habit_score_trend} pts`
                    : dashboardReady
                    ? "—"
                    : "..."
                }
                accent={COLORS.emerald}
                subtitle="this 7 days vs the prior 7 days"
              />
            </div>

            {/* ── ROW 2: Habit Score + Adaptive Difficulty ─────────── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 20,
                marginTop: 24,
              }}
            >
              <HabitScoreCard
                score={dashboardStats?.habit_score}
                breakdown={dashboardStats?.habit_score_breakdown}
              />
              <DifficultyCard difficulty={currentDifficulty} reason={difficultyReason} />
            </div>

            {/* ── ROW 3: Recommendations ───────────────────────────── */}
            <div style={{ marginTop: 24 }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 16,
              }}>
                <div>
                  <div style={{ fontSize: 12, letterSpacing: 1.1, textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 }}>
                    AI-Powered Recommendations
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                    Personalized Insights
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setRecsLoading(true);
                    getRecommendations()
                      .then((data) => setStructuredRecs(data?.recommendations ?? []))
                      .catch(() => setStructuredRecs([]))
                      .finally(() => setRecsLoading(false));
                  }}
                  disabled={recsLoading}
                >
                  {recsLoading ? "Refreshing..." : "↻ Refresh"}
                </button>
              </div>

              {recsLoading ? (
                <div className="card" style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
                  <div>Analyzing your behavioral data...</div>
                </div>
              ) : !structuredRecs || structuredRecs.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                  <h3 style={{ color: "#fff", margin: "0 0 8px" }}>Not enough data yet</h3>
                  <p style={{ color: "#94a3b8", margin: 0 }}>
                    Complete a few alarm challenges to unlock personalized AI recommendations.
                  </p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                  {structuredRecs.map((rec) => (
                    <RecommendationCard key={rec.id ?? rec.title} rec={rec} />
                  ))}
                </div>
              )}
            </div>

            {/* ── ROW 4: Performance Visualizations ────────────────── */}
            <Visualizations performance={performanceStats} />

            {/* ── QUICK ACTIONS ─────────────────────────────────────── */}
            <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setPage("results")}>
                📈 View Detailed Analytics
              </button>
              <button className="btn btn-primary" onClick={() => setPage("alarms")}>
                ⏰ Manage Alarms
              </button>
            </div>
          </PageShell>
        )}
        </Suspense>
      </main>
    </div>
  );
}

export default App;