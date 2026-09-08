import React from 'react';
import { AlertCircleIcon } from './Icons';

/**
 * Reusable error state with an optional "Try Again" action. Never exposes
 * raw technical messages — `detail` is meant to be human-friendly only.
 */
export default function ErrorState({
  title = 'Something went wrong',
  description = 'Unable to load this information.',
  onRetry,
  action,
}) {
  return (
    <div className="state-card state-card--error">
      <div className="state-icon">
        <AlertCircleIcon />
      </div>
      <h3 className="state-title">{title}</h3>
      {description && <p className="state-desc">{description}</p>}
      {(onRetry || action) && (
        <div className="state-action">
          {action}
          {onRetry && (
            <button type="button" className="btn btn-ghost" onClick={onRetry}>
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}