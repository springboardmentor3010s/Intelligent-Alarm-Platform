import React from 'react';
import BrandLogo from '../ui/BrandLogo';

/**
 * Branding row: full-wordmark logo, fixed at the top of the hero.
 */
export default function AuthBranding() {
  return (
    <div className="hero-brand">
      <BrandLogo variant="wide" className="hero-brand__logo" alt="CerebroKognit" />
    </div>
  );
}