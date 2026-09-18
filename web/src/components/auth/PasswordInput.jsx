// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useState } from 'react';
import FormField from './FormField';
import { EyeIcon, EyeOffIcon } from './icons';

/**
 * Password input with an accessible visibility toggle anchored inside the
 * field. `hint` renders a helper line under the control (no error present);
 * `error` shows an inline, aria-linked validation message. Validation and
 * form behavior are unchanged.
 */
export default function PasswordInput({ id, label, error, hint, className = '', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      <div className="password-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={`form-control ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...props}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          tabIndex={0}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </FormField>
  );
}