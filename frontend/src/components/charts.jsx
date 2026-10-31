// Shared Recharts building blocks used by the Coach and Admin dashboards.
// Keeps chart styling consistent and avoids repeating the Recharts boilerplate
// on every card.

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export const CHART_COLORS = [
  "#6366f1",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#22c55e",
  "#eab308",
  "#3b82f6",
];

// Labels for the recommendation/guidance categories returned by the backend.
export const CATEGORY_LABEL = {
  sleep: "Sleep",
  wake_up: "Wake-up",
  habit: "Habit",
  productivity: "Productivity",
  general: "General",
};

// Coerce a value to a finite number, or null when it is not usable.
export function numeric(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function ChartCard({ title, description, children }) {
  return (
    <section className="alarms-card wellness-chart-card">
      <div className="card-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function NoChartData({
  message = "Not enough recorded data to display this chart.",
}) {
  return (
    <div
      style={{
        minHeight: 190,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: 24,
        color: "var(--muted, #64748b)",
      }}
    >
      {message}
    </div>
  );
}

// A pie / donut chart. `data` is [{ name, value }].
export function PieBlock({
  data,
  dataKey = "value",
  nameKey = "name",
  height = 280,
  colors = CHART_COLORS,
  colorFor,
  donut = false,
}) {
  if (!data || data.length === 0) {
    return <NoChartData />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          cx="50%"
          cy="45%"
          innerRadius={donut ? 48 : 0}
          outerRadius={85}
          label={({ name, value }) => `${name}: ${value}`}
        >
          {data.map((entry, index) => (
            <Cell
              key={`${entry[nameKey]}-${index}`}
              fill={
                colorFor
                  ? colorFor(entry, index)
                  : colors[index % colors.length]
              }
            />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

// A (optionally grouped / stacked) bar chart.
// `bars` is [{ key, name, color, stackId? }].
export function BarBlock({
  data,
  bars,
  xKey = "name",
  height = 280,
  yUnit,
  yDomain,
  angle = -30,
  tooltipFormatter,
}) {
  if (!data || data.length === 0) {
    return <NoChartData />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 12, right: 12, left: 0, bottom: angle ? 55 : 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey={xKey}
          angle={angle}
          textAnchor={angle ? "end" : "middle"}
          interval={0}
          height={angle ? 75 : 30}
          tick={{ fontSize: 11 }}
        />
        <YAxis domain={yDomain} unit={yUnit} />
        <Tooltip formatter={tooltipFormatter} />
        {bars.length > 1 && <Legend />}
        {bars.map((bar) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name}
            fill={bar.color}
            stackId={bar.stackId}
            radius={bar.stackId ? undefined : [5, 5, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// A line chart for time series. `lines` is [{ key, name, color }].
export function LineBlock({
  data,
  lines,
  xKey = "date",
  height = 280,
  yUnit,
  yDomain,
  tooltipFormatter,
}) {
  if (!data || data.length === 0) {
    return <NoChartData />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis domain={yDomain} unit={yUnit} />
        <Tooltip formatter={tooltipFormatter} />
        {lines.length > 1 && <Legend />}
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
