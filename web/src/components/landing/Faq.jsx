import React, { useState } from 'react';
import { FAQS } from './demo';
import { LandingSection } from './primitives';

/**
 * Keyboard-accessible FAQ accordion: a single centered column of disclosures.
 * Each question is a <button> (aria-expanded + aria-controls) whose plus icon
 * rotates 45° into an ✕ when open. One item is open at a time.
 *
 * Answers stay mounted in the DOM; the panel animates a CSS grid `0fr -> 1fr`
 * row so open/close transitions smoothly at any content height.
 */
export default function Faq() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <LandingSection
      id="faq"
      eyebrow="FAQ"
      title="Questions, answered."
      subtitle="Straightforward answers about how the alarm, challenges and privacy work."
    >
      <div className="lp-faq">
        {FAQS.map((item, i) => {
          const open = openIndex === i;
          return (
            <div className={`lp-faq__item ${open ? 'is-open' : ''}`} key={item.q}>
              <h3>
                <button
                  type="button"
                  className="lp-faq__q"
                  aria-expanded={open}
                  aria-controls={`lp-faq-panel-${i}`}
                  id={`lp-faq-btn-${i}`}
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <span>{item.q}</span>
                  <span className="lp-faq__plus" aria-hidden="true" />
                </button>
              </h3>
              <div className={`lp-faq__panel${open ? ' is-open' : ''}`}>
                <div
                  id={`lp-faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`lp-faq-btn-${i}`}
                  className="lp-faq__a"
                >
                  <p>{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </LandingSection>
  );
}