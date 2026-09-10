import React, { useEffect, useState } from 'react';
import { Card } from '../styles';
import { Line } from 'react-chartjs-2';
import { buildSeries, makeChartOptions } from '../utils/chartUtils';
import { CardSkeleton, ProgressBar, ErrorState, DownloadIcon, InfoIcon } from '../components/ui';

const FORMATS = {
  csv: { ext: 'csv', mime: 'text/csv', label: 'CSV' },
  pdf: { ext: 'pdf', mime: 'application/pdf', label: 'PDF' },
  excel: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel' },
};

const METRICS = [
  { key: 'wake_up_consistency', label: 'Wake-up Consistency', tone: 'brand' },
  { key: 'challenge_completion', label: 'Challenge Completion', tone: 'success' },
  { key: 'snooze_reduction', label: 'Snooze Reduction', tone: 'warm' },
  { key: 'sleep_schedule_adherence', label: 'Sleep Schedule Adherence', tone: 'cyan' },
];

const REPORT_TYPES = [
  { type: 'habits', title: 'Habit Report', desc: 'Weighted habit score summary.' },
  { type: 'wake-up', title: 'Wake-up Report', desc: 'Wake-up behavior data for analysis.' },
  { type: 'challenges', title: 'Challenge Report', desc: 'Cognitive challenge performance data.' },
];

export default function Reports() {
  const [reportData, setReportData] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

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

    fetch('/api/v1/habits/score/history?days=7', { headers })
      .then(res => (res.ok ? res.json() : []))
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  if (!reportData) {
    if (error) {
      return (
        <div className="page">
          <div className="page-header">
            <div>
              <h1>Reports</h1>
              <div className="subtitle">Download your habit data & progress summaries</div>
            </div>
          </div>
          <ErrorState description={error} />
        </div>
      );
    }
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Loading…</h1>
            <div className="subtitle" role="status">Loading report data…</div>
          </div>
        </div>
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
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <div className="subtitle">Your habit data, interpreted and exportable</div>
        </div>
      </div>

      {error && <div className="banner banner-warning">{error}</div>}

      <div className="reports-grid">
        <Card>
          <div className="card-label mb-2">Habit Score Summary</div>
          <div className="score-hero__value mb-2">
            <span className="num">{reportData.overall_score}</span>
            <span className="denom">/100</span>
          </div>
          <div className="report-metrics">
            {METRICS.map(m => (
              <div key={m.key} className="report-metric">
                <div className="report-metric__head">
                  <span className="report-metric__label">{m.label}</span>
                  <span className="report-metric__value">{reportData[m.key]}/100</span>
                </div>
                <ProgressBar value={reportData[m.key]} max={100} tone={m.tone} label={m.label} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="card-label mb-2">Weekly Trend</div>
          {trendHistory.length >= 2 ? (
            <>
              <div className="chart-card chart-card--sm">
                <Line data={trendData} options={chartOpts} />
              </div>
              <div className="chart-note">
                <InfoIcon size={14} />
                Available data: {trendHistory.length} of 7 days.
              </div>
            </>
          ) : (
            <div className="trend-empty">
              <p className="text-sm text-muted-600" style={{ lineHeight: 1.5 }}>
                Not enough data yet.
              </p>
              <p className="text-sm text-muted-600" style={{ lineHeight: 1.5 }}>
                Continue using CerebroKognit to build your weekly trend.
              </p>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <div className="card-label mb-4">Export Options</div>
        <div className="export-grid">
          {REPORT_TYPES.map(r => (
            <Card key={r.type} className="p-4 export-card">
              <div className="title" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{r.title}</div>
              <p className="text-sm text-muted-600 mt-2">{r.desc}</p>
              <div className="export-actions">
                {Object.entries(FORMATS).map(([key, fmt]) => (
                  <button key={key} className="btn btn-ghost" onClick={() => download(r.type, key)}>
                    <DownloadIcon size={15} /> {fmt.label}
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