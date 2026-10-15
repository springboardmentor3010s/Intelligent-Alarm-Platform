import React from "react";

export default function ExecutiveSummaryCard({ analytics }) {
  if (!analytics) return null;

  const snooze = analytics.snooze_analytics;

  const summaryItems = [
    { label: "Total Alarms Created", value: analytics.total_alarms, icon: "⏰" },
    { label: "Currently Active Alarms", value: analytics.active_alarms, icon: "🔔" },
    { label: "Total Alarm Sessions", value: analytics.total_sessions, icon: "📊" },
    { label: "Completed Sessions", value: analytics.completed_sessions, icon: "✅" },
    { label: "Correct Challenge Answers", value: analytics.correct_answers, icon: "🎯" },
    { label: "Incorrect Challenge Answers", value: analytics.wrong_answers, icon: "❌" },
    {
      label: "Average Response Time",
      value: analytics.average_response_time != null ? `${analytics.average_response_time.toFixed(1)} s` : "N/A",
      icon: "⚡",
    },
    {
      label: "Total Snoozes Used",
      value: snooze?.total_snoozes != null ? snooze.total_snoozes : 0,
      icon: "💤",
    },
  ];

  return (
    <section className="exec-summary-container">
      <div className="section-heading-row">
        <div>
          <span className="section-eyebrow">AUDIT &amp; ACTIVITY</span>
          <h2 className="section-main-title">Executive Performance Summary</h2>
          <p className="section-desc">
            Direct measurable metrics from verified alarm triggers and cognitive challenge completions.
          </p>
        </div>
      </div>

      <div className="summary-metrics-grid">
        {summaryItems.map((item, idx) => (
          <div key={idx} className="summary-item-card">
            <span className="summary-item-icon">{item.icon}</span>
            <div className="summary-item-content">
              <span className="summary-item-label">{item.label}</span>
              <strong className="summary-item-val">{item.value}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
