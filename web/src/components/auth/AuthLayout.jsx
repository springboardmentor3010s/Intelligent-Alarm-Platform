import React from 'react';
import ThemeToggle from './ThemeToggle';

/**
 * Split-screen authentication layout:
 *   left  -> hero (branding, headline, description, benefits)
 *   right -> focused authentication workspace
 * Theme toggle floats top-right.
 */
export default function AuthLayout({ hero, form }) {
  return (
    <div className="auth-shell">
      <ThemeToggle />
      <section className="auth-hero">{hero}</section>
      <section className="auth-panel">{form}</section>
    </div>
  );
}