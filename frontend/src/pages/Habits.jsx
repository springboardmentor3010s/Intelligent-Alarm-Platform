import { useEffect, useState } from "react";

function Habits() {
  const API_URL = "http://localhost:8000";

  const email =
    localStorage.getItem("email") ||
    "kavin_new2026@gmail.com";

  const [wakeUpTime, setWakeUpTime] = useState("07:00");
  const [sleepDuration, setSleepDuration] = useState("8 hours");
  const [productivityGoal, setProductivityGoal] = useState("Study");
  const [difficulty, setDifficulty] = useState("Easy");
  const [habitPreference, setHabitPreference] = useState("Daily");

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [habitScore, setHabitScore] = useState(null);
  const [habitData, setHabitData] = useState(null);

  // --------------------------------
  // LOAD HABIT SCORE
  // --------------------------------

  const loadHabitScore = async () => {
    try {
      const response = await fetch(
        `${API_URL}/habit-score/${encodeURIComponent(email)}`
      );

      const data = await response.json();

      if (response.ok) {
        setHabitScore(data);
      }
    } catch (error) {
      console.error("Could not load habit score:", error);
    }
  };

  // --------------------------------
  // LOAD EXISTING HABIT
  // --------------------------------

  const loadHabit = async () => {
    try {
      const response = await fetch(
        `${API_URL}/habits/${encodeURIComponent(email)}`
      );

      const data = await response.json();

      if (response.ok && data.habit) {
        setHabitData(data.habit);

        if (data.habit.wake_up_time) {
          setWakeUpTime(data.habit.wake_up_time);
        }

        if (data.habit.sleep_duration) {
          setSleepDuration(data.habit.sleep_duration);
        }

        if (data.habit.productivity_goal) {
          setProductivityGoal(
            data.habit.productivity_goal
          );
        }

        if (data.habit.difficulty_preference) {
          setDifficulty(
            data.habit.difficulty_preference
          );
        }

        if (data.habit.habit_preference) {
          setHabitPreference(
            data.habit.habit_preference
          );
        }
      }
    } catch (error) {
      console.error("Could not load habit:", error);
    }
  };

  // --------------------------------
  // PAGE LOAD
  // --------------------------------

  useEffect(() => {
    loadHabit();
    loadHabitScore();
  }, []);

  // --------------------------------
  // SAVE HABIT
  // --------------------------------

  const handleSave = async (e) => {
    e.preventDefault();

    setSaving(true);
    setSaved(false);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/habits`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email: email,
            wake_up_time: wakeUpTime,
            sleep_duration: sleepDuration,
            productivity_goal: productivityGoal,
            difficulty_preference: difficulty,
            habit_preference: habitPreference,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to save habit"
        );
      }

      console.log("Habit saved:", data);

      setSaved(true);

      await loadHabitScore();

      setTimeout(() => {
        setSaved(false);
      }, 3000);

    } catch (error) {
      console.error("Habit error:", error);

      setError(
        error.message ||
        "Could not save habit."
      );
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------
  // SCORE VALUE
  // --------------------------------

  const score =
    habitScore?.habit_score !== undefined
      ? habitScore.habit_score
      : "--";

  // --------------------------------
  // UI
  // --------------------------------

  return (
    <div className="alarm-page">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="sidebar-logo">
          🧠 COGNIA
        </div>

        <nav>

          <a href="/dashboard">
            🏠 Dashboard
          </a>

          <a href="/alarms">
            ⏰ Alarms
          </a>

          <a
            href="/habits"
            className="active-menu"
          >
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

        <button className="logout">
          🚪 Logout
        </button>

      </aside>


      {/* MAIN */}

      <main className="alarm-content">

        <div className="page-header">

          <p className="welcome-small">
            HABIT MANAGEMENT
          </p>

          <h1>
            Sleep & Habit Profile
          </h1>

          <p className="page-subtitle">
            Configure your sleep schedule and productivity goals.
          </p>

        </div>


        {/* FORM + PREVIEW */}

        <div className="alarm-layout">

          {/* FORM */}

          <div className="create-alarm-card">

            <h2>
              Create Your Habit Profile
            </h2>

            <p className="card-description">
              Tell Cognia about your daily routine.
            </p>

            <form onSubmit={handleSave}>

              <label>
                Preferred Wake-up Time
              </label>

              <input
                type="time"
                value={wakeUpTime}
                onChange={(e) =>
                  setWakeUpTime(e.target.value)
                }
              />


              <label>
                Sleep Duration
              </label>

              <select
                value={sleepDuration}
                onChange={(e) =>
                  setSleepDuration(e.target.value)
                }
              >
                <option>6 hours</option>
                <option>7 hours</option>
                <option>8 hours</option>
                <option>9 hours</option>
                <option>10 hours</option>
              </select>


              <label>
                Productivity Goal
              </label>

              <select
                value={productivityGoal}
                onChange={(e) =>
                  setProductivityGoal(e.target.value)
                }
              >
                <option>Study</option>
                <option>Work</option>
                <option>Exercise</option>
                <option>Personal Growth</option>
                <option>General Productivity</option>
              </select>


              <label>
                Challenge Difficulty Preference
              </label>

              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value)
                }
              >
                <option>Beginner</option>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
                <option>Expert</option>
              </select>


              <label>
                Habit Preference
              </label>

              <select
                value={habitPreference}
                onChange={(e) =>
                  setHabitPreference(e.target.value)
                }
              >
                <option>Daily</option>
                <option>Weekdays</option>
                <option>Weekends</option>
              </select>


              <button
                type="submit"
                className="save-alarm-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "🌱 Save Habit"}
              </button>


              {saved && (
                <div className="success-message">
                  ✓ Habit saved successfully!
                </div>
              )}


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


          {/* PREVIEW */}

          <div className="alarm-preview">

            <div className="preview-icon">
              🌱
            </div>

            <p className="preview-label">
              YOUR ROUTINE
            </p>

            <h2>
              {wakeUpTime}
            </h2>

            <p>
              Wake-up time
            </p>

            <div className="preview-divider"></div>

            <p className="preview-label">
              PRODUCTIVITY GOAL
            </p>

            <h3>
              🎯 {productivityGoal}
            </h3>

            <p>
              Sleep: {sleepDuration}
            </p>

            <p>
              Difficulty: {difficulty}
            </p>

            <div className="preview-divider"></div>

            <p className="preview-label">
              HABIT SCORE
            </p>

            <h2>
              {score}%
            </h2>

          </div>

        </div>


        {/* HABIT TRACKING */}

        <div className="section-title">

          <h2>
            Habit Tracking
          </h2>

        </div>


        <div className="active-alarm-card">

          <div className="active-alarm-icon">
            🌱
          </div>

          <div className="active-alarm-info">

            <h3>
              Wake-up Consistency
            </h3>

            <p>
              Build a consistent morning routine.
            </p>

            {habitScore && (
              <small>
                Current habit score:{" "}
                {habitScore.habit_score}%
              </small>
            )}

          </div>

          <div className="active-status">
            ● Tracking
          </div>

        </div>


        {/* SCORE COMPONENTS */}

        {habitScore?.components && (

          <>

            <div className="section-title">

              <h2>
                📊 Habit Score Components
              </h2>

            </div>

            <div className="stats-grid">

              <div className="stat-card">

                <div className="stat-icon">
                  ⏰
                </div>

                <p>
                  Wake-up Consistency
                </p>

                <h2>
                  {habitScore.components.wake_up_consistency}%
                </h2>

              </div>


              <div className="stat-card">

                <div className="stat-icon">
                  🧠
                </div>

                <p>
                  Challenge Completion
                </p>

                <h2>
                  {habitScore.components.challenge_completion}%
                </h2>

              </div>


              <div className="stat-card">

                <div className="stat-icon">
                  🔕
                </div>

                <p>
                  Snooze Reduction
                </p>

                <h2>
                  {habitScore.components.snooze_reduction}%
                </h2>

              </div>


              <div className="stat-card">

                <div className="stat-icon">
                  😴
                </div>

                <p>
                  Sleep Schedule
                </p>

                <h2>
                  {habitScore.components.sleep_schedule_adherence}%
                </h2>

              </div>

            </div>

          </>

        )}

      </main>

    </div>
  );
}

export default Habits;

