import React, { useEffect, useState } from "react";
import {
  getAlarms,
  createAlarm,
  updateAlarm,
  toggleAlarm,
  deleteAlarm,
} from "../services/api";

import { useNavigate } from "react-router-dom";
import {
  getNotificationPermission,
  requestNotificationPermission,
  showAlarmBrowserNotification,
} from "../services/notificationService";

const CHALLENGE_TYPES = [
  {
    value: "math",
    label: "Math",
    icon: "🧮",
  },
  {
    value: "logic",
    label: "Logic",
    icon: "🧩",
  },
  {
    value: "memory",
    label: "Memory",
    icon: "🧠",
  },
  {
    value: "word",
    label: "Word",
    icon: "🔤",
  },
  {
    value: "pattern",
    label: "Pattern",
    icon: "📐",
  },
  {
    value: "riddle",
    label: "Riddle",
    icon: "💡",
  },
  {
    value: "quiz",
    label: "Quiz",
    icon: "❓",
  },
];

const DIFFICULTIES = [
  {
    value: "beginner",
    label: "Beginner",
  },
  {
    value: "easy",
    label: "Easy",
  },
  {
    value: "medium",
    label: "Medium",
  },
  {
    value: "hard",
    label: "Hard",
  },
  {
    value: "expert",
    label: "Expert",
  },
];

const DEFAULT_FORM = {
  name: "",
  alarm_time: "",
  alarm_type: "daily",
  repeat_pattern: "",
  is_active: true,
  challenge_type: "math",
  difficulty: "medium",
};

function normalizeTime(time) {
  if (!time) return "";

  if (typeof time === "string") {
    return time.substring(0, 5);
  }

  return "";
}

function getChallengeLabel(type) {
  const item = CHALLENGE_TYPES.find(
    (challenge) => challenge.value === type
  );

  return item || CHALLENGE_TYPES[0];
}

function getDifficultyLabel(difficulty) {
  const item = DIFFICULTIES.find(
    (level) => level.value === difficulty
  );

  return item ? item.label : "Medium";
}

export default function Alarms() {
  const [alarms, setAlarms] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState(null);

  const [form, setForm] = useState(DEFAULT_FORM);
  const navigate = useNavigate();

  const [notificationPermission, setNotificationPermission] = useState(
    getNotificationPermission()
  );

  async function handleEnableNotifications() {
    const res = await requestNotificationPermission();
    setNotificationPermission(res.status);
    if (res.granted) {
      setSuccess("Browser notifications enabled for real wake-up alerts!");
    } else {
      setError("Notification permission was denied. Please allow notifications in browser settings.");
    }
  }

  /* =====================================================
     LOAD ALARMS
  ===================================================== */


  useEffect(() => {
    loadAlarms();
  }, []);

  async function loadAlarms() {
    try {
      setLoading(true);
      setError("");

      const data = await getAlarms();

      if (Array.isArray(data)) {
        setAlarms(data);
      } else if (Array.isArray(data?.alarms)) {
        setAlarms(data.alarms);
      } else {
        setAlarms([]);
      }
    } catch (err) {
      console.error("Failed to load alarms:", err);
      setError(err.message || "Failed to load alarms");
    } finally {
      setLoading(false);
    }
  }

  /* =====================================================
     FORM HELPERS
  ===================================================== */

  function openCreateForm() {
    setEditingAlarm(null);
    setError("");
    setSuccess("");

    setForm({
      ...DEFAULT_FORM,
    });

    setShowForm(true);
  }

  function openEditForm(alarm) {
    setEditingAlarm(alarm);
    setError("");
    setSuccess("");

    setForm({
      name: alarm.name || "",
      alarm_time: normalizeTime(alarm.alarm_time),
      alarm_type: alarm.alarm_type || "daily",
      repeat_pattern: alarm.repeat_pattern || "",
      is_active:
        typeof alarm.is_active === "boolean"
          ? alarm.is_active
          : true,

      /*
       * Use the preference saved on the alarm.
       * Fallbacks are only used for old alarms that were
       * created before cognitive preferences existed.
       */
      challenge_type:
        alarm.challenge_type ||
        alarm.cognitive_challenge_type ||
        "math",

      difficulty:
        alarm.difficulty ||
        alarm.challenge_difficulty ||
        "medium",
    });

    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingAlarm(null);
    setForm(DEFAULT_FORM);
    setError("");
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function selectChallenge(type) {
    setForm((previous) => ({
      ...previous,
      challenge_type: type,
    }));
  }

  function selectDifficulty(difficulty) {
    setForm((previous) => ({
      ...previous,
      difficulty,
    }));
  }

  /* =====================================================
     VALIDATION
  ===================================================== */

  function validateForm() {
    if (!form.name.trim()) {
      return "Please enter an alarm name.";
    }

    if (!form.alarm_time) {
      return "Please select an alarm time.";
    }

    if (!form.challenge_type) {
      return "Please select a challenge type.";
    }

    if (!form.difficulty) {
      return "Please select a difficulty.";
    }

    return "";
  }

  /* =====================================================
     CREATE / UPDATE
  ===================================================== */

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);

      /*
       * These are the values sent to the existing API.
       *
       * challenge_type and difficulty are included so the
       * selected cognitive preference belongs to this alarm.
       */
      const alarmData = {
        name: form.name.trim(),
        alarm_time: form.alarm_time,
        alarm_type: form.alarm_type,
        repeat_pattern:
          form.repeat_pattern.trim() || null,
        is_active: form.is_active,

        challenge_type: form.challenge_type,
        difficulty: form.difficulty,
      };

      let result;

      if (editingAlarm) {
        result = await updateAlarm(
          editingAlarm.id,
          alarmData
        );

        setAlarms((previous) =>
          previous.map((alarm) =>
            alarm.id === editingAlarm.id
              ? {
                  ...alarm,
                  ...result,
                  ...alarmData,
                }
              : alarm
          )
        );

        setSuccess("Alarm updated successfully.");
      } else {
        result = await createAlarm(alarmData);

        // Proactively request browser notification permission on user creation gesture if unprompted
        if (notificationPermission === "default") {
          try {
            const permRes = await requestNotificationPermission();
            setNotificationPermission(permRes.status);
          } catch (permErr) {
            console.debug("Notification permission prompt note:", permErr);
          }
        }

        setAlarms((previous) => [
          ...previous,
          result,
        ]);

        setSuccess("Alarm created successfully.");
      }

      setShowForm(false);
      setEditingAlarm(null);
      setForm(DEFAULT_FORM);

      /*
       * Refresh from backend so the UI displays exactly
       * what was saved.
       */
      await loadAlarms();
    } catch (err) {
      console.error("Failed to save alarm:", err);
      setError(err.message || "Failed to save alarm");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestAlarm(alarm) {
    if (notificationPermission !== "granted") {
      try {
        const res = await requestNotificationPermission();
        setNotificationPermission(res.status);
      } catch (permErr) {
        console.debug("Notification permission prompt note:", permErr);
      }
    }

    // Dispatch browser notification with deep link callback
    showAlarmBrowserNotification(alarm, () => {
      navigate(`/cognitive-alarm?alarmId=${alarm.id}`);
    });

    // Direct navigation to challenge screen
    navigate(`/cognitive-alarm?alarmId=${alarm.id}`);
  }

  /* =====================================================
     TOGGLE
  ===================================================== */

  async function handleToggle(alarm) {
    try {
      setError("");
      setSuccess("");

      const result = await toggleAlarm(alarm.id);

      setAlarms((previous) =>
        previous.map((item) =>
          item.id === alarm.id
            ? {
                ...item,
                ...result,
                is_active:
                  typeof result?.is_active === "boolean"
                    ? result.is_active
                    : !item.is_active,
              }
            : item
        )
      );

      setSuccess(
        alarm.is_active
          ? "Alarm disabled."
          : "Alarm enabled."
      );
    } catch (err) {
      console.error("Failed to toggle alarm:", err);
      setError(err.message || "Failed to update alarm");
    }
  }

  /* =====================================================
     DELETE
  ===================================================== */

  async function handleDelete(alarm) {
    const confirmed = window.confirm(
      `Delete "${alarm.name || "this alarm"}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await deleteAlarm(alarm.id);

      setAlarms((previous) =>
        previous.filter(
          (item) => item.id !== alarm.id
        )
      );

      setSuccess("Alarm deleted successfully.");
    } catch (err) {
      console.error("Failed to delete alarm:", err);
      setError(err.message || "Failed to delete alarm");
    }
  }

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="alarms-page">
      <div className="alarms-header">
        <div>
          <p className="alarms-eyebrow">
            INTELLIGENT COGNITIVE ALARM
          </p>

          <h1>My Alarms</h1>

          <p className="alarms-subtitle">
            Create alarms and choose the cognitive
            challenge that will wake your mind.
          </p>
        </div>

        <button
          type="button"
          className="add-alarm-btn"
          onClick={openCreateForm}
        >
          <span>＋</span>
          Create Alarm
        </button>
      </div>
     <button
  type="button"
  className="dashboard-button"
  onClick={() => navigate("/dashboard")}
>
  Go to Dashboard
</button>

      {/* Alarm Notifications Status Card (Phase 14) */}
      <div
        className="alarm-notification-status-card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          background: "rgba(30, 41, 59, 0.7)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "12px",
          padding: "14px 20px",
          margin: "12px 0 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "1.4rem" }}>🔔</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#f8fafc" }}>
              Alarm Notifications Status
            </div>
            <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              {notificationPermission === "granted"
                ? "Notifications active — wake-up challenges will alert you even when tab is backgrounded."
                : notificationPermission === "denied"
                ? "Notifications blocked in browser — click address bar lock icon to allow."
                : "Enable browser notifications to receive real wake-up alerts and challenge prompts."}
            </div>
          </div>
        </div>
        {notificationPermission !== "granted" && (
          <button
            type="button"
            className="alarm-action-btn"
            style={{
              background: "#4f46e5",
              color: "#ffffff",
              border: "none",
              padding: "8px 16px",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={handleEnableNotifications}
          >
            🔔 Enable Notifications
          </button>
        )}
      </div>

      {/* =================================================
          MESSAGES
      ================================================= */}

      {error && (
        <div className="alarm-message alarm-message-error">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {success && (
        <div className="alarm-message alarm-message-success">
          <span>✓</span>
          {success}
        </div>
      )}

      {/* =================================================
          LOADING
      ================================================= */}

      {loading ? (
        <div className="alarms-empty">
          <div className="alarm-loader" />
          <p>Loading your alarms...</p>
        </div>
      ) : alarms.length === 0 ? (
        <div className="alarms-empty">
          <div className="empty-icon">⏰</div>

          <h2>No alarms yet</h2>

          <p>
            Create your first alarm and choose a
            cognitive challenge.
          </p>

          <button
            type="button"
            className="add-alarm-btn empty-add-btn"
            onClick={openCreateForm}
          >
            ＋ Create Your First Alarm
          </button>
        </div>
      ) : (
        <div className="alarms-grid">
          {alarms.map((alarm) => {
            const challenge = getChallengeLabel(
              alarm.challenge_type ||
                alarm.cognitive_challenge_type ||
                "math"
            );

            const difficulty = getDifficultyLabel(
              alarm.difficulty ||
                alarm.challenge_difficulty ||
                "medium"
            );

            return (
              <div
                className={`alarm-card ${
                  alarm.is_active
                    ? "alarm-card-active"
                    : "alarm-card-disabled"
                }`}
                key={alarm.id}
              >
                <div className="alarm-card-top">
                  <div className="alarm-icon">
                    ⏰
                  </div>

                  <div className="alarm-status">
                    <span
                      className={`status-dot ${
                        alarm.is_active
                          ? "status-active"
                          : "status-disabled"
                      }`}
                    />

                    {alarm.is_active
                      ? "Active"
                      : "Disabled"}
                  </div>
                </div>

                <div className="alarm-time">
                  {normalizeTime(alarm.alarm_time) ||
                    "--:--"}
                </div>

                <h2 className="alarm-name">
                  {alarm.name || "Unnamed Alarm"}
                </h2>

                <p className="alarm-repeat">
                  {alarm.alarm_type === "daily"
                    ? "Every day"
                    : alarm.repeat_pattern ||
                      alarm.alarm_type ||
                      "Scheduled alarm"}
                </p>

                {/* =========================================
                    COGNITIVE PREFERENCE
                ========================================= */}

                <div className="cognitive-preference">
                  <div className="preference-title">
                    Cognitive Challenge
                  </div>

                  <div className="preference-row">
                    <span className="challenge-badge">
                      <span>
                        {challenge.icon}
                      </span>

                      {challenge.label}
                    </span>

                    <span
                      className={`difficulty-badge difficulty-${(
                        alarm.difficulty ||
                        "medium"
                      ).toLowerCase()}`}
                    >
                      {difficulty}
                    </span>
                  </div>
                </div>

                {/* =========================================
                    ACTIONS
                ========================================= */}

                <div className="alarm-actions">
                  <button
                    type="button"
                    className="alarm-action-btn"
                    style={{
                      background: "rgba(99, 102, 241, 0.2)",
                      color: "#a5b4fc",
                      border: "1px solid rgba(99, 102, 241, 0.4)",
                    }}
                    title="Test alarm wake-up trigger and cognitive challenge"
                    onClick={() => handleTestAlarm(alarm)}
                  >
                    🔔 Test Alarm
                  </button>

                  <button
                    type="button"
                    className="alarm-action-btn edit-btn"
                    onClick={() =>
                      openEditForm(alarm)
                    }
                  >
                    ✏️ Edit
                  </button>

                  <button
                    type="button"
                    className="alarm-action-btn toggle-btn"
                    onClick={() =>
                      handleToggle(alarm)
                    }
                  >
                    {alarm.is_active
                      ? "⏸ Disable"
                      : "▶ Enable"}
                  </button>

                  <button
                    type="button"
                    className="alarm-action-btn delete-btn"
                    onClick={() =>
                      handleDelete(alarm)
                    }
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =================================================
          CREATE / EDIT MODAL
      ================================================= */}

      {showForm && (
        <div
          className="alarm-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeForm();
            }
          }}
        >
          <div className="alarm-modal">
            <div className="alarm-modal-header">
              <div>
                <p className="modal-eyebrow">
                  {editingAlarm
                    ? "UPDATE ALARM"
                    : "NEW ALARM"}
                </p>

                <h2>
                  {editingAlarm
                    ? "Edit Alarm"
                    : "Create Alarm"}
                </h2>

                <p>
                  Choose the challenge before your
                  alarm rings.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeForm}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form
              className="alarm-form"
              onSubmit={handleSubmit}
            >
              {/* =========================================
                  BASIC ALARM DETAILS
              ========================================= */}

              <div className="form-section">
                <h3>Alarm Details</h3>

                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="alarm-name">
                      Alarm Name
                    </label>

                    <input
                      id="alarm-name"
                      name="name"
                      type="text"
                      placeholder="Morning Alarm"
                      value={form.name}
                      onChange={handleChange}
                      maxLength={100}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="alarm-time">
                      Alarm Time
                    </label>

                    <input
                      id="alarm-time"
                      name="alarm_time"
                      type="time"
                      value={form.alarm_time}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="alarm-type">
                      Alarm Type
                    </label>

                    <select
                      id="alarm-type"
                      name="alarm_type"
                      value={form.alarm_type}
                      onChange={handleChange}
                    >
                      <option value="daily">
                        Daily
                      </option>

                      <option value="weekly">
                        Weekly
                      </option>

                      <option value="custom">
                        Custom
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="repeat-pattern">
                      Repeat Pattern
                    </label>

                    <input
                      id="repeat-pattern"
                      name="repeat_pattern"
                      type="text"
                      placeholder="Every day"
                      value={form.repeat_pattern}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* =========================================
                  CHALLENGE TYPE
              ========================================= */}

              <div className="form-section">
                <div className="section-heading-row">
                  <div>
                    <h3>
                      Cognitive Challenge
                    </h3>

                    <p>
                      This challenge will appear when
                      this alarm rings.
                    </p>
                  </div>
                </div>

                <div className="challenge-options">
                  {CHALLENGE_TYPES.map(
                    (challenge) => (
                      <button
                        type="button"
                        key={challenge.value}
                        className={`challenge-option ${
                          form.challenge_type ===
                          challenge.value
                            ? "challenge-option-selected"
                            : ""
                        }`}
                        onClick={() =>
                          selectChallenge(
                            challenge.value
                          )
                        }
                      >
                        <span className="challenge-option-icon">
                          {challenge.icon}
                        </span>

                        <span>
                          {challenge.label}
                        </span>

                        {form.challenge_type ===
                          challenge.value && (
                          <span className="selected-check">
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* =========================================
                  DIFFICULTY
              ========================================= */}

              <div className="form-section">
                <div className="section-heading-row">
                  <div>
                    <h3>Difficulty</h3>

                    <p>
                      Choose how challenging the
                      wake-up task should be.
                    </p>
                  </div>
                </div>

                <div className="difficulty-options">
                  {DIFFICULTIES.map(
                    (difficulty) => (
                      <button
                        type="button"
                        key={difficulty.value}
                        className={`difficulty-option ${
                          form.difficulty ===
                          difficulty.value
                            ? "difficulty-option-selected"
                            : ""
                        }`}
                        onClick={() =>
                          selectDifficulty(
                            difficulty.value
                          )
                        }
                      >
                        {difficulty.label}

                        {form.difficulty ===
                          difficulty.value && (
                          <span>
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* =========================================
                  ACTIVE
              ========================================= */}

              <div className="active-alarm-setting">
                <label className="switch-label">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                  />

                  <span className="custom-switch" />

                  <span>
                    Enable alarm immediately
                  </span>
                </label>
              </div>

              {/* =========================================
                  FORM ACTIONS
              ========================================= */}

              <div className="alarm-form-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-alarm-btn"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="button-spinner" />
                      Saving...
                    </>
                  ) : editingAlarm ? (
                    "✓ Update Alarm"
                  ) : (
                    "＋ Create Alarm"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}