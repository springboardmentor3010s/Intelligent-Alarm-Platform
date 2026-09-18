// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';

/**
 * Thin, calm progress bar driven by real data. `tone` maps to the semantic
 * accent (brand/success/warm/danger). Exposes the proper progressbar role.
 */
export default function ProgressBar({ value = 0, max = 100, tone = 'brand', label }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div className={`progress__fill progress__fill--${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}