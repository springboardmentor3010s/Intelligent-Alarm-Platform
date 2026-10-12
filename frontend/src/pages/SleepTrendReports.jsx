import React, { useEffect, useMemo, useState } from "react";
import { Activity, Download, Moon, RefreshCw, Search, UserRound } from "lucide-react";
import api from "../services/api";

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
const card = { background: "rgba(15, 23, 42, .72)", border: "1px solid rgba(148,163,184,.16)", borderRadius: 14, padding: 20, backdropFilter: "blur(12px)" };
const muted = { color: "#94a3b8", fontSize: 13 };

function formatWakeTime(hour) {
  if (hour === null || hour === undefined) return "Not available";
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function QualityBadge({ value }) {
  const tone = value >= 70 ? ["#34d399", "rgba(52,211,153,.14)"] : value >= 40 ? ["#fbbf24", "rgba(251,191,36,.14)"] : ["#fb7185", "rgba(251,113,133,.14)"];
  return <span style={{ color: tone[0], background: tone[1], borderRadius: 99, padding: "4px 9px", fontWeight: 800, fontSize: 12 }}>{value}% quality</span>;
}

function TrendChart({ points }) {
  if (!points?.length) return <div style={{ ...muted, height: 220, display: "grid", placeItems: "center" }}>Sleep activity will appear after alarm sessions are recorded.</div>;
  const width = 720, height = 230, left = 42, right = 18, top = 20, bottom = 38;
  const rate = (p) => p.total ? (p.completed / p.total) * 100 : 0;
  const x = (i) => left + (i * (width - left - right)) / Math.max(points.length - 1, 1);
  const y = (value) => height - bottom - (value / 100) * (height - top - bottom);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(rate(p))}`).join(" ");
  const area = `${path} L ${x(points.length - 1)},${y(0)} L ${x(0)},${y(0)} Z`;
  const sessions = points.reduce((total, point) => total + (point.total || 0), 0);
  const completed = points.reduce((total, point) => total + (point.completed || 0), 0);
  const average = sessions ? Math.round((completed / sessions) * 100) : 0;
  const tickIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  return <>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 6 }}><strong style={{ color: "#e2e8f0", fontSize: 20 }}>{average}% completed</strong><span style={muted}>{completed} of {sessions} alarms completed{sessions - completed ? ` · ${sessions - completed} missed` : " · no missed alarms"}</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height: 230, display: "block" }} aria-label={`Wake completion trend: ${average}% of alarms completed`}>
      <defs><linearGradient id="completionArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity=".35"/><stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/></linearGradient></defs>
      {[0, 50, 100].map((n) => <g key={n}><line x1={left} x2={width - right} y1={y(n)} y2={y(n)} stroke="rgba(148,163,184,.2)" strokeDasharray="4 4" /><text x="4" y={y(n) + 4} fill="#94a3b8" fontSize="11">{n}%</text></g>)}
      <path d={area} fill="url(#completionArea)" />
      <path d={path} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <g key={p.date || i}><title>{`${p.date}: ${Math.round(rate(p))}% completed (${p.completed || 0} of ${p.total || 0} alarms)`}</title><circle cx={x(i)} cy={y(rate(p))} r="4" fill="#c4b5fd" stroke="#0f172a" strokeWidth="2" /></g>)}
      {tickIndexes.map((i) => <text key={i} x={x(i)} y={height - 10} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fill="#94a3b8" fontSize="11">{points[i]?.date}</text>)}
    </svg>
    <p style={{ ...muted, fontSize: 11, margin: "3px 0 0" }}>Each point represents a day. Hover over a point to see the completed alarms for that date.</p>
  </>;
}

export default function SleepTrendReports({ token }) {
  const [data, setData] = useState({ summary: {}, users: [], global_timeline: [], hourly_distribution: [] });
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const response = await api.get("/wellness_coach/sleep-trend-reports", auth(token)); setData(response.data); }
    catch (error) { console.error("Failed to load sleep trend reports", error); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setDetailLoading(true);
    api.get(`/wellness_coach/sleep-trend-reports/${selected}`, auth(token)).then((res) => setDetail(res.data)).catch((error) => console.error("Failed to load sleep detail", error)).finally(() => setDetailLoading(false));
  }, [selected]);

  const users = useMemo(() => data.users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase().trim())).sort((a, b) => b.sleep_quality_score - a.sleep_quality_score), [data.users, search]);
  const exportCsv = () => {
    const headers = ["Name", "Email", "Sleep quality", "Wake consistency", "Completion rate", "Snooze rate", "Average wake time", "Sessions", "Current streak"];
    const rows = data.users.map((u) => [u.name, u.email, u.sleep_quality_score, u.consistency_score, u.completion_rate, u.snooze_rate, formatWakeTime(u.avg_wake_hour), u.total_sessions, u.streak].map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","));
    const link = document.createElement("a"); link.href = `data:text/csv;charset=utf-8,${encodeURIComponent([headers.join(","), ...rows].join("\n"))}`; link.download = `sleep-trend-reports-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
  };
  const summary = data.summary || {};
  const metrics = detail?.metrics;
  const selectedUser = data.users.find((user) => user.user_id === selected);
  const chartPoints = selected ? detail?.timeline : data.global_timeline;

  return <div style={{ display: "grid", gap: 20 }}>
    <section style={{ ...card, background: "linear-gradient(130deg, rgba(49,46,129,.42), rgba(15,23,42,.76))", display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
      <div><div style={{ color: "#c4b5fd", fontWeight: 800, fontSize: 12, letterSpacing: 1.2 }}>WELLNESS COACH REPORTING</div><h1 style={{ margin: "6px 0", fontSize: 26 }}>Sleep Trend Reports</h1><p style={{ ...muted, margin: 0, maxWidth: 700 }}>Track wake consistency, alarm completion, and snooze patterns across your managed users.</p></div>
      <div style={{ display: "flex", gap: 10 }}><button className="secondary-button" onClick={exportCsv} disabled={!data.users.length}><Download size={16} /> Export CSV</button><button className="create-alarm-button" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> {loading ? "Refreshing" : "Refresh"}</button></div>
    </section>

    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
      {[["Average sleep quality", `${summary.avg_sleep_quality_score || 0}%`, Moon, "#a78bfa"], ["Wake consistency", `${summary.avg_consistency_score || 0}%`, Activity, "#38bdf8"], ["Alarm completion", `${summary.avg_completion_rate || 0}%`, UserRound, "#34d399"], ["Users needing support", summary.needs_support_count || 0, Moon, "#fb7185"]].map(([label, value, Icon, color]) => <div key={label} style={card}><Icon size={19} color={color} /><div style={{ ...muted, marginTop: 12 }}>{label}</div><strong style={{ fontSize: 25 }}>{value}</strong></div>)}
    </section>

    <section style={card}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}><div><h2 style={{ margin: 0, fontSize: 18 }}>{selectedUser ? `${selectedUser.name}'s wake completion trend` : "30-day wake completion trend"}</h2><p style={{ ...muted, margin: "5px 0 0" }}>{selectedUser ? "Completed alarm sessions for this managed user" : "Completed alarm sessions across all managed users"}</p></div><div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><select value={selected || ""} onChange={(e) => setSelected(e.target.value || null)} aria-label="Choose a user for the sleep trend chart" style={{ minWidth: 210 }}><option value="">All managed users</option>{data.users.map((user) => <option key={user.user_id} value={user.user_id}>{user.name}</option>)}</select><span style={{ color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>● Completion rate</span></div></div><div style={{ marginTop: 18 }}>{detailLoading ? <div style={{ ...muted, height: 220, display: "grid", placeItems: "center" }}>Loading user trend…</div> : <TrendChart points={chartPoints} />}</div></section>

    <section style={card}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><div><h2 style={{ margin: 0, fontSize: 18 }}>User sleep reports</h2><p style={{ ...muted, margin: "5px 0 0" }}>Select a user to inspect their recent sleep trend.</p></div><div style={{ position: "relative" }}><Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "#64748b" }} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users" style={{ paddingLeft: 32, width: 210 }} /></div></div>
      <div style={{ overflowX: "auto", marginTop: 16 }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, fontSize: 13 }}><thead><tr style={{ color: "#94a3b8", textAlign: "left", borderBottom: "1px solid rgba(148,163,184,.2)" }}>{["User", "Sleep quality", "Consistency", "Completion", "Snooze rate", "Wake time", "Streak"].map((h) => <th key={h} style={{ padding: "10px 8px" }}>{h}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan="7" style={{ ...muted, textAlign: "center", padding: 28 }}>Loading reports…</td></tr> : users.length ? users.map((u) => <tr key={u.user_id} onClick={() => setSelected(u.user_id)} style={{ cursor: "pointer", background: selected === u.user_id ? "rgba(167,139,250,.09)" : "transparent", borderBottom: "1px solid rgba(148,163,184,.09)" }}><td style={{ padding: "12px 8px" }}><strong>{u.name}</strong><div style={{ ...muted, fontSize: 11 }}>{u.email}</div></td><td style={{ padding: "12px 8px" }}><QualityBadge value={u.sleep_quality_score} /></td><td style={{ padding: "12px 8px" }}>{u.consistency_score}%</td><td style={{ padding: "12px 8px" }}>{u.completion_rate}%</td><td style={{ padding: "12px 8px" }}>{u.snooze_rate}%</td><td style={{ padding: "12px 8px" }}>{formatWakeTime(u.avg_wake_hour)}</td><td style={{ padding: "12px 8px" }}>{u.streak} days</td></tr>) : <tr><td colSpan="7" style={{ ...muted, textAlign: "center", padding: 28 }}>No managed users match this search.</td></tr>}</tbody></table></div></section>

    {selected && <section style={card}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><h2 style={{ margin: 0, fontSize: 18 }}>{detail?.profile?.name || "User"}’s sleep summary</h2><p style={{ ...muted, margin: "5px 0 0" }}>Wake and snooze signals for personalised coaching</p></div><button className="secondary-button" onClick={() => setSelected(null)}>Show all users</button></div>{detailLoading ? <p style={{ ...muted }}>Loading detailed report…</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 18 }}>{[["Sleep quality", `${metrics?.sleep_quality_score || 0}%`], ["Average wake time", formatWakeTime(metrics?.avg_wake_hour)], ["Snooze rate", `${metrics?.snooze_rate || 0}%`], ["Longest streak", `${metrics?.longest_streak || 0} days`]].map(([label, value]) => <div key={label} style={{ background: "rgba(30,41,59,.7)", padding: 14, borderRadius: 10 }}><div style={muted}>{label}</div><strong style={{ fontSize: 18 }}>{value}</strong></div>)}</div>}</section>}
  </div>;
}
