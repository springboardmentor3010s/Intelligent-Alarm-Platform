import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, PlayIcon, CheckCircleIcon } from '../ui';
import CommandCenter from './CommandCenter';
import useReveal from './useReveal';

const HERO_POINTS = [
  'Cognitive challenge gates your dismissal',
  'Adaptive difficulty tuned to your streak',
  'Habit score that rewards consistency',
];

/**
 * Hero: headline + supporting copy + primary/secondary CTAs and the
 * interactive command-center demo. Keeps the wake-with-purpose message.
 */
export default function Hero() {
  const [ref, visible] = useReveal();
  return (
    <section className="lp-hero">
      <div ref={ref} className={`lp-hero__inner reveal ${visible ? 'is-visible' : ''}`}>
        <div className="lp-hero__text">
          <span className="lp-hero__badge">
            <span className="led led--on led--live" aria-hidden="true" />
            Cognitive alarm system
          </span>
          <h1>
            WAKE WITH PURPOSE.
            <br />
            <em>
              An <span className="hl--violet">intelligent</span>{' '}
              <span className="hl--mint">command</span>{' '}
              <span className="hl--amber">center</span> for your{' '}
              <span className="hl--cyan">mornings</span>.
            </em>
          </h1>
          <p className="lp-hero__lead">
            CerebroKognit turns waking up into a meaningful daily routine, a quick
            cognitive challenge sits between your alarm and snooze, backed by a
            habit score that measures what actually works.
          </p>

          <div className="lp-hero__actions">
            <Link to="/auth" className="btn btn-primary btn--lg">
              Get Started <ArrowRightIcon size={16} />
            </Link>
            <a href="#how-it-works" className="btn btn-ghost btn--lg">
              <PlayIcon size={15} /> See how it works
            </a>
          </div>

          <ul className="lp-hero__points">
            {HERO_POINTS.map(p => (
              <li key={p}>
                <CheckCircleIcon size={15} /> {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-hero__demo">
          <CommandCenter />
        </div>
      </div>
    </section>
  );
}