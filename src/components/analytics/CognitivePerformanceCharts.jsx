import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const TYPE_COLORS = {
  Math: "#0284c7",
  Logic: "#8b5cf6",
  Memory: "#ec4899",
  Word: "#10b981",
  Pattern: "#f59e0b",
  Riddle: "#06b6d4",
  Quiz: "#6366f1",
};

const DIFF_COLORS = {
  Beginner: "#64748b",
  Easy: "#10b981",
  Medium: "#f59e0b",
  Hard: "#ef4444",
  Expert: "#8b5cf6",
};

function CustomTypeTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="custom-chart-tooltip">
        <div className="tooltip-title">{data.name}</div>
        <div className="tooltip-item">
          <span>Accuracy:</span> <strong>{data.accuracy}%</strong>
        </div>
        <div className="tooltip-item">
          <span>Total Solved:</span> <strong>{data.total}</strong>
        </div>
        <div className="tooltip-item">
          <span>Correct:</span> <strong style={{ color: "#10b981" }}>{data.correct}</strong>
        </div>
        <div className="tooltip-item">
          <span>Wrong:</span> <strong style={{ color: "#ef4444" }}>{data.wrong}</strong>
        </div>
      </div>
    );
  }
  return null;
}

function CustomDiffTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="custom-chart-tooltip">
        <div className="tooltip-title">{data.name} Difficulty</div>
        <div className="tooltip-item">
          <span>Total:</span> <strong>{data.value} challenges</strong>
        </div>
        <div className="tooltip-item">
          <span>Accuracy:</span> <strong>{data.accuracy}%</strong>
        </div>
      </div>
    );
  }
  return null;
}

export default function CognitivePerformanceCharts({ analytics }) {
  const challengeTypes = analytics?.challenge_performance || [];
  const difficultyLevels = analytics?.difficulty_performance || [];

  const typeChartData = challengeTypes.map((t) => ({
    name: (t.challenge_type || "math").toUpperCase(),
    accuracy: t.accuracy,
    total: t.total,
    correct: t.correct,
    wrong: t.wrong,
    fill: TYPE_COLORS[(t.challenge_type || "").charAt(0).toUpperCase() + (t.challenge_type || "").slice(1)] || "#0284c7",
  }));

  const diffChartData = difficultyLevels.map((d) => ({
    name: d.difficulty,
    value: d.total,
    accuracy: d.accuracy,
    fill: DIFF_COLORS[d.difficulty] || "#0284c7",
  }));

  return (
    <section className="analytics-card cognitive-visual-container">
      <div className="section-heading-row">
        <div>
          <span className="section-eyebrow">COGNITIVE METRICS</span>
          <h2 className="section-main-title">Cognitive Challenge Performance</h2>
          <p className="section-desc">
            Breakdown of challenge accuracy, question counts across cognitive categories, and difficulty distribution.
          </p>
        </div>
      </div>

      <div className="cognitive-charts-grid">
        {/* Chart 1: Challenge Types Bar Chart */}
        <div className="chart-sub-panel">
          <h3 className="chart-panel-title">Accuracy by Challenge Type</h3>
          {typeChartData.length === 0 ? (
            <div className="chart-empty-state-mini">No challenge activity recorded yet.</div>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeChartData} margin={{ top: 10, right: 15, left: -15, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, rgba(255,255,255,0.08))" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--chart-axis, #8fa0b5)"
                    tick={{ fontSize: 11, fill: "var(--chart-text, #8fa0b5)" }}
                  />
                  <YAxis
                    unit="%"
                    domain={[0, 100]}
                    stroke="var(--chart-axis, #8fa0b5)"
                    tick={{ fontSize: 11, fill: "var(--chart-text, #8fa0b5)" }}
                  />
                  <Tooltip content={<CustomTypeTooltip />} />
                  <Bar
                    dataKey="accuracy"
                    name="Accuracy Rate (%)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={36}
                  >
                    {typeChartData.map((entry, index) => (
                      <Cell key={`type-cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: Difficulty Distribution Pie / Donut */}
        <div className="chart-sub-panel">
          <h3 className="chart-panel-title">Difficulty Level Distribution</h3>
          {diffChartData.length === 0 ? (
            <div className="chart-empty-state-mini">No difficulty levels evaluated yet.</div>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={diffChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {diffChartData.map((entry, index) => (
                      <Cell key={`diff-cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomDiffTooltip />} />
                  <Legend
                    formatter={(value) => <span style={{ color: "var(--chart-legend, #cbd5e1)", fontSize: 12 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
