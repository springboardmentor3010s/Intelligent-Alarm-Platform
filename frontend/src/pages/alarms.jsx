import { useCallback, useEffect, useRef, useState } from "react";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { getAlarms, createAlarm, deleteAlarm, snoozeAlarm, completeAlarm } from "../services/api";

import {
  PageShell,
  Card,
  StatCard,
  EmptyState,
} from "../components/ChartKit";
import { COLORS, pieColors, tooltipStyle, gridStroke, axisTick, statGrid } from "../components/chartTokens";

const ALL_DAYS = [
  { short: "Mon", full: "Monday" },
  { short: "Tue", full: "Tuesday" },
  { short: "Wed", full: "Wednesday" },
  { short: "Thu", full: "Thursday" },
  { short: "Fri", full: "Friday" },
  { short: "Sat", full: "Saturday" },
  { short: "Sun", full: "Sunday" },
];

function Alarm({
  onBack,
  onStartChallenge,
  audioReady,
  onEnableSound,
  timeZone,
  onAlarmTriggered,
  onSnoozeRinging,
  ringingAlarmId,
  snoozedUntil,
  completedAlarmIds,
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [alarmTime, setAlarmTime] = useState("");
  const [alarmType, setAlarmType] = useState("daily");
  const [days, setDays] = useState("Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday");
  const [difficulty, setDifficulty] = useState("medium");
  const [challengeType, setChallengeType] = useState("math");
  const [questionCount, setQuestionCount] = useState(3);
  const [isSmart, setIsSmart] = useState(true);

  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAlarms, setLoadingAlarms] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const triggeredAlarmsRef = useRef(new Set());

  const triggerAlarm = useCallback((alarm) => {
    const alarmKey = `${alarm.id}-${alarm.alarm_time}-${new Date().toDateString()}-${
      snoozedUntil[alarm.id] || "scheduled"
    }`;
    if (triggeredAlarmsRef.current.has(alarmKey)) return;
    triggeredAlarmsRef.current.add(alarmKey);
    setMessage(`Alarm triggered: ${alarm.title}`);
    onAlarmTriggered(alarm);
  }, [onAlarmTriggered, snoozedUntil]);

  const isAlarmDue = useCallback((alarm, now) => {
    if (!alarm.is_active) return false;
    if (snoozedUntil[alarm.id]) {
      return Date.now() >= snoozedUntil[alarm.id];
    }
    const timeParts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "long",
    }).formatToParts(now);
    const currentTime = Object.fromEntries(timeParts.map(({ type, value }) => [type, value]));
    const [hours, minutes] = alarm.alarm_time.split(":");
    if (hours !== currentTime.hour || minutes !== currentTime.minute) return false;
    if (alarm.alarm_type === "daily" || alarm.alarm_type === "one_time") return true;
    if (alarm.alarm_type === "weekday") return !["Saturday", "Sunday"].includes(currentTime.weekday);
    if (alarm.alarm_type === "weekend") return ["Saturday", "Sunday"].includes(currentTime.weekday);
    if (alarm.alarm_type === "smart_adaptive" && !alarm.days) return true;
    if (!alarm.days) return false;
    return alarm.days
      .split(",")
      .map((day) => day.trim().toLowerCase())
      .includes(currentTime.weekday.toLowerCase());
  }, [snoozedUntil, timeZone]);

  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      alarms.forEach((alarm) => {
        if (!completedAlarmIds.has(alarm.id) && isAlarmDue(alarm, now) && !ringingAlarmId) {
          triggerAlarm(alarm);
        }
      });
    };
    checkAlarms();
    const intervalId = window.setInterval(checkAlarms, 1000);
    return () => window.clearInterval(intervalId);
  }, [alarms, ringingAlarmId, snoozedUntil, completedAlarmIds, isAlarmDue, triggerAlarm]);

  useEffect(() => {
    let cancelled = false;

    getAlarms()
      .then((data) => {
        if (!cancelled) setAlarms(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.detail || "Unable to load alarms.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAlarms(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleDay(fullDay) {
    const currentList = days
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    let nextList;
    if (currentList.includes(fullDay)) {
      nextList = currentList.filter((d) => d !== fullDay);
    } else {
      nextList = [...currentList, fullDay];
    }
    setDays(nextList.join(","));
  }

  async function handleCreateAlarm(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const alarmData = {
      title,
      description,
      alarm_time: alarmTime,
      alarm_type: alarmType,
      days,
      difficulty,
      challenge_type: challengeType,
      challenge_question_count: Number(questionCount),
      is_smart: isSmart,
      is_active: true,
    };

    try {
      const newAlarm = await createAlarm(alarmData);
      setAlarms((previous) => [...previous, newAlarm]);
      setMessage("Alarm created successfully!");
      setTitle("");
      setDescription("");
      setAlarmTime("");
      setShowCreateModal(false);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail ? (typeof detail === "string" ? detail : JSON.stringify(detail)) : "Unable to create alarm.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAlarm(alarmId) {
    if (!window.confirm("Are you sure you want to delete this alarm?")) return;
    setError("");
    setMessage("");
    try {
      await deleteAlarm(alarmId);
      setAlarms((previous) => previous.filter((alarm) => alarm.id !== alarmId));
      setMessage("Alarm deleted successfully!");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail ? (typeof detail === "string" ? detail : JSON.stringify(detail)) : "Unable to delete alarm.");
    }
  }

  async function handleSnoozeAlarm(alarmId) {
    try {
      setError("");
      setMessage("");
      const updatedAlarm = await snoozeAlarm(alarmId);
      onSnoozeRinging(alarmId);
      setAlarms((previous) => previous.map((alarm) => (alarm.id === alarmId ? updatedAlarm : alarm)));
      setMessage("Alarm snoozed for 2 minutes.");
    } catch {
      setError("Unable to snooze alarm.");
    }
  }

  async function handleCompleteAlarm(alarmId) {
    try {
      setError("");
      setMessage("");
      const updatedAlarm = await completeAlarm(alarmId);
      setAlarms((previous) => previous.map((alarm) => (alarm.id === alarmId ? updatedAlarm : alarm)));
      setMessage("Alarm marked as completed!");
    } catch {
      setError("Unable to complete alarm.");
    }
  }

  /* -------- Derived Metrics -------- */
  const activeCount = alarms.filter((a) => a.is_active).length;
  const totalSnoozes = alarms.reduce((t, a) => t + (a.snooze_count || 0), 0);
  const totalCompletions = alarms.reduce((t, a) => t + (a.completed_count || 0), 0);

  const difficultyCounts = {};
  alarms.forEach((a) => {
    const d = (a.difficulty || "medium").toLowerCase();
    difficultyCounts[d] = (difficultyCounts[d] || 0) + 1;
  });
  const difficultyData = Object.entries(difficultyCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const engagementData = alarms.slice(0, 6).map((a) => ({
    name: a.title ? (a.title.length > 10 ? a.title.slice(0, 10) + "…" : a.title) : "Alarm",
    Snoozes: a.snooze_count || 0,
    Completions: a.completed_count || 0,
  }));

  const activeDaysList = days.split(",").map((d) => d.trim().toLowerCase());

  return (
    <PageShell
      eyebrow="Routine Automation"
      title="Scheduled Alarms"
      subtitle="Manage your cognitive alarms and configure morning puzzle difficulties."
      onBack={onBack}
      backLabel="← Dashboard"
      action={
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(!showCreateModal)}
        >
          {showCreateModal ? "Hide Form" : "+ Create Alarm"}
        </button>
      }
    >
      {/* STAT SUMMARY CARDS */}
      <div style={statGrid}>
        <StatCard icon="⏰" label="Total Alarms" value={alarms.length} accent={COLORS.primary} />
        <StatCard icon="✅" label="Active Alarms" value={activeCount} accent={COLORS.emerald} />
        <StatCard icon="😴" label="Total Snoozes" value={totalSnoozes} accent={COLORS.amber} />
        <StatCard icon="🏆" label="Completed" value={totalCompletions} accent={COLORS.cyan} />
      </div>

      {/* FEEDBACK BANNERS */}
      {error && <div className="alert-box alert-error">⚠️ {error}</div>}
      {message && <div className="alert-box alert-success">✅ {message}</div>}

      {/* CREATE ALARM FORM MODAL/DRAWER */}
      {showCreateModal && (
        <div style={{ marginBottom: 28 }}>
          <Card
            title="Create New Cognitive Alarm"
            subtitle="Configure time, recurrence, and morning challenge type"
            wide
          >
            <div
              className="alert-box alert-info"
              style={{ marginBottom: 20 }}
            >
              <span>🔔</span>
              <span>
                {audioReady
                  ? "Browser alarm sound is enabled. Keep this tab running to trigger alarms on time."
                  : "Sound permission is needed so the browser can play alarms when they trigger."}
              </span>
              {!audioReady && (
                <button className="btn btn-secondary btn-sm" onClick={onEnableSound}>
                  Enable sound
                </button>
              )}
            </div>

            <form onSubmit={handleCreateAlarm}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 16,
                }}
              >
                <div className="form-group">
                  <label className="form-label">
                    Alarm Title <span className="required">*</span>
                  </label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g., Morning Focus Sprint"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Wake Time <span className="required">*</span>
                  </label>
                  <input
                    className="form-input"
                    type="time"
                    value={alarmTime}
                    onChange={(e) => setAlarmTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Alarm Type</label>
                  <select
                    className="form-select"
                    value={alarmType}
                    onChange={(e) => {
                      setAlarmType(e.target.value);
                      if (e.target.value === "smart_adaptive") setIsSmart(true);
                    }}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekday">Weekdays</option>
                    <option value="weekend">Weekends</option>
                    <option value="weekly">Custom weekly days</option>
                    <option value="one_time">One-time</option>
                    <option value="smart_adaptive">Smart adaptive</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Challenge Difficulty</label>
                  <select
                    className="form-select"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="easy">Easy (Quick wake)</option>
                    <option value="medium">Medium (Standard)</option>
                    <option value="hard">Hard (High alertness)</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Challenge Category</label>
                  <select
                    className="form-select"
                    value={challengeType}
                    onChange={(e) => setChallengeType(e.target.value)}
                  >
                    <option value="math">Math Calculations</option>
                    <option value="logic">Logic Puzzles</option>
                    <option value="memory">Memory Recall</option>
                    <option value="riddle">Riddles & Wordplay</option>
                    <option value="word">Word Association</option>
                    <option value="pattern">Pattern Recognition</option>
                    <option value="quiz">Quick Quiz</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Verification Questions</label>
                  <select
                    className="form-select"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                  >
                    <option value="1">1 question</option>
                    <option value="3">3 questions</option>
                    <option value="5">5 questions</option>
                    <option value="10">10 questions</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Description (optional)</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g., Drink water and complete math challenge"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              {/* INTERACTIVE WEEKDAY PICKER */}
              {(alarmType === "weekly" || alarmType === "smart_adaptive") && (
                <div className="form-group" style={{ marginTop: 4 }}>
                  <label className="form-label">Active Days of the Week</label>
                  <div className="days-selector">
                    {ALL_DAYS.map((day) => {
                      const isSelected = activeDaysList.includes(day.full.toLowerCase());
                      return (
                        <button
                          type="button"
                          key={day.full}
                          className={`day-pill ${isSelected ? "active" : ""}`}
                          onClick={() => toggleDay(day.full)}
                          title={day.full}
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SMART ALARM TOGGLE */}
              <div style={{ marginTop: 14, marginBottom: 22 }}>
                <label className="switch-label">
                  <input
                    type="checkbox"
                    checked={isSmart}
                    onChange={(e) => setIsSmart(e.target.checked)}
                  />
                  <span>Enable Adaptive Smart Wakeup (optimizes challenge based on wake history)</span>
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Scheduling Alarm..." : "Save Alarm"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ALARMS GRID LIST */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Space Grotesk', sans-serif" }}>
            Active Alarms ({alarms.length})
          </h2>
          {!showCreateModal && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(true)}>
              + Quick Add
            </button>
          )}
        </div>

        {loadingAlarms ? (
          <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
            Loading your scheduled alarms...
          </div>
        ) : alarms.length === 0 ? (
          <Card>
            <EmptyState
              icon="⏰"
              title="No Alarms Configured"
              description="Create your first cognitive alarm to start waking up with adaptive brain challenges."
              action={
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                  Create Your First Alarm
                </button>
              }
            />
          </Card>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 18,
            }}
          >
            {alarms.map((alarm) => {
              const isRinging = ringingAlarmId === alarm.id;
              return (
                <div
                  key={alarm.id}
                  className="alarm-card-saas"
                  style={{
                    borderColor: isRinging ? COLORS.primary : undefined,
                    boxShadow: isRinging ? "0 0 25px rgba(99, 102, 241, 0.3)" : undefined,
                  }}
                >
                  <div className="alarm-card-top">
                    <div>
                      <div className="alarm-card-time">{alarm.alarm_time}</div>
                      <h3 className="alarm-card-title">{alarm.title}</h3>
                      {alarm.description && (
                        <p className="alarm-card-desc">{alarm.description}</p>
                      )}
                    </div>

                    <span className={`badge ${alarm.is_active ? "badge-active" : "badge-inactive"}`}>
                      {alarm.is_active ? "Active" : "Disabled"}
                    </span>
                  </div>

                  <div className="alarm-card-meta">
                    <span className="badge badge-primary">{alarm.challenge_type}</span>
                    <span className="badge badge-cyan">{alarm.difficulty}</span>
                    <span className="badge badge-amber">{alarm.alarm_type}</span>
                  </div>

                  <div className="alarm-card-bottom">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSnoozeAlarm(alarm.id)}
                        title="Snooze for 2 minutes"
                      >
                        Snooze
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCompleteAlarm(alarm.id)}
                        title="Mark alarm completed"
                      >
                        Complete
                      </button>
                      {isRinging && onStartChallenge && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => onStartChallenge(alarm)}
                        >
                          Start Challenge
                        </button>
                      )}
                    </div>

                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteAlarm(alarm.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ANALYTICS PREVIEW SECTION */}
      {alarms.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          <Card title="Alarm Engagement" subtitle="Completions vs Snoozes per alarm">
            {engagementData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={engagementData} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                  <Bar dataKey="Completions" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Snoozes" fill={COLORS.rose} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon="📊" title="No Engagement Data" description="Trigger alarms to track responses." />
            )}
          </Card>

          <Card title="Difficulty Distribution" subtitle="Mix of scheduled alarm difficulty">
            {difficultyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={difficultyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="rgba(8, 11, 19, 0.8)"
                  >
                    {difficultyData.map((_, i) => (
                      <Cell key={i} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon="🎯" title="No Difficulty Data" description="Set alarms to view distribution." />
            )}
          </Card>
        </div>
      )}
    </PageShell>
  );
}

export default Alarm;