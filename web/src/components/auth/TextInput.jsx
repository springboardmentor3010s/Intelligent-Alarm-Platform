import React from 'react';
import FormField from './FormField';

/**
 * Text-ish input (text/email/etc). Consistent 48px height, focus ring, and
 * inline validation wiring.
 */
export default function TextInput({ id, label, error, className = '', ...props }) {
  return (
    <FormField id={id} label={label} error={error}>
      <input
        id={id}
        className={`form-control ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </FormField>
  );
}