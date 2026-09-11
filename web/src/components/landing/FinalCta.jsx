import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, SparklesIcon } from '../ui';
import useReveal from './useReveal';

/**
 * Final CTA — a strong deep-indigo band that brings the palette to a close.
 */
export default function FinalCta() {
  const [ref, visible] = useReveal();
  return (
    <section className="lp-final">
      <div ref={ref} className={`lp-final__inner lp-final__inner--strong reveal ${visible ? 'is-visible' : ''}`}>
        <span className="lp-final__mark" aria-hidden="true"><SparklesIcon size={18} /></span>
        <h2>Turn your wake-up into your sharpest moment.</h2>
        <p>Set your first alarm and let the cognitive loop do the rest.</p>
        <div className="lp-final__actions">
          <Link to="/auth" className="btn btn-primary btn--lg">
            Get Started <ArrowRightIcon size={16} />
          </Link>
          <a href="#how-it-works" className="btn btn-ghost btn--lg">
            Replay how it works
          </a>
        </div>
        <p className="lp-final__meta">Free to use · No credit card · Cancels in one tap</p>
      </div>
    </section>
  );
}