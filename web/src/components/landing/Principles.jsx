// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { PRINCIPLES } from './demo';
import { LandingSection } from './primitives';
import { ShieldIcon, LockIcon, ZapIcon } from '../ui';

const PRINCIPLE_ICONS = [LockIcon, ShieldIcon, ZapIcon];

/**
 * Transparent principles block — an honest alternative to fake testimonials
 * or invented social proof. Communicates how the product behaves.
 */
export default function Principles() {
  return (
    <LandingSection
      id="principles"
      eyebrow="How we build"
      title="Principles over promises."
      subtitle="No fake reviews, no invented statistics; here is how the product actually behaves."
      className="lp-section--gray"
    >
      <div className="lp-principles">
        {PRINCIPLES.map((p, i) => {
          const Icon = PRINCIPLE_ICONS[i] || ShieldIcon;
          return (
            <article className="lp-card lp-card--principle" key={p.title}>
              <div className="lp-card__icon">
                <Icon size={20} />
              </div>
              <h3>{p.title}</h3>
              <p className="lp-card__desc">{p.desc}</p>
            </article>
          );
        })}
      </div>
    </LandingSection>
  );
}