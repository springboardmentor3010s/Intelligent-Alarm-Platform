import React from "react";

export default function HabitScoreVisualizer({ analytics }) {
  const habit = analytics?.habit_score;

  if (!habit) return null;

  const score = habit.overall_habit_score || 0;
  const consistency = habit.wake_up_consistency || 0;
  const challenge = habit.challenge_completion || 0;
  const snooze = habit.snooze_reduction || 0;
  const sleep = habit.sleep_schedule_adherence || 0;

  // Milestone 3 Weighted Formula Contributions:
  // Wake-Up: 35%, Challenge: 25%, Snooze: 20%, Sleep: 20%
  const wakeContribution = (consistency * 0.35).toFixed(1);
  const challengeContribution = (challenge * 0.25).toFixed(1);
  const snoozeContribution = (snooze * 0.20).toFixed(1);
  const sleepContribution = (sleep * 0.20).toFixed(1);

  function getGrade(sc) {
    if (sc >= 80) return { label: "Excellent", tagCls: "grade-tag-excellent" };
    if (sc >= 65) return { label: "Good", tagCls: "grade-tag-good" };
    if (sc >= 50) return { label: "Fair", tagCls: "grade-tag-fair" };
    return { label: "Needs Improvement", tagCls: "grade-tag-poor" };
  }

  const grade = getGrade(score);

  return (
    <section className="analytics-card habit-visual-container">
      <div className="section-heading-row">
        <div>
          <span className="section-eyebrow">INTELLIGENCE FORMULA</span>
          <h2 className="section-main-title">Habit Score Breakdown &amp; Weights</h2>
          <p className="section-desc">
            Official Milestone 3 behavioral score evaluated across 4 deterministic weighted dimensions.
          </p>
        </div>
      </div>

      <div className="habit-visual-hero">
        {/* Circular Gauge Center */}
        <div className="habit-gauge-wrapper">
          <div className="habit-gauge-circle">
            <span className="gauge-number">{score.toFixed(1)}</span>
            <span className="gauge-denom">/ 100</span>
            <span className={`gauge-badge ${grade.tagCls}`}>{grade.label}</span>
          </div>
          <span className="gauge-caption">Evaluated on {habit.total_sessions || 0} sessions</span>
        </div>

        {/* 4 Dimension Contribution Cards */}
        <div className="habit-dimensions-list">
          <div className="dimension-row">
            <div className="dim-info">
              <span className="dim-name">Wake-Up Consistency</span>
              <span className="dim-weight">Weight: 35%</span>
            </div>
            <div className="dim-bar-track">
              <div className="dim-bar-fill fill-blue" style={{ width: `${Math.min(consistency, 100)}%` }} />
            </div>
            <div className="dim-numbers">
              <strong>{consistency.toFixed(1)}%</strong>
              <span className="dim-contrib">+{wakeContribution} pts</span>
            </div>
          </div>

          <div className="dimension-row">
            <div className="dim-info">
              <span className="dim-name">Challenge Completion</span>
              <span className="dim-weight">Weight: 25%</span>
            </div>
            <div className="dim-bar-track">
              <div className="dim-bar-fill fill-purple" style={{ width: `${Math.min(challenge, 100)}%` }} />
            </div>
            <div className="dim-numbers">
              <strong>{challenge.toFixed(1)}%</strong>
              <span className="dim-contrib">+{challengeContribution} pts</span>
            </div>
          </div>

          <div className="dimension-row">
            <div className="dim-info">
              <span className="dim-name">Snooze Reduction</span>
              <span className="dim-weight">Weight: 20%</span>
            </div>
            <div className="dim-bar-track">
              <div className="dim-bar-fill fill-amber" style={{ width: `${Math.min(snooze, 100)}%` }} />
            </div>
            <div className="dim-numbers">
              <strong>{snooze.toFixed(1)} / 100</strong>
              <span className="dim-contrib">+{snoozeContribution} pts</span>
            </div>
          </div>

          <div className="dimension-row">
            <div className="dim-info">
              <span className="dim-name">Sleep Schedule Adherence</span>
              <span className="dim-weight">Weight: 20%</span>
            </div>
            <div className="dim-bar-track">
              <div className="dim-bar-fill fill-emerald" style={{ width: `${Math.min(sleep, 100)}%` }} />
            </div>
            <div className="dim-numbers">
              <strong>{sleep.toFixed(1)}%</strong>
              <span className="dim-contrib">+{sleepContribution} pts</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
