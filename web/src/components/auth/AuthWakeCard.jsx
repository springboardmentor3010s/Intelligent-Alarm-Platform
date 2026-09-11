import React from 'react';

const STEPS = [
  { key: 'armed', label: 'ARM', state: 'is-done' },
  { key: 'ring', label: 'RING', state: 'is-next' },
  { key: 'solve', label: 'SOLVE', state: '' },
  { key: 'score', label: 'SCORE', state: '' },
];

const DOT_CLASS = {
  done: 'auth-wake__dot auth-wake__dot--on',
  next: 'auth-wake__dot auth-wake__dot--next',
  idle: 'auth-wake__dot',
};

/**
 * Decorative "Next Wake Window" widget for the auth brand panel: a static
 * product mock that matches the flat retro look of the mobile "Home" tab
 * (alarm time, ARMED status and the ARM->RING->SOLVE->SCORE protocol).
 * Purely illustrative (aria-hidden).
 */
export default function AuthWakeCard() {
  return (
    <div className="auth-wake" aria-hidden="true">
      <div className="auth-wake__head">
        <span className="sys-label sys-label--violet">Next wake window</span>
        <span className="auth-wake__status">
          <i className="auth-wake__dot auth-wake__dot--on" /> ARMED
        </span>
      </div>

      <div className="auth-wake__time">
        <strong className="tabular">07</strong>
        <span className="auth-wake__colon">:</span>
        <strong className="tabular">05</strong>
        <span className="auth-wake__tz">IST</span>
      </div>

      <ol className="auth-wake__steps">
        {STEPS.map(step => (
          <li key={step.key} className={step.state}>
            <i className={DOT_CLASS[step.state || 'idle']} />
            {step.label}
          </li>
        ))}
      </ol>

      <div className="auth-wake__foot">
        <span>Mach 1 · protocol</span>
        <span className="auth-wake__chal">Logic · 4 steps</span>
      </div>
    </div>
  );
}