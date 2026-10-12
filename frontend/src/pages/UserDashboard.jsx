import React, { useEffect, useState, useRef } from "react";
import {
  AlarmClock,
  Brain,
  BarChart3,
  Plus,
  Play,
  Zap,
  Flame,
  Trophy,
  ChevronRight,
  User as UserIcon,
  CheckCircle2,
  Clock,
  Save,
  Loader2,
  Bell,
  Activity
} from "lucide-react";
import AppShell from "../components/AppShell";
import AccessDenied from "../components/AccessDenied";
import MyAlarms from "./user/MyAlarms";
import Challenge from "./user/Challenge";
import PracticeChallenges from "./user/PracticeChallenges";
import Progress from "./user/Progress";
import UserReports from "./user/UserReports";
import NotificationsCenter from "./NotificationsCenter";
import RoleBadge from "../components/RoleBadge";
import api from "../services/api";
import { getTimeOfDayGreeting, formatAlarmTime, parseTo24Hour } from "../utils/timeUtils";


function UserDashboard({ user, token, onLogout }) {
  // Access Protection Guard
  if (user?.role !== "USER" && user?.role !== "ADMIN" && user?.role !== "WELLNESS_COACH") {
    return <AccessDenied userRole={user?.role} />;
  }

  const [activeTab, setActiveTab] = useState("dashboard");
  const [alarms, setAlarms] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [testAlarmItem, setTestAlarmItem] = useState(null);
  const [ringingAlarm, setRingingAlarm] = useState(null);
  const [liveClock, setLiveClock] = useState(new Date());

  // Refs so the alarm interval always sees fresh values without restarting
  const alarmsRef = useRef([]);
  const ringingAlarmRef = useRef(null);

  // Profile Form state
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileTimezone, setProfileTimezone] = useState(user?.timezone || "Asia/Kolkata");
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  const loadUserData = async () => {
    try {
      const [alarmsRes, perfRes] = await Promise.all([
        api.get("/alarms", { headers: { Authorization: `Bearer ${token}` } }),
        api.get("/performance", { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null })),
      ]);
      setAlarms(alarmsRes.data || []);
      setPerformance(perfRes.data || null);
    } catch (error) {
      console.error("Failed to load user data:", error);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  // Keep refs in sync with latest state so the interval always sees fresh values
  useEffect(() => { alarmsRef.current = alarms; }, [alarms]);
  useEffect(() => { ringingAlarmRef.current = ringingAlarm; }, [ringingAlarm]);

  const lastTriggeredMinute = useRef(null);
  const dismissedAlarmsToday = useRef(new Set());

  const getTodayKey = (dateObj) => {
    const yyyy = dateObj.getFullYear();
    const mm = (dateObj.getMonth() + 1).toString().padStart(2, "0");
    const dd = dateObj.getDate().toString().padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Live clock tick every second (drives both the display AND the alarm check)
  useEffect(() => {
    /**
     * Normalize any stored alarm_time to "HH:mm" 24-hour format.
     * Handles: "07:00", "07:00 AM", "7:00 PM", "19:30", etc.
     */
    const normalizeToHHMM = (timeStr) => {
      if (!timeStr) return null;
      const s = String(timeStr).trim().toUpperCase();
      const isPM = s.includes("PM");
      const isAM = s.includes("AM");
      const clean = s.replace(/AM|PM/g, "").trim();
      const parts = clean.split(":");
      if (parts.length < 2) return null;
      let h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (isNaN(h) || isNaN(m)) return null;
      if (isPM && h !== 12) h += 12;
      if (isAM && h === 12) h = 0;
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    };

    const tick = () => {
      const now = new Date();
      setLiveClock(new Date(now)); // update live display

      // Skip if an alarm is already ringing
      if (ringingAlarmRef.current) return;

      const todayKey = getTodayKey(now);
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const currentDayName = dayNames[now.getDay()];
      const currentDayOfMonth = now.getDate().toString();

      const hh = now.getHours().toString().padStart(2, "0");
      const mm = now.getMinutes().toString().padStart(2, "0");
      const currentTimeStr = `${hh}:${mm}`;

      // Prevent firing more than once per minute for the same time
      if (lastTriggeredMinute.current === currentTimeStr) return;

      const currentAlarms = alarmsRef.current;
      const alarmToRing = currentAlarms.find(a => {
        if (!a.enabled || !a.alarm_time) return false;

        // Prevent firing if already dismissed today
        if (dismissedAlarmsToday.current.has(`${a.id}_${todayKey}`)) {
          return false;
        }

        const normalized = normalizeToHHMM(a.alarm_time);
        if (normalized !== currentTimeStr) return false;

        // Check repeat type matching
        const repeatType = a.repeat_type || "daily";
        if (repeatType === "weekly") {
          const days = a.repeat_days || [];
          if (days.length > 0 && !days.includes(currentDayName)) {
            return false;
          }
        } else if (repeatType === "monthly") {
          const days = a.repeat_days || [];
          if (days.length > 0 && days[0] !== currentDayOfMonth) {
            return false;
          }
        }

        return true;
      });

      if (alarmToRing) {
        console.log(`[AlarmClock] ⏰ Alarm triggered: "${alarmToRing.title}" at ${currentTimeStr}`);
        lastTriggeredMinute.current = currentTimeStr;
        setRingingAlarm(alarmToRing);
      }
    };

    tick(); // check immediately on mount
    const interval = setInterval(tick, 1000); // check every second
    return () => clearInterval(interval);
  }, []); // runs once — uses refs for live data, no restarts

  const nowForNext = liveClock;
  const hhForNext = nowForNext.getHours().toString().padStart(2, "0");
  const mmForNext = nowForNext.getMinutes().toString().padStart(2, "0");
  const currentTimeStrForNext = `${hhForNext}:${mmForNext}`;
  const todayKeyForNext = getTodayKey(nowForNext);

  const nextAlarm =
    alarms.length > 0
      ? (alarms.find((alarm) => {
          if (!alarm.enabled) return false;
          const repeatType = alarm.repeat_type || "daily";
          const normalizedTime = parseTo24Hour(alarm.alarm_time);

          if (repeatType === "once") {
            if (dismissedAlarmsToday.current.has(`${alarm.id}_${todayKeyForNext}`)) return false;
            if (normalizedTime <= currentTimeStrForNext) return false;
          }

          return true;
        }) || null)
      : null;

  const handleTestAlarm = (alarm) => {
    setTestAlarmItem(alarm);
    setActiveTab("challenges");
  };

  const handleSnoozeAlarm = ({ alarm, durationMinutes }) => {
    setRingingAlarm(null);
    // Reset the lastTriggeredMinute so the snoozed time can trigger a new ring
    lastTriggeredMinute.current = null;
    if (activeTab === "challenges") {
      setActiveTab("dashboard");
    }

    const duration = durationMinutes || 5;
    const alarmId = alarm?.id || "demo";
    
    // Log snooze event to backend analytics
    api.post(`/alarms/${alarmId}/snooze?duration=${duration}`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(err => console.error("Failed to log snooze event:", err));

    const now = new Date();
    const nextRingDate = new Date(now.getTime() + duration * 60 * 1000);
    const h = nextRingDate.getHours().toString().padStart(2, '0');
    const m = nextRingDate.getMinutes().toString().padStart(2, '0');
    const snoozedTimeStr = `${h}:${m}`;

    // Update in-memory alarms state with snoozed time and decremented max_snoozes
    setAlarms(prev =>
      prev.map(a => {
        if (a.id === alarm.id) {
          const currentRemaining = a.max_snoozes !== undefined ? a.max_snoozes : 2;
          return {
            ...a,
            alarm_time: snoozedTimeStr,
            max_snoozes: Math.max(0, currentRemaining - 1)
          };
        }
        return a;
      })
    );

    alert(`💤 Alarm snoozed for ${duration} minute(s)! It will ring again at ${snoozedTimeStr}.`);
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
      setProfileMessage("✅ Profile details updated successfully!");
    } catch (err) {
      setProfileMessage("❌ Failed to update profile details.");
    } finally {
      setProfileUpdating(false);
    }
  };

  const timeMeta = getTimeOfDayGreeting();
  const nextAlarmTimeMeta = nextAlarm ? formatAlarmTime(nextAlarm.alarm_time) : null;

  // Compute countdown to next alarm
  const getNextAlarmCountdown = () => {
    if (!nextAlarm?.alarm_time) return null;
    const now = liveClock;
    const [h, m] = parseTo24Hour(nextAlarm.alarm_time).split(":").map(Number);
    const alarmDate = new Date(now);
    alarmDate.setHours(h, m, 0, 0);
    if (alarmDate <= now) alarmDate.setDate(alarmDate.getDate() + 1);
    const diff = Math.floor((alarmDate - now) / 1000);
    const hrs = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };
  const countdownLabel = getNextAlarmCountdown();

  // Live clock display
  const clockDisplay = liveClock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const dateDisplay = liveClock.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const pageTitleMap = {
    dashboard:   "Dashboard",
    alarms:      "My Alarms",
    challenges:  "Cognitive Challenges",
    performance: "Performance Analytics",
    reports:     "My Reports",
    notifications: "Reminders",
    profile:     "User Profile"
  };

  return (
    <AppShell
      user={user}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onLogout={onLogout}
      title={pageTitleMap[activeTab] || "User Workspace"}
      streak={performance?.current_streak ?? user?.current_streak ?? 0}
    >
      {/* DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ── TOP HERO: CLOCK + GREETING ──────────────────────────── */}
          <section className="dashboard-hero" style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 20,
            alignItems: "center",
            background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.08) 50%, rgba(16,185,129,0.06) 100%)",
            border: "1px solid rgba(139,92,246,0.25)",
            borderRadius: 20,
            padding: "28px 32px",
            position: "relative",
            overflow: "hidden"
          }}>
            {/* Glow orbs */}
            <div style={{ position: "absolute", top: -40, left: -40, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -30, right: 60, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

            <div style={{ zIndex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
                {timeMeta.smallLabel} · {dateDisplay}
              </p>
              <h1 style={{ fontSize: "clamp(22px,3vw,34px)", fontWeight: 900, margin: "0 0 6px", color: "#fff" }}>
                {timeMeta.greeting}, {user?.name?.split(" ")[0] || "User"}! <span>{timeMeta.icon}</span>
              </h1>
              <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>{timeMeta.subtitle}</p>

              <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                <button className="create-alarm-button" onClick={() => setActiveTab("alarms")}>
                  <Plus size={16} /> Manage Alarms
                </button>
                <button
                  className="primary-button"
                  onClick={() => { setTestAlarmItem(nextAlarm); setActiveTab("challenges"); }}
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)", border: "none" }}
                >
                  <Zap size={16} /> Start Challenge
                </button>
              </div>
            </div>

            {/* Live Clock */}
            <div className="live-time-panel" style={{
              zIndex: 1, textAlign: "center",
              background: "rgba(15,23,42,0.55)",
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: 18, padding: "18px 28px",
              backdropFilter: "blur(12px)"
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: 2, marginBottom: 4 }}>LIVE TIME</div>
              <div style={{ fontSize: "clamp(22px,3vw,32px)", fontWeight: 900, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: 1 }}>
                {clockDisplay}
              </div>
              {countdownLabel && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#34d399", fontWeight: 700 }}>
                  ⏰ Next alarm in {countdownLabel}
                </div>
              )}
            </div>
          </section>

          {/* ── NEXT ALARM CARD ─────────────────────────────────────── */}
          <section className="next-alarm-card" style={{ position: "relative", overflow: "hidden" }}>
            {nextAlarm ? (
              <>
                <div style={{ position: "absolute", top: 0, right: 0, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${nextAlarm?.role_meta?.color || "rgba(99,102,241"}0.12) 0%, transparent 70%)`, pointerEvents: "none" }} />

                <div className="alarm-icon-box" style={{ fontSize: 36, position: "relative", zIndex: 1 }}>
                  {nextAlarm?.role_meta?.icon || "⏰"}
                </div>

                <div className="next-alarm-info" style={{ zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", textTransform: "uppercase", letterSpacing: 1.5 }}>NEXT UPCOMING ALARM</span>
                    <span className={`role-card-badge role-pill-${(nextAlarm.alarm_role || 'standard').toLowerCase()}`}>
                      {nextAlarm.role_meta?.name || nextAlarm.alarm_role}
                    </span>
                    {countdownLabel && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", padding: "3px 10px", borderRadius: 20 }}>
                        ⏱ {countdownLabel} away
                      </span>
                    )}
                  </div>
                  <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 900, margin: "0 0 4px", letterSpacing: -1 }}>
                    {nextAlarmTimeMeta ? nextAlarmTimeMeta.displayTime : "--:--"}
                  </h2>
                  <p className="next-alarm-meta" style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600, margin: 0 }}>
                    {nextAlarm.title} · {nextAlarm.difficulty || 'MEDIUM'} Difficulty · {
                      nextAlarm.repeat_type === "once" ? "🗓️ Once" :
                      nextAlarm.repeat_type === "monthly" ? "📆 Monthly" :
                      nextAlarm.repeat_type === "weekly" ? `📅 Weekly (${nextAlarm.repeat_days?.join(", ") || "Mon-Sun"})` :
                      "🔁 Daily"
                    }
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => handleTestAlarm(nextAlarm)}
                  style={{ whiteSpace: "nowrap", zIndex: 1, background: "linear-gradient(135deg, #f59e0b, #ef4444)", border: "none" }}
                >
                  <Play size={18} /> Test Alarm
                </button>
              </>
            ) : (
              <>
                <div className="alarm-icon-box" style={{ fontSize: 36, position: "relative", zIndex: 1, background: "rgba(255,255,255,0.05)" }}>
                  🔕
                </div>

                <div className="next-alarm-info" style={{ zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5 }}>NO ALARMS YET</span>
                  </div>
                  <h2 style={{ fontSize: "clamp(22px,3vw,32px)", fontWeight: 800, margin: "0 0 4px", color: "#f1f5f9" }}>
                    No Active Alarms Set
                  </h2>
                  <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
                    You don't have any upcoming alarms enabled. Create your first cognitive wake-up alarm to start!
                  </p>
                </div>

                <button
                  className="create-alarm-button"
                  onClick={() => setActiveTab("alarms")}
                  style={{ whiteSpace: "nowrap", zIndex: 1, padding: "12px 24px" }}
                >
                  <Plus size={18} /> Add Alarm
                </button>
              </>
            )}
          </section>

          {/* ── 4 RICH STAT CARDS ───────────────────────────────────── */}
          <section className="stats-grid">
            {/* Streak Card */}
            <div className="stat-card" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(15,23,42,0.7) 100%)", border: "1px solid rgba(245,158,11,0.25)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, fontSize: 64, opacity: 0.06, pointerEvents: "none" }}>🔥</div>
              <div className="stat-icon orange"><Flame size={22} /></div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: 1 }}>Wake Streak</span>
              <strong style={{ fontSize: 28, fontWeight: 900, color: "#fde047" }}>
                🔥 {performance?.current_streak ?? 0}
                <span style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginLeft: 4 }}>days</span>
              </strong>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <small style={{ color: performance?.current_streak > 0 ? "#34d399" : "#94a3b8" }}>
                  {performance?.current_streak > 0 ? "🟢 Active streak" : "Start today to begin!"}
                </small>
                {(performance?.longest_streak ?? 0) > 0 && (
                  <small style={{ color: "#64748b" }}>Best: {performance.longest_streak} days</small>
                )}
              </div>
            </div>

            {/* Cognitive Score Card */}
            <div className="stat-card" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(15,23,42,0.7) 100%)", border: "1px solid rgba(139,92,246,0.25)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, fontSize: 64, opacity: 0.06, pointerEvents: "none" }}>🧠</div>
              <div className="stat-icon purple"><Brain size={22} /></div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: 1 }}>Cognitive Score</span>
              <strong style={{ fontSize: 28, fontWeight: 900, color: "#c4b5fd" }}>
                {performance?.accuracy ?? 0}
                <span style={{ fontSize: 16, fontWeight: 700, color: "#94a3b8" }}>%</span>
              </strong>
              <div style={{ height: 4, background: "rgba(139,92,246,0.15)", borderRadius: 2, marginTop: 4 }}>
                <div style={{ height: "100%", width: `${Math.min(100, performance?.accuracy ?? 0)}%`, background: "linear-gradient(90deg, #8b5cf6, #a78bfa)", borderRadius: 2, transition: "width 0.8s ease" }} />
              </div>
              <small style={{ color: "#94a3b8" }}>Puzzle accuracy rate</small>
            </div>

            {/* Challenges Card */}
            <div className="stat-card" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(15,23,42,0.7) 100%)", border: "1px solid rgba(16,185,129,0.25)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, fontSize: 64, opacity: 0.06, pointerEvents: "none" }}>🏆</div>
              <div className="stat-icon yellow"><Trophy size={22} /></div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: 1 }}>Solved</span>
              <strong style={{ fontSize: 28, fontWeight: 900, color: "#34d399" }}>
                {performance?.completed_alarms ?? 0}
                <span style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginLeft: 4 }}>puzzles</span>
              </strong>
              <small style={{ color: "#94a3b8" }}>Alarms dismissed via challenge</small>
            </div>

            {/* ML Habit Score Card */}
            <div className="stat-card" style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(15,23,42,0.7) 100%)", border: "1px solid rgba(236,72,153,0.25)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, fontSize: 64, opacity: 0.06, pointerEvents: "none" }}>📈</div>
              <div className="stat-icon purple" style={{ background: "rgba(236,72,153,0.2)", color: "#f472b6" }}><Activity size={22} /></div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f472b6", textTransform: "uppercase", letterSpacing: 1 }}>Habit Score</span>
              <strong style={{ fontSize: 28, fontWeight: 900, color: "#fbcfe8" }}>
                {performance?.habit_score ?? 75}
                <span style={{ fontSize: 16, fontWeight: 700, color: "#94a3b8" }}>%</span>
              </strong>
              <div style={{ height: 4, background: "rgba(236,72,153,0.15)", borderRadius: 2, marginTop: 4 }}>
                <div style={{ height: "100%", width: `${Math.min(100, performance?.habit_score ?? 75)}%`, background: "linear-gradient(90deg, #ec4899, #f472b6)", borderRadius: 2, transition: "width 0.8s ease" }} />
              </div>
              <small style={{ color: "#f472b6", fontWeight: 600 }}>{performance?.habit_tier || "Building Habit 📈"}</small>
            </div>
          </section>


          {/* ── START CHALLENGE BANNER ───────────────────────────────── */}
          <section className="challenge-card">
            <div className="challenge-left">
              <div className="challenge-icon"><Zap size={28} /></div>
              <div>
                <span>COGNITIVE WAKE-UP</span>
                <h2>Test your mind against today's assigned wake-up puzzle.</h2>
              </div>
            </div>
            <button
              className="challenge-button"
              onClick={() => { setTestAlarmItem(nextAlarm); setActiveTab("challenges"); }}
            >
              Start Challenge <ChevronRight size={20} />
            </button>
          </section>
        </div>
      )}

      {/* MY ALARMS TAB */}
      {activeTab === "alarms" && (
        <MyAlarms
          token={token}
          user={user}
          onTestAlarm={handleTestAlarm}
          onAlarmsChange={(updated) => setAlarms(updated)}
        />
      )}

      {/* CHALLENGES TAB */}
      {activeTab === "challenges" && (
        <PracticeChallenges token={token} />
      )}

      {/* FULL-SCREEN AUTOMATED RINGING ALARM TAKEOVER */}
      {ringingAlarm && (
        <Challenge
          token={token}
          alarm={ringingAlarm}
          onDismiss={() => {
            const now = new Date();
            const todayKey = getTodayKey(now);
            if (ringingAlarm?.id) {
              dismissedAlarmsToday.current.add(`${ringingAlarm.id}_${todayKey}`);
              if (ringingAlarm.repeat_type === "once") {
                api.patch(`/alarms/${ringingAlarm.id}/toggle`, {}, {
                  headers: { Authorization: `Bearer ${token}` }
                }).catch(err => console.error("Failed to auto-disable once alarm:", err));
                setAlarms(prev => prev.map(a => a.id === ringingAlarm.id ? { ...a, enabled: false } : a));
              }
            }
            setRingingAlarm(null);
            loadUserData();
            setActiveTab("performance");
          }}
          onSnooze={handleSnoozeAlarm}
        />
      )}

      {/* PERFORMANCE / PROGRESS TAB */}
      {activeTab === "performance" && (
        <Progress token={token} />
      )}


      {/* PROFILE TAB */}
      {activeTab === "profile" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}>
          <div className="progress-card">
            <h2>User Account Profile</h2>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Manage your personal details and wake-up preferences.</p>

            {/* PROFILE STREAK BADGE CARD */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, background: "rgba(15, 23, 42, 0.6)", padding: 18, borderRadius: 14, border: "1px solid rgba(255, 255, 255, 0.08)", marginTop: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg, #8b5cf6, #ec4899)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
                {user?.name?.slice(0, 1) || "U"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{user?.name || "User"}</div>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 2 }}>{user?.email}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.35)", padding: "8px 14px", borderRadius: 20, color: "#fcd34d", fontWeight: 700, fontSize: 13 }}>
                  <Flame size={16} color="#f59e0b" />
                  <span>{performance?.current_streak ?? 0} Streak</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.35)", padding: "8px 14px", borderRadius: 20, color: "#34d399", fontWeight: 700, fontSize: 13 }}>
                  <Trophy size={16} color="#10b981" />
                  <span>{performance?.completed_alarms ?? 0} Solved</span>
                </div>
              </div>
            </div>

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
                <input
                  type="text"
                  value={user?.username || ""}
                  disabled
                  style={{ opacity: 0.6, cursor: "not-allowed" }}
                />
              </div>

              <div className="form-control">
                <label>EMAIL ADDRESS (READ-ONLY)</label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  style={{ opacity: 0.6, cursor: "not-allowed" }}
                />
              </div>

              <div className="form-control">
                <label>ACCOUNT ROLE (READ-ONLY)</label>
                <div style={{ paddingTop: 4 }}>
                  <RoleBadge role={user?.role} />
                </div>
              </div>

              <div className="form-control">
                <label>TIMEZONE PREFERENCE</label>
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
                <div style={{ padding: 12, borderRadius: 10, background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.3)", color: "#c4b5fd", fontSize: 13 }}>
                  {profileMessage}
                </div>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={profileUpdating}
                style={{ width: 180, marginTop: 8 }}
              >
                {profileUpdating ? <Loader2 size={16} className="spin" /> : <><Save size={16} /> Save Changes</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === "reports" && (
        <UserReports token={token} user={user} />
      )}
      {activeTab === "notifications" && <NotificationsCenter token={token} />}
    </AppShell>
  );
}

export default UserDashboard;
