// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useId } from 'react';

/**
 * Accessible switch (role="switch") used in settings rows.
 * `onChange(nextChecked)` is called with the new value.
 */
export default function Toggle({ checked = false, onChange, label, desc, disabled = false }) {
  const id = useId();
  return (
    <div className="settings-row">
      <div className="settings-row__text">
        <label className="settings-row__label" htmlFor={id} id={`${id}-label`}>
          {label}
        </label>
        {desc && <div className="settings-row__desc">{desc}</div>}
      </div>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        className={`toggle ${checked ? 'toggle--on' : ''}`}
        onClick={() => onChange && onChange(!checked)}
        disabled={disabled}
      >
        <span className="toggle__thumb" />
      </button>
    </div>
  );
}