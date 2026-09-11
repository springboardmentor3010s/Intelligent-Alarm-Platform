import React from 'react';

/**
 * Card component - a styled wrapper div using the design system
 */
export function Card({ className = '', children, ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

/**
 * Grid component - responsive card grid
 */
export function Grid({ className = '', children, ...props }) {
  return (
    <div className={`grid-cards ${className}`} {...props}>
      {children}
    </div>
  );
}

/**
 * Metric value card - shows a label with a prominent tabular value, optional icon and trend
 */
export function MetricCard({ label, value, suffix = '', trend = null, icon = null, className = '', children }) {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="metric-card__head">
        <div className="card-label">{label}</div>
        {icon && <span className="metric-card__icon">{icon}</span>}
      </div>
      <div className="card-value">
        {value}
        {suffix && <span className="metric-denom">{suffix}</span>}
      </div>
      {trend && (
        <div className={`metric-trend metric-trend--${trend.direction || 'neutral'}`}>
          <span>{trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}</span>
          <span>{trend.label}</span>
        </div>
      )}
      {children && <div className="mt-2 text-sm text-muted-600">{children}</div>}
    </Card>
  );
}

export default { Card, Grid, MetricCard };
