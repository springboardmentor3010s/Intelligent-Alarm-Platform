import React, { useEffect, useState, useCallback } from "react";
import {
  Activity,
  AlarmClock,
  Brain,
  CheckCircle2,
  Download,
  Flame,
  RefreshCw,
  BarChart3,
  Target,
  Zap,
} from "lucide-react";
import api from "../../services/api";

/* ─── Design tokens ─── */
const card = {
  background: "rgba(15, 23, 42, 0.72)",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  borderRadius: 14,
  padding: 20,
  backdropFilter: "blur(12px)",
};
const muted = { color: "#94a3b8", fontSize: 13 };

/* ─── Main Component ─── */
function UserReports({ token, user }) {
  const [analytics, setAnalytics] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);

  const headers = { headers: { Authorization: `Bearer ${token}` } };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [anaRes, tsRes, perfRes, histRes] = await Promise.allSettled([
        api.get("/ml-sd/analytics", headers),
        api.get(`/ml-sd/behavior-timeseries?days=${timeRange}`, headers),
        api.get("/performance", headers),
        api.get("/challenges/history", headers),
      ]);
      if (anaRes.status === "fulfilled") setAnalytics(anaRes.value.data);
      if (tsRes.status === "fulfilled") setTimeseries(tsRes.value.data || []);
      if (perfRes.status === "fulfilled") setPerformance(perfRes.value.data);
      if (histRes.status === "fulfilled") setHistory(histRes.value.data || []);
    } catch (e) {
      console.error("Reports fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [token, timeRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ─── Derived metrics ─── */
  const streak          = analytics?.current_streak ?? performance?.current_streak ?? 0;
  const longestStreak   = analytics?.longest_streak ?? performance?.longest_streak ?? 0;
  const habitScore      = Math.round(analytics?.habit_score ?? performance?.habit_score ?? 0);
  const habitTier       = analytics?.habit_tier ?? performance?.habit_tier ?? "Building Habit 📈";
  const accuracy        = Math.round(analytics?.accuracy_rate ?? performance?.accuracy ?? 0);
  const totalAttempts   = analytics?.total_attempts ?? history.length;
  const alarmSessions   = analytics?.alarm_sessions ?? performance?.total_alarms ?? 0;
  const completedSessions = analytics?.completed_alarm_sessions ?? performance?.completed_alarms ?? 0;
  const wakeRate        = alarmSessions > 0 ? Math.round((completedSessions / alarmSessions) * 100) : 0;
  const snoozes         = analytics?.snooze_stats?.total_snoozes ?? 0;
  const diffLabel       = analytics?.difficulty_label ?? performance?.difficulty_label ?? "MEDIUM";
  const palette = ["#38bdf8", "#34d399", "#a78bfa", "#f472b6", "#6ee7b7", "#fb923c", "#facc15", "#818cf8"];

  /* ─── Challenge type breakdown ─── */
  const typeCount = {};
  history.forEach((c) => {
    const t = c.challenge_type || "MATH";
    if (!typeCount[t]) typeCount[t] = { total: 0, correct: 0 };
    typeCount[t].total++;
    if (c.correct) typeCount[t].correct++;
  });
  const typeEntries = Object.entries(typeCount).sort((a, b) => b[1].total - a[1].total);

  /* ─── CSV export ─── */
  const exportCSV = () => {
    const rows = [
      ["Metric", "Value"],
      ["Alarm Wake Rate", wakeRate + "%"],
      ["Challenge Accuracy", accuracy + "%"],
      ["Habit Score", habitScore + "%"],
      ["Streak", streak + " days"],
      ["Longest Streak", longestStreak + " days"],
      ["Total Attempts", totalAttempts],
      ["Alarm Sessions", alarmSessions],
      ["Completed Sessions", completedSessions],
      ["Snoozes", snoozes],
      ["Difficulty Level", diffLabel],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cogwake_report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* ── Header ── */}
      <section
        style={{
          ...card,
          background: "linear-gradient(135deg, rgba(30,58,138,0.4), rgba(88,28,135,0.28), rgba(15,23,42,0.9))",
          border: "1px solid rgba(129,140,248,0.28)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <BarChart3 size={18} style={{ color: "#a5b4fc" }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#a5b4fc", letterSpacing: 1.5, textTransform: "uppercase" }}>
              My Performance Report
            </span>
          </div>
          <h1 style={{ margin: "4px 0 6px", fontSize: 26, fontWeight: 900, color: "#f8fafc" }}>
            {user?.name?.split(" ")[0] || "Your"}'s Personal Report
          </h1>
          <p style={{ ...muted, margin: 0 }}>
            A summary of your alarm sessions, challenge activity, and habit tracking.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            style={{ background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", padding: "8px 12px", borderRadius: 8, fontSize: 12 }}
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
          <button
            onClick={exportCSV}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.35)",
              color: "#6ee7b7", padding: "8px 16px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={fetchAll}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "rgba(99,102,241,0.14)", border: "1px solid rgba(129,140,248,0.35)",
              color: "#a5b4fc", padding: "8px 16px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </section>

      {/* ── 5 KPI Cards ── */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 12 }}>
        {[
          { label: "Alarm Wake Rate",    value: wakeRate + "%",    sub: completedSessions + "/" + alarmSessions + " sessions", color: "#38bdf8", Icon: AlarmClock },
          { label: "Challenge Accuracy", value: accuracy + "%",    sub: totalAttempts + " total attempts",                    color: "#a78bfa", Icon: Brain },
          { label: "Habit Score",        value: habitScore + "%",  sub: habitTier,                                            color: "#f472b6", Icon: Flame },
          { label: "Current Streak",     value: streak + " 🔥",   sub: "Best: " + longestStreak + " days",                   color: "#fb923c", Icon: Target },
          { label: "Total Snoozes",      value: snoozes,           sub: "Across all alarm sessions",                         color: "#facc15", Icon: Zap },
        ].map(({ label, value, sub, color, Icon }) => (
          <div key={label} style={{ ...card, borderTop: "3px solid " + color }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <Icon size={14} style={{ color }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</span>
            </div>
            <strong style={{ display: "block", fontSize: 26, color, marginBottom: 2 }}>{value}</strong>
            <div style={{ fontSize: 11, color: "#64748b" }}>{sub}</div>
          </div>
        ))}
      </section>

      {/* ── Daily Challenge Activity ── */}
      <section style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Activity size={15} style={{ color: "#a78bfa" }} />
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#f8fafc" }}>Daily Challenge Activity</h2>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>Challenges solved per day</span>
        </div>
        {timeseries.length > 0 ? (
          <div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
              {timeseries.map((d, i) => {
                const maxA = Math.max(...timeseries.map(x => x.challenge_activity), 1);
                const h = d.challenge_activity > 0 ? Math.max(6, Math.round((d.challenge_activity / maxA) * 114)) : 3;
                const isToday = i === timeseries.length - 1;
                return (
                  <div key={i} title={d.day + ": " + d.challenge_activity + " challenges"} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{
                      width: "100%", height: h,
                      background: d.challenge_activity > 0 ? (isToday ? "#818cf8" : "#a78bfa") : "rgba(255,255,255,0.06)",
                      borderRadius: "3px 3px 0 0",
                    }} />
                    {(i % Math.ceil(timeseries.length / 8) === 0 || isToday) && (
                      <span style={{ fontSize: 8, color: isToday ? "#a78bfa" : "#64748b", fontWeight: isToday ? 700 : 400 }}>{d.day}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 10 }}>
              Total: <strong style={{ color: "#a78bfa" }}>{timeseries.reduce((s, d) => s + (d.challenge_activity || 0), 0)}</strong> challenges in the last {timeRange} days
            </div>
          </div>
        ) : (
          <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 13, borderRadius: 10, background: "rgba(15,23,42,0.4)" }}>
            Challenge activity will appear here after sessions are recorded.
          </div>
        )}
      </section>

      {/* ── Alarm Activity + Challenge Type ── */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>

        {/* Alarm Stats */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <AlarmClock size={15} style={{ color: "#38bdf8" }} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>Alarm Activity</h3>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              ["Total Sessions",         alarmSessions],
              ["Sessions Completed",     completedSessions],
              ["Wake-Up Success Rate",   wakeRate + "%"],
              ["Total Snoozes",          snoozes],
              ["Snooze Rate",            (analytics?.snooze_stats?.snooze_rate ?? 0) + "%"],
              ["Zero-Snooze Compliance", (analytics?.snooze_stats?.zero_snooze_compliance ?? 0) + "%"],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(148,163,184,0.1)", paddingBottom: 8 }}>
                <span style={{ ...muted, fontSize: 12 }}>{lbl}</span>
                <strong style={{ fontSize: 13, color: "#e2e8f0" }}>{val}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Challenge Type Performance */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Brain size={15} style={{ color: "#a78bfa" }} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>Challenge Type Performance</h3>
          </div>
          {typeEntries.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              {typeEntries.map(([type, stats], idx) => {
                const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                const color = palette[idx % palette.length];
                return (
                  <div key={type}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{type}</span>
                      <span style={{ color: "#94a3b8" }}>{stats.correct}/{stats.total} — <strong style={{ color }}>{pct}%</strong></span>
                    </div>
                    <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 4 }}>
                      <div style={{ width: pct + "%", height: "100%", background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ ...muted, fontSize: 12 }}>Complete some challenges to see type-based performance here.</p>
          )}
        </div>
      </section>

      {/* ── Recent Challenge Activity ── */}
      <section style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <CheckCircle2 size={15} style={{ color: "#34d399" }} />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>Recent Challenge Activity</h3>
        </div>
        {history.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "#64748b", textAlign: "left", borderBottom: "1px solid rgba(148,163,184,0.14)" }}>
                  <th style={{ padding: "8px 10px" }}>Type</th>
                  <th style={{ padding: "8px 10px" }}>Result</th>
                  <th style={{ padding: "8px 10px" }}>Response Time</th>
                  <th style={{ padding: "8px 10px" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 15).map((c, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid rgba(148,163,184,0.07)" }}>
                    <td style={{ padding: "10px 10px", fontWeight: 700, color: "#e2e8f0" }}>{c.challenge_type || "MATH"}</td>
                    <td style={{ padding: "10px 10px", fontWeight: 700, color: c.correct ? "#6ee7b7" : "#fda4af" }}>
                      {c.correct ? "✓ Correct" : "✗ Incorrect"}
                    </td>
                    <td style={{ padding: "10px 10px", color: "#94a3b8" }}>{c.response_time ? c.response_time + "s" : "—"}</td>
                    <td style={{ padding: "10px 10px", color: "#64748b" }}>
                      {c.attempted_at ? new Date(c.attempted_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ ...muted, fontSize: 12 }}>Start completing challenges to see your activity here.</p>
        )}
      </section>

    </div>
  );
}

export default UserReports;
