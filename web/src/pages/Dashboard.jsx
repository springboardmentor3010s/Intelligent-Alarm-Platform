import React, { useEffect, useState } from 'react';
import { Card, Grid, MetricCard } from '../styles';
import { Line } from 'react-chartjs-2';
import { buildHabitCharts, makeChartOptions } from '../utils/chartUtils';
import { CardSkeleton, Badge, SectionHeader } from '../components/ui';
import ErrorState from '../components/ui/ErrorState';

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
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

    fetch('/api/v1/habits/score', { headers })
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

    fetch('/api/v1/habits/score/history?days=7', { headers })
      .then(res => (res.ok ? res.json() : []))
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(console.error);

    fetch('/api/v1/analytics/me', { headers })
      .then(res => (res.ok ? res.json() : null))
      .then(setAnalytics)
      .catch(console.error);

    fetch('/api/v1/analytics/recommendations', { headers })
      .then(res => (res.ok ? res.json() : []))
      .then(data => setRecommendations(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(load, []);

  const habitCharts = buildHabitCharts(history.filter(h => h.overall_score !== null));
  const chartOpts = makeChartOptions();

  if (error && !habitScore) {
    return (
      <div className="page">
        <SectionHeader title="Dashboard" subtitle="Habit analytics & personal insights" />
        <ErrorState description={error} onRetry={load} />
      </div>
    );
  }

  if (!habitScore) {
    return (
      <div className="page">
        <SectionHeader title="Dashboard" subtitle="Loading behavioral intelligence…" />
        <div className="grid-cards grid-cards--metrics">
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
        title="Dashboard"
        subtitle="Behavioral intelligence, circadian trajectory & personalized recommendations"
      />

      {error && <div className="banner banner-warning">{error}</div>}

      {/* Top Intelligence Overview (Google Bento Grid) */}
      <Grid className="mb-6 grid-cards--duo">
        <Card className="p-5 bento-hero-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="card-label">Composite Habit Score</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '0.25rem' }}>
                <span className="metric-value" style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1 }}>
                  {habitScore.overall_score}
                </span>
                <span className="metric-denom" style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  /100
                </span>
              </div>
            </div>
            <Badge tone={habitScore.overall_score >= 80 ? 'success' : habitScore.overall_score >= 60 ? 'brand' : 'warm'}>
              {habitScore.overall_score >= 80 ? 'Optimal Trajectory' : habitScore.overall_score >= 60 ? 'Active Discipline' : 'Calibrating'}
            </Badge>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              <span>Circadian Efficiency</span>
              <span className="tabular">{habitScore.overall_score}%</span>
            </div>
            <div style={{ height: '8px', background: 'var(--surface-3)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(0, habitScore.overall_score))}%`,
                  background: 'var(--grad-primary)',
                  borderRadius: '9999px',
                  transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
            <strong>Weighted formula:</strong> 35% Consistency · 25% Challenge · 20% Snooze · 20% Adherence
          </div>
        </Card>

        {analytics && (
          <Card className="p-5">
            <div className="card-label mb-3">Cognitive Telemetry Summary</div>
            <div className="telemetry-grid">
              <div className="telemetry-item">
                <span className="text-xs text-muted-600" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span className="led led--on" /> Total Alarms
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
                  <span className="led led--on led--live" style={{ background: 'var(--c-amber)' }} /> Avg Snooze Count
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
      </Grid>

      {/* Pillar Charts with Full Context: Value, Trend, Interpretation, and Action */}
      <div className="card-label mb-2"><span className="sys-label">Detailed Habit Pillars · Intelligence Breakdown</span></div>
      <Grid className="grid-cards--duo">
        {charts.map(c => {
          const meta = PILLAR_METADATA[c.label] || {};
          const currentVal = habitScore[c.key] ?? '—';
          return (
            <Card key={c.label} className="p-4">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div>
                  <div className="card-label" style={{ marginBottom: '0.2rem' }}>{c.label}</div>
                  <span className="text-xs text-muted-600">{meta.weight}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="metric-value" style={{ fontSize: '1.45rem' }}>{currentVal}<span className="metric-denom">/100</span></div>
                </div>
              </div>

              <div className="chart-card">
                <Line data={c.data} options={chartOpts} />
              </div>

              <div className="pillar-meta">
                <div className="pillar-meta__row">
                  <span className="pillar-meta__tag">Interpretation</span>
                  <p className="pillar-meta__text">{meta.interpretation}</p>
                </div>
                <div className="pillar-meta__row">
                  <span className="pillar-meta__tag pillar-meta__tag--action">Recommended Action</span>
                  <p className="pillar-meta__action">{meta.recommendedAction}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </Grid>
      <div className="chart-note">
        Tracking {available} of 7 recorded days. Only real server-verified habit scoring events are plotted.
      </div>

      {/* Actionable Recommendations Module (Google Gemini Style) */}
      {recommendations.length > 0 && (
        <div className="mt-8">
          <div className="card-label mb-3">
            <span className="sys-label">Personalized AI Recommendations</span>
          </div>
          <Grid className="grid-cards--3">
            {recommendations.map(r => (
              <Card key={r.id} className="p-5 rec-card">
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
                    <span>→</span> {r.suggested_action}
                  </div>
                )}
              </Card>
            ))}
          </Grid>
        </div>
      )}
    </div>
  );
}