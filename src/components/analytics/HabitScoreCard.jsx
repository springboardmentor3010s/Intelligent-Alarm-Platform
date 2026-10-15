import { useEffect, useState } from "react";
import { getHabitScore } from "../../services/api";

export default function HabitScoreCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    getHabitScore()
      .then((result) => {
        if (isMounted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load habit score:", err);
          setError(err.message || "Failed to load habit score");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleRetry() {
    setLoading(true);
    setError("");
    try {
      const result = await getHabitScore();
      setData(result);
    } catch (err) {
      console.error("Failed to reload habit score:", err);
      setError(err.message || "Failed to load habit score");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="analytics-section m3-section">
        <div className="section-heading">
          <span className="m3-tag">INTELLIGENCE ENGINE</span>
          <h2>Habit Score</h2>
        </div>
        <div className="m3-loading-card">
          <div className="m3-spinner">⏳</div>
          <p>Calculating behavioral habit score...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="analytics-section m3-section">
        <div className="section-heading">
          <span className="m3-tag">INTELLIGENCE ENGINE</span>
          <h2>Habit Score</h2>
        </div>
        <div className="m3-error-card">
          <p className="m3-error-text">⚠️ {error}</p>
          <button className="m3-retry-btn" onClick={handleRetry}>
            Retry Habit Score
          </button>
        </div>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  const overall = Number(data.overall_habit_score || 0).toFixed(1);
  const consistency = Number(data.wake_up_consistency || 0).toFixed(1);
  const challengeComp = Number(data.challenge_completion || 0).toFixed(1);
  const snoozeRed = Number(data.snooze_reduction || 0).toFixed(1);
  const sleepAdh = Number(data.sleep_schedule_adherence || 0).toFixed(1);
  const totalSessions = data.total_sessions ?? 0;
  const avgSnooze = Number(data.avg_snooze_count || 0).toFixed(2);

  // Determine score color grade
  const scoreNumber = parseFloat(overall);
  let gradeClass = "grade-average";
  let gradeLabel = "Building Habit";
  if (scoreNumber >= 80) {
    gradeClass = "grade-excellent";
    gradeLabel = "Optimal Mastery";
  } else if (scoreNumber >= 65) {
    gradeClass = "grade-good";
    gradeLabel = "Good Progress";
  } else if (scoreNumber < 50) {
    gradeClass = "grade-needs-work";
    gradeLabel = "Needs Consistency";
  }

  return (
    <section className="analytics-section m3-section">
      <div className="section-heading">
        <span className="m3-tag">INTELLIGENCE</span>
        <h2>Behavioral Habit Score</h2>
      </div>

      <div className="habit-score-container">
        {/* Main Score Hero Card */}
        <div className={`habit-hero-card ${gradeClass}`}>
          <div className="habit-hero-top">
            <span className="habit-hero-label">OVERALL HABIT SCORE</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {data.prediction_source === "ml_model" ? (
                <span
                  style={{
                    fontSize: "0.72rem",
                    background: "rgba(14, 165, 233, 0.15)",
                    color: "#38bdf8",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    border: "1px solid rgba(14, 165, 233, 0.3)",
                    fontWeight: 600,
                  }}
                >
                  🤖 ML Primary Model
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "0.72rem",
                    background: "rgba(148, 163, 184, 0.15)",
                    color: "#94a3b8",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    fontWeight: 600,
                  }}
                >
                  📋 Rule-Based Fallback
                </span>
              )}
              <span className="habit-grade-pill">{gradeLabel}</span>
            </div>
          </div>

          <div className="habit-hero-value">
            <strong>{overall}</strong>
            <span>/ 100</span>
          </div>

          <div className="habit-hero-progress-track">
            <div
              className="habit-hero-progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, scoreNumber))}%` }}
            />
          </div>

          <div className="habit-hero-meta">
            <span>
              Sessions Evaluated: <strong>{totalSessions}</strong>
            </span>
            <span>
              Avg Snooze Count: <strong>{avgSnooze}</strong>
            </span>
            {data.ml_behavioral_score != null && (
              <span>
                ML Behavioral Score: <strong>{Number(data.ml_behavioral_score).toFixed(1)}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Breakdown Component Cards */}
        <div className="habit-breakdown-grid">
          {/* 1. Wake-Up Consistency (35%) */}
          <div className="habit-component-card">
            <div className="component-header">
              <div>
                <span className="component-weight">35% WEIGHT</span>
                <h3>Wake-Up Consistency</h3>
              </div>
              <strong className="component-value">{consistency}%</strong>
            </div>
            <div className="component-bar-track">
              <div
                className="component-bar-fill fill-blue"
                style={{ width: `${consistency}%` }}
              />
            </div>
            <p className="component-description">
              Variance in actual wake-up times relative to your target schedule.
            </p>
          </div>

          {/* 2. Challenge Completion (25%) */}
          <div className="habit-component-card">
            <div className="component-header">
              <div>
                <span className="component-weight">25% WEIGHT</span>
                <h3>Challenge Completion</h3>
              </div>
              <strong className="component-value">{challengeComp}%</strong>
            </div>
            <div className="component-bar-track">
              <div
                className="component-bar-fill fill-green"
                style={{ width: `${challengeComp}%` }}
              />
            </div>
            <p className="component-description">
              Percentage of triggered cognitive challenges solved correctly.
            </p>
          </div>

          {/* 3. Snooze Reduction (20%) */}
          <div className="habit-component-card">
            <div className="component-header">
              <div>
                <span className="component-weight">20% WEIGHT</span>
                <h3>Snooze Reduction</h3>
              </div>
              <strong className="component-value">{snoozeRed}%</strong>
            </div>
            <div className="component-bar-track">
              <div
                className="component-bar-fill fill-purple"
                style={{ width: `${snoozeRed}%` }}
              />
            </div>
            <p className="component-description">
              Waking immediately without relying on repeated snoozes.
            </p>
          </div>

          {/* 4. Sleep Schedule Adherence (20%) */}
          <div className="habit-component-card">
            <div className="component-header">
              <div>
                <span className="component-weight">20% WEIGHT</span>
                <h3>Sleep Schedule Adherence</h3>
              </div>
              <strong className="component-value">{sleepAdh}%</strong>
            </div>
            <div className="component-bar-track">
              <div
                className="component-bar-fill fill-amber"
                style={{ width: `${sleepAdh}%` }}
              />
            </div>
            <p className="component-description">
              Alignment between active alarms and profile sleep window preferences.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
