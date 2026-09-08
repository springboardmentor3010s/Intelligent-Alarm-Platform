import React from 'react';

/**
 * Login / Register segmented control. Preserves existing mode state; only
 * presentational + ARIA wiring.
 */
export default function AuthTabs({ mode, onChange }) {
  return (
    <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'login'}
        className="auth-tab"
        onClick={() => onChange('login')}
      >
        Login
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'register'}
        className="auth-tab"
        onClick={() => onChange('register')}
      >
        Register
      </button>
    </div>
  );
}