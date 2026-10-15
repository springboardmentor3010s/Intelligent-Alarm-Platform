import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

function CustomWakeUpTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="custom-chart-tooltip">
        <div className="tooltip-title">{data.date}</div>
        <div className="tooltip-item">
          <span>Alarm:</span> <strong>{data.alarm_name || "Morning Alarm"}</strong>
        </div>
        <div className="tooltip-item">
          <span>Scheduled Time:</span> <strong>{data.alarm_time || "—"}</strong>
        </div>
        <div className="tooltip-item">
          <span>Actual Wake:</span> <strong>{data.actual_wake_time || "—"}</strong>
        </div>
        <div className="tooltip-item">
          <span>Response Time:</span> <strong>{data.response_time_seconds} s</strong>
        </div>
        <div className="tooltip-item">
          <span>Status:</span>{" "}
          <strong className={`status-text-${(data.dismissal_status || "").toLowerCase()}`}>
            {(data.dismissal_status || data.session_status || "completed").toUpperCase()}
          </strong>
        </div>
      </div>
    );
  }
  return null;
}

export default function WakeUpPerformanceChart({ analytics }) {
  const history = analytics?.wake_up_history || [];

  if (history.length === 0) {
    return (
      <section className="analytics-card chart-card-container">
        <div className="section-heading-row">
          <div>
            <span className="section-eyebrow">WAKE-UP METRICS</span>
            <h2 className="section-main-title">Wake-Up Performance Trend</h2>
            <p className="section-desc">Track alarm response speeds and wake-up consistency over time.</p>
          </div>
        </div>
        <div className="chart-empty-state">
          <span className="empty-icon">⏰</span>
          <p>No wake-up session history recorded yet for this time window.</p>
        </div>
      </section>
    );
  }

  // Format chart data
  const chartData = history.map((item, idx) => ({
    ...item,
    index: idx + 1,
    formattedLabel: item.date ? item.date.slice(5) : `#${idx + 1}`,
  }));

  return (
    <section className="analytics-card chart-card-container">
      <div className="section-heading-row">
        <div>
          <span className="section-eyebrow">WAKE-UP METRICS</span>
          <h2 className="section-main-title">Wake-Up Performance Trend</h2>
          <p className="section-desc">
            Visual response times and alarm wake consistency over consecutive sessions. Lower response time indicates faster alertness.
          </p>
        </div>
      </div>

      <div className="chart-wrapper-inner" style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 25, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, rgba(255,255,255,0.08))" />
            <XAxis
              dataKey="formattedLabel"
              stroke="var(--chart-axis, #8fa0b5)"
              tick={{ fontSize: 12, fill: "var(--chart-text, #8fa0b5)" }}
            />
            <YAxis
              stroke="var(--chart-axis, #8fa0b5)"
              unit="s"
              tick={{ fontSize: 12, fill: "var(--chart-text, #8fa0b5)" }}
            />
            <Tooltip content={<CustomWakeUpTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => <span style={{ color: "var(--chart-legend, #cbd5e1)", fontSize: 13 }}>{value}</span>}
            />
            <Bar
              dataKey="response_time_seconds"
              name="Response Time (seconds)"
              fill="#0284c7"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
            />
            <Line
              type="monotone"
              dataKey="response_time_seconds"
              name="Response Trend"
              stroke="#38bdf8"
              strokeWidth={3}
              dot={{ r: 4, fill: "#38bdf8" }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
