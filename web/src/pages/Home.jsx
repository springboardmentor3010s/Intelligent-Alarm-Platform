import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Card } from '../styles';
import { buildSeries, makeChartOptions } from '../utils/chartUtils';
import { CardSkeleton, ProgressBar, InfoIcon, AlarmClockIcon, ActivityIcon, SparklesIcon, ClockIcon, PlusIcon } from '../components/ui';
import { formatTimeOfDay, formatWeekday } from '../utils/timeFormat';
import { Link } from 'react-router-dom';

const WEIGHTS = [
  { key: 'wake_up_consistency', label: 'Wake-up Consistency', denom: 100, weight: '35% weight', tone: 'brand' },
  { key: 'challenge_completion', label: 'Challenge Completion', denom: 100, weight: '25% weight', tone: 'success' },
  { key: 'snooze_reduction', label: 'Snooze Reduction', denom: 100, weight: '20% weight', tone: 'warm' },
  { key: 'sleep_schedule_adherence', label: 'Sleep Schedule Adherence', denom: 100, weight: '20% weight', tone: 'cyan' },
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

export default function Home() {
  const [habitScore, setHabitScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [alarms, setAlarms] = useState([]);
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

    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  if (!habitScore) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Loading…</h1>
            <div className="subtitle" role="status">Loading your cognitive status…</div>
          </div>
        </div>
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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Today's Progress</h1>
          <div className="subtitle">
            {greeting()}, {firstName}. <span className="sys-label" style={{ marginLeft: '0.4rem' }}><span className="led led--on led--live" /> Online</span>
          </div>
        </div>
      </div>

      {error && <div className="banner banner-warning">{error}</div>}

      {/* Next Alarm + habit score hero */}
      <Card className="mb-6">
        <div className="score-hero" style={{ alignItems: 'center' }}>
          <div className="score-ring" style={{ ['--p']: `${score}` }}>
            <div className="score-ring__inner">
              <div className="score-ring__num">{score}</div>
              <div className="score-ring__cap">Habit Score</div>
            </div>
          </div>

          <div className="next-alarm__infos">
            <div className="sys-label">Next Alarm</div>
            {upcoming ? (
              <>
                <div className="next-alarm__time">
                  {upcoming.time ? formatTimeOfDay(upcoming.time) : '—'}
                  <span className="led led--on led--live" style={{ marginLeft: '0.9rem', verticalAlign: 'middle' }} />
                </div>
                <div className="next-alarm__meta">
                  <span>
                    {upcoming.title || 'Untitled alarm'} · {upcoming.alarm_type || ''}
                    {upcoming.challenge_type ? ` · ${upcoming.challenge_type} challenge` : ''}
                  </span>
                  <span className="countdown">{formatCountdown(upcoming.next_trigger)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="next-alarm__meta" style={{ marginTop: '0.5rem' }}>
                  No alarm scheduled.
                </div>
              </>
            )}
            <div className="score-hero__actions">
              <Link to="/alarms" className="quick-action">Manage alarms</Link>
              <Link to="/challenges" className="quick-action">Practice a challenge</Link>
            </div>
          </div>
        </div>
      </Card>

      {/* Compact statistics */}
      <div className="stat-strip">
        <div className="stat-card">
          <span className="stat-card__icon"><ActivityIcon size={20} /></span>
          <div>
            <div className="stat-card__num">{score}</div>
            <div className="stat-card__label">Habit Score</div>
          </div>
        </div>
        <div className="stat-card stat-card--violet">
          <span className="stat-card__icon"><AlarmClockIcon size={20} /></span>
          <div>
            <div className="stat-card__num">{enabled.length}</div>
            <div className="stat-card__label">Active Alarms</div>
          </div>
        </div>
        <div className="stat-card stat-card--violet">
          <span className="stat-card__icon"><ClockIcon size={20} /></span>
          <div>
            <div className="stat-card__num">{trendHistory.length}</div>
            <div className="stat-card__label">Days Tracked</div>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-card__icon"><SparklesIcon size={20} /></span>
          <div>
            <div className="stat-card__num">{habitScore.challenge_completion}%</div>
            <div className="stat-card__label">Challenge Completion</div>
          </div>
        </div>
      </div>

      {/* Pillar weights */}
      <GridMetrics habitScore={habitScore} />

      {/* Today's schedule timeline */}
      <Card className="mt-6">
        <div className="card-label"><span className="sys-label">Upcoming · Schedule</span></div>
        {timeline.length ? (
          <ul className="timeline" style={{ marginTop: '1rem' }}>
            {timeline.map((a, i) => (
              <li key={a.id} className={`timeline-item ${i === 0 ? 'timeline-item--hot' : ''}`}>
                <span className="timeline-item__dot" aria-hidden="true" />
                <div className="timeline-item__time">{a.time ? formatTimeOfDay(a.time) : '—'}</div>
                <div className="timeline-item__main">
                  <div className="timeline-item__label">{a.title || 'Untitled alarm'}</div>
                  <div className="timeline-item__meta">
                    {a.alarm_type} · {a.next_trigger ? formatWeekday(a.next_trigger) : 'unscheduled'}
                  </div>
                </div>
                <span className={`pill ${a.is_enabled ? 'pill-success' : 'pill-neutral'}`}>
                  <span className="led led--on" style={{ marginRight: '0.3rem' }} />{a.is_enabled ? 'Active' : 'Inactive'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-600" style={{ marginTop: '0.75rem' }}>
            No alarms scheduled — add one to start building your routine.
          </p>
        )}
      </Card>

      {/* Weekly trend */}
      <Card className="mt-6">
        <div className="card-label"><span className="sys-label">Weekly Trend</span></div>
        {trendHistory.length >= 2 ? (
          <>
            <div className="chart-card chart-card--sm">
              <Line data={trendData} options={chartOpts} />
            </div>
            <div className="chart-note">
              <InfoIcon size={14} />
              Available data: {trendHistory.length} of 7 days. Only real recorded days are plotted.
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-600">
            Not enough data yet — continue using CerebroKognit to build your weekly trend.
          </p>
        )}
      </Card>

      <div className="quick-actions mt-6">
        <Link to="/alarms" className="quick-action"><PlusIcon size={16} /> New Alarm</Link>
        <Link to="/challenges" className="quick-action"><SparklesIcon size={16} /> Generate a Challenge</Link>
        <Link to="/dashboard" className="quick-action"><ActivityIcon size={16} /> View Insights</Link>
      </div>
    </div>
  );
}

function GridMetrics({ habitScore }) {
  return (
    <div className="grid-cards grid-cards--metrics mt-4">
      {WEIGHTS.map(m => (
        <Card key={m.key} className="p-4">
          <div className="card-label">{m.label}</div>
          <div className="metric-row">
            <span className="metric-value">{habitScore[m.key]}</span>
            <span className="metric-denom">/ {m.denom}</span>
          </div>
          <ProgressBar value={habitScore[m.key]} max={m.denom} tone={m.tone} label={m.label} />
          <div className="text-xs text-muted-600 mt-2">{m.weight}</div>
        </Card>
      ))}
    </div>
  );
}