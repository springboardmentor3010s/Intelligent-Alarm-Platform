import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getCurrentUser,
  getDashboardStats,
  getHabitScore,
  getAlarms,
  getSessionHistory,
  isDemoActive,
} from "../services/api";

import Navbar from "../components/Navbar";
import WakeUpPredictionCard from "../components/analytics/WakeUpPredictionCard";

// Pre-configured formatters for Indian Standard Time (Asia/Kolkata)
const istTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const istDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function parseRepeatDays(pattern, type) {
  const p = (pattern || "").toLowerCase().trim();
  const t = (type || "").toLowerCase().trim();
  if (!p && (!t || t === "daily")) return [0, 1, 2, 3, 4, 5, 6];
  if (!p && t === "weekly") return [0, 1, 2, 3, 4, 5, 6];
  if (p === "daily" || p === "every day" || p === "everyday") return [0, 1, 2, 3, 4, 5, 6];
  if (p.includes("weekday") || p.includes("mon-fri") || p.includes("mon - fri")) return [1, 2, 3, 4, 5];
  if (p.includes("weekend")) return [0, 6];

  const dayMap = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tuesday: 2,
    wed: 3, wednesday: 3,
    thu: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6,
  };
  const matched = new Set();
  const tokens = p.split(/[\s,/-]+/);
  for (const token of tokens) {
    if (dayMap[token] !== undefined) matched.add(dayMap[token]);
  }
  if (matched.size > 0) return Array.from(matched);
  return [0, 1, 2, 3, 4, 5, 6];
}

function getISTDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10) - 1;
  const day = parseInt(map.day, 10);
  const hour = parseInt(map.hour === "24" ? "0" : map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const second = parseInt(map.second, 10);
  const dayOfWeek = new Date(Date.UTC(year, month, day)).getUTCDay();
  return { year, month, day, hour, minute, second, dayOfWeek };
}

function findNextAlarm(alarms, now = new Date()) {
  if (!Array.isArray(alarms) || alarms.length === 0) return null;
  const ist = getISTDateParts(now);
  const currentSecondsToday = ist.hour * 3600 + ist.minute * 60 + ist.second;

  let bestAlarm = null;
  let minDiffSeconds = Infinity;
  let bestDayOffset = null;

  for (const alarm of alarms) {
    if (!alarm.is_active || !alarm.alarm_time) continue;
    const timeParts = String(alarm.alarm_time).split(":").map(Number);
    const alarmHour = timeParts[0];
    const alarmMinute = timeParts[1];
    if (isNaN(alarmHour) || isNaN(alarmMinute)) continue;

    const alarmSecondsToday = alarmHour * 3600 + alarmMinute * 60;
    const allowedDays = parseRepeatDays(alarm.repeat_pattern, alarm.alarm_type);

    for (let offset = 0; offset <= 7; offset++) {
      const targetDayOfWeek = (ist.dayOfWeek + offset) % 7;
      if (!allowedDays.includes(targetDayOfWeek)) continue;

      if (offset === 0) {
        if (alarmSecondsToday > currentSecondsToday) {
          const diffSeconds = alarmSecondsToday - currentSecondsToday;
          if (diffSeconds < minDiffSeconds) {
            minDiffSeconds = diffSeconds;
            bestAlarm = alarm;
            bestDayOffset = offset;
          }
          break;
        }
      } else {
        const diffSeconds = (offset * 86400 + alarmSecondsToday) - currentSecondsToday;
        if (diffSeconds < minDiffSeconds) {
          minDiffSeconds = diffSeconds;
          bestAlarm = alarm;
          bestDayOffset = offset;
        }
        break;
      }
    }
  }

  if (!bestAlarm) return null;
  return {
    alarm: bestAlarm,
    diffSeconds: minDiffSeconds,
    dayOffset: bestDayOffset,
  };
}

function formatCountdown(diffSeconds) {
  if (diffSeconds == null || diffSeconds < 0) return "";
  if (diffSeconds === 0) return "due now";

  const days = Math.floor(diffSeconds / 86400);
  const hours = Math.floor((diffSeconds % 86400) / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);

  if (days > 0) {
    return `in ${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `in ${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `in ${minutes}m`;
  }
  return `in ${diffSeconds}s`;
}

function formatAlarmTime(alarmTimeStr) {
  if (!alarmTimeStr) return "--:--";
  const parts = String(alarmTimeStr).split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return alarmTimeStr;
  const period = h >= 12 ? "PM" : "AM";
  const formattedH = String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0");
  const formattedM = String(m).padStart(2, "0");
  return `${formattedH}:${formattedM} ${period}`;
}

function Dashboard() {
  const navigate = useNavigate();
  const isDemo = isDemoActive();

  const [user, setUser] = useState(null);
  const [dashboardStats, setDashboardStats] =
    useState(null);
  const [alarms, setAlarms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [habitScoreData, setHabitScoreData] = useState(null);
  const [habitScoreLoading, setHabitScoreLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Real-time IST clock update every second with proper cleanup
  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, []);
 
  function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good Morning";
  }

  if (hour < 17) {
    return "Good Afternoon";
  }

  if (hour < 21) {
    return "Good Evening";
  }

  return "Good Night";
}
  // =========================================================
  // LOAD DASHBOARD
  // =========================================================

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [
          currentUser,
          stats,
          alarmsData,
          sessionsData,
        ] = await Promise.all([
          getCurrentUser(),
          getDashboardStats(),
          getAlarms().catch((err) => {
            console.warn("Alarms load warning:", err);
            return [];
          }),
          getSessionHistory().catch((err) => {
            console.warn("Sessions load warning:", err);
            return { sessions: [] };
          }),
        ]);

        setUser(currentUser);
        setDashboardStats(stats);
        const alarmList = Array.isArray(alarmsData)
          ? alarmsData
          : Array.isArray(alarmsData?.alarms)
          ? alarmsData.alarms
          : [];
        setAlarms(alarmList);

        const sessionList = Array.isArray(sessionsData?.sessions)
          ? sessionsData.sessions
          : Array.isArray(sessionsData)
          ? sessionsData
          : [];
        setSessions(sessionList);
      } catch (error) {
        console.error(
          "Dashboard loading error:",
          error
        );

        if (!isDemoActive()) {
          localStorage.removeItem(
            "access_token"
          );

          localStorage.removeItem("user");

          navigate("/login");
        }
      } finally {
        setLoading(false);
      }

      // Fetch habit score independently without blocking dashboard
      try {
        const habitData = await getHabitScore();
        setHabitScoreData(habitData);
      } catch (err) {
        console.warn("Habit score load warning:", err);
      } finally {
        setHabitScoreLoading(false);
      }
    }

    loadDashboard();
  }, [navigate]);

  // =========================================================
  // EXIT DEMO MODE
  // =========================================================

  function handleExitDemo() {
    sessionStorage.removeItem("demo_mode");
    localStorage.removeItem("demo_mode");
    navigate("/login");
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  function handleLogout() {
    if (isDemo) {
      handleExitDemo();
      return;
    }

    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem("user");

    navigate("/login");
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="dashboard-loading">
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  // =========================================================
  // USER DATA
  // =========================================================

  const displayName = user?.name || "User";

  const progress =
    dashboardStats?.progress ?? 0;

  const formattedTime = istTimeFormatter.format(currentTime);
  const formattedDate = istDateFormatter.format(currentTime);
  const nextAlarmResult = findNextAlarm(alarms, currentTime);

  // =========================================================
  // DASHBOARD
  // =========================================================

  return (
    <div className="dashboard-page">

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <Navbar />


      <main className="dashboard-container">

        {/* ===================================================
            DEMO MODE INDICATOR BANNER
        =================================================== */}
        {isDemo && (
          <div className="demo-mode-banner" role="status" aria-label="Demo Mode Active">
            <div className="demo-banner-content">
              <span className="demo-badge">🎯 DEMO MODE</span>
              <span className="demo-banner-text">
                Interactive preview active with predefined sample data. All actions are simulated and read-only.
              </span>
            </div>
            <button
              type="button"
              className="exit-demo-button"
              onClick={handleExitDemo}
              title="Exit Demo Mode and Return to Login"
            >
              ✕ Exit Demo
            </button>
          </div>
        )}

        {/* ===================================================
            WELCOME & LIVE REAL-TIME CLOCK
        =================================================== */}

        <section className="welcome-section">

          <div className="welcome-content">

            <p className="welcome-label">
              Welcome back 👋
            </p>

            <h1>
  {getGreeting()},{" "}
  <span>{displayName}</span>
</h1>

            <p className="welcome-text">
              Ready to wake up your mind and
              start your day with focus?
            </p>

          </div>

          {/* REAL-TIME CURRENT TIME CLOCK CARD (IST) */}
          <div className="dashboard-clock-card" aria-label="Current Time and Next Alarm in Indian Standard Time">

            <div className="clock-card-header">

              <div className="clock-icon-wrapper" aria-hidden="true">
                🕒
              </div>

              <div className="clock-badge-group">
                <span className="clock-title">Current Time</span>
                <span className="clock-zone-badge">
                  <span className="clock-pulse-dot" />
                  IST (Asia/Kolkata)
                </span>
              </div>

            </div>

            <div className="clock-time-display">
              <span className="clock-time-digits">{formattedTime}</span>
            </div>

            <p className="clock-date-display">
              {formattedDate}
            </p>

            {/* NEXT ALARM SECTION */}
            <div
              className="next-alarm-section"
              onClick={() => navigate("/alarms")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  navigate("/alarms");
                }
              }}
              title="Manage Alarms"
            >

              <div className="next-alarm-header">

                <div className="next-alarm-title-group">
                  <span className="next-alarm-icon" aria-hidden="true">⏰</span>
                  <span className="next-alarm-label">NEXT ALARM</span>
                </div>

                {nextAlarmResult && (
                  <span className="next-alarm-countdown">
                    {formatCountdown(nextAlarmResult.diffSeconds)}
                  </span>
                )}

              </div>

              {nextAlarmResult ? (
                <div className="next-alarm-details">
                  <span className="next-alarm-name" title={nextAlarmResult.alarm.name}>
                    {nextAlarmResult.alarm.name || "Unnamed Alarm"}
                  </span>
                  <span className="next-alarm-time">
                    {formatAlarmTime(nextAlarmResult.alarm.alarm_time)}
                  </span>
                </div>
              ) : (
                <div className="no-next-alarm">
                  <span>No active alarms</span>
                </div>
              )}

            </div>

          </div>

        </section>


        {/* ===================================================
            PROFILE / ROLE / SESSION HISTORY
        =================================================== */}

        <section className="dashboard-cards">

          {/* =================================================
              PROFILE CARD
          ================================================= */}

          <div className="dashboard-card profile-card">

            <div className="card-icon">
              👤
            </div>

            <div className="profile-content">

              <p className="card-label">
                Profile
              </p>

              <h2>
                {displayName}
              </h2>

              <p className="card-value">
                {user?.email}
              </p>

              <button
                type="button"
                className="profile-button"
                onClick={() =>
                  navigate("/profile")
                }
              >
                View Profile
              </button>

            </div>

          </div>


          {/* =================================================
              ROLE CARD
          ================================================= */}

          <div className="dashboard-card role-card">

            <div className="card-icon">
              🛡️
            </div>

            <div>

              <p className="card-label">
                Your Role
              </p>

              <span
                className={`role-badge ${
                  user?.role === "admin"
                    ? "admin-role"
                    : "user-role"
                }`}
              >
                {user?.role?.toUpperCase()}
              </span>

            </div>

          </div>


          {/* =================================================
              SESSION HISTORY CARD
          ================================================= */}

          <div
            className="dashboard-card history-card"
            onClick={() =>
              navigate("/session-history")
            }
          >

            <div className="card-icon">
              📊
            </div>

            <div className="history-content">

              <p className="card-label">
                Performance
              </p>

              <h2>
                Session History
              </h2>

              <p className="card-value">
                Review your cognitive alarm
                sessions and performance.
              </p>

              <button
                type="button"
                className="history-button"
                onClick={(event) => {
                  event.stopPropagation();

                  navigate(
                    "/session-history"
                  );
                }}
              >
                View History
              </button>

            </div>

          </div>


          {/* =================================================
              HABIT SCORE CARD (MILESTONE 3)
          ================================================= */}

          <div
            className="dashboard-card habit-dashboard-card clickable-card"
            onClick={() => navigate("/analytics")}
          >

            <div className="card-top">

              <span className="card-badge">  
              </span>

              <span className="card-icon">
                🎯
              </span>

            </div>


            <div className="card-content">

              <p className="card-label card-title">
                Habit Intelligence
              </p>

              <h2>
                Habit Score
              </h2>

              <div className="habit-score-display">
                <strong>
                  {habitScoreLoading
                    ? "..."
                    : habitScoreData?.overall_habit_score != null
                    ? Number(habitScoreData.overall_habit_score).toFixed(1)
                    : "—"}
                </strong>
                <span> / 100</span>
              </div>

              <p className="card-value">
                {habitScoreData?.wake_up_consistency != null
                  ? `Consistency: ${Number(habitScoreData.wake_up_consistency).toFixed(0)}% • Snooze: ${Number(habitScoreData.snooze_reduction).toFixed(0)}%`
                  : "Behavioral consistency & cognitive performance."}
              </p>

              <div className="habit-score-breakdown-pills">
                <span className="habit-pill" title="Wake-Up Consistency">
                  Consistency: <strong>{Number(habitScoreData?.wake_up_consistency ?? 85).toFixed(0)}%</strong>
                </span>
                <span className="habit-pill" title="Challenge Completion Rate">
                  Challenges: <strong>{Number(habitScoreData?.challenge_completion ?? 90).toFixed(0)}%</strong>
                </span>
                <span className="habit-pill" title="Snooze Reduction">
                  Snooze: <strong>{Number(habitScoreData?.snooze_reduction ?? 80).toFixed(0)}%</strong>
                </span>
                <span className="habit-pill" title="Sleep Schedule Adherence">
                  Adherence: <strong>{Number(habitScoreData?.sleep_schedule_adherence ?? 75).toFixed(0)}%</strong>
                </span>
              </div>

              <button
                type="button"
                className="history-button habit-view-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate("/analytics");
                }}
              >
                View Analytics
              </button>

            </div>

          </div>

        </section>


        {/* ===================================================
            AI WAKE-UP PREDICTION (XGBOOST ENGINE)
            Placed immediately after Habit Score card
        =================================================== */}
        {/* <WakeUpPredictionCard /> */}


        {/* ===================================================
            STATISTICS
        =================================================== */}

        <section className="stats-grid">

          {/* TOTAL ALARMS */}

          <div className="stat-card">

            <span className="stat-icon">
              ⏰
            </span>

            <div>

              <p>
                Total Alarms
              </p>

              <h2>
                {dashboardStats?.total_alarms ?? 0}
              </h2>

            </div>

          </div>


          {/* ACTIVE ALARMS */}

          <div className="stat-card">

            <span className="stat-icon">
              🔔
            </span>

            <div>

              <p>
                Active Alarms
              </p>

              <h2>
                {dashboardStats?.active_alarms ?? 0}
              </h2>

            </div>

          </div>


          {/* TOTAL SESSIONS */}

          <div className="stat-card">

            <span className="stat-icon">
              🧠
            </span>

            <div>

              <p>
                Total Sessions
              </p>

              <h2>
                {dashboardStats?.total_sessions ?? 0}
              </h2>

            </div>

          </div>


          {/* COMPLETED */}

          <div className="stat-card">

            <span className="stat-icon">
              ✅
            </span>

            <div>

              <p>
                Completed
              </p>

              <h2>
                {dashboardStats?.completed_sessions ?? 0}
              </h2>

            </div>

          </div>

        </section>


        {/* ===================================================
            COGNITIVE PROGRESS
        =================================================== */}

        <section className="progress-section">

          <div className="section-header">

            <div>

              <p className="section-label">
                Your Progress
              </p>

              <h2>
                Cognitive Progress
              </h2>

            </div>

            <strong className="progress-percentage">
              {progress}%
            </strong>

          </div>


          {/* PROGRESS BAR */}

          <div className="progress-bar">

            <div
              className="progress-fill"
              style={{
                width: `${progress}%`,
              }}
            />

          </div>


          {/* PROGRESS INFO */}

          <div className="progress-info">

            <span className="progress-stat-pill success">
              <span className="pill-check-icon" aria-hidden="true">✓ </span>{dashboardStats?.correct_answers ?? 0} correct answers
            </span>

            {dashboardStats?.wrong_answers > 0 && (
              <span className="progress-stat-pill danger">
                <span className="pill-cross-icon" aria-hidden="true">✗ </span>{dashboardStats?.wrong_answers} wrong {dashboardStats?.wrong_answers === 1 ? "answer" : "answers"}
              </span>
            )}

            <span className="progress-stat-pill info">
              <span className="pill-brain-icon" aria-hidden="true">🧠 </span>{dashboardStats?.answered_challenges ?? 0} challenges answered
            </span>
          </div>

        </section>


        {/* ===================================================
            QUICK ACTIONS
        =================================================== */}

        <section className="quick-section">

          <h2>
            Quick Actions
          </h2>

          <div className="quick-actions">

            {/* MANAGE ALARMS */}
            <button
              type="button"
              onClick={() =>
                navigate("/alarms")
              }
              className="action-button"
            >
              <span className="action-icon-box" aria-hidden="true">
                ⏰
              </span>
              <span className="action-button-label">
                Manage Alarms
              </span>
              <span className="action-chevron" aria-hidden="true">›</span>
            </button>

            {/* COGNITIVE ALARM */}
            <button
              type="button"
              onClick={() =>
                navigate(
                  "/cognitive-alarm"
                )
              }
              className="action-button"
            >
              <span className="action-icon-box" aria-hidden="true">
                🧠
              </span>
              <span className="action-button-label">
                Cognitive Alarm
              </span>
              <span className="action-chevron" aria-hidden="true">›</span>
            </button>

            {/* SESSION HISTORY */}
            <button
              type="button"
              onClick={() =>
                navigate(
                  "/session-history"
                )
              }
              className="action-button"
            >
              <span className="action-icon-box" aria-hidden="true">
                📊
              </span>
              <span className="action-button-label">
                Session History
              </span>
              <span className="action-chevron" aria-hidden="true">›</span>
            </button>

            {/* ANALYTICS */}
            <button
              type="button"
              onClick={() =>
                navigate(
                  "/analytics"
                )
              }
              className="action-button"
            >
              <span className="action-icon-box" aria-hidden="true">
                📑
              </span>
              <span className="action-button-label">
                Analytics
              </span>
              <span className="action-chevron" aria-hidden="true">›</span>
            </button>

          </div>

        </section>

        {/* ===================================================
            LOGOUT / EXIT DEMO
        =================================================== */}
        <div className="dashboard-footer-actions">
          {isDemo ? (
            <button
              type="button"
              className="logout-button exit-demo-button-main"
              onClick={handleExitDemo}
            >
              Exit Demo / Back to Login
            </button>
          ) : (
            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          )}
        </div>

      </main>

    </div>
  );
}

export default Dashboard;