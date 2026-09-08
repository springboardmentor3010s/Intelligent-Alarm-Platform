import React, { useState } from 'react';
import FormField from './FormField';
import { EyeIcon, EyeOffIcon } from './icons';

/**
 * Password input with a keyboard-accessible visibility toggle. Preserves the
 * `type` swap only for display; validation & form behavior are unchanged.
 */
export default function PasswordInput({ id, label, error, className = '', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField id={id} label={label} error={error}>
      <div className="password-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={`form-control ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
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