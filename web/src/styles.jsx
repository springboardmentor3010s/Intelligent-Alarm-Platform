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
 * Metric value card - shows a label with a prominent gradient value
 */
export function MetricCard({ label, value, suffix = '', className = '', children }) {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="card-label">{label}</div>
      <div className="card-value">
        {value}
        {suffix && <span style={{ fontSize: '1rem', marginLeft: '0.2rem' }}>{suffix}</span>}
      </div>
      {children && <div className="mt-2 text-sm text-muted-600">{children}</div>}
    </Card>
  );
}

export default { Card, Grid, MetricCard };
