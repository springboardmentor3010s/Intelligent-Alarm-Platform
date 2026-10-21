import { COLORS } from "./chartTokens";

/* ---------- Page Shell with Standard SaaS Header ---------- */
export function PageShell({ eyebrow, title, subtitle, onBack, backLabel = "← Dashboard", action, children }) {
  return (
    <div className="saas-container" style={{ paddingBottom: 48 }}>
      <div className="saas-page-header">
        <div>
          {eyebrow && <div className="saas-eyebrow">{eyebrow}</div>}
          <h1 className="saas-title">{title}</h1>
          {subtitle && <p className="saas-subtitle">{subtitle}</p>}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {action}
          {onBack && (
            <button onClick={onBack} className="btn btn-secondary btn-sm">
              {backLabel}
            </button>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}

/* ---------- Reusable SaaS Card ---------- */
export function Card({ title, subtitle, badge, action, children, wide, style, className = "" }) {
  return (
    <div
      className={`saas-card ${className}`}
      style={{
        gridColumn: wide ? "1 / -1" : "auto",
        ...style,
      }}
    >
      {(title || subtitle || badge || action) && (
        <div className="saas-card-header">
          <div>
            {title && <h2 className="saas-card-title">{title}</h2>}
            {subtitle && <p className="saas-card-desc">{subtitle}</p>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {badge && <span className="badge badge-primary">{badge}</span>}
            {action}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------- Clean SaaS Stat Card ---------- */
export function StatCard({ icon, label, value, accent = COLORS.primary, trend, subtitle }) {
  return (
    <div className="saas-stat-card">
      <div
        className="saas-stat-icon-wrap"
        style={{
          background: `${accent}16`,
          borderColor: `${accent}30`,
          color: accent,
        }}
      >
        {icon}
      </div>

      <div className="saas-stat-info">
        <span className="saas-stat-label">{label}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="saas-stat-value">{value}</span>
          {trend && (
            <span style={{ fontSize: 12, color: COLORS.emerald, fontWeight: 600 }}>
              {trend}
            </span>
          )}
        </div>
        {subtitle && (
          <span style={{ fontSize: 11, color: "#64748b", marginTop: 2, display: "block" }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Progress Metric Row ---------- */
export function MetricRow({ label, value, color = COLORS.primary }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 500 }}>{label}</span>
        <strong style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{pct}%</strong>
      </div>
      <div
        style={{
          height: 7,
          borderRadius: 8,
          background: "rgba(255, 255, 255, 0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 8,
            background: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

/* ---------- Modern Empty State Component ---------- */
export function EmptyState({ icon = "📊", title = "No data yet", description = "Activity will appear here once recorded.", action }) {
  return (
    <div className="saas-empty-state">
      <div className="saas-empty-icon">{icon}</div>
      <div className="saas-empty-title">{title}</div>
      <p className="saas-empty-desc">{description}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
