import React from "react";

export default function ExecutiveKPICards({ analytics }) {
  if (!analytics) return null;

  const habit = analytics.habit_score;
  const snooze = analytics.snooze_analytics;
  const sleep = analytics.sleep_adherence;

  function getHabitGrade(score) {
    if (score >= 80) return { label: "Excellent", cls: "grade-pill-excellent" };
    if (score >= 65) return { label: "Good", cls: "grade-pill-good" };
    if (score >= 50) return { label: "Fair", cls: "grade-pill-fair" };
    return { label: "Needs Work", cls: "grade-pill-poor" };
  }

  const habitGrade = habit?.overall_habit_score != null ? getHabitGrade(habit.overall_habit_score) : null;

  const kpis = [
    {
      id: "habit-score",
      icon: "🏆",
      title: "Habit Score",
      value: habit?.overall_habit_score != null ? `${habit.overall_habit_score.toFixed(1)}` : "N/A",
      denom: habit?.overall_habit_score != null ? "/ 100" : "",
      sub: habitGrade ? (
        <span className={`kpi-status-badge ${habitGrade.cls}`}>{habitGrade.label}</span>
      ) : "No session data",
      accent: "kpi-accent-cyan",
    },
    {
      id: "wake-consistency",
      icon: "⏰",
      title: "Wake-Up Consistency",
      value: habit?.wake_up_consistency != null ? `${habit.wake_up_consistency.toFixed(1)}%` : "N/A",
      sub: "35% Habit Weight",
      accent: "kpi-accent-blue",
    },
    {
      id: "challenge-accuracy",
      icon: "🎯",
      title: "Challenge Accuracy",
      value: analytics.accuracy != null ? `${analytics.accuracy.toFixed(1)}%` : "N/A",
      sub: `${analytics.correct_answers || 0} Correct of ${analytics.total_sessions || 0}`,
      accent: "kpi-accent-emerald",
    },
    {
      id: "challenge-completion",
      icon: "🏁",
      title: "Challenge Completion",
      value: analytics.progress != null ? `${analytics.progress.toFixed(1)}%` : "N/A",
      sub: `${analytics.completed_sessions || 0} Completed Sessions`,
      accent: "kpi-accent-purple",
    },
    {
      id: "snooze-behavior",
      icon: "💤",
      title: "Snooze Behavior",
      value: snooze?.snooze_rate != null ? `${snooze.snooze_rate.toFixed(1)}%` : "N/A",
      sub: `Snooze Rate (${snooze?.total_snoozes || 0} total snoozes)`,
      accent: "kpi-accent-amber",
    },
    {
      id: "sleep-adherence",
      icon: "🌙",
      title: "Sleep Adherence",
      value: sleep?.is_configured && sleep?.sleep_schedule_adherence != null
        ? `${sleep.sleep_schedule_adherence.toFixed(1)}%`
        : (sleep?.sleep_schedule_adherence != null ? `${sleep.sleep_schedule_adherence.toFixed(1)}%` : "N/A"),
      sub: sleep?.is_configured ? `Target: ${sleep.preferred_wake_time}` : "Profile wake time unconfigured",
      accent: "kpi-accent-indigo",
    },
    {
      id: "total-sessions",
      icon: "📋",
      title: "Total Sessions",
      value: analytics.total_sessions != null ? `${analytics.total_sessions}` : "0",
      sub: `Avg Response: ${analytics.average_response_time != null ? analytics.average_response_time.toFixed(1) + "s" : "—"}`,
      accent: "kpi-accent-slate",
    },
    {
      id: "successful-dismissals",
      icon: "✅",
      title: "Successful Dismissals",
      value: analytics.successful_dismissals != null ? `${analytics.successful_dismissals}` : "0",
      sub: `${analytics.total_sessions ? Math.round((analytics.successful_dismissals / analytics.total_sessions) * 100) : 0}% Dismissal Rate`,
      accent: "kpi-accent-green",
    },
  ];

  return (
    <section className="executive-kpi-section" aria-label="Executive Performance Indicators">
      <div className="section-heading-row">
        <div>
          <span className="section-eyebrow">EXECUTIVE METRICS</span>
          <h2 className="section-main-title">Key Performance Indicators</h2>
        </div>
      </div>

      <div className="executive-kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.id} className={`kpi-card ${kpi.accent}`}>
            <div className="kpi-card-header">
              <span className="kpi-card-icon">{kpi.icon}</span>
              <span className="kpi-card-title">{kpi.title}</span>
            </div>
            <div className="kpi-card-body">
              <div className="kpi-value-row">
                <span className="kpi-card-value">{kpi.value}</span>
                {kpi.denom && <span className="kpi-card-denom">{kpi.denom}</span>}
              </div>
              <div className="kpi-card-sub">{kpi.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
