import React from 'react';
import useReveal from './useReveal';

/**
 * Shared landing section wrapper: centered eyebrow + heading + sub copy,
 * with an intersection-reveal transition.
 */
export function LandingSection({ id, eyebrow, title, subtitle, children, wide = false, className = '' }) {
  const [ref, visible] = useReveal();
  return (
    <section id={id} className={`lp-section ${className}`.trim()}>
      <div
        ref={ref}
        className={`lp-section__inner reveal ${visible ? 'is-visible' : ''} ${wide ? 'lp-section__inner--wide' : ''}`}
      >
        {(eyebrow || title || subtitle) && (
          <div className="lp-section__head">
            {eyebrow && <span className="sys-label">{eyebrow}</span>}
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/**
 * Small reusable status/demo badge used across the landing previews.
 */
export function DemoPill({ children }) {
  return (
    <span className="lp-pill">
      <span className="led led--on led--live" aria-hidden="true" />
      {children}
    </span>
  );
}

export default LandingSection;