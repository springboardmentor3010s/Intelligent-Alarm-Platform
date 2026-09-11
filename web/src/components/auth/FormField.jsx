import React from 'react';
import { AlertIcon } from './icons';

/**
 * Form field wrapper: label (associated via htmlFor), control, an optional
 * helper hint, and an inline error message programmatically linked with
 * aria-describedby.
 */
export default function FormField({ id, label, error, hint, children }) {
  return (
    <div className={`form-field ${error ? 'form-field--error' : ''}`}>
      {label && (
        <label className="auth-label" htmlFor={id}>{label}</label>
      )}
      {children}
      {!error && hint && (
        <div className="form-field__hint" id={`${id}-hint`}>{hint}</div>
      )}
      {error && (
        <div className="form-field__error" id={`${id}-error`} role="alert">
          <AlertIcon />
          {error}
        </div>
      )}
    </div>
  );
}