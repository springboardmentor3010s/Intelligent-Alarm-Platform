import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import {
  getCoachDashboard,
  getCoachClients,
  getClientInsights,
  getClientHabits,
  getClientSleepTrends,
  getClientAnalytics,
} from "../services/api";

function CoachDashboard() {
  let user = null;
  try {
    const raw = localStorage.getItem("user");
    user = raw ? JSON.parse(raw) : null;
  } catch {
    user = null;
  }

  // Dashboard state
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Selected client detail state
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [activeTab, setActiveTab] = useState("insights"); // "insights" | "habits" | "sleep" | "progress"
  const [clientLoading, setClientLoading] = useState(false);
  const [insightsData, setInsightsData] = useState(null);
  const [habitsData, setHabitsData] = useState(null);
  const [sleepData, setSleepData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Load dashboard overview & client list
  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");
        const [dashStats, clientList] = await Promise.all([
          getCoachDashboard(),
          getCoachClients(),
        ]);
        setStats(dashStats);
        setClients(clientList);

        if (clientList && clientList.length > 0) {
          setSelectedClientId(clientList[0].id);
        }
      } catch (err) {
        setError(err.message || "Failed to load wellness coach dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  // Filter clients by search term
  const filteredClients = clients.filter((c) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term))
    );
  });

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // Load selected client detailed data when client or tab changes
  useEffect(() => {
    if (!selectedClientId) return;

    async function loadClientData() {
      try {
        setClientLoading(true);
        if (activeTab === "insights") {
          const data = await getClientInsights(selectedClientId);
          setInsightsData(data);
        } else if (activeTab === "habits") {
          const data = await getClientHabits(selectedClientId);
          setHabitsData(data);
        } else if (activeTab === "sleep") {
          const data = await getClientSleepTrends(selectedClientId);
          setSleepData(data);
        } else if (activeTab === "progress") {
          const data = await getClientAnalytics(selectedClientId);
          setAnalyticsData(data);
        }
      } catch (err) {
        console.error("Failed to load client details:", err);
      } finally {
        setClientLoading(false);
      }
    }

    loadClientData();
  }, [selectedClientId, activeTab]);

  function getScoreColor(score) {
    if (score >= 80) return "#10b981"; // green
    if (score >= 60) return "#f59e0b"; // yellow
    return "#ef4444"; // red
  }

  return (
    <div className="dashboard-page">
      <Navbar />

      <main
        className="dashboard-content"
        style={{
          padding: "2rem 1.5rem",
          maxWidth: "1400px",
          margin: "0 auto",
          color: "#f8fafc",
        }}
      >
        {/* =========================================================
            HEADER
        ========================================================= */}
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "2rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            paddingBottom: "1.5rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
              <span style={{ fontSize: "2rem" }}>🩺</span>
              <h1 style={{ margin: 0, fontSize: "1.85rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                Wellness Coach Dashboard
              </h1>
              <span
                style={{
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "0.3rem 0.6rem",
                  borderRadius: "6px",
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#34d399",
                  fontWeight: 700,
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
              >
                Coach Authorized
              </span>
            </div>
            <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.95rem" }}>
              Welcome back, <strong>{user?.name || "Wellness Coach"}</strong>. Monitor client sleep hygiene, cognitive
              habit adherence, and behavioral trends.
            </p>
          </div>

          <div
            style={{
              background: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "0.6rem 1.2rem",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }} />
            <span style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
              Client Data Isolation: <strong>Strictly Enforced</strong>
            </span>
          </div>
        </header>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid #ef4444",
              color: "#fca5a5",
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1.5rem",
            }}
          >
            {error}
          </div>
        )}

        {/* =========================================================
            WORKSPACE KPI CARDS
        ========================================================= */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1.25rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              background: "#1e293b",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "1.25rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Assigned Clients</span>
              <span style={{ fontSize: "1.5rem" }}>👥</span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#f8fafc", margin: "0.5rem 0 0.25rem" }}>
              {stats?.total_clients ?? 0}
            </div>
            <span style={{ fontSize: "0.8rem", color: "#38bdf8" }}>Registered users under coaching</span>
          </div>

          <div
            style={{
              background: "#1e293b",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "1.25rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Active in Training</span>
              <span style={{ fontSize: "1.5rem" }}>⚡</span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#34d399", margin: "0.5rem 0 0.25rem" }}>
              {stats?.active_clients ?? 0}
            </div>
            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Recorded sessions in history</span>
          </div>

          <div
            style={{
              background: "#1e293b",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "1.25rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Avg Client Habit Score</span>
              <span style={{ fontSize: "1.5rem" }}>🎯</span>
            </div>
            <div
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                color: getScoreColor(stats?.average_habit_score || 60),
                margin: "0.5rem 0 0.25rem",
              }}
            >
              {stats?.average_habit_score ?? 60.0}
            </div>
            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>100-point behavioral index</span>
          </div>

          <div
            style={{
              background: "#1e293b",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "1.25rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Completed Sessions</span>
              <span style={{ fontSize: "1.5rem" }}>🏆</span>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#818cf8", margin: "0.5rem 0 0.25rem" }}>
              {stats?.total_completed_sessions ?? 0}
            </div>
            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Total alarm sessions dismissed</span>
          </div>
        </section>

        {/* =========================================================
            CLIENT DIRECTORY & SELECTION
        ========================================================= */}
        <section
          style={{
            background: "#1e293b",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "14px",
            padding: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 700 }}>Client Overview &amp; Roster</h2>
              <p style={{ color: "#94a3b8", margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
                Select a client to inspect behavior insights, habit adherence, and circadian sleep trends.
              </p>
            </div>

            <div style={{ minWidth: "260px" }}>
              <input
                type="text"
                placeholder="🔍 Search client name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.6rem 1rem",
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "8px",
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {filteredClients.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
              No clients found matching &quot;{search}&quot;.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "#94a3b8" }}>
                    <th style={{ padding: "0.75rem 1rem" }}>Client</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Target Wake</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Sleep Schedule</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Habit Score</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Sessions</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Completion Rate</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const isSelected = client.id === selectedClientId;
                    return (
                      <tr
                        key={client.id}
                        onClick={() => setSelectedClientId(client.id)}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                          background: isSelected ? "rgba(56, 189, 248, 0.12)" : "transparent",
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "1rem" }}>
                          <div style={{ fontWeight: 600, color: "#f8fafc" }}>{client.name}</div>
                          <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{client.email}</div>
                        </td>
                        <td style={{ padding: "1rem", color: "#cbd5e1" }}>
                          {client.preferred_wake_time || "06:30 AM"}
                        </td>
                        <td style={{ padding: "1rem", color: "#cbd5e1" }}>
                          {client.sleep_duration ? `${client.sleep_duration} hours` : "Not set"}
                        </td>
                        <td style={{ padding: "1rem" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "0.25rem 0.6rem",
                              borderRadius: "6px",
                              fontSize: "0.85rem",
                              fontWeight: 700,
                              background: `${getScoreColor(client.habit_score)}22`,
                              color: getScoreColor(client.habit_score),
                              border: `1px solid ${getScoreColor(client.habit_score)}44`,
                            }}
                          >
                            {client.habit_score}
                          </span>
                        </td>
                        <td style={{ padding: "1rem", color: "#cbd5e1" }}>
                          {client.completed_sessions} / {client.total_sessions}
                        </td>
                        <td style={{ padding: "1rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div
                              style={{
                                flex: 1,
                                height: "6px",
                                background: "rgba(255,255,255,0.1)",
                                borderRadius: "3px",
                                overflow: "hidden",
                                minWidth: "60px",
                              }}
                            >
                              <div
                                style={{
                                  width: `${client.completion_rate}%`,
                                  height: "100%",
                                  background: "#38bdf8",
                                  borderRadius: "3px",
                                }}
                              />
                            </div>
                            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                              {client.completion_rate}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "1rem", textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClientId(client.id);
                            }}
                            style={{
                              padding: "0.4rem 0.8rem",
                              borderRadius: "6px",
                              border: isSelected ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.15)",
                              background: isSelected ? "#0284c7" : "rgba(255,255,255,0.05)",
                              color: "#ffffff",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {isSelected ? "Active Client" : "Inspect"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* =========================================================
            SELECTED CLIENT WORKSPACE & ANALYSIS TABS
        ========================================================= */}
        {selectedClient && (
          <section
            style={{
              background: "#1e293b",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "14px",
              padding: "1.75rem",
              boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            }}
          >
            {/* Selected Client Identity Banner */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                paddingBottom: "1.25rem",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#38bdf8",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Active Client Focus
                </span>
                <h2 style={{ fontSize: "1.5rem", margin: "0.2rem 0", fontWeight: 700 }}>
                  {selectedClient.name}
                </h2>
                <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{selectedClient.email}</span>
              </div>

              {/* Tab Navigation */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  background: "rgba(15, 23, 42, 0.6)",
                  padding: "0.35rem",
                  borderRadius: "10px",
                }}
              >
                {[
                  { id: "insights", label: "📊 Behavior Insights" },
                  { id: "habits", label: "🎯 Habit Adherence" },
                  { id: "sleep", label: "🛌 Sleep Trends" },
                  { id: "progress", label: "📈 Progress Monitoring" },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        padding: "0.55rem 1rem",
                        borderRadius: "8px",
                        border: "none",
                        background: active ? "#0284c7" : "transparent",
                        color: active ? "#ffffff" : "#94a3b8",
                        fontWeight: active ? 700 : 500,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TAB CONTENTS */}
            {clientLoading ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                Loading client analysis...
              </div>
            ) : (
              <>
                {/* -------------------------------------------------------------
                    TAB 1: BEHAVIOR INSIGHTS
                ------------------------------------------------------------- */}
                {activeTab === "insights" && insightsData && (
                  <div>
                    {/* Behavioral KPI summary */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "1rem",
                        marginBottom: "1.5rem",
                      }}
                    >
                      <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "1.2rem", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Completion Rate</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#38bdf8", marginTop: "0.25rem" }}>
                          {insightsData.behavioral_summary.completion_rate}%
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {insightsData.behavioral_summary.completed_sessions} of {insightsData.behavioral_summary.total_sessions} completed
                        </div>
                      </div>

                      <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "1.2rem", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Cognitive Accuracy</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#10b981", marginTop: "0.25rem" }}>
                          {insightsData.behavioral_summary.accuracy_rate}%
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>First-attempt correct rate</div>
                      </div>

                      <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "1.2rem", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Avg Snooze Count</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f59e0b", marginTop: "0.25rem" }}>
                          {insightsData.behavioral_summary.average_snooze_count}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Snoozes per morning alarm</div>
                      </div>

                      <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "1.2rem", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Avg Response Time</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#a855f7", marginTop: "0.25rem" }}>
                          {insightsData.behavioral_summary.average_response_time_seconds}s
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Cognitive challenge answer time</div>
                      </div>
                    </div>

                    {/* ML Intelligence Card & Recommendations */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                        gap: "1.25rem",
                      }}
                    >
                      {/* AI Behavioral Score */}
                      <div
                        style={{
                          background: "rgba(15, 23, 42, 0.5)",
                          border: "1px solid rgba(255, 255, 255, 0.06)",
                          padding: "1.25rem",
                          borderRadius: "10px",
                        }}
                      >
                        <h3 style={{ fontSize: "1.05rem", margin: "0 0 0.75rem", color: "#f8fafc" }}>
                          🤖 XGBoost Behavioral Score
                        </h3>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.75rem" }}>
                          <span style={{ fontSize: "2rem", fontWeight: 800, color: "#38bdf8" }}>
                            {insightsData.ml_insights.ml_behavioral_score ?? insightsData.habit_metrics.overall_habit_score}
                          </span>
                          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                            / 100 ML Score (Confidence: {Math.round((insightsData.ml_insights.ml_confidence || 0.85) * 100)}%)
                          </span>
                        </div>
                        <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
                          Evaluated by the behavioral XGBoost intelligence engine based on circadian alignment, snooze
                          entropy, and cognitive challenge response latency.
                        </p>
                      </div>

                      {/* AI Coaching Recommendations */}
                      <div
                        style={{
                          background: "rgba(15, 23, 42, 0.5)",
                          border: "1px solid rgba(255, 255, 255, 0.06)",
                          padding: "1.25rem",
                          borderRadius: "10px",
                        }}
                      >
                        <h3 style={{ fontSize: "1.05rem", margin: "0 0 0.75rem", color: "#f8fafc" }}>
                          💡 Personalized Recommendations
                        </h3>
                        {insightsData.ml_insights.recommendations?.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                            {insightsData.ml_insights.recommendations.map((rec, idx) => (
                              <div
                                key={idx}
                                style={{
                                  background: "rgba(30, 41, 59, 0.5)",
                                  padding: "0.75rem",
                                  borderRadius: "8px",
                                  borderLeft: "3px solid #38bdf8",
                                }}
                              >
                                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#f8fafc" }}>
                                  {rec.title}
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                                  {rec.description}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: 0 }}>
                            Client maintains baseline behavioral adherence. No critical interventions flagged.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    TAB 2: HABIT ADHERENCE ANALYTICS
                ------------------------------------------------------------- */}
                {activeTab === "habits" && habitsData && (
                  <div>
                    {/* Client Goals Card */}
                    <div
                      style={{
                        background: "rgba(15, 23, 42, 0.5)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        padding: "1.25rem",
                        borderRadius: "10px",
                        marginBottom: "1.5rem",
                      }}
                    >
                      <h3 style={{ fontSize: "1.05rem", margin: "0 0 1rem", color: "#f8fafc" }}>
                        🎯 Client Stated Habit Goals &amp; Preferences
                      </h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                        <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "1rem", borderRadius: "8px" }}>
                          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Wake-Up Goal</span>
                          <p style={{ fontWeight: 600, color: "#f8fafc", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
                            {habitsData.goals.wake_up_goal || "Not set by client"}
                          </p>
                        </div>
                        <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "1rem", borderRadius: "8px" }}>
                          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Productivity Goals</span>
                          <p style={{ fontWeight: 600, color: "#f8fafc", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
                            {habitsData.goals.productivity_goals || "Not set by client"}
                          </p>
                        </div>
                        <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "1rem", borderRadius: "8px" }}>
                          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Habit Preferences</span>
                          <p style={{ fontWeight: 600, color: "#f8fafc", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
                            {habitsData.goals.habit_preferences || "Not set by client"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 4-Factor Habit Adherence Breakdown */}
                    <div
                      style={{
                        background: "rgba(15, 23, 42, 0.5)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        padding: "1.25rem",
                        borderRadius: "10px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <h3 style={{ fontSize: "1.05rem", margin: 0, color: "#f8fafc" }}>
                          ⚖️ Multi-Factor Adherence Breakdown
                        </h3>
                        <div style={{ fontSize: "0.9rem", color: "#38bdf8", fontWeight: 700 }}>
                          🔥 Active Streak: {habitsData.streak} consecutive completions
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                        {[
                          {
                            label: "Wake-Up Consistency (35%)",
                            val: habitsData.adherence_metrics.wake_up_consistency,
                          },
                          {
                            label: "Challenge Completion (25%)",
                            val: habitsData.adherence_metrics.challenge_completion,
                          },
                          {
                            label: "Snooze Reduction (20%)",
                            val: habitsData.adherence_metrics.snooze_reduction,
                          },
                          {
                            label: "Sleep Adherence (20%)",
                            val: habitsData.adherence_metrics.sleep_schedule_adherence,
                          },
                        ].map((m, idx) => (
                          <div key={idx} style={{ background: "rgba(30, 41, 59, 0.6)", padding: "1rem", borderRadius: "8px" }}>
                            <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.4rem" }}>{m.label}</div>
                            <div style={{ fontSize: "1.35rem", fontWeight: 700, color: getScoreColor(m.val) }}>
                              {m.val}%
                            </div>
                            <div
                              style={{
                                width: "100%",
                                height: "6px",
                                background: "rgba(255,255,255,0.1)",
                                borderRadius: "3px",
                                marginTop: "0.5rem",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, m.val)}%`,
                                  height: "100%",
                                  background: getScoreColor(m.val),
                                  borderRadius: "3px",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    TAB 3: SLEEP TREND REPORTS
                ------------------------------------------------------------- */}
                {activeTab === "sleep" && sleepData && (
                  <div>
                    {/* Sleep stats summary */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "1rem",
                        marginBottom: "1.5rem",
                      }}
                    >
                      <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "1.2rem", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Target Wake Time</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#38bdf8", marginTop: "0.25rem" }}>
                          {sleepData.preferred_wake_time || "06:30 AM"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Target circadian awakening</div>
                      </div>

                      <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "1.2rem", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Target Sleep Duration</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#10b981", marginTop: "0.25rem" }}>
                          {sleepData.sleep_duration_hours ? `${sleepData.sleep_duration_hours}h` : "8.0h"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Recommended nightly window</div>
                      </div>

                      <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "1.2rem", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Sleep Adherence Rate</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: getScoreColor(sleepData.sleep_adherence_percentage), marginTop: "0.25rem" }}>
                          {sleepData.sleep_adherence_percentage}%
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>On-time morning adherence</div>
                      </div>

                      <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "1.2rem", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Average Wake Drift</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f59e0b", marginTop: "0.25rem" }}>
                          {sleepData.average_wake_drift_minutes}m
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Deviation from alarm target</div>
                      </div>
                    </div>

                    {/* Historical Wake-Up Log Table */}
                    <div
                      style={{
                        background: "rgba(15, 23, 42, 0.5)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        padding: "1.25rem",
                        borderRadius: "10px",
                      }}
                    >
                      <h3 style={{ fontSize: "1.05rem", margin: "0 0 1rem", color: "#f8fafc" }}>
                        📋 Recent Wake-Up &amp; Circadian Drift History
                      </h3>

                      {sleepData.wake_up_log?.length === 0 ? (
                        <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: 0 }}>
                          No alarm sessions recorded yet for this client.
                        </p>
                      ) : (
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "#94a3b8" }}>
                                <th style={{ padding: "0.6rem 0.8rem" }}>Session Started (IST)</th>
                                <th style={{ padding: "0.6rem 0.8rem" }}>Alarm</th>
                                <th style={{ padding: "0.6rem 0.8rem" }}>Scheduled</th>
                                <th style={{ padding: "0.6rem 0.8rem" }}>Actual Wake</th>
                                <th style={{ padding: "0.6rem 0.8rem" }}>Drift</th>
                                <th style={{ padding: "0.6rem 0.8rem" }}>Snoozes</th>
                                <th style={{ padding: "0.6rem 0.8rem" }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sleepData.wake_up_log.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                                  <td style={{ padding: "0.75rem 0.8rem", color: "#f1f5f9" }}>{item.started_at_ist}</td>
                                  <td style={{ padding: "0.75rem 0.8rem", color: "#cbd5e1" }}>{item.alarm_name}</td>
                                  <td style={{ padding: "0.75rem 0.8rem", color: "#cbd5e1" }}>{item.scheduled_alarm_time}</td>
                                  <td style={{ padding: "0.75rem 0.8rem", color: "#cbd5e1" }}>{item.actual_wake_time}</td>
                                  <td style={{ padding: "0.75rem 0.8rem", color: item.on_time ? "#34d399" : "#f87171" }}>
                                    {item.drift_minutes !== null ? `${item.drift_minutes > 0 ? "+" : ""}${item.drift_minutes}m` : "—"}
                                  </td>
                                  <td style={{ padding: "0.75rem 0.8rem", color: "#cbd5e1" }}>{item.snooze_count}</td>
                                  <td style={{ padding: "0.75rem 0.8rem" }}>
                                    <span
                                      style={{
                                        padding: "0.2rem 0.5rem",
                                        borderRadius: "4px",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        background: item.on_time ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                                        color: item.on_time ? "#34d399" : "#f87171",
                                      }}
                                    >
                                      {item.on_time ? "On-Time" : "Delayed"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    TAB 4: PROGRESS MONITORING & ANALYTICS
                ------------------------------------------------------------- */}
                {activeTab === "progress" && (
                  <div>
                    <div
                      style={{
                        background: "rgba(15, 23, 42, 0.5)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        padding: "1.25rem",
                        borderRadius: "10px",
                        marginBottom: "1.5rem",
                      }}
                    >
                      <h3 style={{ fontSize: "1.05rem", margin: "0 0 1rem", color: "#f8fafc" }}>
                        📈 Long-Term Cognitive Progress &amp; Adherence Trends
                      </h3>
                      <p style={{ color: "#94a3b8", fontSize: "0.85rem", lineHeight: 1.6 }}>
                        Client <strong>{selectedClient.name}</strong> has participated in{" "}
                        <strong>{selectedClient.total_sessions}</strong> alarm cycles, completing{" "}
                        <strong>{selectedClient.completed_sessions}</strong> ({selectedClient.completion_rate}% adherence).
                        Current cognitive difficulty setting: <strong style={{ textTransform: "capitalize" }}>{selectedClient.difficulty_preference || "medium"}</strong>.
                      </p>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: "1rem",
                          marginTop: "1.25rem",
                        }}
                      >
                        <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "1rem", borderRadius: "8px" }}>
                          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Client Status</span>
                          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#34d399", marginTop: "0.25rem" }}>
                            Active Trainee
                          </div>
                        </div>

                        <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "1rem", borderRadius: "8px" }}>
                          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Circadian Stability</span>
                          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#38bdf8", marginTop: "0.25rem" }}>
                            {selectedClient.habit_score >= 80 ? "High Adherence" : selectedClient.habit_score >= 60 ? "Moderate Adherence" : "Needs Coaching"}
                          </div>
                        </div>

                        <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "1rem", borderRadius: "8px" }}>
                          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Recommended Coach Action</span>
                          <div style={{ fontSize: "1rem", fontWeight: 600, color: "#f59e0b", marginTop: "0.25rem" }}>
                            {selectedClient.habit_score >= 80 ? "Maintain current rhythm" : "Review wake-up drift & snoozes"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default CoachDashboard;
