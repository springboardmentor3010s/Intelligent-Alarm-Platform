import React, { useEffect, useState } from 'react';
import { Card } from '../styles';
import { Line } from 'react-chartjs-2';
import { buildSeries, makeChartOptions } from '../utils/chartUtils';
import {
  CardSkeleton,
  ProgressBar,
  ErrorState,
  DownloadIcon,
  InfoIcon,
  SectionHeader,
  Badge,
  ActivityIcon,
} from '../components/ui';

const FORMATS = {
  csv: { ext: 'csv', mime: 'text/csv', label: 'CSV' },
  pdf: { ext: 'pdf', mime: 'application/pdf', label: 'PDF' },
  excel: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel' },
};

const METRICS = [
  { key: 'wake_up_consistency', label: 'Wake-up Consistency', weight: '35%', tone: 'brand' },
  { key: 'challenge_completion', label: 'Challenge Completion', weight: '25%', tone: 'success' },
  { key: 'snooze_reduction', label: 'Snooze Reduction', weight: '20%', tone: 'warm' },
  { key: 'sleep_schedule_adherence', label: 'Sleep Adherence', weight: '20%', tone: 'cyan' },
];

const REPORT_TYPES = [
  {
    type: 'habits',
    title: 'Daily Habit Performance Report',
    desc: 'Weighted 35/25/20/20 composite scoring history, wake times, and daily circadian index.',
  },
  {
    type: 'wake-up',
    title: 'Wake-up & Snooze Telemetry',
    desc: 'Event-by-event dismissal log, snooze latency metrics, and scheduled trigger comparisons.',
  },
  {
    type: 'challenges',
    title: 'Cognitive Puzzle Challenge Report',
    desc: 'Per-attempt question accuracy, response times, difficulty ratings, and category performance.',
  },
];

const RANGE_OPTIONS = [7, 14, 30];

export default function Reports() {
  const [reportData, setReportData] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

    fetch('/api/v1/habits/score', { headers })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setReportData)
      .catch(err => {
        console.error(err);
        setError('Could not load report data.');
        setReportData(null);
      });

    fetch(`/api/v1/habits/score/history?days=${days}`, { headers })
      .then(res => (res.ok ? res.json() : []))
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [days]);

  if (!reportData) {
    if (error) {
      return (
        <div className="page">
          <SectionHeader title="Reports" subtitle="Download habit data & progress summaries" />
          <ErrorState description={error} />
        </div>
      );
    }
    return (
      <div className="page">
        <SectionHeader title="Reports" subtitle="Loading analytical reports…" />
        <div className="grid-cards">
          <CardSkeleton showChart />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const trendHistory = history.filter(h => h.overall_score !== null);
  const trendData = buildSeries(trendHistory, { dataKey: 'overall_score', label: 'Overall Score (%)' });
  const chartOpts = makeChartOptions();

  const download = async (_type, formatKey) => {
    setError(null);
    setDownloading(`${_type}:${formatKey}`);
    const fmt = FORMATS[formatKey];
    try {
      const res = await fetch(`/api/v1/dashboard/reports/${_type}?format=${formatKey}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${_type}-report.${fmt.ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError(`Export failed. Please try again.`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="page">
      <SectionHeader
        title="Reports"
        subtitle="Analytical habit history, circadian stability metrics & raw telemetry exports"
      />

      {error && <div className="banner banner-warning">{error}</div>}

      {/* Analytical Overview Cards */}
      <div className="reports-grid">
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div className="card-label mb-0"><span className="sys-label">Habit Score Breakdown</span></div>
            <Badge tone="brand">Composite Analysis</Badge>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', margin: '0.5rem 0 1rem' }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {reportData.overall_score}
            </span>
            <span className="metric-denom" style={{ fontSize: '1.1rem' }}>/100</span>
          </div>

          <div className="report-metrics">
            {METRICS.map(m => (
              <div key={m.key} className="report-metric">
                <div className="report-metric__head">
                  <span className="report-metric__label">
                    {m.label} <span className="text-xs text-muted-600">({m.weight})</span>
                  </span>
                  <span className="report-metric__value">{reportData[m.key]}/100</span>
                </div>
                <ProgressBar value={reportData[m.key]} max={100} tone={m.tone} label={m.label} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="card-label mb-0"><span className="sys-label">Circadian Trajectory</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="segmented segmented--range" role="group" aria-label="Report date range">
                {RANGE_OPTIONS.map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`segmented__option ${d === days ? 'is-active' : ''}`}
                    aria-pressed={d === days}
                    onClick={() => setDays(d)}
                  >
                    {d}D
                  </button>
                ))}
              </div>
              <Badge tone={trendHistory.length >= 4 ? 'success' : 'subtle'}>
                {trendHistory.length}/{days} Days Active
              </Badge>
            </div>
          </div>

          {trendHistory.length >= 2 ? (
            <>
              <div className="chart-card chart-card--sm">
                <Line data={trendData} options={chartOpts} />
              </div>
              <div className="chart-note">
                <InfoIcon size={14} />
                Tracking {trendHistory.length} of {days} days recorded. Displays server-certified score trajectory.
              </div>
            </>
          ) : (
            <div style={{ background: 'var(--surface-2)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginTop: '0.75rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.4rem' }}>
                Insufficient Baseline For Plotting
              </div>
              <p className="text-sm text-muted-600" style={{ lineHeight: 1.5 }}>
                At least 2 active morning wake-up records are needed to compute stability curves in the last {days} days.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Secondary Data Export Console */}
      <div className="mt-6">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div className="card-label mb-0"><span className="sys-label">Export Data Records</span></div>
          <span className="text-xs text-muted-600">All exports formatted for analytical processing</span>
        </div>

        <div className="export-grid">
          {REPORT_TYPES.map(r => (
            <Card key={r.type} className="p-4 export-card">
              <div className="title" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
                {r.title}
              </div>
              <p className="text-sm text-muted-600 mt-1" style={{ fontSize: '0.85rem', lineHeight: 1.45 }}>
                {r.desc}
              </p>
              <div className="export-actions">
                {Object.entries(FORMATS).map(([key, fmt]) => (
                  <button
                    key={key}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    onClick={() => download(r.type, key)}
                    disabled={downloading === `${r.type}:${key}`}
                  >
                    <DownloadIcon size={14} /> {downloading === `${r.type}:${key}` ? 'Exporting…' : fmt.label}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}