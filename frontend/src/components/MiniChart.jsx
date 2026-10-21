/* Lightweight SVG-based charts */

export function BarChart({ data, height = 120 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="bar-chart" style={{ height }}>
      {data.map((item, i) => (
        <div className="bar-item" key={i}>
          <div
            className="bar-fill"
            style={{
              height: `${(item.value / max) * 100}%`,
              background: item.color || undefined,
            }}
          />
          <span className="bar-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ value, total, size = 100, strokeWidth = 10, color = "#6366f1" }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className="progress-ring-value">{Math.round(pct)}%</span>
    </div>
  );
}

export function ProgressBar({ value, max = 100, colorClass = "primary" }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="progress-bar-track">
      <div
        className={`progress-bar-fill ${colorClass}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}
