export default function StatCard({
  icon,
  value,
  label,
  trend,
  trendDir,
  progress,
  colorClass = "primary",
  delay = 0,
}) {
  return (
    <div
      className="stat-card"
      style={{ animationDelay: `${delay * 0.06}s` }}
    >
      <div className={`stat-card-icon ${colorClass}`}>
        {icon}
      </div>
      <div className="stat-card-body">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-label">{label}</span>
        {trend && (
          <span className={`stat-card-trend ${trendDir || "up"}`}>
            {trendDir === "down" ? "↓" : "↑"} {trend}
          </span>
        )}
        {progress !== undefined && (
          <div className="stat-progress">
            <div
              className="stat-progress-bar"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
