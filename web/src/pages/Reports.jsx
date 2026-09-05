import React, { useEffect, useState } from 'react';
import { Card, Grid } from '../styles';

export default function Reports() {
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/v1/habits/score', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setReportData)
      .catch(err => {
        console.error(err);
        setError('Could not load report data.');
        setReportData({
          overall_score: '—',
          wake_up_consistency: '—',
          challenge_completion: '—',
          snooze_reduction: '—',
          sleep_schedule_adherence: '—',
        });
      });
  }, []);

  if (!reportData) return <div className="page">Loading report data…</div>;

  const download = (type) => {
    const token = localStorage.getItem('token');
    const endpoint = `/api/v1/dashboard/reports/${type}`;
    fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(text => {
        const blob = new Blob([text], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-report.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(err => setError(`Export failed: ${err.message}`));
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <div className="subtitle">Download your habit data & progress summaries</div>
        </div>
      </div>

      {error && <div className="banner banner-warning">⚠️ {error}</div>}

      <Grid>
        <Card className="p-4 span-2">
          <div className="card-label mb-2">Habit Score Summary</div>
          <div className="kv"><span className="k">Overall Score</span><span className="v">{reportData.overall_score}/100</span></div>
          <div className="kv"><span className="k">Wake-up Consistency</span><span className="v">{reportData.wake_up_consistency}/100</span></div>
          <div className="kv"><span className="k">Challenge Completion</span><span className="v">{reportData.challenge_completion}/100</span></div>
          <div className="kv"><span className="k">Snooze Reduction</span><span className="v">{reportData.snooze_reduction}/100</span></div>
          <div className="kv"><span className="k">Sleep Schedule Adherence</span><span className="v">{reportData.sleep_schedule_adherence}/100</span></div>
        </Card>

        <Card className="p-4">
          <div className="card-label mb-2">Weekly Trend</div>
          <p className="text-sm text-muted-600">
            Your 7-day habit trend is visualized on the Dashboard and Home pages.
          </p>
        </Card>
      </Grid>

      <div className="mt-6">
        <div className="card-label mb-4">Export Options</div>
        <Grid>
          <Card className="p-4">
            <div className="title" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Habit Report</div>
            <p className="text-sm text-muted-600 mt-2">Download your weighted habit score summary as CSV.</p>
            <button className="btn btn-ghost mt-4" onClick={() => download('habits')}>Download CSV</button>
          </Card>
          <Card className="p-4">
            <div className="title" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Wake-up Report</div>
            <p className="text-sm text-muted-600 mt-2">Export wake-up behavior data for analysis.</p>
            <button className="btn btn-ghost mt-4" onClick={() => download('wake-up')}>Download CSV</button>
          </Card>
          <Card className="p-4">
            <div className="title" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Challenge Report</div>
            <p className="text-sm text-muted-600 mt-2">Export cognitive challenge performance data.</p>
            <button className="btn btn-ghost mt-4" onClick={() => download('challenges')}>Download CSV</button>
          </Card>
        </Grid>
      </div>
    </div>
  );
}
