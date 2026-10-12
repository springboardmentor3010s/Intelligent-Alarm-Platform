import React, { useState, useEffect, useRef } from "react";
import { Plus, AlarmClock, Trash2, Power, Play, ShieldAlert, Edit3, X, Sun, Moon, Volume2, VolumeX, MoonStar } from "lucide-react";
import api from "../../services/api";
import { formatAlarmTime, getDefaultTitleForTime, parseTo12HourComponents, convertTo24Hour } from "../../utils/timeUtils";
import { createAlarmEngine } from "../../utils/audioEngine";

const TIME_PRESETS = [
  { label: "06:00 AM (Early)", hour: "06", minute: "00", ampm: "AM" },
  { label: "07:00 AM (Morning)", hour: "07", minute: "00", ampm: "AM" },
  { label: "08:30 AM (Work)", hour: "08", minute: "30", ampm: "AM" },
  { label: "02:00 PM (Afternoon)", hour: "02", minute: "00", ampm: "PM" },
  { label: "08:00 PM (Evening)", hour: "08", minute: "00", ampm: "PM" },
  { label: "10:30 PM (Night)", hour: "10", minute: "30", ampm: "PM" },
];

const DEFAULT_ROLES = [
  {
    id: "STANDARD",
    name: "Standard Wake",
    icon: "⏰",
    tagline: "Balanced morning alarm with standard cognitive challenges.",
    color: "#6366f1",
    theme: "standard"
  },
  {
    id: "DRILL_SERGEANT",
    name: "Drill Sergeant",
    icon: "🎖️",
    tagline: "Aggressive speed challenges! Zero snooze policy.",
    color: "#ef4444",
    theme: "drill_sergeant"
  },
  {
    id: "ZEN_GURU",
    name: "Zen Guru",
    icon: "🧘",
    tagline: "Mindful awakening with soothing pattern puzzles.",
    color: "#10b981",
    theme: "zen_guru"
  },
  {
    id: "CORPORATE_EXEC",
    name: "Corporate Exec",
    icon: "💼",
    tagline: "Strategic logic & decision challenges for professionals.",
    color: "#3b82f6",
    theme: "corporate_exec"
  },
  {
    id: "MAD_SCIENTIST",
    name: "Mad Scientist",
    icon: "🧪",
    tagline: "Complex multi-step math and atomic logic puzzles.",
    color: "#8b5cf6",
    theme: "mad_scientist"
  },
  {
    id: "FITNESS_COACH",
    name: "Fitness Coach",
    icon: "🏋️",
    tagline: "High-energy agility challenges to jumpstart your morning.",
    color: "#f59e0b",
    theme: "fitness_coach"
  }
];

const PUZZLE_TYPES = [
  { id: "MATH",          name: "Math",           icon: "🧮", desc: "Arithmetic & algebra puzzles",             color: "#6366f1" },
  { id: "WORD_SCRAMBLE", name: "Word Scramble",   icon: "🔤", desc: "Unscramble jumbled letters",               color: "#f59e0b" },
  { id: "SEQUENCE",      name: "Sequence",        icon: "🔢", desc: "Find the next number in the pattern",     color: "#10b981" },
  { id: "MEMORY",        name: "Memory",          icon: "🧠", desc: "Memorize & recall a flashed sequence",    color: "#ec4899" },
  { id: "TRIVIA",        name: "Trivia",          icon: "💡", desc: "General knowledge multiple choice",       color: "#3b82f6" },
  { id: "COLOR_MATCH",   name: "Color Match",     icon: "🎨", desc: "Name the color, not the word (Stroop)",   color: "#a855f7" },
  { id: "RANDOM",        name: "Random",          icon: "🎲", desc: "A different puzzle type each time",       color: "#64748b" },
];

function MyAlarms({ token, user, onTestAlarm, onAlarmsChange }) {
  const [alarms, setAlarms] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAlarmId, setEditingAlarmId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewRole, setPreviewRole] = useState(null);

  const audioRef = useRef(null);
  const previewTimerRef = useRef(null);

  // Form fields
  const [title, setTitle] = useState("Morning Wake-Up");
  const [hour12, setHour12] = useState("07");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmpm] = useState("AM");
  const [alarmTime, setAlarmTime] = useState("07:00");
  const [selectedRole, setSelectedRole] = useState("STANDARD");
  const [snoozeEnabled, setSnoozeEnabled] = useState(true);
  const [snoozeDuration, setSnoozeDuration] = useState(5);
  const [maxSnoozes, setMaxSnoozes] = useState(2);
  const [isMandatory, setIsMandatory] = useState(false);
  const [difficulty, setDifficulty] = useState("AUTO");
  const [numberOfChallenges, setNumberOfChallenges] = useState(3);
  const [challengeType, setChallengeType] = useState("MATH");
  const [repeatType, setRepeatType] = useState("daily"); // "once", "daily", "weekly", "monthly"
  const [repeatDays, setRepeatDays] = useState(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

  const stopPreviewAudio = () => {
    if (audioRef.current) {
      audioRef.current.stop();
    }
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setPreviewRole(null);
  };

  useEffect(() => {
    return () => {
      stopPreviewAudio();
    };
  }, []);

  const handlePreviewRoleSound = (roleId) => {
    if (previewRole === roleId) {
      stopPreviewAudio();
    } else {
      stopPreviewAudio();
      if (!audioRef.current) {
        audioRef.current = createAlarmEngine();
      }
      audioRef.current.start(roleId);
      setPreviewRole(roleId);

      previewTimerRef.current = setTimeout(() => {
        if (audioRef.current) audioRef.current.stop();
        setPreviewRole(null);
      }, 3000);
    }
  };

  const loadAlarms = async () => {
    try {
      setLoading(true);
      const res = await api.get("/alarms", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAlarms(res.data || []);
      if (onAlarmsChange) onAlarmsChange(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlarms();
  }, []);

  const handleTimePickerChange = (newH, newM, newP) => {
    const nextH = newH !== undefined ? newH : hour12;
    const nextM = newM !== undefined ? newM : minute;
    const nextP = newP !== undefined ? newP : ampm;

    setHour12(nextH);
    setMinute(nextM);
    setAmpm(nextP);

    const calculated24 = convertTo24Hour(nextH, nextM, nextP);
    setAlarmTime(calculated24);

    if (!editingAlarmId) {
      setTitle(getDefaultTitleForTime(calculated24));
    }
  };

  const openCreateModal = () => {
    setEditingAlarmId(null);
    setHour12("07");
    setMinute("00");
    setAmpm("AM");
    setAlarmTime("07:00");
    setTitle(getDefaultTitleForTime("07:00"));
    setSelectedRole("STANDARD");
    setSnoozeEnabled(true);
    setSnoozeDuration(5);
    setMaxSnoozes(2);
    setIsMandatory(false);
    setDifficulty("AUTO");
    setNumberOfChallenges(3);
    setChallengeType("MATH");
    setRepeatType("daily");
    setRepeatDays(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    setError("");
    setShowModal(true);
  };

  const openEditModal = (alarm) => {
    setEditingAlarmId(alarm.id);
    const comps = parseTo12HourComponents(alarm.alarm_time);
    setHour12(comps.hour);
    setMinute(comps.minute);
    setAmpm(comps.ampm);
    const time24 = convertTo24Hour(comps.hour, comps.minute, comps.ampm);
    setAlarmTime(time24);
    setTitle(alarm.title || getDefaultTitleForTime(time24));
    setSelectedRole(alarm.alarm_role || "STANDARD");
    setSnoozeEnabled(alarm.snooze_enabled ?? true);
    setSnoozeDuration(alarm.snooze_duration || 5);
    setMaxSnoozes(alarm.max_snoozes ?? 2);
    setIsMandatory(alarm.is_mandatory ?? false);
    setDifficulty(alarm.difficulty || "AUTO");
    setNumberOfChallenges(alarm.number_of_challenges || 3);
    setChallengeType(alarm.challenge_type || "MATH");
    setRepeatType(alarm.repeat_type || "daily");
    setRepeatDays(alarm.repeat_days || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    setError("");
    setShowModal(true);
  };

  const handleToggleWeeklyDay = (dayStr) => {
    if (repeatDays.includes(dayStr)) {
      if (repeatDays.length === 1) return;
      setRepeatDays(repeatDays.filter(d => d !== dayStr));
    } else {
      setRepeatDays([...repeatDays, dayStr]);
    }
  };

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    if (roleId === "DRILL_SERGEANT") {
      setSnoozeEnabled(false);
      setMaxSnoozes(0);
    } else if (roleId === "ZEN_GURU") {
      setSnoozeEnabled(true);
      setSnoozeDuration(5);
      setMaxSnoozes(3);
    } else {
      setSnoozeEnabled(true);
      if (maxSnoozes === 0) setMaxSnoozes(2);
    }
    // Difficulty is always AUTO (adaptive) — not user-configurable
    setDifficulty("AUTO");
  };

  const handleSaveAlarm = async (e) => {
    e.preventDefault();
    try {
      setError("");
      const isSnoozeAllowed = snoozeEnabled && selectedRole !== "DRILL_SERGEANT" && !isMandatory;
      const payload = {
        title,
        alarm_time: alarmTime,
        timezone: "Asia/Kolkata",
        repeat_type: repeatType,
        repeat_days: repeatDays,
        enabled: true,
        sound: "default",
        volume: 80,
        snooze_enabled: isSnoozeAllowed,
        snooze_duration: snoozeDuration,
        max_snoozes: isSnoozeAllowed ? maxSnoozes : 0,
        challenge_type: challengeType,
        difficulty,
        number_of_challenges: numberOfChallenges,
        alarm_role: selectedRole,
        is_mandatory: isMandatory
      };

      if (editingAlarmId) {
        await api.put(`/alarms/${editingAlarmId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await api.post("/alarms", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setShowModal(false);
      loadAlarms();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save alarm");
    }
  };

  const handleToggle = async (alarmId) => {
    try {
      await api.patch(`/alarms/${alarmId}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      loadAlarms();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (alarmId) => {
    if (!window.confirm("Are you sure you want to delete this alarm?")) return;
    try {
      await api.delete(`/alarms/${alarmId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      loadAlarms();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete alarm");
    }
  };

  return (
    <div className="my-alarms-container">
      <div className="section-title-row">
        <div>
          <h2>My Cognitive Alarms</h2>
          <p>Role-Based Awakening Personas and Managed Alarms</p>
        </div>
        <button className="create-alarm-button" onClick={openCreateModal}>
          <Plus size={18} /> Add Role Alarm
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#94a3b8" }}>Loading your alarms...</p>
      ) : alarms.length === 0 ? (
        <div className="empty-alarm">
          <AlarmClock size={50} color="#8b5cf6" />
          <h3>No Alarms Set</h3>
          <p>Set up your first Role-Based Alarm (e.g. Drill Sergeant or Zen Guru) to start!</p>
          <button className="primary-button" onClick={openCreateModal} style={{ marginTop: 15 }}>
            Create First Alarm
          </button>
        </div>
      ) : (
        <div className="alarm-list">
          {alarms.map((alarm) => {
            const roleMeta = alarm.role_meta || DEFAULT_ROLES.find(r => r.id === alarm.alarm_role) || DEFAULT_ROLES[0];
            const pillClass = `role-pill-${(alarm.alarm_role || 'standard').toLowerCase()}`;
            const timeMeta = formatAlarmTime(alarm.alarm_time);

            return (
              <div key={alarm.id} className="alarm-row">
                <div className="alarm-row-icon" style={{ fontSize: 24, background: "rgba(255,255,255,0.06)" }}>
                  {roleMeta.icon || "⏰"}
                </div>
                <div className="alarm-row-info">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <strong>{alarm.title}</strong>
                    <span className={`role-card-badge ${pillClass}`}>
                      {roleMeta.name}
                    </span>
                    {alarm.is_mandatory && (
                      <span className="role-card-badge" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.4)" }}>
                        <ShieldAlert size={12} style={{ display: "inline", marginRight: 3 }} /> Mandatory
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
                      {timeMeta.displayTime}
                    </span>
                  </div>
                  <small style={{ color: "#94a3b8" }}>
                    Schedule: {
                      alarm.repeat_type === "once" ? "🗓️ Once" :
                      alarm.repeat_type === "monthly" ? `📆 Monthly (${alarm.repeat_days?.[0] ? `${alarm.repeat_days[0]}th` : "1st"})` :
                      alarm.repeat_type === "weekly" ? `📅 Weekly (${alarm.repeat_days?.length ? alarm.repeat_days.join(", ") : "Mon-Sun"})` :
                      "🔁 Daily"
                    } | {(PUZZLE_TYPES.find(p => p.id === alarm.challenge_type) || PUZZLE_TYPES[0]).icon} {(PUZZLE_TYPES.find(p => p.id === alarm.challenge_type) || PUZZLE_TYPES[0]).name} | Snooze: {alarm.snooze_enabled ? `${alarm.max_snoozes || 2}x (${alarm.snooze_duration || 5}m)` : "Disabled"}
                  </small>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    className="icon-button"
                    title="Test Cognitive Challenge"
                    onClick={() => {
                      stopPreviewAudio();
                      onTestAlarm && onTestAlarm(alarm);
                    }}
                    style={{ background: "rgba(99, 102, 241, 0.2)", color: "#c4b5fd" }}
                  >
                    <Play size={18} />
                  </button>

                  <button
                    className="icon-button"
                    title="Edit Alarm"
                    onClick={() => openEditModal(alarm)}
                  >
                    <Edit3 size={18} />
                  </button>

                  <button
                    className={`icon-button ${alarm.enabled ? "active" : ""}`}
                    title={alarm.enabled ? "Disable Alarm" : "Enable Alarm"}
                    onClick={() => handleToggle(alarm.id)}
                    style={{ color: alarm.enabled ? "#34d399" : "#64748b" }}
                  >
                    <Power size={18} />
                  </button>

                  <button
                    className="icon-button"
                    title="Delete Alarm"
                    onClick={() => handleDelete(alarm.id)}
                    style={{ color: "#fca5a5" }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT ROLE ALARM MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h2>{editingAlarmId ? "Edit Role Alarm" : "Create Role-Based Alarm"}</h2>
              <button className="close-button" onClick={() => { stopPreviewAudio(); setShowModal(false); }}>
                <X size={20} />
              </button>
            </div>

            {error && <div className="error-box">{error}</div>}

            <form onSubmit={handleSaveAlarm} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="small-label">SELECT ALARM ROLE PERSONA & SOUND</label>
                <div className="role-selector-grid">
                  {DEFAULT_ROLES.map((role) => (
                    <div
                      key={role.id}
                      className={`role-card ${selectedRole === role.id ? "selected" : ""}`}
                      onClick={() => handleRoleSelect(role.id)}
                    >
                      <div className="role-card-header">
                        <span className="role-icon-lg">{role.icon}</span>
                        <button
                          type="button"
                          className={`preview-sound-btn ${previewRole === role.id ? "playing" : ""}`}
                          title="Preview Alarm Persona Sound"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewRoleSound(role.id);
                          }}
                        >
                          {previewRole === role.id ? <VolumeX size={13} /> : <Volume2 size={13} />}
                          {previewRole === role.id ? "Playing..." : "Preview"}
                        </button>
                      </div>
                      <span className="role-card-title">{role.name}</span>
                      <p className="role-card-tagline">{role.tagline}</p>
                      <span className={`role-card-badge role-pill-${role.theme}`} style={{ marginTop: 6 }}>
                        {role.name} Tone
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-control">
                <label className="small-label">ALARM TITLE</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Morning Wake-Up"
                  required
                />
              </div>

              {/* DEDICATED 12-HOUR TIME PICKER WITH AM / PM */}
              <div className="form-control">
                <label className="small-label">ALARM TIME & AM / PM SELECTOR</label>
                <div className="time-picker-card">
                  <div className="time-picker-controls">
                    {/* Hour and Minute Selectors */}
                    <div className="time-select-box">
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>HOUR</span>
                        <select
                          className="time-picker-select"
                          value={hour12}
                          onChange={(e) => handleTimePickerChange(e.target.value, undefined, undefined)}
                        >
                          {Array.from({ length: 12 }, (_, i) => {
                            const h = (i + 1).toString().padStart(2, "0");
                            return (
                              <option key={h} value={h} style={{ background: "#1e293b", color: "#fff" }}>
                                {h}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <span className="time-colon">:</span>

                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>MINUTE</span>
                        <select
                          className="time-picker-select"
                          value={minute}
                          onChange={(e) => handleTimePickerChange(undefined, e.target.value, undefined)}
                        >
                          {Array.from({ length: 60 }, (_, i) => {
                            const m = i.toString().padStart(2, "0");
                            return (
                              <option key={m} value={m} style={{ background: "#1e293b", color: "#fff" }}>
                                {m}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    {/* AM / PM Segmented Control */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>PERIOD</span>
                      <div className="ampm-toggle-group">
                        <button
                          type="button"
                          className={`ampm-btn am ${ampm === "AM" ? "active" : ""}`}
                          onClick={() => handleTimePickerChange(undefined, undefined, "AM")}
                        >
                          <Sun size={16} /> AM
                        </button>
                        <button
                          type="button"
                          className={`ampm-btn pm ${ampm === "PM" ? "active" : ""}`}
                          onClick={() => handleTimePickerChange(undefined, undefined, "PM")}
                        >
                          <Moon size={16} /> PM
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Quick Time Presets
                    </span>
                    <div className="time-preset-pills">
                      {TIME_PRESETS.map((preset, idx) => (
                        <button
                          type="button"
                          key={idx}
                          className="preset-pill"
                          onClick={() => handleTimePickerChange(preset.hour, preset.minute, preset.ampm)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* REPEAT SCHEDULE CONFIGURATION */}
              <div className="form-control" style={{ background: "rgba(15,23,42,0.6)", padding: 16, borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)" }}>
                <label className="small-label" style={{ marginBottom: 8 }}>REPEAT SCHEDULE</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {[
                    { id: "once", label: "Once", icon: "🗓️" },
                    { id: "daily", label: "Daily", icon: "🔁" },
                    { id: "weekly", label: "Weekly", icon: "📅" },
                    { id: "monthly", label: "Monthly", icon: "📆" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setRepeatType(item.id);
                        if (item.id === "daily") {
                          setRepeatDays(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
                        } else if (item.id === "once") {
                          setRepeatDays([]);
                        } else if (item.id === "weekly") {
                          setRepeatDays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
                        } else if (item.id === "monthly") {
                          setRepeatDays([new Date().getDate().toString()]);
                        }
                      }}
                      style={{
                        padding: "10px 6px",
                        borderRadius: 10,
                        border: repeatType === item.id ? "1px solid #8b5cf6" : "1px solid rgba(255,255,255,0.1)",
                        background: repeatType === item.id ? "rgba(139,92,246,0.25)" : "rgba(30,41,59,0.5)",
                        color: repeatType === item.id ? "#c4b5fd" : "#94a3b8",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6
                      }}
                    >
                      <span>{item.icon}</span> {item.label}
                    </button>
                  ))}
                </div>

                {/* WEEKLY DAY SELECTOR */}
                {repeatType === "weekly" && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, display: "block", marginBottom: 6 }}>
                      SELECT DAYS OF THE WEEK
                    </span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                        const isSelected = repeatDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleToggleWeeklyDay(day)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 20,
                              border: isSelected ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.1)",
                              background: isSelected ? "rgba(16,185,129,0.25)" : "rgba(30,41,59,0.5)",
                              color: isSelected ? "#34d399" : "#64748b",
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer"
                            }}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* MONTHLY DAY OF MONTH SELECTOR */}
                {repeatType === "monthly" && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>
                      DAY OF MONTH:
                    </span>
                    <select
                      value={repeatDays[0] || new Date().getDate().toString()}
                      onChange={(e) => setRepeatDays([e.target.value])}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "rgba(30,41,59,0.9)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.15)",
                        fontWeight: 600
                      }}
                    >
                      {Array.from({ length: 31 }, (_, i) => (i + 1).toString()).map((d) => (
                        <option key={d} value={d}>
                          Day {d} of every month
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* PUZZLE TYPE SELECTOR */}
              <div className="form-control">
                <label className="small-label">PUZZLE TYPE</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                  {PUZZLE_TYPES.map((pt) => {
                    const isSelected = challengeType === pt.id;
                    return (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => setChallengeType(pt.id)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          padding: "14px 10px",
                          borderRadius: 14,
                          border: isSelected ? `2px solid ${pt.color}` : "2px solid rgba(255,255,255,0.08)",
                          background: isSelected ? `${pt.color}18` : "rgba(15,23,42,0.5)",
                          color: isSelected ? "#fff" : "#94a3b8",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          boxShadow: isSelected ? `0 0 20px ${pt.color}30` : "none",
                        }}
                      >
                        <span style={{ fontSize: 26 }}>{pt.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 800 }}>{pt.name}</span>
                        <span style={{ fontSize: 10, color: isSelected ? "#cbd5e1" : "#64748b", textAlign: "center", lineHeight: 1.3 }}>
                          {pt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Difficulty is always AUTO (Adaptive) — hidden from user */}

              {/* NUMBER OF CHALLENGES */}
              <div className="form-control">
                <label className="small-label">NUMBER OF CHALLENGES TO DISMISS ALARM</label>
                <select
                  value={numberOfChallenges}
                  onChange={(e) => setNumberOfChallenges(Number(e.target.value))}
                  style={{ width: "100%", height: 48, background: "rgba(15,23,42,0.6)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "0 12px" }}
                >
                  <option value={2}>2 Puzzles</option>
                  <option value={3}>3 Puzzles</option>
                </select>
              </div>

              {/* SNOOZE CONFIGURATION */}
              <div className="form-control" style={{ background: "rgba(15,23,42,0.6)", padding: 16, borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <label className="small-label" style={{ marginBottom: 2 }}>SNOOZE OPTIONS</label>
                    <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                      {selectedRole === "DRILL_SERGEANT"
                        ? "🎖️ Drill Sergeant enforces zero-snooze policy (Disabled)"
                        : "Allow snoozing before solving the wake-up challenge"}
                    </p>
                  </div>
                  {selectedRole !== "DRILL_SERGEANT" && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={snoozeEnabled}
                        onChange={(e) => setSnoozeEnabled(e.target.checked)}
                        style={{ width: 18, height: 18, cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700, color: snoozeEnabled ? "#34d399" : "#94a3b8" }}>
                        {snoozeEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  )}
                </div>

                {snoozeEnabled && selectedRole !== "DRILL_SERGEANT" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <div>
                      <label className="small-label" style={{ fontSize: 11 }}>SNOOZE DURATION</label>
                      <select
                        value={snoozeDuration}
                        onChange={(e) => setSnoozeDuration(parseInt(e.target.value) || 5)}
                        style={{ width: "100%", height: 44, background: "rgba(30,41,59,0.9)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "0 10px", fontSize: 14, fontWeight: 600 }}
                      >
                        <option value={3}>3 Minutes</option>
                        <option value={5}>5 Minutes</option>
                        <option value={10}>10 Minutes</option>
                        <option value={15}>15 Minutes</option>
                      </select>
                    </div>

                    <div>
                      <label className="small-label" style={{ fontSize: 11 }}>MAX SNOOZES ALLOWED</label>
                      <select
                        value={maxSnoozes}
                        onChange={(e) => setMaxSnoozes(parseInt(e.target.value) || 0)}
                        style={{ width: "100%", height: 44, background: "rgba(30,41,59,0.9)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "0 10px", fontSize: 14, fontWeight: 600 }}
                      >
                        <option value={1}>1 Snooze</option>
                        <option value={2}>2 Snoozes</option>
                        <option value={3}>3 Snoozes</option>
                        <option value={5}>5 Snoozes</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {(user?.role === "ADMIN" || user?.role === "WELLNESS_COACH") && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(239, 68, 68, 0.1)", padding: 12, borderRadius: 12, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                  <input
                    type="checkbox"
                    id="mandatory-check"
                    checked={isMandatory}
                    onChange={(e) => setIsMandatory(e.target.checked)}
                    style={{ width: 20, height: 20 }}
                  />
                  <label htmlFor="mandatory-check" style={{ color: "#fca5a5", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                    Mark as Mandatory Alarm (Prevents snooze/deletion without completion)
                  </label>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 10 }}>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => { stopPreviewAudio(); setShowModal(false); }}
                  style={{ width: "auto", padding: "0 20px" }}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Save Role Alarm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyAlarms;
