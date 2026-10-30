// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';

/**
 * Standardized SectionHeader primitive used across all screens.
 * Ensures consistent typography hierarchy:
 * - Page Title (H1, 1.875rem, font-weight 800, tracking -0.025em)
 * - Page Subtitle / Status (0.95rem, text-muted)
 * - Action slot (buttons, filters)
 */
export default function SectionHeader({
  title,
  subtitle,
  children,
  badge,
  className = '',
}) {
  return (
    <div className={`page-header ${className}`}>
      <div className="page-header__meta">
        <div className="page-header__title-row">
          <h1>{title}</h1>
          {badge && <span className="page-header__badge">{badge}</span>}
        </div>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
      {children && <div className="page-header__actions">{children}</div>}
    </div>
  );
}
