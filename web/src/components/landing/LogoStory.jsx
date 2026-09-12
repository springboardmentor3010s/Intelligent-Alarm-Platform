import React from 'react';
import { LandingSection } from './primitives';
import BrandLogo from '../ui/BrandLogo';

/**
 * Brand story section: what the CerebroKognit logo means, why it was designed
 * this way, and why its colors were chosen. The full logo is displayed as the
 * visual on the right, theme-aware so the correct lockup always renders.
 */
export default function LogoStory() {
  return (
    <LandingSection
      id="logo-story"
      eyebrow="Brand story"
      title="What the CerebroKognit logo means."
      className="lp-section--tint"
    >
      <div className="lp-logo-story">
        <div className="lp-logo-story__text">
          <p>
            I designed the CerebroKognit logo by combining a brain and a sunrise to represent
            intelligent waking and a fresh start to every morning. The brain reflects the cognitive
            challenges and AI capabilities of the application, while the sunrise represents energy,
            consistency, and the beginning of a productive day.
          </p>
          <p>
            I chose deep navy and indigo as the primary colors because they create a calm, focused,
            and trustworthy environment. Violet represents innovation and artificial intelligence, and
            mint green represents freshness, progress, and positive change. Together, these colors give
            CerebroKognit a modern, intelligent, and approachable identity that works consistently
            across the website, mobile application, and dark mode.
          </p>
        </div>

        <div className="lp-logo-story__art" aria-label="CerebroKognit logo">
          <BrandLogo
            variant="wide"
            className="lp-logo-story__logo"
            alt="The CerebroKognit logo, a brain and sunrise mark in indigo, violet and mint green"
          />
        </div>
      </div>
    </LandingSection>
  );
}