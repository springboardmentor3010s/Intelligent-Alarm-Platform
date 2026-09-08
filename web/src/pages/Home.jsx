import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Card } from '../styles';
import { buildSeries, makeChartOptions } from '../utils/chartUtils';
import { CardSkeleton, ProgressBar, InfoIcon } from '../components/ui';
import { Link } from 'react-router-dom';

const WEIGHTS = [
  { key: 'wake_up_consistency', label: 'Wake-up Consistency', denom: 100, weight: '35% weight', tone: 'brand' },
  { key: 'challenge_completion', label: 'Challenge Completion', denom: 100, weight: '25% weight', tone: 'success' },
  { key: 'snooze_reduction', label: 'Snooze Reduction', denom: 100, weight: '20% weight', tone: 'warm' },
  { key: 'sleep_schedule_adherence', label: 'Sleep Schedule Adherence', denom: 100, weight: '20% weight', tone: 'cyan' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatNext(alarm) {
  const d = new Date(alarm.next_trigger);
  const time = alarm.time
    ? alarm.time
    : Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day = Number.isNaN(d.getTime())
    ? 'Scheduled'
    : d.toLocaleDateString(undefined, { weekday: 'short' });
  return { time, day };
}

export default function Home() {
  const [habitScore, setHabitScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [error, setError] = useState(null);

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

  const upcoming = alarms
    .filter(a => a.is_enabled)
    .sort((a, b) => (a.next_trigger || '').toString().localeCompare((b.next_trigger || '').toString()))[0];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Today's Progress</h1>
          <div className="subtitle">{greeting()}, {firstName}. Here is your cognitive status right now.</div>
        </div>
      </div>

      {error && <div className="banner banner-warning">{error}</div>}

      <Card className="mb-6">
        <div className="score-hero">
          <div className="score-hero__left">
            <div className="score-hero__label">Overall Score</div>
            <div className="score-hero__value">
              <span className="num">{habitScore.overall_score}</span>
              <span className="denom">/100</span>
            </div>
            <div className="score-hero__hint">Weighted from your four habit pillars</div>
          </div>

          <div className="score-hero__alarm">
            <div className="score-hero__label">Next Alarm</div>
            {upcoming ? (
              <>
                <div className="score-hero__alarm-time">{formatNext(upcoming).time}</div>
                <div className="score-hero__alarm-meta">
                  {upcoming.title || 'Untitled alarm'} · {upcoming.challenge_type || ''} · {upcoming.difficulty || ''}
                </div>
                <div className="score-hero__actions">
                  <Link to="/alarms" className="quick-action">Manage alarms</Link>
                </div>
              </>
            ) : (
              <>
                <div className="score-hero__alarm-meta" style={{ marginTop: '0.35rem' }}>
                  No alarm scheduled yet.
                </div>
                <div className="score-hero__actions">
                  <Link to="/alarms" className="quick-action">Create an alarm</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="quick-actions mb-6">
        <Link to="/alarms" className="quick-action">+ New Alarm</Link>
        <Link to="/challenges" className="quick-action">Generate a Challenge</Link>
      </div>

      <GridMetrics habitScore={habitScore} />

      <Card className="mt-6">
        <div className="card-label">Weekly Trend</div>
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
    </div>
  );
}

function GridMetrics({ habitScore }) {
  return (
    <div className="grid-cards grid-cards--metrics">
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