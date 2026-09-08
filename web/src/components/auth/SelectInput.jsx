import React from 'react';
import FormField from './FormField';

/**
 * Native select visually matched to text inputs (same height/border/radius/
 * focus) via the `.form-control--select` modifier.
 */
export default function SelectInput({ id, label, error, className = '', children, ...props }) {
  return (
    <FormField id={id} label={label} error={error}>
      <select
        id={id}
        className={`form-control form-control--select ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      >
        {children}
      </select>
    </FormField>
  );
}