
import { useEffect, useState } from "react";

function Alarms() {
  // ----------------------------------------
  // ALARM TIME
  // ----------------------------------------

  const [hour, setHour] = useState("07");
  const [minute, setMinute] = useState("00");
  const [period, setPeriod] = useState("AM");

  // ----------------------------------------
  // ALARM SETTINGS
  // ----------------------------------------

  const [alarmType, setAlarmType] = useState("Daily");
  const [challenge, setChallenge] = useState("Math");
  const [difficulty, setDifficulty] = useState("Easy");

  // ----------------------------------------
  // ALARMS
  // ----------------------------------------

  const [alarms, setAlarms] = useState([]);

  // ----------------------------------------
  // ADAPTIVE ML DATA
  // ----------------------------------------

  const [adaptive, setAdaptive] = useState(null);
  const [adaptiveLoading, setAdaptiveLoading] = useState(true);

  // ----------------------------------------
  // UI STATES
  // ----------------------------------------

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const email = localStorage.getItem("email");

  // ----------------------------------------
  // CONVERT 12-HOUR TIME TO 24-HOUR TIME
  // ----------------------------------------

  const get24HourTime = () => {
    let h = parseInt(hour, 10);

    if (period === "AM") {
      if (h === 12) {
        h = 0;
      }
    } else {
      if (h !== 12) {
        h += 12;
      }
    }

    return `${String(h).padStart(2, "0")}:${minute}`;
  };

  // ----------------------------------------
  // DISPLAY TIME
  // ----------------------------------------

  const getDisplayTime = (time24) => {
    if (!time24) {
      return "07:00 AM";
    }

    const [h, m] = time24.split(":");

    let h12 = parseInt(h, 10);

    const p = h12 >= 12 ? "PM" : "AM";

    if (h12 === 0) {
      h12 = 12;
    } else if (h12 > 12) {
      h12 -= 12;
    }

    return `${String(h12).padStart(2, "0")}:${m} ${p}`;
  };

  // ----------------------------------------
  // LOAD DATA
  // ----------------------------------------

  useEffect(() => {
    if (!email) {
      window.location.href = "/login";
      return;
    }

    loadAlarms();
    loadAdaptiveDifficulty();
  }, [email]);

  // ----------------------------------------
  // LOAD EXISTING ALARMS
  // ----------------------------------------

  const loadAlarms = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/alarms/${encodeURIComponent(email)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to load alarms"
        );
      }

      setAlarms(data.alarms || []);

    } catch (error) {
      console.error("Load alarms error:", error);
      setError("Could not load alarms.");
    }
  };

  // ----------------------------------------
  // LOAD ML ADAPTIVE DIFFICULTY
  // ----------------------------------------

  const loadAdaptiveDifficulty = async () => {
    try {
      setAdaptiveLoading(true);

      const response = await fetch(
        `http://localhost:8000/adaptive-difficulty/${encodeURIComponent(email)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to load adaptive difficulty"
        );
      }

      console.log("Adaptive difficulty:", data);

      setAdaptive(data);

      /*
        IMPORTANT:

        We DO NOT automatically change the selected
        difficulty here.

        Example:

        User selects Expert
        → difficulty remains Expert

        ML recommendation is used only when
        Alarm Type = Smart Adaptive.
      */

    } catch (error) {
      console.error(
        "Adaptive difficulty error:",
        error
      );

      setAdaptive(null);

    } finally {
      setAdaptiveLoading(false);
    }
  };

  // ----------------------------------------
  // WHEN ALARM TYPE CHANGES
  // ----------------------------------------

  const handleAlarmTypeChange = (e) => {
    const newType = e.target.value;

    setAlarmType(newType);

    /*
      Smart Adaptive uses the ML recommendation.

      Normal alarm types keep whatever
      difficulty the user selected.
    */

    if (
      newType === "Smart Adaptive" &&
      adaptive?.next_difficulty
    ) {
      setDifficulty(adaptive.next_difficulty);
    }
  };

  // ----------------------------------------
  // SAVE ALARM
  // ----------------------------------------

  const handleSave = async (e) => {
    e.preventDefault();

    if (!email) {
      setError("Please login first.");
      return;
    }

    setSaving(true);
    setSaved(false);
    setError("");

    // Convert selected time
    const alarmTime24 = get24HourTime();

    // ----------------------------------------
    // FINAL DIFFICULTY
    // ----------------------------------------

    /*
      Normal alarm:

      User selects Expert
      → Expert is saved

      Smart Adaptive:

      ML recommendation is used
    */

    let finalDifficulty = difficulty;

    if (
      alarmType === "Smart Adaptive" &&
      adaptive?.next_difficulty
    ) {
      finalDifficulty = adaptive.next_difficulty;
    }

    console.log(
      "Saving alarm with difficulty:",
      finalDifficulty
    );

    // ----------------------------------------
    // SAVE TO BACKEND
    // ----------------------------------------

    try {
      const response = await fetch(
        "http://localhost:8000/alarms",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email: email,
            alarm_time: alarmTime24,
            alarm_type: alarmType,
            challenge: challenge,

            // IMPORTANT
            difficulty: finalDifficulty,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "Failed to save alarm"
        );
      }

      console.log(
        "Alarm saved:",
        data
      );

      // ----------------------------------------
      // SUCCESS
      // ----------------------------------------

      setSaved(true);

      // Reload alarms
      await loadAlarms();

      // Reload ML data
      await loadAdaptiveDifficulty();

      setTimeout(() => {
        setSaved(false);
      }, 3000);

    } catch (error) {
      console.error(
        "Alarm error:",
        error
      );

      setError(
        error.message ||
        "Could not save alarm."
      );

    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------
  // LOGOUT
  // ----------------------------------------

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("role");

    window.location.href = "/login";
  };

  // ----------------------------------------
  // PAGE
  // ----------------------------------------

  return (
    <div className="alarm-page">

      {/* ======================================
          SIDEBAR
      ====================================== */}

      <aside className="sidebar">

        <div className="sidebar-logo">
          🧠 COGNIA
        </div>

        <nav>

          <a href="/dashboard">
            🏠 Dashboard
          </a>

          <a
            href="/alarms"
            className="active-menu"
          >
            ⏰ Alarms
          </a>

          <a href="/habits">
            🌱 Habits
          </a>

          <a href="/challenges">
            🧩 Challenges
          </a>

          <a href="/analytics">
            📊 Analytics
          </a>

          <a href="/profile">
            👤 Profile
          </a>

        </nav>

        <button
          className="logout"
          onClick={logout}
        >
          🚪 Logout
        </button>

      </aside>

      {/* ======================================
          MAIN CONTENT
      ====================================== */}

      <main className="alarm-content">

        {/* ====================================
            HEADER
        ==================================== */}

        <div className="page-header">

          <p className="welcome-small">
            WAKE-UP MANAGEMENT
          </p>

          <h1>
            Alarm Scheduling
          </h1>

          <p className="page-subtitle">
            Create and customize your intelligent wake-up alarms.
          </p>

        </div>

        {/* ====================================
            CREATE ALARM
        ==================================== */}

        <div className="alarm-layout">

          {/* ==================================
              CREATE ALARM CARD
          ================================== */}

          <div className="create-alarm-card">

            <h2>
              Create New Alarm
            </h2>

            <p className="card-description">
              Configure your wake-up time and cognitive challenge.
            </p>

            <form onSubmit={handleSave}>

              {/* ==================================
                  ALARM TIME
              ================================== */}

              <label>
                Alarm Time
              </label>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >

                {/* HOUR */}

                <select
                  value={hour}
                  onChange={(e) =>
                    setHour(e.target.value)
                  }
                  required
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "16px",
                  }}
                >

                  {Array.from(
                    { length: 12 },
                    (_, i) => {

                      const value =
                        String(i + 1).padStart(
                          2,
                          "0"
                        );

                      return (
                        <option
                          key={value}
                          value={value}
                        >
                          {value}
                        </option>
                      );

                    }
                  )}

                </select>

                <span
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                  }}
                >
                  :
                </span>

                {/* MINUTE */}

                <select
                  value={minute}
                  onChange={(e) =>
                    setMinute(e.target.value)
                  }
                  required
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "16px",
                  }}
                >

                  {Array.from(
                    { length: 60 },
                    (_, i) => {

                      const value =
                        String(i).padStart(
                          2,
                          "0"
                        );

                      return (
                        <option
                          key={value}
                          value={value}
                        >
                          {value}
                        </option>
                      );

                    }
                  )}

                </select>

                {/* AM / PM */}

                <select
                  value={period}
                  onChange={(e) =>
                    setPeriod(e.target.value)
                  }
                  required
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "16px",
                    fontWeight: "bold",
                  }}
                >

                  <option value="AM">
                    AM
                  </option>

                  <option value="PM">
                    PM
                  </option>

                </select>

              </div>

              {/* ==================================
                  ALARM TYPE
              ================================== */}

              <label>
                Alarm Type
              </label>

              <select
                value={alarmType}
                onChange={handleAlarmTypeChange}
                required
              >

                <option value="Daily">
                  Daily
                </option>

                <option value="Weekday">
                  Weekday
                </option>

                <option value="Weekend">
                  Weekend
                </option>

                <option value="One-Time">
                  One-Time
                </option>

                <option value="Smart Adaptive">
                  Smart Adaptive
                </option>

              </select>

              {/* ==================================
                  COGNITIVE CHALLENGE
              ================================== */}

              <label>
                Cognitive Challenge
              </label>

              <select
                value={challenge}
                onChange={(e) =>
                  setChallenge(e.target.value)
                }
                required
              >

                <option value="Math">
                  Math
                </option>

                <option value="Logic Puzzle">
                  Logic Puzzle
                </option>

                <option value="Memory">
                  Memory
                </option>

                <option value="Word Game">
                  Word Game
                </option>

                <option value="Pattern Recognition">
                  Pattern Recognition
                </option>

                <option value="Riddle">
                  Riddle
                </option>

                <option value="Quick Quiz">
                  Quick Quiz
                </option>

              </select>

              {/* ==================================
                  DIFFICULTY
              ================================== */}

              <label>
                Difficulty
              </label>

              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value)
                }
                required
              >

                <option value="Beginner">
                  Beginner
                </option>

                <option value="Easy">
                  Easy
                </option>

                <option value="Medium">
                  Medium
                </option>

                <option value="Hard">
                  Hard
                </option>

                <option value="Expert">
                  Expert
                </option>

              </select>

              {/* ==================================
                  SMART ADAPTIVE INFO
              ================================== */}

              {alarmType === "Smart Adaptive" && (
                <div
                  style={{
                    marginTop: "15px",
                    marginBottom: "15px",
                    padding: "14px",
                    borderRadius: "10px",
                    background: "#f5f3ff",
                    border: "1px solid #ddd6fe",
                  }}
                >

                  <strong>
                    🤖 Smart Adaptive Mode
                  </strong>

                  {adaptiveLoading ? (

                    <p>
                      Analyzing your performance...
                    </p>

                  ) : adaptive ? (

                    <p>
                      COGNIA will automatically use{" "}
                      <strong>
                        {adaptive.next_difficulty}
                      </strong>{" "}
                      difficulty based on your behavior.
                    </p>

                  ) : (

                    <p>
                      Adaptive recommendation unavailable.
                    </p>

                  )}

                </div>
              )}

              {/* ==================================
                  SAVE BUTTON
              ================================== */}

              <button
                type="submit"
                className="save-alarm-button"
                disabled={saving}
              >

                {saving
                  ? "Saving..."
                  : "⏰ Save Alarm"}

              </button>

              {/* ==================================
                  SUCCESS
              ================================== */}

              {saved && (
                <div className="success-message">
                  ✓ Alarm saved successfully!
                </div>
              )}

              {/* ==================================
                  ERROR
              ================================== */}

              {error && (
                <div
                  className="success-message"
                  style={{
                    color: "#ff6b6b",
                  }}
                >
                  ✕ {error}
                </div>
              )}

            </form>

          </div>

          {/* ==================================
              PREVIEW
          ================================== */}

          <div className="alarm-preview">

            <div className="preview-icon">
              ⏰
            </div>

            <p className="preview-label">
              NEXT ALARM
            </p>

            <h2>
              {hour}:{minute} {period}
            </h2>

            <p>
              {alarmType}
            </p>

            <div className="preview-divider"></div>

            <p className="preview-label">
              COGNITIVE CHALLENGE
            </p>

            <h3>
              🧩 {challenge}
            </h3>

            <p>
              Difficulty:{" "}
              <strong>
                {difficulty}
              </strong>
            </p>

            {/* SMART ADAPTIVE PREVIEW */}

            {alarmType === "Smart Adaptive" &&
              adaptive && (
                <p>
                  🤖 ML Recommended:{" "}
                  <strong>
                    {adaptive.next_difficulty}
                  </strong>
                </p>
              )}

          </div>

        </div>

        {/* ====================================
            ACTIVE ALARMS
        ==================================== */}

        <div className="section-title">

          <h2>
            Active Alarms
          </h2>

        </div>

        {alarms.length === 0 ? (

          <div className="active-alarm-card">

            <div className="active-alarm-info">

              <h3>
                No alarms found
              </h3>

              <p>
                Create your first intelligent alarm above.
              </p>

            </div>

          </div>

        ) : (

          alarms.map((alarm, index) => (

            <div
              className="active-alarm-card"
              key={index}
            >

              <div className="active-alarm-icon">
                ⏰
              </div>

              <div className="active-alarm-info">

                <h3>
                  Morning Focus
                </h3>

                <p>
                  {getDisplayTime(
                    alarm.alarm_time
                  )}{" "}
                  •{" "}
                  {alarm.alarm_type}
                </p>

              </div>

              <div className="active-challenge">

                🧩 {alarm.challenge}

                <small>
                  {alarm.difficulty}
                </small>

              </div>

              <div className="active-status">

                ●{" "}
                {alarm.active
                  ? "Active"
                  : "Inactive"}

              </div>

            </div>

          ))

        )}

      </main>

    </div>
  );
}

export default Alarms;

