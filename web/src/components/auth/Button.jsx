import React from 'react';

/**
 * Primary (brand gradient) and secondary (surface) auth buttons.
 * `loading` renders a spinner and forces the disabled state to prevent
 * duplicate submissions.
 */
export default function Button({ variant = 'primary', loading = false, className = '', children, ...props }) {
  const cls = variant === 'secondary' ? 'btn btn-secondary' : 'btn btn-primary';
  return (
    <button
      type={props.type || 'submit'}
      className={`${cls} ${className}`}
      disabled={loading || props.disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}