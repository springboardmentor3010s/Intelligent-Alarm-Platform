// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';

/**
 * Intentional empty state: icon, short title, one-sentence explanation and an
 * optional action. Used whenever a page has genuinely no data to show.
 */
export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="state-card state-card--empty">
      {icon && <div className="state-icon">{icon}</div>}
      <h3 className="state-title">{title}</h3>
      {description && <p className="state-desc">{description}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}