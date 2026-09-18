// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
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
import { getTheme, subscribeTheme } from '../theme';
import { apiFetch } from '../utils/api';
import { Link } from 'react-router-dom';

const WEIGHTS = [
  { key: 'wake_up_consistency', label: 'Wake-up Consistency', denom: 100, weight: '35% weight', tone: 'brand', desc: 'Snooze-free dismissals on scheduled time' },
  { key: 'challenge_completion', label: 'Challenge Completion', denom: 100, weight: '25% weight', tone: 'mint', desc: 'Accuracy & speed across cognitive puzzles' },
  { key: 'snooze_reduction', label: 'Snooze Reduction', denom: 100, weight: '20% weight', tone: 'warm', desc: 'Reduction vs 7-day baseline' },
  { key: 'sleep_schedule_adherence', label: 'Sleep Adherence', denom: 100, weight: '20% weight', tone: 'mint', desc: 'Circadian stability and wake-time variance' },
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
  const [error, setError] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    apiFetch('/api/v1/habits/score')
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

    apiFetch('/api/v1/habits/score/history?days=7')
      .then(res => (res.ok ? res.json() : []))
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(console.error);

    apiFetch('/api/v1/alarms')
      .then(res => (res.ok ? res.json() : []))
      .then(data => setAlarms(Array.isArray(data) ? data : []))
      .catch(console.error);

    const timer = setInterval(() => setTick(t => t + 1), 30000);
    const unsubTheme = subscribeTheme(() => setTick(t => t + 1));
    return () => {
      clearInterval(timer);
      unsubTheme();
    };
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
  const isLightTheme = getTheme() !== 'dark';
  const accentHex = isLightTheme ? '#6844FD' : '#58F6CA';
  const accentFill = isLightTheme ? 'rgba(104, 68, 253, 0.12)' : 'rgba(88, 246, 202, 0.16)';
  const trendData = buildSeries(trendHistory, {
    dataKey: 'overall_score',
    label: 'Overall Score (%)',
    border: accentHex,
    bg: accentFill,
    pointBorder: accentHex,
  });
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

  const scheduleRail = (
    <Card className="home-cols__rail">
      <div className="home-rail__head">
        <div className="card-label"><span className="sys-label">Upcoming Wake Routine</span></div>
        <Link to="/alarms" className="text-xs text-muted-600" style={{ fontWeight: 600, color: 'var(--c-violet)' }}>
          Configure
        </Link>
      </div>

      {timeline.length ? (
        <ul className="timeline">
          {timeline.map((a, i) => (
            <li key={a.id} className={`timeline-item ${i === 0 ? 'timeline-item--hot' : ''}`}>
              <span className="timeline-item__dot" aria-hidden="true" />
              <div className="timeline-item__time">{a.time ? formatTimeOfDay(a.time) : '-'}</div>
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
  );

  return (
    <div className="page">
      <div className="home-bento">
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

        {/* 1. Today's Cognitive Readiness strip */}
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
        </div>

        {/* 2. Split Intelligence Hero: alarm + score | 7-day trajectory */}
        <Card className="home-split">
          <div className="home-split__alarm">
            <div className="score-hero score-hero--split">
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
                      {upcoming.time ? formatTimeOfDay(upcoming.time) : '-'}
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
          </div>

          <div className="home-split__trend">
            <div className="home-split__trend-head">
              <span className="sys-label sys-label--mint">
                <span className="led led--on" style={{ background: 'var(--c-violet-light)' }} />Circadian Trajectory
              </span>
              {trendHistory.length > 0 && (
                <span className="streak-badge" title={`${trendHistory.length} recorded day(s) this week`}>
                  <SparklesIcon size={14} /> {trendHistory.length} day streak
                </span>
              )}
            </div>

            {trendHistory.length >= 2 ? (
              <>
                <div className="chart-card chart-card--sm home-split__chart">
                  <Line data={trendData} options={chartOpts} />
                </div>
                <div className="chart-note">
                  <InfoIcon size={13} style={{ color: 'var(--c-violet)', flexShrink: 0 }} />
                  <span>
                    Tracking <strong style={{ color: 'var(--text)' }}>{trendHistory.length} of 7 days</strong>. Server-verified daily habit scores.
                  </span>
                </div>
              </>
            ) : (
              <div className="home-split__empty">
                <div className="home-split__empty-title">
                  <span className="led led--on" style={{ background: 'var(--c-violet-light)' }} /> Building Your Weekly Baseline
                </div>
                <p className="text-sm text-muted-600" style={{ lineHeight: 1.6 }}>
                  Charting needs <strong style={{ color: 'var(--text)' }}>2 recorded wake-up events</strong>. Complete tomorrow's challenge to start plotting.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* 3. KPI Trio */}
        <div className="stat-strip stat-strip--trio">
          <div className="stat-card">
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

        {/* 4. Habit Pillars (2x2) + Interactive Practice Simulator */}
        <div className="home-cols home-cols--sim">
          <div className="home-cols__main">
            <div className="card-label"><span className="sys-label">Cognitive Habit Pillars</span></div>
            <GridMetrics habitScore={habitScore} />
            {scheduleRail}
          </div>

          <div className="home-cols__rail home-cols__rail--sim">
            <LiveChallengeSimulator />
          </div>
        </div>
      </div>
    </div>
  );
}

function GridMetrics({ habitScore }) {
  return (
    <div className="grid-cards grid-cards--square">
      {WEIGHTS.map(m => (
        <Card key={m.key} className="p-4">
          <div className="card-label">{m.label}</div>
          <div className="metric-row" style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '0.6rem' }}>
            <span className="metric-value">{habitScore[m.key]}</span>
            <span className="metric-denom">/ {m.denom}</span>
          </div>
          <ProgressBar value={habitScore[m.key]} max={m.denom} tone={m.tone} label={m.label} />
          <div className="text-xs text-muted-600 mt-2" style={{ fontSize: '0.85rem', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--text)' }}>{m.weight}</strong> · {m.desc}
          </div>
        </Card>
      ))}
    </div>
  );
}