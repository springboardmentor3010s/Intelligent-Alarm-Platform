// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';

/**
 * "or" divider between the primary CTA and the demo-account action.
 */
export default function AuthDivider({ label = 'or' }) {
  return <div className="auth-divider" role="separator">{label}</div>;
}