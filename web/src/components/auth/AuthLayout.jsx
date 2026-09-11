import React from 'react';
import ThemeToggle from './ThemeToggle';
import AuthBranding from './AuthBranding';

/**
 * Split-screen authentication layout:
 *   left  -> brand panel (identity, headline, description, benefits, visual)
 *   right -> focused authentication workspace
 * A compact brand header appears on top of the form panel on small screens
 * (the full brand panel is hidden there). Theme toggle floats top-right.
 */
export default function AuthLayout({ hero, form }) {
  return (
    <div className="auth-shell">
      <ThemeToggle />
      <section className="auth-hero">{hero}</section>
      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <AuthBranding />
        </div>
        {form}
      </section>
    </div>
  );
}