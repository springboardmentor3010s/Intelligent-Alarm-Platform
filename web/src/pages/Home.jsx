import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Card } from '../styles';
import { buildSeries, makeChartOptions } from '../utils/chartUtils';
import {
  CardSkeleton,
  ProgressBar,
  InfoIcon,
  AlarmClockIcon,
  ActivityIcon,
  SparklesIcon,
  ClockIcon,
  PlusIcon,
  FileTextIcon,
  Badge,
  SectionHeader,
  LiveChallengeSimulator,
} from '../components/ui';
import { formatTimeOfDay, formatWeekday } from '../utils/timeFormat';
import { Link } from 'react-router-dom';

const WEIGHTS = [
  { key: 'wake_up_consistency', label: 'Wake-up Consistency', denom: 100, weight: '35% weight', tone: 'brand', desc: 'Snooze-free dismissals on scheduled time' },
  { key: 'challenge_completion', label: 'Challenge Completion', denom: 100, weight: '25% weight', tone: 'mint', desc: 'Accuracy & speed across cognitive puzzles' },
  { key: 'snooze_reduction', label: 'Snooze Reduction', denom: 100, weight: '20% weight', tone: 'warm', desc: 'Reduction in snooze frequency vs 7-day baseline' },
  { key: 'sleep_schedule_adherence', label: 'Sleep Adherence', denom: 100, weight: '20% weight', tone: 'mint', desc: 'Circadian stability and wake-time standard deviation' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatCountdown(iso) {
  const diff = new Date(iso) - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return 'due now';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h >= 24 ? `in ${Math.floor(h / 24)}d ${h % 24}h` : `in ${h}h ${m}m`;
}

function getCognitiveReadiness(score) {
  if (score >= 80) return { label: 'Optimal Readiness', tone: 'success' };
  if (score >= 60) return { label: 'Active Baseline', tone: 'brand' };
  if (score >= 40) return { label: 'Calibrating Routine', tone: 'warm' };
  return { label: 'Needs Consistency', tone: 'subtle' };
}

export default function Home() {
  const [habitScore, setHabitScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

    fetch('/api/v1/habits/score', { headers })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setHabitScore)
      .catch(err => {
        console.error(err);
        setError('Could not load habit score.');
        setHabitScore(null);
      });

    fetch('/api/v1/habits/score/history?days=7', { headers })
      .then(res => (res.ok ? res.json() : []))
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(console.error);

    fetch('/api/v1/alarms', { headers })
      .then(res => (res.ok ? res.json() : []))
      .then(data => setAlarms(Array.isArray(data) ? data : []))
      .catch(console.error);

    fetch('/api/v1/analytics/recommendations', { headers })
      .then(res => (res.ok ? res.json() : []))
      .then(data => setRecommendations(Array.isArray(data) ? data : []))
      .catch(console.error);

    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  if (!habitScore) {
    if (error) {
      return (
        <div className="page">
          <SectionHeader title="Habit Score Unavailable" subtitle={error} />
          <div className="banner banner-warning">{error}</div>
        </div>
      );
    }
    return (
      <div className="page">
        <SectionHeader title="Loading…" subtitle="Loading your cognitive status…" />
        <div className="grid-cards grid-cards--metrics">
          {Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const firstName = String(storedUser.full_name || storedUser.email?.split('@')[0] || 'User').split(' ')[0];

  const trendHistory = history.filter(h => h.overall_score !== null);
  const trendData = buildSeries(trendHistory, { dataKey: 'overall_score', label: 'Overall Score (%)' });
  const chartOpts = makeChartOptions();

  const enabled = alarms.filter(a => a.is_enabled);
  const upcoming = [...enabled].sort((a, b) =>
    (a.next_trigger || '').toString().localeCompare((b.next_trigger || '').toString())
  )[0];
  const timeline = [...enabled].sort((a, b) =>
    (a.next_trigger || '').toString().localeCompare((b.next_trigger || '').toString())
  ).slice(0, 6);
  const score = Number(habitScore.overall_score) || 0;
  const readiness = getCognitiveReadiness(score);

  return (
    <div className="page">
      <SectionHeader
        title="Today's Progress"
        subtitle={
          <span>
            {greeting()}, {firstName}.
            <span className="sys-label" style={{ marginLeft: '0.6rem' }}>
              <span className="led led--on led--live" /> Online
            </span>
          </span>
        }
      >
        <Link to="/alarms" className="btn btn-primary">
          <PlusIcon size={16} /> New Alarm
        </Link>
      </SectionHeader>

      {error && <div className="banner banner-warning">{error}</div>}

      {/* 0. Today's Cognitive Readiness Banner */}
      <div className={`readiness-banner readiness-banner--${readiness.tone}`}>
        <div className="readiness-banner__main">
          <div className="readiness-banner__icon">
            <ActivityIcon size={22} />
          </div>
          <div>
            <div className="readiness-banner__title">
              Today's Cognitive Readiness
              <Badge tone={readiness.tone}>{readiness.label}</Badge>
            </div>
            <div className="readiness-banner__desc">
              {score >= 80
                ? 'Outstanding circadian discipline · your prefrontal activation window is primed.'
                : score >= 60
                  ? 'Solid baseline established · keep your streak alive to reach optimal readiness.'
                  : score >= 40
                    ? 'Routine is calibrating · consistency today compounds into week-level gains.'
                    : 'Fresh start detected · solve your first challenge to begin logging data.'}
            </div>
          </div>
        </div>
        {trendHistory.length > 0 && (
          <span className="streak-badge" title={`${trendHistory.length} recorded day(s) this week`}>
            <SparklesIcon size={14} /> {trendHistory.length} day streak
          </span>
        )}
      </div>

      {/* 1. Next Alarm & Habit Score Hero Intelligence Surface */}
      <Card className="mb-6">
        <div className="score-hero">
          <div className="score-ring" style={{ ['--p']: `${score}` }}>
            <div className="score-ring__inner">
              <div className="score-ring__num">{score}</div>
              <div className="score-ring__cap">Habit Score</div>
            </div>
          </div>

          <div className="next-alarm__infos">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span className="sys-label">Next Scheduled Alarm</span>
              <span className="countdown">{upcoming ? formatCountdown(upcoming.next_trigger) : 'not scheduled'}</span>
            </div>

            {upcoming ? (
              <>
                <div className="next-alarm__time">
                  {upcoming.time ? formatTimeOfDay(upcoming.time) : '—'}
                  <span className="led led--on led--live" style={{ marginLeft: '0.85rem' }} title="Armed and scheduled" />
                </div>
                <div className="next-alarm__meta">
                  <span>
                    <strong>{upcoming.title || 'Morning Alarm'}</strong> · {upcoming.alarm_type || 'Daily'}
                    {upcoming.challenge_type ? ` · ${upcoming.challenge_type} Challenge` : ''}
                  </span>
                  <Link to={`/alarms`} className="quick-schedule-toggle" title="Manage this schedule">
                    <AlarmClockIcon size={13} /> Manage
                  </Link>
                </div>
              </>
            ) : (
              <div className="next-alarm__meta" style={{ marginTop: '0.35rem' }}>
                <span>No active alarms scheduled. Set your wake time to activate habit tracking.</span>
              </div>
            )}

            <div className="score-hero__actions">
              <Link to="/alarms" className="quick-action">
                <AlarmClockIcon size={14} /> Set Alarm
              </Link>
              <Link to="/challenges" className="quick-action">
                <SparklesIcon size={14} /> Test Challenge
              </Link>
              <Link to="/reports" className="quick-action">
                <FileTextIcon size={14} /> View Reports
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Cognitive Performance Stat Strip */}
      <div className="stat-strip">
        <div className="stat-card">
          <span className="stat-card__icon"><ActivityIcon size={20} /></span>
          <div>
            <div className="stat-card__num">{score}<span className="metric-denom">/100</span></div>
            <div className="stat-card__label">Composite Habit Score</div>
          </div>
        </div>

        <div className="stat-card stat-card--violet">
          <span className="stat-card__icon"><AlarmClockIcon size={20} /></span>
          <div>
            <div className="stat-card__num">{enabled.length}</div>
            <div className="stat-card__label">Active Wake Schedules</div>
          </div>
        </div>

        <div className="stat-card stat-card--violet">
          <span className="stat-card__icon"><ClockIcon size={20} /></span>
          <div>
            <div className="stat-card__num">{trendHistory.length}<span className="metric-denom">/7</span></div>
            <div className="stat-card__label">Days Recorded This Week</div>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-card__icon"><SparklesIcon size={20} /></span>
          <div>
            <div className="stat-card__num">{habitScore.challenge_completion}%</div>
            <div className="stat-card__label">Challenge Completion Rate</div>
          </div>
        </div>
      </div>

      {/* 3. Key Habit Pillars Breakdown */}
      <div>
        <div className="card-label mb-2"><span className="sys-label">Cognitive Habit Pillars · 35/25/20/20 Composite</span></div>
        <GridMetrics habitScore={habitScore} />
      </div>

      {/* 4. Behavioral Recommendations (if available) */}
      {recommendations.length > 0 && (
        <Card className="mt-4">
          <div className="card-label mb-3"><span className="sys-label">Behavioral Intelligence · Recommendations</span></div>
          <div className="grid-cards grid-cards--duo">
            {recommendations.slice(0, 2).map(r => (
              <div key={r.id} style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <Badge tone={r.priority === 'high' ? 'danger' : 'brand'}>{r.category}</Badge>
                  <span className="sys-label">{r.priority} priority</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{r.title}</div>
                <p className="text-sm text-muted-600 mt-1" style={{ fontSize: '0.85rem' }}>{r.message}</p>
                {r.suggested_action && (
                  <div className="text-xs mt-2" style={{ color: 'var(--c-violet)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className="dot-bullet" aria-hidden="true" />
                    {r.suggested_action}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 5. Interactive Practice Engine Simulator */}
      <div className="mt-4">
        <LiveChallengeSimulator />
      </div>

      {/* 6. Upcoming Schedule Timeline */}
      <Card className="mt-4">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div className="card-label"><span className="sys-label">Upcoming Wake Routine</span></div>
          <Link to="/alarms" className="text-xs text-muted-600" style={{ fontWeight: 600, color: 'var(--c-violet)' }}>
            Configure schedules
          </Link>
        </div>

        {timeline.length ? (
          <ul className="timeline">
            {timeline.map((a, i) => (
              <li key={a.id} className={`timeline-item ${i === 0 ? 'timeline-item--hot' : ''}`}>
                <span className="timeline-item__dot" aria-hidden="true" />
                <div className="timeline-item__time">{a.time ? formatTimeOfDay(a.time) : '—'}</div>
                <div className="timeline-item__main">
                  <div className="timeline-item__label">{a.title || 'Wake-up Alarm'}</div>
                  <div className="timeline-item__meta">
                    {a.alarm_type} · {a.challenge_type || 'Cognitive'} challenge · {a.next_trigger ? formatWeekday(a.next_trigger) : 'unscheduled'}
                  </div>
                </div>
                <span className={`pill ${a.is_enabled ? 'pill-success' : 'pill-neutral'}`}>
                  <span className="led led--on" style={{ marginRight: '0.25rem' }} />
                  {a.is_enabled ? 'Active' : 'Inactive'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-600" style={{ padding: '0.5rem 0' }}>
            No alarms scheduled. Add an alarm to start building your cognitive routine.
          </p>
        )}
      </Card>

      {/* 7. Weekly Trend & Contextual Empty State */}
      <Card className="mt-4">
        <div className="card-label mb-2"><span className="sys-label">Circadian Trajectory · 7-Day Habit Trend</span></div>
        {trendHistory.length >= 2 ? (
          <>
            <div className="chart-card chart-card--sm">
              <Line data={trendData} options={chartOpts} />
            </div>
            <div className="chart-note">
              <InfoIcon size={14} />
              Tracking {trendHistory.length} of 7 days recorded. Plots server-verified daily composite habit scores.
            </div>
          </>
        ) : (
          <div style={{ background: 'var(--surface-2)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.4rem' }}>
              Building Your Weekly Baseline
            </div>
            <p className="text-sm text-muted-600" style={{ maxWidth: '640px', lineHeight: 1.5 }}>
              Trajectory charts require at least <strong>2 recorded morning wake-up events</strong> to calculate velocity.
              Complete tomorrow's cognitive challenge to activate weekly trend plotting and circadian drift detection.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

function GridMetrics({ habitScore }) {
  return (
    <div className="grid-cards grid-cards--metrics">
      {WEIGHTS.map(m => (
        <Card key={m.key} className="p-4">
          <div className="card-label">{m.label}</div>
          <div className="metric-row" style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem', marginBottom: '0.5rem' }}>
            <span className="metric-value">{habitScore[m.key]}</span>
            <span className="metric-denom">/ {m.denom}</span>
          </div>
          <ProgressBar value={habitScore[m.key]} max={m.denom} tone={m.tone} label={m.label} />
          <div className="text-xs text-muted-600 mt-2" style={{ fontSize: '0.75rem' }}>
            <strong style={{ color: 'var(--text)' }}>{m.weight}</strong> · {m.desc}
          </div>
        </Card>
      ))}
    </div>
  );
}