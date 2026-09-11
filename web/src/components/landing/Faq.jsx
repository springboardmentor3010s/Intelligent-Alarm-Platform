import React, { useState } from 'react';
import { ChevronDownIcon } from '../ui';
import { FAQS } from './demo';
import { LandingSection } from './primitives';

/**
 * Keyboard-accessible FAQ accordion: each item is a disclosure built from a
 * <button> + aria-expanded + aria-controls, so it works with keyboard and SR.
 */
export default function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

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
                  <ChevronDownIcon size={18} className={open ? 'is-flipped' : ''} />
                </button>
              </h3>
              {open && (
                <p
                  id={`lp-faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`lp-faq-btn-${i}`}
                  className="lp-faq__a"
                >
                  {item.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </LandingSection>
  );
}