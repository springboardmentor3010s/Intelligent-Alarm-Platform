import React from 'react';
import { AlertIcon } from './icons';

/**
 * Form field wrapper: label (associated via htmlFor), control, and an inline
 * error message programmatically linked with aria-describedby.
 */
export default function FormField({ id, label, error, children }) {
  return (
    <div className={`form-field ${error ? 'form-field--error' : ''}`}>
      {label && (
        <label className="auth-label" htmlFor={id}>{label}</label>
      )}
      {children}
      {error && (
        <div className="form-field__error" id={`${id}-error`} role="alert">
          <AlertIcon />
          {error}
        </div>
      )}
    </div>
  );
}