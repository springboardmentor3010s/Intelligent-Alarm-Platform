import React, { useEffect, useState } from 'react';
import { Card, Grid, MetricCard } from '../styles';
import { Line } from 'react-chartjs-2';
import { buildHabitCharts, chartOptions } from '../utils/chartUtils';

export default function Home() {
  const [habitScore, setHabitScore] = useState(null);
  const [history, setHistory] = useState([]);
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
      .then(res => res.ok ? res.json() : [])
      .then(setHistory)
      .catch(console.error);
  }, []);

  if (!habitScore) return <div className="page">Loading habit score…</div>;

  const habitCharts = buildHabitCharts(history.filter(h => h.overall_score !== null));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Today's Progress</h1>
          <div className="subtitle">Your cognitive habit health at a glance</div>
        </div>
      </div>

      {error && <div className="banner banner-warning">⚠️ {error}</div>}

      <MetricCard label="Overall Score" value={habitScore.overall_score} suffix="/100" className="mb-6">
        Weighted from four habit pillars
      </MetricCard>

      <Grid>
        <Card className="p-4">
          <div className="card-label">Wake-up Consistency</div>
          <div className="card-value">{habitScore.wake_up_consistency}</div>
          <div className="mt-2 text-sm text-muted-600">35% weight</div>
          <div className="chart-card"><Line data={habitCharts.wakeUp} options={chartOptions} /></div>
        </Card>

        <Card className="p-4">
          <div className="card-label">Challenge Completion</div>
          <div className="card-value">{habitScore.challenge_completion}</div>
          <div className="mt-2 text-sm text-muted-600">25% weight</div>
          <div className="chart-card"><Line data={habitCharts.challenge} options={chartOptions} /></div>
        </Card>

        <Card className="p-4">
          <div className="card-label">Snooze Reduction</div>
          <div className="card-value">{habitScore.snooze_reduction}</div>
          <div className="mt-2 text-sm text-muted-600">20% weight</div>
          <div className="chart-card"><Line data={habitCharts.snooze} options={chartOptions} /></div>
        </Card>

        <Card className="p-4">
          <div className="card-label">Sleep Schedule Adherence</div>
          <div className="card-value">{habitScore.sleep_schedule_adherence}</div>
          <div className="mt-2 text-sm text-muted-600">20% weight</div>
          <div className="chart-card"><Line data={habitCharts.sleep} options={chartOptions} /></div>
        </Card>
      </Grid>
    </div>
  );
}