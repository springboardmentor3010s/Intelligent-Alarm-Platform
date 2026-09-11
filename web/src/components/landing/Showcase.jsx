import React, { useState } from 'react';
import {
  AlarmClockIcon,
  AlertCircleIcon,
  BarChartIcon,
  BrainIcon,
  CheckCircleIcon,
  FlameIcon,
  TargetIcon,
} from '../../components/ui/Icons';
import { LandingSection, DemoPill } from './primitives';
import PhoneMock from './PhoneMock';
import { CHALLENGE_PREVIEWS, PILLARS } from './demo';

/**
 * Product showcase — pure CSS/SVG mockups (no stock images) so the page never
 * feels empty: a rich browser dashboard preview next to a realistic phone mock.
 * The recent-challenges list is a real, accessible control: tapping a row
 * previews that challenge in the dashboard card. Every number is labeled
 * sample data.
 */
export default function Showcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = CHALLENGE_PREVIEWS[activeIndex];

  return (
    <LandingSection
      id="showcase"
      eyebrow="One platform"
      title="Web dashboard, pocket companion."
      subtitle="The same habit score, trends and challenges, tuned for the big screen and for the morning phone."
      wide
      className="lp-section--tint"
    >
      <div className="lp-show">
        <div className="lp-show__browser">
          <div className="lp-show__bar">
            <span className="lp-show__dots"><i /><i /><i /></span>
            <span className="lp-show__url">app.cerebrokognit · Home</span>
            <DemoPill>Dashboard preview</DemoPill>
          </div>
          <div className="lp-show__body">
            <div className="lp-show__row">
              <span className="sys-label">Today</span>
              <span className="lp-show__streak"><FlameIcon size={12} /> 6-day streak</span>
            </div>
            <div className="lp-show__grid">
              <div className="lp-show__ring">
                <svg viewBox="0 0 120 120">
                  <circle className="lp-show__ring-track" cx="60" cy="60" r="52" />
                  <circle className="lp-show__ring-fill" cx="60" cy="60" r="52" strokeDasharray="326.7" strokeDashoffset="71.9" />
                </svg>
                <div className="lp-show__ring-num">
                  <strong className="tabular">78</strong>
                  <span>/100</span>
                </div>
              </div>
              <div className="lp-show__pillars">
                {PILLARS.map(p => (
                  <div className="lp-show__pillar" key={p.label}>
                    <span className="lp-show__pillar-label">{p.label}</span>
                    <span className="lp-show__pillar-track">
                      <span
                        className={`lp-show__pillar-fill lp-show__pillar-fill--${p.tone}`}
                        style={{ width: `${p.value}%` }}
                      />
                    </span>
                    <span className="lp-show__pillar-value tabular">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-show__chips">
              <span className="lp-pill"><AlarmClockIcon size={12} /> Next alarm 07:00</span>
              <span className="lp-pill"><BrainIcon size={12} /> Memory · Hard</span>
              <span className="lp-pill"><TargetIcon size={12} /> +12 pts this week</span>
              <span className="lp-pill"><BarChartIcon size={12} /> Best Monday ever</span>
            </div>

            <div className="lp-show__challenge">
              <span className="sys-label">Challenge preview</span>
              <div className="lp-show__challenge-row">
                <div className="lp-show__challenge-info">
                  <strong className="lp-show__challenge-q">{active.question}</strong>
                  <span className="lp-show__challenge-meta tabular">{active.meta}</span>
                </div>
                <span className={`lp-show__challenge-badge lp-show__challenge-badge--${active.tone}`}>
                  {active.points}
                </span>
              </div>
            </div>

            <div className="lp-show__progress">
              <span className="sys-label">Morning progress</span>
              <span className="lp-show__progress-track">
                <span className="lp-show__progress-fill" style={{ width: '66%' }} />
              </span>
              <span className="lp-show__progress-num tabular">2 of 3</span>
            </div>

            <div className="lp-show__history">
              <span className="sys-label">Recent challenges - tap to preview</span>
              {CHALLENGE_PREVIEWS.map((c, i) => (
                <button
                  key={c.key}
                  type="button"
                  className={`lp-show__history-row${i === activeIndex ? ' is-active' : ''}${c.tone === 'no' ? ' lp-show__history-row--miss' : ''}`}
                  aria-pressed={i === activeIndex}
                  onClick={() => setActiveIndex(i)}
                >
                  {c.tone === 'no' ? <AlertCircleIcon size={13} /> : <CheckCircleIcon size={13} />}
                  <span className="lp-show__history-q">{c.label}</span>
                  <span className={`lp-show__history-stat tabular${c.tone === 'ok' ? ' lp-show__history-stat--good' : ''}`}>
                    {c.points}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <PhoneMock />
      </div>
    </LandingSection>
  );
}