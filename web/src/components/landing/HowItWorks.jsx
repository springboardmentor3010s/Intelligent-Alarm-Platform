import React, { useState } from 'react';
import { STEPS } from './demo';
import { LandingSection } from './primitives';
import { BedIcon, KeyboardIcon, FlameIcon, CheckIcon } from '../../components/ui/Icons';

function StepMock({ visual }) {
  if (visual === 'sched') {
    return (
      <div className="lp-stepmock" aria-hidden="true">
        <div className="lp-stepmock__head"><BedIcon size={14} /> Wake schedule</div>
        <div className="lp-stepmock__rows">
          <span className="lp-pill">07:00</span>
          <span className="lp-pill">Math</span>
          <span className="lp-pill">Easy</span>
          <span className="lp-pill">Daily</span>
        </div>
        <span className="lp-stepmock__note">Armed in your own timezone</span>
      </div>
    );
  }
  if (visual === 'solve') {
    return (
      <div className="lp-stepmock" aria-hidden="true">
        <div className="lp-stepmock__head"><KeyboardIcon size={14} /> Dismiss challenge</div>
        <div className="lp-stepmock__q">3 + 7 = ?</div>
        <div className="lp-stepmock__options">
          <span>8</span>
          <span className="is-right">10 <CheckIcon size={12} /></span>
          <span>12</span>
        </div>
        <span className="lp-stepmock__note">Correct answers unlock dismissal</span>
      </div>
    );
  }
  return (
    <div className="lp-stepmock" aria-hidden="true">
      <div className="lp-stepmock__head"><FlameIcon size={14} /> Momentum</div>
      <div className="lp-stepmock__streak">
        <strong className="tabular">6</strong>
        <span>day streak</span>
      </div>
      <div className="lp-stepmock__meter">
        <span className="lp-stepmock__meter-fill" style={{ width: '78%' }} />
      </div>
      <span className="lp-stepmock__note">Habit score 78/100 today</span>
    </div>
  );
}

/**
 * Three-step protocol with a connected progress rail. Steps are interactive
 * buttons so the accompanying detail panel works with keyboard + screen reader.
 * Each step shows a small illustrative mock of the moment on screen.
 */
export default function HowItWorks() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <LandingSection
      id="how-it-works"
      eyebrow="The protocol"
      title="From alarm to anchor in three steps."
      subtitle="A simple loop you repeat every morning until it becomes automatic."
    >
      <div className="lp-steps">
        <div className="lp-steps__rail" role="tablist" aria-label="How it works steps">
          {STEPS.map((s, i) => (
            <button
              key={s.n}
              type="button"
              role="tab"
              id={`lp-step-tab-${i}`}
              aria-selected={active === i}
              aria-controls="lp-step-panel"
              className={`lp-step ${active === i ? 'is-active' : ''}`}
              onClick={() => setActive(i)}
            >
              <span className="lp-step__marker">
                <span className="lp-step__num tabular">{s.n}</span>
                {i < STEPS.length - 1 && <span className="lp-step__rail" aria-hidden="true" />}
              </span>
              <span className="lp-step__text">
                <span className="lp-step__title">{s.title}</span>
                <span className="lp-step__sub">{s.example}</span>
              </span>
              {active === i && <CheckIcon size={15} className="lp-step__check" />}
            </button>
          ))}
        </div>

        <div
          id="lp-step-panel"
          role="tabpanel"
          aria-labelledby={`lp-step-tab-${active}`}
          className="lp-steps__panel"
        >
          <span className="sys-label">Step {step.n}</span>
          <h3>{step.title}</h3>
          <p>{step.desc}</p>
          <StepMock visual={step.visual} />
          <p className="lp-steps__detail">{step.detail}</p>
        </div>
      </div>
    </LandingSection>
  );
}