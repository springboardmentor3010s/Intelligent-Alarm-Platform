import React, { useEffect, useState } from 'react';
import { Card, Grid } from '../styles';
import { Line } from 'react-chartjs-2';
import { buildHabitCharts, makeChartOptions } from '../utils/chartUtils';
import { subscribeTheme } from '../theme';
import { CardSkeleton, Badge, SectionHeader } from '../components/ui';
import ErrorState from '../components/ui/ErrorState';
import { apiFetch } from '../utils/api';

const PRIORITY_TONE = { high: 'danger', medium: 'warm', low: 'success', 1: 'danger', 2: 'warm', 3: 'success' };
const CATEGORY_LABEL = {
  sleep: 'Sleep Routine',
  wake_up: 'Wake-up Discipline',
  habit: 'Habit Consistency',
  challenge: 'Cognitive Challenge',
};

const PILLAR_METADATA = {
  'Wake-up Consistency': {
    weight: '35% Composite Weight',
    interpretation: 'Measures scheduled dismissals without snooze delays. Snooze cycles fragment wakefulness and trigger sleep inertia.',
    recommendedAction: 'Dismiss on your initial ring. Consistent first-ring dismissals anchor your biological morning rhythm.',
  },
  'Challenge Completion': {
    weight: '25% Composite Weight',
    interpretation: 'Measures prefrontal puzzle accuracy and problem-solving speed immediately after waking up.',
    recommendedAction: 'Practice varied puzzle types (e.g. Logic, Patterns) to maintain neuroplastic engagement.',
  },
  'Snooze Reduction': {
    weight: '20% Composite Weight',
    interpretation: 'Tracks snooze frequency relative to your rolling 7-day behavioral baseline.',
    recommendedAction: 'Target zero snoozes for 3 consecutive days to reinforce rapid cortisol awakening response.',
  },
  'Sleep Schedule Adherence': {
    weight: '20% Composite Weight',
    interpretation: 'Calculates the circadian variance and standard deviation of your scheduled wake-up times.',
    recommendedAction: 'Maintain wake times within a 30-minute window across both weekdays and weekends.',
  },
};

export default function Dashboard() {
  const [habitScore, setHabitScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);

    apiFetch('/api/v1/habits/score')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setHabitScore)
      .catch(err => {
        console.error(err);
        setError('Could not load data.');
        setHabitScore(null);
      });

    apiFetch('/api/v1/habits/score/history?days=7')
      .then(res => (res.ok ? res.json() : []))
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(console.error);

    apiFetch('/api/v1/analytics/me')
      .then(res => (res.ok ? res.json() : null))
      .then(setAnalytics)
      .catch(console.error);

    apiFetch('/api/v1/analytics/recommendations')
      .then(res => (res.ok ? res.json() : []))
      .then(data => setRecommendations(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(load, []);

  const [, setThemeBump] = useState(0);
  useEffect(() => subscribeTheme(() => setThemeBump(t => t + 1)), []);

  const habitCharts = buildHabitCharts(history.filter(h => h.overall_score !== null));
  const chartOpts = makeChartOptions();

  if (error && !habitScore) {
    return (
      <div className="page">
        <SectionHeader title="Analytics" subtitle="Habit analytics & personal insights" />
        <ErrorState description={error} onRetry={load} />
      </div>
    );
  }

  if (!habitScore) {
    return (
      <div className="page">
        <SectionHeader title="Analytics" subtitle="Loading behavioral intelligence…" />
        <div className="grid-cards grid-cards--square">
          {Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} showChart />)}
        </div>
      </div>
    );
  }

  const available = history.filter(h => h.overall_score !== null).length;
  const charts = [
    { label: 'Wake-up Consistency', key: 'wake_up_consistency', data: habitCharts.wakeUp },
    { label: 'Challenge Completion', key: 'challenge_completion', data: habitCharts.challenge },
    { label: 'Snooze Reduction', key: 'snooze_reduction', data: habitCharts.snooze },
    { label: 'Sleep Schedule Adherence', key: 'sleep_schedule_adherence', data: habitCharts.sleep },
  ];

  return (
    <div className="page">
      <SectionHeader
        title="Analytics"
        subtitle="Behavioral intelligence · circadian trajectory · recommendations"
      />

      {error && <div className="banner banner-warning">{error}</div>}

      <div className="analytics-bento">
        <Card className="bento-score">
          <div>
            <div className="card-label">Composite Habit Score</div>
            <div className="bento-score__head">
              <div className="bento-score__num">
                <span className="metric-value">{habitScore.overall_score}</span>
                <span className="metric-denom">/100</span>
              </div>
              <Badge tone={habitScore.overall_score >= 80 ? 'success' : habitScore.overall_score >= 60 ? 'brand' : 'warm'}>
                {habitScore.overall_score >= 80 ? 'Optimal Trajectory' : habitScore.overall_score >= 60 ? 'Active Discipline' : 'Calibrating'}
              </Badge>
            </div>
          </div>

          <div className="bento-score__bar">
            <div className="bar-head">
              <span>Circadian Efficiency</span>
              <span className="tabular">{habitScore.overall_score}%</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${Math.min(100, Math.max(0, habitScore.overall_score))}%` }}
              />
            </div>
          </div>

          <div className="bento-score__formula">
            <strong>Weighted formula:</strong> 35% Consistency · 25% Challenge · 20% Snooze · 20% Adherence
          </div>
        </Card>

        {analytics && (
          <Card className="bento-tele">
            <div className="card-label">Cognitive Telemetry</div>
            <div className="telemetry-grid">
              <div className="telemetry-item">
                <span className="text-xs text-muted-600" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span className="led led--on" style={{ background: 'var(--c-violet)' }} /> Total Alarms
                </span>
                <span className="metric-value">{analytics.total_alarms}</span>
              </div>
              <div className="telemetry-item">
                <span className="text-xs text-muted-600" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span className="led led--on" /> Successful Dismissals
                </span>
                <span className="metric-value">{analytics.total_dismissals}</span>
              </div>
              <div className="telemetry-item">
                <span className="text-xs text-muted-600" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span className="led led--on" style={{ background: 'var(--c-violet)' }} /> Avg Snooze Count
                </span>
                <span className="metric-value">{analytics.average_snooze_count?.toFixed(1)}</span>
              </div>
              <div className="telemetry-item">
                <span className="text-xs text-muted-600" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span className="led led--on" /> Challenge Accuracy
                </span>
                <span className="metric-value">{((analytics.challenge_accuracy || 0) * 100).toFixed(0)}%</span>
              </div>
            </div>
          </Card>
        )}

        {recommendations.length > 0 && (
          <div className="bento-recs">
            <div className="card-label mb-3">
              <span className="sys-label">Personalized AI Recommendations</span>
            </div>
            <Grid className="grid-cards--3">
              {recommendations.map(r => (
                <Card key={r.id} className="p-4 rec-card">
                  <div className="rec-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <Badge tone="brand">{CATEGORY_LABEL[r.category] || r.category}</Badge>
                    <Badge tone={PRIORITY_TONE[r.priority] || 'subtle'}>
                      {typeof r.priority === 'number' ? `P${r.priority}` : r.priority}
                    </Badge>
                  </div>
                  <div className="rec-title mt-2">
                    {r.title}
                  </div>
                  <p className="text-sm text-muted-600 mt-2" style={{ lineHeight: 1.55 }}>{r.message}</p>
                  {r.suggested_action && (
                    <div className="rec-action mt-4">
                      <span className="dot-bullet" aria-hidden="true" />
                      {r.suggested_action}
                    </div>
                  )}
                </Card>
              ))}
            </Grid>
          </div>
        )}

        {charts.map((c, i) => {
          const meta = PILLAR_METADATA[c.label] || {};
          const currentVal = habitScore[c.key] ?? '-';
          return (
            <Card key={c.label} className="bento-tile">
              <div className="bento-tile__head">
                <span className="bento-tile__num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <div className="bento-tile__head-text">
                  <span className="sys-label">Habit Pillar</span>
                  <div className="bento-tile__title">{c.label}</div>
                </div>
                <div className="bento-tile__value">
                  <div className="metric-value">{currentVal}<span className="metric-denom">/100</span></div>
                  <span className="text-xs text-muted-600">{meta.weight}</span>
                </div>
              </div>

              <div className="chart-card bento-tile__chart">
                <Line data={c.data} options={chartOpts} />
              </div>

              <div className="pillar-meta">
                <div className="pillar-meta__col">
                  <span className="pillar-meta__tag">About this metric</span>
                  <p className="pillar-meta__text">{meta.interpretation}</p>
                </div>
                <div className="pillar-meta__col">
                  <span className="pillar-meta__tag pillar-meta__tag--action">Recommended</span>
                  <p className="pillar-meta__action">{meta.recommendedAction}</p>
                </div>
              </div>
            </Card>
          );
        })}

        <div className="chart-note bento-note">
          <span className="chart-note__label">Disclaimer</span>
          Tracking {available} of 7 recorded days. Only real server-verified habit scoring events are plotted.
        </div>
      </div>
    </div>
  );
}