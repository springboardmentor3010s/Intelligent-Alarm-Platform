import React from 'react';
import { BrandMark } from './icons';

/**
 * Branding row: logo tile + wordmark, fixed at the top of the hero.
 * Uses a semantic heading for the wordmark so it reads as product identity.
 */
export default function AuthBranding() {
  return (
    <div className="hero-brand">
      <BrandMark />
      <span className="brand-word">CerebroKognit</span>
    </div>
  );
}