import React, { useEffect, useState } from 'react';
import { Card, Grid, MetricCard } from '../styles';
import { Line } from 'react-chartjs-2';
import { habitsChartData, chartOptions } from '../utils/chartUtils';

export default function Home() {
  const [habitScore, setHabitScore] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/v1/habits/score', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setHabitScore)
      .catch(err => {
        console.error(err);
        setError('Could not load habit score.');
        setHabitScore({
          overall_score: 70,
          wake_up_consistency: 70,
          challenge_completion: 70,
          snooze_reduction: 70,
          sleep_schedule_adherence: 70,
        });
      });
  }, []);

  if (!habitScore) return <div className="page">Loading habit score…</div>;

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
          <div className="chart-card"><Line data={habitsChartData.wakeUp} options={chartOptions} /></div>
        </Card>

        <Card className="p-4">
          <div className="card-label">Challenge Completion</div>
          <div className="card-value">{habitScore.challenge_completion}</div>
          <div className="mt-2 text-sm text-muted-600">25% weight</div>
          <div className="chart-card"><Line data={habitsChartData.challenge} options={chartOptions} /></div>
        </Card>

        <Card className="p-4">
          <div className="card-label">Snooze Reduction</div>
          <div className="card-value">{habitScore.snooze_reduction}</div>
          <div className="mt-2 text-sm text-muted-600">20% weight</div>
          <div className="chart-card"><Line data={habitsChartData.snooze} options={chartOptions} /></div>
        </Card>

        <Card className="p-4">
          <div className="card-label">Sleep Schedule Adherence</div>
          <div className="card-value">{habitScore.sleep_schedule_adherence}</div>
          <div className="mt-2 text-sm text-muted-600">20% weight</div>
          <div className="chart-card"><Line data={habitsChartData.sleep} options={chartOptions} /></div>
        </Card>
      </Grid>
    </div>
  );
}
