import { useEffect, useState } from "react";
import { getAlarms, getAlarmAdaptiveDifficulty } from "../../services/api";

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export default function AdaptiveDifficultyCard() {
  const [alarms, setAlarms] = useState([]);
  const [selectedAlarmId, setSelectedAlarmId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [error, setError] = useState("");

  // Load user's alarms on mount
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        setLoading(true);
        setError("");
        const alarmsData = await getAlarms();
        const alarmsList = Array.isArray(alarmsData)
          ? alarmsData
          : alarmsData?.alarms || [];

        if (!isMounted) return;

        setAlarms(alarmsList);

        if (alarmsList.length > 0) {
          // Prefer first active alarm, or first alarm
          const defaultAlarm =
            alarmsList.find((a) => a.is_active) || alarmsList[0];
          setSelectedAlarmId(defaultAlarm.id);

          // Fetch adaptive difficulty status for this specific alarm
          const status = await getAlarmAdaptiveDifficulty(defaultAlarm.id);
          if (isMounted) {
            setData(status);
            if (status?.adjusted && status?.next_difficulty) {
              setAlarms((prev) =>
                prev.map((a) =>
                  a.id === defaultAlarm.id
                    ? { ...a, difficulty: status.next_difficulty }
                    : a
                )
              );
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to load adaptive difficulty:", err);
          setError(err.message || "Failed to load adaptive difficulty");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // When user selects a different alarm
  async function handleAlarmChange(alarmId) {
    const id = Number(alarmId);
    setSelectedAlarmId(id);
    setLoadingStatus(true);
    setError("");
    try {
      const status = await getAlarmAdaptiveDifficulty(id);
      setData(status);
      if (status?.adjusted && status?.next_difficulty) {
        setAlarms((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, difficulty: status.next_difficulty } : a
          )
        );
      }
    } catch (err) {
      console.error("Failed to load adaptive difficulty for alarm:", err);
      setError(err.message || "Failed to load adaptive difficulty for alarm");
    } finally {
      setLoadingStatus(false);
    }
  }

  async function handleRetry() {
    if (!selectedAlarmId) return;
    setLoadingStatus(true);
    setError("");
    try {
      const status = await getAlarmAdaptiveDifficulty(selectedAlarmId);
      setData(status);
      if (status?.adjusted && status?.next_difficulty) {
        setAlarms((prev) =>
          prev.map((a) =>
            a.id === selectedAlarmId
              ? { ...a, difficulty: status.next_difficulty }
              : a
          )
        );
      }
    } catch (err) {
      console.error("Failed to retry adaptive difficulty:", err);
      setError(err.message || "Failed to reload adaptive difficulty");
    } finally {
      setLoadingStatus(false);
    }
  }

  // Selected alarm metadata
  const selectedAlarm = alarms.find((a) => a.id === selectedAlarmId);

  if (loading) {
    return (
      <section className="analytics-section m3-section">
        <div className="section-heading">
          <span className="m3-tag">PER-ALARM CALIBRATION</span>
          <h2>Adaptive Difficulty Engine</h2>
        </div>
        <div className="m3-loading-card">
          <div className="m3-spinner">⚙️</div>
          <p>Analyzing recent two-attempt cognitive performance...</p>
        </div>
      </section>
    );
  }

  if (alarms.length === 0) {
    return (
      <section className="analytics-section m3-section">
        <div className="section-heading">
          <span className="m3-tag">PER-ALARM CALIBRATION</span>
          <h2>Adaptive Difficulty Engine</h2>
        </div>
        <div className="adaptive-card">
          <div style={{ textAlign: "center", padding: "30px 20px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔔</div>
            <h3 style={{ margin: "0 0 8px", color: "#f8fafc" }}>
              No Active Alarms Found
            </h3>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
              Create an alarm in the Alarms section to activate the Two-Attempt
              Difficulty Engine.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="analytics-section m3-section">
        <div className="section-heading">
          <span className="m3-tag">PER-ALARM CALIBRATION</span>
          <h2>Adaptive Difficulty Engine</h2>
        </div>
        <div className="m3-error-card">
          <p className="m3-error-text">⚠️ {error}</p>
          <button className="m3-retry-btn" onClick={handleRetry}>
            Retry Adaptive Difficulty
          </button>
        </div>
      </section>
    );
  }

  // Derived state from backend response (Source of Truth)
  const results = data?.results || [];
  const totalCompleted = results.length;
  const isTwoAttempts = totalCompleted >= 2;
  const correctCount = results.filter((r) => r === "correct").length;

  const currentDiff = capitalize(
    data?.previous_difficulty || selectedAlarm?.difficulty || "medium"
  );
  const nextDiff = capitalize(
    data?.next_difficulty || selectedAlarm?.difficulty || "medium"
  );

  const decision = (
    data?.action || (data?.decision ? data.decision.toUpperCase() : "MAINTAIN")
  ).toUpperCase();

  const isAdjusted = data?.adjusted ?? false;
  const reason =
    data?.reason ||
    (isTwoAttempts
      ? correctCount === 2
        ? "2/2 correct → Difficulty increased"
        : correctCount === 1
        ? "1/2 correct → Difficulty maintained"
        : "0/2 correct → Difficulty decreased"
      : "2 completed attempts are required for adaptive adjustment.");

  return (
    <section className="analytics-section m3-section">
      <div className="section-heading">
        <span className="m3-tag">PER-ALARM CALIBRATION</span>
        <h2>Adaptive Difficulty Engine</h2>
      </div>

      <div className="adaptive-card">
        {/* Top Header Row: Subtitle + Per-Alarm Selector */}
        <div className="adaptive-card-top">
          <div className="adaptive-title-area">
            <h3> Difficulty Engine</h3>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "13px",
                color: "#94a3b8",
              }}
            >
              Calibrated strictly per alarm using the latest two completed
              attempts.
            </p>
          </div>

          {/* Per-Alarm Selector (Strict Per-Alarm Isolation) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <label
              htmlFor="adaptive-alarm-select"
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Alarm:
            </label>
            {alarms.length > 1 ? (
              <select
                id="adaptive-alarm-select"
                value={selectedAlarmId}
                onChange={(e) => handleAlarmChange(e.target.value)}
                disabled={loadingStatus}
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#f8fafc",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "13px",
                  fontWeight: "600",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {alarms.map((alarm) => (
                  <option key={alarm.id} value={alarm.id}>
                    {alarm.name} ({capitalize(alarm.difficulty || "medium")})
                  </option>
                ))}
              </select>
            ) : (
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#38bdf8",
                  padding: "4px 10px",
                  background: "rgba(56, 189, 248, 0.1)",
                  borderRadius: "6px",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                }}
              >
                🔔 {selectedAlarm?.name} (
                {capitalize(selectedAlarm?.difficulty || "medium")})
              </span>
            )}
          </div>
        </div>

        {/* Core Layout: Grid of Attempts, Visual Progression, and Decision */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "18px",
            margin: "24px 0",
          }}
        >
          {/* Card 1: Recent Attempts (Requirement 5) */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "14px",
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Recent Attempts</span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#38bdf8",
                    fontWeight: "600",
                  }}
                >
                  Alarm ID: {selectedAlarmId}
                </span>
              </div>

              {/* Attempt 1 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.03)",
                  marginBottom: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#cbd5e1",
                  }}
                >
                  Attempt 1
                </span>
                {totalCompleted >= 1 ? (
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: "700",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      background:
                        results[0] === "correct"
                          ? "rgba(34, 197, 94, 0.15)"
                          : "rgba(239, 68, 68, 0.15)",
                      color:
                        results[0] === "correct" ? "#4ade80" : "#f87171",
                      border: `1px solid ${
                        results[0] === "correct"
                          ? "rgba(34, 197, 94, 0.3)"
                          : "rgba(239, 68, 68, 0.3)"
                      }`,
                    }}
                  >
                    {results[0] === "correct" ? "✓ Correct" : "✕ Incorrect"}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#94a3b8",
                      fontStyle: "italic",
                    }}
                  >
                    — Waiting for first attempt
                  </span>
                )}
              </div>

              {/* Attempt 2 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.03)",
                  marginBottom: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#cbd5e1",
                  }}
                >
                  Attempt 2
                </span>
                {totalCompleted >= 2 ? (
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: "700",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      background:
                        results[1] === "correct"
                          ? "rgba(34, 197, 94, 0.15)"
                          : "rgba(239, 68, 68, 0.15)",
                      color:
                        results[1] === "correct" ? "#4ade80" : "#f87171",
                      border: `1px solid ${
                        results[1] === "correct"
                          ? "rgba(34, 197, 94, 0.3)"
                          : "rgba(239, 68, 68, 0.3)"
                      }`,
                    }}
                  >
                    {results[1] === "correct" ? "✓ Correct" : "✕ Incorrect"}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#94a3b8",
                      fontStyle: "italic",
                    }}
                  >
                    — Waiting for second attempt
                  </span>
                )}
              </div>
            </div>

            {!isTwoAttempts && (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "12px",
                  color: "#fbbf24",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>ℹ️</span>
                <span>
                  2 completed attempts are required for adaptive adjustment.
                </span>
              </p>
            )}
          </div>

          {/* Card 2: Current & Next Difficulty Progression (Requirement 7) */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "14px",
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "12px",
                textAlign: "left",
              }}
            >
              Difficulty Progression
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "8px 0",
              }}
            >
              {/* CURRENT */}
              <div style={{ width: "100%", maxWidth: "200px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  CURRENT
                </span>
                <div
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    fontSize: "17px",
                    fontWeight: "800",
                    color: "#f8fafc",
                  }}
                >
                  {currentDiff}
                </div>
              </div>

              {/* Arrow */}
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "800",
                  color:
                    decision === "INCREASE"
                      ? "#4ade80"
                      : decision === "DECREASE"
                      ? "#f87171"
                      : "#38bdf8",
                  lineHeight: 1,
                  margin: "2px 0",
                }}
              >
                ↓
              </div>

              {/* NEXT */}
              <div style={{ width: "100%", maxWidth: "200px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color:
                      decision === "INCREASE"
                        ? "#4ade80"
                        : decision === "DECREASE"
                        ? "#f87171"
                        : "#38bdf8",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  NEXT
                </span>
                <div
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    background:
                      decision === "INCREASE"
                        ? "rgba(34, 197, 94, 0.15)"
                        : decision === "DECREASE"
                        ? "rgba(239, 68, 68, 0.15)"
                        : "rgba(56, 189, 248, 0.12)",
                    border: `1px solid ${
                      decision === "INCREASE"
                        ? "rgba(34, 197, 94, 0.35)"
                        : decision === "DECREASE"
                        ? "rgba(239, 68, 68, 0.35)"
                        : "rgba(56, 189, 248, 0.3)"
                    }`,
                    fontSize: "17px",
                    fontWeight: "800",
                    color:
                      decision === "INCREASE"
                        ? "#4ade80"
                        : decision === "DECREASE"
                        ? "#f87171"
                        : "#38bdf8",
                  }}
                >
                  {nextDiff}
                </div>
              </div>
            </div>

            {!isTwoAttempts && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  marginTop: "6px",
                }}
              >
                Status: Waiting for second completed attempt
              </div>
            )}
          </div>

          {/* Card 3: Performance, Decision & Applied Status (Requirements 6 & 8) */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "14px",
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "12px",
                }}
              >
                Evaluation & Decision
              </div>

              <div style={{ marginBottom: "10px" }}>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    display: "block",
                  }}
                >
                  Performance:
                </span>
                <strong
                  style={{
                    fontSize: "18px",
                    color: "#f8fafc",
                    fontWeight: "800",
                  }}
                >
                  {isTwoAttempts
                    ? `${correctCount} / 2 Correct`
                    : totalCompleted === 1
                    ? `${correctCount} / 1 Completed Attempt`
                    : "0 / 2 Completed Attempts"}
                </strong>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Decision:
                </span>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "13px",
                    fontWeight: "800",
                    padding: "4px 12px",
                    borderRadius: "6px",
                    letterSpacing: "0.5px",
                    background:
                      decision === "INCREASE"
                        ? "rgba(34, 197, 94, 0.15)"
                        : decision === "DECREASE"
                        ? "rgba(239, 68, 68, 0.15)"
                        : "rgba(245, 158, 11, 0.15)",
                    color:
                      decision === "INCREASE"
                        ? "#4ade80"
                        : decision === "DECREASE"
                        ? "#f87171"
                        : "#fbbf24",
                    border: `1px solid ${
                      decision === "INCREASE"
                        ? "rgba(34, 197, 94, 0.35)"
                        : decision === "DECREASE"
                        ? "rgba(239, 68, 68, 0.35)"
                        : "rgba(245, 158, 11, 0.35)"
                    }`,
                  }}
                >
                  {decision}
                </span>
              </div>
            </div>

            {/* Application Status (Requirement 8) */}
            <div
              style={{
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                paddingTop: "10px",
              }}
            >
              {isAdjusted ? (
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#4ade80",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "2px",
                    }}
                  >
                    <span>✓</span>
                    <span>Difficulty automatically updated</span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
                    The next cognitive challenge will use {nextDiff} difficulty.
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: "13px",
                    color: "#94a3b8",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>•</span>
                  <span>No difficulty change yet</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reason Box */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            background: "rgba(30, 58, 138, 0.18)",
            border: "1px solid rgba(56, 189, 248, 0.22)",
            borderRadius: "12px",
            padding: "14px 18px",
            marginBottom: "20px",
          }}
        >
          <div style={{ fontSize: "18px", lineHeight: 1 }}>🎯</div>
          <div>
            <strong
              style={{
                display: "block",
                fontSize: "13px",
                color: "#38bdf8",
                marginBottom: "3px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Calibration Reason
            </strong>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: "#e2e8f0",
                lineHeight: 1.5,
                fontWeight: "500",
              }}
            >
              {reason}
            </p>
          </div>
        </div>

        {/* Visual Decision Tree Infographic (Requirement 15) */}
        <div
          style={{
            background: "rgba(0, 0, 0, 0.25)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "14px",
            padding: "16px 20px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: "700",
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "12px",
              textAlign: "center",
            }}
          >
            Two-Attempt Calibration Flowchart
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
              textAlign: "center",
            }}
          >
            {/* Branch 1: Both Correct */}
            <div
              style={{
                padding: "12px 10px",
                borderRadius: "10px",
                background:
                  decision === "INCREASE"
                    ? "rgba(34, 197, 94, 0.12)"
                    : "rgba(255, 255, 255, 0.02)",
                border: `1px solid ${
                  decision === "INCREASE"
                    ? "rgba(34, 197, 94, 0.4)"
                    : "rgba(255, 255, 255, 0.06)"
                }`,
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "800",
                  color: decision === "INCREASE" ? "#4ade80" : "#cbd5e1",
                  marginBottom: "4px",
                }}
              >
                2 / 2 Correct
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#94a3b8",
                  marginBottom: "6px",
                }}
              >
                Both attempts correct
              </div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#4ade80",
                }}
              >
                ↑ Increase Level
              </div>
            </div>

            {/* Branch 2: Mixed */}
            <div
              style={{
                padding: "12px 10px",
                borderRadius: "10px",
                background:
                  decision === "MAINTAIN"
                    ? "rgba(245, 158, 11, 0.12)"
                    : "rgba(255, 255, 255, 0.02)",
                border: `1px solid ${
                  decision === "MAINTAIN"
                    ? "rgba(245, 158, 11, 0.4)"
                    : "rgba(255, 255, 255, 0.06)"
                }`,
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "800",
                  color: decision === "MAINTAIN" ? "#fbbf24" : "#cbd5e1",
                  marginBottom: "4px",
                }}
              >
                1 / 2 Correct
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#94a3b8",
                  marginBottom: "6px",
                }}
              >
                One correct, one wrong
              </div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#fbbf24",
                }}
              >
                • Maintain Level
              </div>
            </div>

            {/* Branch 3: Both Incorrect */}
            <div
              style={{
                padding: "12px 10px",
                borderRadius: "10px",
                background:
                  decision === "DECREASE"
                    ? "rgba(239, 68, 68, 0.12)"
                    : "rgba(255, 255, 255, 0.02)",
                border: `1px solid ${
                  decision === "DECREASE"
                    ? "rgba(239, 68, 68, 0.4)"
                    : "rgba(255, 255, 255, 0.06)"
                }`,
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "800",
                  color: decision === "DECREASE" ? "#f87171" : "#cbd5e1",
                  marginBottom: "4px",
                }}
              >
                0 / 2 Correct
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#94a3b8",
                  marginBottom: "6px",
                }}
              >
                Both attempts wrong
              </div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#f87171",
                }}
              >
                ↓ Decrease Level
              </div>
            </div>
          </div>
        </div>

        {/* Simple Explanation (Requirement 11) */}
        <div
          style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            paddingTop: "14px",
            fontSize: "13px",
            color: "#94a3b8",
            lineHeight: 1.6,
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              fontWeight: "600",
              color: "#e2e8f0",
            }}
          >
            Difficulty adapts after every two completed attempts for this
            alarm.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              fontSize: "12px",
            }}
          >
            <span style={{ color: "#4ade80" }}>
              • 2/2 correct → Increase one level
            </span>
            <span style={{ color: "#fbbf24" }}>
              • 1/2 correct → Maintain current level
            </span>
            <span style={{ color: "#f87171" }}>
              • 0/2 correct → Decrease one level
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
