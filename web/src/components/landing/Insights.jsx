import React from 'react';
import { SAMPLE_WEEK, SAMPLE_INSIGHTS } from './demo';
import { LandingSection, DemoPill } from './primitives';
import HabitChart from './HabitChart';

/**
 * Interactive habit analytics preview. All numbers are illustrative sample data
 * and are labeled as such. Weekly score trend chart + headline metrics,
 * self-contained, no chart library.
 */
export default function Insights() {
  const metrics = [
    { label: 'Habit score', value: SAMPLE_INSIGHTS.habitScore, suffix: '/100' },
    { label: 'Wake consistency', value: SAMPLE_INSIGHTS.consistency, suffix: '%' },
    { label: 'Challenge accuracy', value: SAMPLE_INSIGHTS.accuracy, suffix: '%' },
    { label: 'Current streak', value: SAMPLE_INSIGHTS.streakDays, suffix: ' days' },
  ];

  return (
    <LandingSection
      id="insights"
      eyebrow="Personal insights"
      title="Your habits, visualized."
      subtitle="Weekly streaks, wake consistency and challenge accuracy at a glance — using illustrative sample data, clearly labeled."
    >
      <div className="lp-insights">
        <div className="lp-insights__chart">
          <div className="lp-insights__chart-head">
            <div>
              <span className="sys-label">Weekly habit score — last 7 days</span>
              <h3 className="lp-insights__chart-title">Trend, 0 – 100</h3>
            </div>
            <DemoPill>Sample data</DemoPill>
          </div>
          <HabitChart data={SAMPLE_WEEK} />
        </div>

        <div className="lp-insights__metrics">
          {metrics.map(m => (
            <div className="lp-metric" key={m.label}>
              <span className="lp-metric__value tabular">
                {m.value}
                <span className="lp-metric__suffix">{m.suffix}</span>
              </span>
              <span className="lp-metric__label">{m.label}</span>
            </div>
          ))}
          <p className="lp-insights__note">
            Sample numbers only — your real dashboard shows your actual morning data.
          </p>
        </div>
      </div>
    </LandingSection>
  );
}