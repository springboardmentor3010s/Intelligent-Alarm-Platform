// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import AuthBranding from './AuthBranding';
import { ChevronLeftIcon } from '../ui';

/**
 * Split-screen authentication layout:
 *   left  -> brand panel (identity, headline, description, benefits, visual)
 *   right -> focused authentication workspace
 * A compact brand header appears on top of the form panel on small screens
 * (the full brand panel is hidden there). Back + theme toggle float top-right.
 */
export default function AuthLayout({ hero, form }) {
  return (
    <div className="auth-shell">
      <div className="auth-top">
        <Link to="/" className="auth-back" aria-label="Back to home">
          <ChevronLeftIcon size={15} /> Back
        </Link>
        <ThemeToggle />
      </div>
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