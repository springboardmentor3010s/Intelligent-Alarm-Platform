import React, { useEffect, useMemo, useState } from "react";
import { Activity, AlarmClock, Download, Moon, RefreshCw, ShieldAlert, Users } from "lucide-react";
import api from "../services/api";

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
const card = { background: "rgba(15,23,42,.72)", border: "1px solid rgba(148,163,184,.16)", borderRadius: 14, padding: 20 };
const muted = { color: "#94a3b8", fontSize: 13 };

function RateChart({ series }) {
  if (!series.length) return <div style={{ ...muted, height: 210, display: "grid", placeItems: "center" }}>No platform activity was recorded in this date range.</div>;
  const width = 760, height = 230, left = 42, right = 18, top = 20, bottom = 38;
  const x = (i) => left + (i * (width - left - right)) / Math.max(series.length - 1, 1);
  const y = (value) => height - bottom - (value / 100) * (height - top - bottom);
  const path = (key) => series.map((point, i) => `${i ? "L" : "M"}${x(i)},${y(point[key] || 0)}`).join(" ");
  const labels = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])];
  return <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height: 230, display: "block" }} aria-label="Platform outcome trends">
    {[0, 50, 100].map((n) => <g key={n}><line x1={left} x2={width - right} y1={y(n)} y2={y(n)} stroke="rgba(148,163,184,.2)" strokeDasharray="4 4" /><text x="4" y={y(n) + 4} fill="#94a3b8" fontSize="11">{n}%</text></g>)}
    <path d={path("wake_success")} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" />
    <path d={path("accuracy")} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
    {series.map((point, i) => <g key={point.date}><title>{`${point.date}: Wake success ${point.wake_success || 0}%, challenge accuracy ${point.accuracy || 0}%`}</title><circle cx={x(i)} cy={y(point.wake_success || 0)} r="3" fill="#c4b5fd" /><circle cx={x(i)} cy={y(point.accuracy || 0)} r="3" fill="#7dd3fc" /></g>)}
    {labels.map((i) => <text key={i} x={x(i)} y={height - 10} textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"} fill="#94a3b8" fontSize="11">{series[i].date}</text>)}
  </svg>;
}

export default function AdminSystemReports({ token }) {
  const [data, setData] = useState({ analytics: { series: [] }, missed: {}, sleep: { summary: {}, users: [] }, challenges: { challenges: [] } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const range = useMemo(() => { const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 29); return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }; }, []);
  const load = async () => {
    setLoading(true); setError("");
    const [analytics, missed, sleep, challenges] = await Promise.allSettled([
      api.get(`/admin/analytics?start=${range.start}&end=${range.end}`, auth(token)),
      api.get("/admin/alarms/missed-report", auth(token)),
      api.get("/wellness_coach/sleep-trend-reports", auth(token)),
      api.get("/wellness_coach/challenge-analytics", auth(token))
    ]);
    const value = (result, fallback) => result.status === "fulfilled" ? result.value.data : fallback;
    setData({ analytics: value(analytics, { series: [] }), missed: value(missed, {}), sleep: value(sleep, { summary: {}, users: [] }), challenges: value(challenges, { challenges: [] }) });
    if ([analytics, missed, sleep, challenges].some((result) => result.status === "rejected")) setError("Some report sources could not be refreshed. Available data is shown.");
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const series = data.analytics.series || [];
  const avg = (key) => series.length ? (series.reduce((sum, day) => sum + Number(day[key] || 0), 0) / series.length).toFixed(1) : "0.0";
  const exportCsv = () => { const rows = [["Date", "Wake success %", "Challenge accuracy %", "New users"], ...series.map((day) => [day.date, day.wake_success, day.accuracy, day.user_growth])]; const link = document.createElement("a"); link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(rows.map((r) => r.join(",")).join("\n"))}`; link.download = `system-report-${range.start}-to-${range.end}.csv`; link.click(); };
  const sleep = data.sleep.summary || {};
  return <div style={{ display: "grid", gap: 20 }}>
    <section style={{ ...card, background: "linear-gradient(130deg, rgba(30,64,175,.32), rgba(15,23,42,.78))", display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}><div><div style={{ color: "#93c5fd", fontSize: 12, fontWeight: 800, letterSpacing: 1.2 }}>ADMIN REPORTING CENTER</div><h1 style={{ margin: "6px 0", fontSize: 26 }}>System Reports</h1><p style={{ ...muted, margin: 0 }}>A single view of platform activity, alarm reliability, sleep trends, and challenge outcomes.</p></div><div style={{ display: "flex", gap: 10 }}><button className="secondary-button" onClick={exportCsv} disabled={!series.length}><Download size={16} /> Export CSV</button><button className="create-alarm-button" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> {loading ? "Refreshing" : "Refresh"}</button></div></section>
    {error && <div style={{ color: "#fbbf24", fontSize: 13 }}>{error}</div>}
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>{[["Wake-up success", `${avg("wake_success")}%`, AlarmClock, "#a78bfa", "Average over 30 days"], ["Challenge accuracy", `${avg("accuracy")}%`, Activity, "#38bdf8", "Average over 30 days"], ["Sleep quality", `${sleep.avg_sleep_quality_score || 0}%`, Moon, "#34d399", `${sleep.total_users || 0} users monitored`], ["Missed alarms", data.missed.missed_alarms || 0, ShieldAlert, "#fb7185", `${data.missed.total_sessions || 0} total sessions`], ["Active challenges", data.challenges.challenges?.length || 0, Users, "#fbbf24", "Challenge library activity"]].map(([label, value, Icon, color, note]) => <div key={label} style={card}><Icon size={19} color={color} /><div style={{ ...muted, marginTop: 11 }}>{label}</div><strong style={{ fontSize: 25 }}>{value}</strong><div style={{ ...muted, fontSize: 11, marginTop: 4 }}>{note}</div></div>)}</section>
    <section style={card}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h2 style={{ margin: 0, fontSize: 18 }}>Platform outcome trend</h2><p style={{ ...muted, margin: "5px 0 0" }}>Daily outcome rates for the last 30 days.</p></div><div style={{ display: "flex", gap: 14, fontSize: 12, fontWeight: 700 }}><span style={{ color: "#c4b5fd" }}>● Wake-up success</span><span style={{ color: "#7dd3fc" }}>● Challenge accuracy</span></div></div><div style={{ marginTop: 16 }}><RateChart series={series} /></div></section>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}><div style={card}><h2 style={{ marginTop: 0, fontSize: 18 }}>Sleep trend summary</h2><div style={{ display: "grid", gap: 12 }}>{[["Wake consistency", `${sleep.avg_consistency_score || 0}%`], ["Alarm completion", `${sleep.avg_completion_rate || 0}%`], ["Average snooze rate", `${sleep.avg_snooze_rate || 0}%`], ["Users needing support", sleep.needs_support_count || 0]].map(([label, value]) => <div key={label} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 10, borderBottom: "1px solid rgba(148,163,184,.12)" }}><span style={muted}>{label}</span><strong>{value}</strong></div>)}</div></div><div style={card}><h2 style={{ marginTop: 0, fontSize: 18 }}>Recent missed alarms</h2>{data.missed.recent_missed?.length ? <div style={{ display: "grid", gap: 10 }}>{data.missed.recent_missed.slice(0, 5).map((item) => <div key={item.id} style={{ borderBottom: "1px solid rgba(148,163,184,.12)", paddingBottom: 9 }}><strong style={{ fontSize: 13 }}>{item.user}</strong><div style={{ ...muted, fontSize: 11 }}>{item.triggered_at ? new Date(item.triggered_at).toLocaleString() : "Time unavailable"} · {item.snoozed_count || 0} snoozes</div></div>)}</div> : <p style={muted}>No missed alarms recorded.</p>}</div></section>
  </div>;
}
