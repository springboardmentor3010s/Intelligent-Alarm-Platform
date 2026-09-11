import React, { useState } from 'react';
import { ChevronDownIcon } from '../ui';
import { FEATURES } from './demo';
import { LandingSection } from './primitives';

/**
 * Feature modules as product-led cards. Each card has an expandable detail
 * ("Learn more") that is a real <button> — not hover-dependent, keyboard-open.
 */
export default function Features() {
  const [openCard, setOpenCard] = useState(null);

  return (
    <LandingSection
      id="features"
      eyebrow="Product modules"
      title="An intelligent command center for your mornings."
      subtitle="Four modules, one loop — wake, solve, score, repeat."
    >
      <div className="lp-features">
        {FEATURES.map((f, i) => {
          const open = openCard === i;
          return (
            <article className={`lp-card ${open ? 'lp-card--open' : ''}`} key={f.title}>
              <div className={`lp-card__icon lp-card__icon--${f.tone}`}>
                <f.icon size={20} />
              </div>
              <span className={`sys-label sys-label--${f.tone}`}>{f.kicker}</span>
              <h3>{f.title}</h3>
              <p className="lp-card__desc">{f.desc}</p>

              <button
                type="button"
                className="lp-card__more"
                aria-expanded={open}
                aria-controls={`lp-feature-detail-${i}`}
                onClick={() => setOpenCard(open ? null : i)}
              >
                {open ? 'Show less' : 'Learn more'}
                <ChevronDownIcon size={14} className={open ? 'is-flipped' : ''} />
              </button>

              {open && (
                <p id={`lp-feature-detail-${i}`} className="lp-card__detail">
                  {f.detail}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </LandingSection>
  );
}