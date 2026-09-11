import React from 'react';
import { Link } from 'react-router-dom';
import {
  BrandMark,
  AlarmClockIcon,
  SparklesIcon,
  ActivityIcon,
  HomeIcon,
  ProgressBar,
  BarChartIcon,
} from '../components/ui';

const FEATURES = [
  {
    icon: AlarmClockIcon,
    title: 'Intelligent Alarms',
    desc: 'Alarms that refuse to be ignored — each wake-up is gated by a quick cognitive challenge that genuinely gets your brain online.',
  },
  {
    icon: SparklesIcon,
    title: 'Cognitive Challenges',
    desc: 'Math, logic, memory, patterns and word puzzles with adaptive difficulty that tunes itself to your daily performance.',
  },
  {
    icon: HomeIcon,
    title: 'Habit Tracking',
    desc: 'A weighted 35/25/20/20 habit score tracks wake-up consistency, challenge completion, snooze reduction and sleep adherence.',
  },
  {
    icon: BarChartIcon,
    title: 'Personal Insights',
    desc: 'Sleep windows, streaks, attempt accuracy and recommendations — every decision backed by your real behavioral data.',
  },
];

const STEPS = [
  { n: '01', title: 'Set your wake time', desc: 'Choose a schedule, a challenge type and a difficulty level.' },
  { n: '02', title: 'Wake up, solve to dismiss', desc: 'When the alarm fires, complete the challenge to earn dismissal.' },
  { n: '03', title: 'Build the streak', desc: 'Watch your habit score and streaks compound week over week.' },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="brand">
          <BrandMark size={30} />
          CerebroKognit
          <span className="led led--on led--live" />
        </span>
        <div className="landing-nav__actions">
          <Link to="/auth" className="btn btn-ghost">Sign in</Link>
          <Link to="/auth" className="btn btn-primary">Get Started</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero__badge">
          <span className="led led--on" />
          Cognitive alarm system · v2
        </div>
        <h1>WAKE WITH PURPOSE.<br /><em>Build better habits.</em></h1>
        <p>
          CerebroKognit is an intelligent alarm and cognitive habit platform designed to turn
          waking up into a meaningful daily routine — backed by data, not willpower.
        </p>
        <div className="landing-hero__actions">
          <Link to="/auth" className="btn btn-primary">Get Started</Link>
          <a href="#features" className="btn btn-ghost">Explore CerebroKognit</a>
        </div>

        <div className="landing-hero__visual">
          <MockDashboard />
        </div>
      </section>

      <section id="features" className="landing-section">
        <div className="landing-section__head">
          <span className="sys-label">System Modules</span>
          <h2>One command center for your mornings.</h2>
          <p>Everything you need to wake up intentionally and measure what matters.</p>
        </div>
        <div className="landing-grid">
          {FEATURES.map(f => (
            <div className="landing-card card" key={f.title}>
              <span className="stat-card__icon"><f.icon size={20} /></span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section__head">
          <span className="sys-label">Protocol</span>
          <h2>How it works</h2>
        </div>
        <div className="landing-grid">
          {STEPS.map(s => (
            <div className="landing-card card" key={s.n}>
              <div className="sys-label">{s.n}</div>
              <h3 style={{ marginTop: '0.9rem' }}>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="landing-cta">
        <h2>Turn your wake-up into your sharpest moment.</h2>
        <p>Join the demo, set your first alarm, and let the cognitive loop do the rest.</p>
        <Link to="/auth" className="btn btn-primary">Get Started</Link>
      </div>

      <footer className="landing-footer">
        <span className="brand" style={{ fontSize: '0.95rem' }}>
          <BrandMark size={22} />
          CerebroKognit
        </span>
        <span className="sys-label">SYS 2.4 · Cognitive Productivity Platform</span>
      </footer>
    </div>
  );
}

function MockDashboard() {
  return (
    <CardMock>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <span className="sys-label"><span className="led led--on led--live" /> Live · Command Center</span>
        <span className="pill pill-success"><span className="led led--on" style={{ marginRight: '0.25rem' }} /> 07:00 AM Active</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', flexWrap: 'wrap' }}>
        <div className="score-ring" style={{ ['--p']: 78, width: 110, height: 110 }}>
          <div className="score-ring__inner" style={{ width: 88, height: 88 }}>
            <div className="score-ring__num" style={{ fontSize: '1.85rem' }}>78</div>
            <div className="score-ring__cap" style={{ fontSize: '0.6rem' }}>Habit Score</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="next-alarm__time" style={{ fontSize: '2.4rem' }}>07:00 AM</div>
          <div className="next-alarm__meta">
            <span>Morning Boost · Adaptive Math Challenge</span>
            <span className="countdown">in 8h 24m</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <ProgressBar value={85} max={100} tone="brand" label="Wake-up Consistency (35%)" />
        <ProgressBar value={90} max={100} tone="success" label="Challenge Completion (25%)" />
        <ProgressBar value={65} max={100} tone="warm" label="Snooze Reduction (20%)" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', color: 'var(--text-muted)' }}>
        <ActivityIcon size={14} />
        <span className="sys-label">Prefrontal cortex readiness: Optimal · 7-day streak</span>
      </div>
    </CardMock>
  );
}

function CardMock({ children }) {
  return (
    <div
      className="card"
      style={{
        maxWidth: 680,
        margin: '0 auto',
        textAlign: 'left',
        padding: '1.75rem 2rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {children}
    </div>
  );
}