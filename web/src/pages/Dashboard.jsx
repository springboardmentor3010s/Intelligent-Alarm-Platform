import React, { useEffect, useState } from 'react';
import { Card, Grid, MetricCard } from '../styles';
import { Line } from 'react-chartjs-2';
import { buildHabitCharts, makeChartOptions } from '../utils/chartUtils';
import { CardSkeleton, Badge } from '../components/ui';
import ErrorState from '../components/ui/ErrorState';

const PRIORITY_TONE = { high: 'danger', medium: 'warm', low: 'success' };
const CATEGORY_LABEL = {
  sleep: 'Sleep',
  wake_up: 'Wake-up',
  habit: 'Habit',
  challenge: 'Challenge',
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
      .then(setRecommendations)
      .catch(console.error);
  };

  useEffect(load, []);

  const habitCharts = buildHabitCharts(history.filter(h => h.overall_score !== null));
  const chartOpts = makeChartOptions();

  if (error && !habitScore) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Dashboard</h1>
            <div className="subtitle">Habit analytics & personal insights</div>
          </div>
        </div>
        <ErrorState description={error} onRetry={load} />
      </div>
    );
  }

  if (!habitScore) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Loading…</h1>
            <div className="subtitle" role="status">Loading analytics…</div>
          </div>
        </div>
        <div className="grid-cards grid-cards--metrics">
          {Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} showChart />)}
        </div>
      </div>
    );
  }

  const available = history.filter(h => h.overall_score !== null).length;
  const charts = [
    { label: 'Wake-up Consistency', data: habitCharts.wakeUp },
    { label: 'Challenge Completion', data: habitCharts.challenge },
    { label: 'Snooze Reduction', data: habitCharts.snooze },
    { label: 'Sleep Schedule Adherence', data: habitCharts.sleep },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <div className="subtitle">Why your performance is improving — and what to do next</div>
        </div>
      </div>

      {error && <div className="banner banner-warning">{error}</div>}

      <Grid className="mb-6 grid-cards--metrics">
        <MetricCard label="Overall Score" value={habitScore.overall_score} suffix="/100">
          Weighted from four habit pillars
        </MetricCard>
        {analytics && (
          <Card className="p-4 span-2">
            <div className="card-label">Analytics Summary</div>
            <div className="metric-grid">
              <div>
                <div className="text-xs text-muted-600">Total Alarms</div>
                <div className="metric-value">{analytics.total_alarms}</div>
              </div>
              <div>
                <div className="text-xs text-muted-600">Successful Dismissals</div>
                <div className="metric-value">{analytics.total_dismissals}</div>
              </div>
              <div>
                <div className="text-xs text-muted-600">Avg Snooze</div>
                <div className="metric-value">{analytics.average_snooze_count?.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-600">Challenge Accuracy</div>
                <div className="metric-value">{((analytics.challenge_accuracy || 0) * 100).toFixed(0)}%</div>
              </div>
            </div>
          </Card>
        )}
      </Grid>

      <Grid className="grid-cards--metrics">
        {charts.map(c => (
          <Card key={c.label} className="p-4">
            <div className="card-label">{c.label}</div>
            <div className="chart-card"><Line data={c.data} options={chartOpts} /></div>
          </Card>
        ))}
      </Grid>
      <div className="chart-note">Available data: {available} of 7 days. Only real recorded days are plotted.</div>

      {recommendations.length > 0 && (
        <div className="mt-6">
          <div className="card-label mb-4">Recommendations</div>
          <Grid>
            {recommendations.map(r => (
              <Card key={r.id} className="p-4">
                <div className="rec-header">
                  <Badge tone="subtle">{CATEGORY_LABEL[r.category] || r.category}</Badge>
                  <Badge tone={PRIORITY_TONE[r.priority] || 'subtle'}>{r.priority}</Badge>
                </div>
                <div className="title mt-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{r.title}</div>
                <p className="text-sm text-muted-600 mt-2">{r.message}</p>
                {r.suggested_action && (
                  <p className="text-sm mt-2" style={{ color: 'var(--accent)' }}>{r.suggested_action}</p>
                )}
              </Card>
            ))}
          </Grid>
        </div>
      )}
    </div>
  );
}