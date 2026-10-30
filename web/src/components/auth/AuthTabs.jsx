// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';

const TABS = ['login', 'register'];
const LABELS = { login: 'Login', register: 'Register' };

/**
 * Login / Register segmented control.
 *
 * WAI-ARIA tabs pattern: roving tabindex (active tab is keyboard-focusable),
 * arrow-left/right to switch, and ids tied to the form's tabpanel role.
 * Click behavior + visual active state preserved.
 */
export default function AuthTabs({ mode, onChange }) {
  const onKeyDown = e => {
    const idx = TABS.indexOf(mode);
    let next = null;
    if (e.key === 'ArrowRight') next = TABS[(idx + 1) % TABS.length];
    else if (e.key === 'ArrowLeft') next = TABS[(idx - 1 + TABS.length) % TABS.length];
    if (!next) return;
    e.preventDefault();
    const btn = e.currentTarget.closest('[role="tablist"]')?.querySelector(
      `[data-auth-tab="${next}"]`
    );
    onChange(next);
    btn?.focus();
  };

  return (
    <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
      {TABS.map(tab => (
        <button
          key={tab}
          type="button"
          role="tab"
          id={`auth-tab-${tab}`}
          data-auth-tab={tab}
          aria-selected={mode === tab}
          aria-controls="auth-tabpanel"
          tabIndex={mode === tab ? 0 : -1}
          className={`auth-tab ${mode === tab ? 'is-active' : ''}`}
          onClick={() => onChange(tab)}
          onKeyDown={onKeyDown}
        >
          {LABELS[tab]}
        </button>
      ))}
    </div>
  );
}