import React, { useEffect, useState } from 'react';
import { Card, Grid, MetricCard } from '../styles';
import { Line } from 'react-chartjs-2';
import { buildHabitCharts, chartOptions } from '../utils/chartUtils';

export default function Dashboard() {
  const [habitScore, setHabitScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
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
        setError('Could not load data.');
        setHabitScore(null);
      });

    fetch('/api/v1/habits/score/history?days=7', { headers })
      .then(res => res.ok ? res.json() : [])
      .then(setHistory)
      .catch(console.error);

    fetch('/api/v1/analytics/me', { headers })
      .then(res => res.ok ? res.json() : null)
      .then(setAnalytics)
      .catch(console.error);

    fetch('/api/v1/analytics/recommendations', { headers })
      .then(res => res.ok ? res.json() : [])
      .then(setRecommendations)
      .catch(console.error);
  }, []);

  const habitCharts = buildHabitCharts(history.filter(h => h.overall_score !== null));

  if (error && !habitScore) return <div className="page">⚠️ Could not load dashboard. Is the backend running?</div>;
  if (!habitScore) return <div className="page">Loading dashboard…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <div className="subtitle">Habit analytics & personal insights</div>
        </div>
      </div>

      {error && <div className="banner banner-warning">⚠️ {error}</div>}

      <Grid className="mb-6">
        <MetricCard label="Overall Score" value={habitScore.overall_score} suffix="/100" />
        {analytics && (
          <Card className="p-4 span-2">
            <div className="card-label">Analytics Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: '1rem', marginTop: '0.5rem' }}>
              <div>
                <div className="text-xs text-muted-600">Total Alarms</div>
                <div className="card-value plain" style={{ fontSize: '1.6rem' }}>{analytics.total_alarms}</div>
              </div>
              <div>
                <div className="text-xs text-muted-600">Successful Dismissals</div>
                <div className="card-value plain" style={{ fontSize: '1.6rem' }}>{analytics.total_dismissals}</div>
              </div>
              <div>
                <div className="text-xs text-muted-600">Avg Snooze</div>
                <div className="card-value plain" style={{ fontSize: '1.6rem' }}>{analytics.average_snooze_count?.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-600">Challenge Accuracy</div>
                <div className="card-value plain" style={{ fontSize: '1.6rem' }}>{((analytics.challenge_accuracy || 0) * 100).toFixed(0)}%</div>
              </div>
            </div>
          </Card>
        )}
      </Grid>

      <Grid>
        <Card className="p-4">
          <div className="card-label">Wake-up Consistency</div>
          <div className="card-value">{habitScore.wake_up_consistency}</div>
          <div className="chart-card"><Line data={habitCharts.wakeUp} options={chartOptions} /></div>
        </Card>

        <Card className="p-4">
          <div className="card-label">Challenge Completion</div>
          <div className="card-value">{habitScore.challenge_completion}</div>
          <div className="chart-card"><Line data={habitCharts.challenge} options={chartOptions} /></div>
        </Card>

        <Card className="p-4">
          <div className="card-label">Snooze Reduction</div>
          <div className="card-value">{habitScore.snooze_reduction}</div>
          <div className="chart-card"><Line data={habitCharts.snooze} options={chartOptions} /></div>
        </Card>

        <Card className="p-4">
          <div className="card-label">Sleep Schedule Adherence</div>
          <div className="card-value">{habitScore.sleep_schedule_adherence}</div>
          <div className="chart-card"><Line data={habitCharts.sleep} options={chartOptions} /></div>
        </Card>
      </Grid>

      {recommendations.length > 0 && (
        <div className="mt-6">
          <div className="card-label mb-4">Recommendations</div>
          <Grid>
            {recommendations.map(r => (
              <Card key={r.id} className="p-4">
                <div className="card-label" style={{ textTransform: 'capitalize' }}>{r.category} · {r.priority}</div>
                <div className="title" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{r.title}</div>
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
