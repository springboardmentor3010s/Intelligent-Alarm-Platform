import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

function CustomSnoozeTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="custom-chart-tooltip">
        <div className="tooltip-title">{data.date}</div>
        <div className="tooltip-item">
          <span>Snoozes Used:</span> <strong>{data.snooze_count}</strong>
        </div>
        <div className="tooltip-item">
          <span>Sessions:</span> <strong>{data.sessions_count}</strong>
        </div>
      </div>
    );
  }
  return null;
}

export default function SnoozeAnalyticsCard({ analytics }) {
  const snooze = analytics?.snooze_analytics;

  if (!snooze) return null;

  const history = snooze.snooze_history || [];

  return (
    <section className="analytics-card snooze-analytics-container">
      <div className="section-heading-row">
        <div>
          <span className="section-eyebrow">SNOOZE BEHAVIOR</span>
          <h2 className="section-main-title">Snooze Behavior &amp; Resistance</h2>
          <p className="section-desc">
            Analyze sleep inertia dependencies, snooze frequency, and clean waking rates.
          </p>
        </div>
      </div>

      {/* Snooze 4-card metric grid */}
      <div className="snooze-metrics-grid">
        <div className="snooze-metric-box">
          <span className="snooze-box-label">Total Snoozes Used</span>
          <strong className="snooze-box-val">{snooze.total_snoozes}</strong>
          <span className="snooze-box-sub">Across all evaluated alarms</span>
        </div>

        <div className="snooze-metric-box">
          <span className="snooze-box-label">Average Snoozes / Session</span>
          <strong className="snooze-box-val">{snooze.average_snooze_count.toFixed(2)}</strong>
          <span className="snooze-box-sub">Lower is better</span>
        </div>

        <div className="snooze-metric-box">
          <span className="snooze-box-label">Sessions With Snooze</span>
          <strong className="snooze-box-val" style={{ color: "#f59e0b" }}>
            {snooze.sessions_with_snooze}
          </strong>
          <span className="snooze-box-sub">{snooze.snooze_rate.toFixed(1)}% Snooze Rate</span>
        </div>

        <div className="snooze-metric-box">
          <span className="snooze-box-label">Clean Wakes (No Snooze)</span>
          <strong className="snooze-box-val" style={{ color: "#10b981" }}>
            {snooze.sessions_without_snooze}
          </strong>
          <span className="snooze-box-sub">
            {analytics.total_sessions
              ? Math.round((snooze.sessions_without_snooze / analytics.total_sessions) * 100)
              : 0}
            % of Sessions
          </span>
        </div>
      </div>

      {/* Snooze Trend over time */}
      {history.length > 0 && (
        <div className="snooze-chart-wrapper">
          <h3 className="chart-panel-title">Snoozes Over Time</h3>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history} margin={{ top: 10, right: 15, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, rgba(255,255,255,0.08))" />
                <XAxis
                  dataKey="date"
                  stroke="var(--chart-axis, #8fa0b5)"
                  tickFormatter={(val) => (val ? val.slice(5) : "")}
                  tick={{ fontSize: 11, fill: "var(--chart-text, #8fa0b5)" }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--chart-axis, #8fa0b5)"
                  tick={{ fontSize: 11, fill: "var(--chart-text, #8fa0b5)" }}
                />
                <Tooltip content={<CustomSnoozeTooltip />} />
                <Bar
                  dataKey="snooze_count"
                  name="Snoozes"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
