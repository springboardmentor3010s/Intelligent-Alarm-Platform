import React, { useEffect, useState } from 'react';
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
  BarChartIcon,
  FileTextIcon,
  ClockIcon,
  BrainIcon,
} from '../components/ui';
import { apiFetch } from '../utils/api';
import { formatDateTime } from '../utils/timeFormat';

const FORMATS = {
  csv: { ext: 'csv', mime: 'text/csv', label: 'CSV' },
  pdf: { ext: 'pdf', mime: 'application/pdf', label: 'PDF' },
  excel: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel' },
};

const METRICS = [
  { key: 'wake_up_consistency', label: 'Wake-up Consistency', weight: '35%', tone: 'brand' },
  { key: 'challenge_completion', label: 'Challenge Completion', weight: '25%', tone: 'mint' },
  { key: 'snooze_reduction', label: 'Snooze Reduction', weight: '20%', tone: 'warm' },
  { key: 'sleep_schedule_adherence', label: 'Sleep Adherence', weight: '20%', tone: 'mint' },
];

const REPORT_TYPES = [
  {
    type: 'habits',
    area: 'exp-habits',
    short: 'Habit Performance',
    icon: FileTextIcon,
    title: 'Daily Habit Performance Report',
    desc: 'Weighted 35/25/20/20 composite scoring history, wake times, and daily circadian index.',
  },
  {
    type: 'wake-up',
    area: 'exp-wake',
    short: 'Wake-up Telemetry',
    icon: ClockIcon,
    title: 'Wake-up & Snooze Telemetry',
    desc: 'Event-by-event dismissal log, snooze latency metrics, and scheduled trigger comparisons.',
  },
  {
    type: 'challenges',
    area: 'exp-challenges',
    short: 'Challenge Log',
    icon: BrainIcon,
    title: 'Cognitive Puzzle Challenge Report',
    desc: 'Per-attempt question accuracy, response times, difficulty ratings, and category performance.',
  },
  {
    type: 'productivity',
    area: 'exp-productivity',
    short: 'Productivity Log',
    icon: FileTextIcon,
    title: 'Self-Logged Productivity Report',
    desc: 'User-entered daily productivity scores only — exported when real logs exist, never estimated.',
  },
];

const RANGE_OPTIONS = [7, 14, 30];

export default function Reports() {
  const [reportData, setReportData] = useState(null);
  const [history, setHistory] = useState([]);
  const [wakeEvents, setWakeEvents] = useState(null);
  const [prodHistory, setProdHistory] = useState([]);
  const [prodTrend, setProdTrend] = useState(null);
  const [prodCorr, setProdCorr] = useState(null);
  const [logScore, setLogScore] = useState('');
  const [logNote, setLogNote] = useState('');
  const [logState, setLogState] = useState('idle');
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    apiFetch('/api/v1/habits/score')
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

    apiFetch(`/api/v1/habits/score/history?days=${days}`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(console.error);

    apiFetch(`/api/v1/dashboard/reports/wake-up?format=json&days=${days}`)
      .then(res => (res.ok ? res.json() : null))
      .then(body => setWakeEvents(Array.isArray(body?.data) ? body.data : []))
      .catch(() => setWakeEvents([]));

    apiFetch(`/api/v1/productivity/history?days=${days}`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => setProdHistory(Array.isArray(data) ? data : []))
      .catch(() => setProdHistory([]));

    apiFetch('/api/v1/productivity/trend?days=14')
      .then(res => (res.ok ? res.json() : null))
      .then(setProdTrend)
      .catch(() => setProdTrend(null));

    apiFetch('/api/v1/productivity/correlation?days=30')
      .then(res => (res.ok ? res.json() : null))
      .then(setProdCorr)
      .catch(() => setProdCorr(null));
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
  const prodTrendData = buildSeries([...prodHistory].reverse(), { dataKey: 'score', label: 'Productivity (user-entered)' });
  const chartOpts = makeChartOptions();

  const submitLog = async (e) => {
    e.preventDefault();
    const score = Number(logScore);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setError('Productivity score must be a number from 0 to 100.');
      return;
    }
    setError(null);
    setLogState('saving');
    try {
      const res = await apiFetch('/api/v1/productivity/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: Math.round(score), note: logNote.trim() || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved = await res.json();
      setProdHistory(prev => [saved, ...prev.filter(p => p.date !== saved.date)]);
      setLogScore('');
      setLogNote('');
      setLogState('saved');
      apiFetch('/api/v1/productivity/trend?days=14')
        .then(r => (r.ok ? r.json() : null)).then(setProdTrend).catch(() => {});
      apiFetch('/api/v1/productivity/correlation?days=30')
        .then(r => (r.ok ? r.json() : null)).then(setProdCorr).catch(() => {});
    } catch (err) {
      console.error(err);
      setError('Could not save the productivity log. Please try again.');
      setLogState('idle');
    }
  };

  const download = async (_type, formatKey) => {
    setError(null);
    setDownloading(`${_type}:${formatKey}`);
    const fmt = FORMATS[formatKey];
    try {
      // Exports honor the selected range so files match the on-screen data.
      const res = await apiFetch(`/api/v1/dashboard/reports/${_type}?format=${formatKey}&days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${_type}-report-${days}d.${fmt.ext}`;
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

      {/* Reports command bento */}
      <div className="reports-bento">
        {/* Score hero */}
        <section className="bento bento--score">
          <div className="bento__head">
            <BarChartIcon size={14} />
            <span>Score Breakdown</span>
            <span className="bento__chip">Composite Analysis</span>
          </div>

          <div className="rp-score">
            <span className="rp-score__num">{reportData.overall_score}</span>
            <span className="rp-score__denom">/100</span>
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
        </section>

        {/* Circadian trajectory rail */}
        <section className="bento bento--trajectory">
          <div className="bento__head bento__head--spread">
            <ActivityIcon size={14} />
            <span>Circadian Trajectory</span>
            <div className="bento__head-actions">
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
            <div className="rp-baseline">
              <div className="rp-baseline__title">Insufficient Baseline For Plotting</div>
              <p className="text-sm text-muted-600">
                At least 2 active morning wake-up records are needed to compute stability curves in the last {days} days.
              </p>
            </div>
          )}
        </section>

        {/* Alarm history timeline (same source as the wake-up export) */}
        <section className="bento bento--timeline">
          <div className="bento__head bento__head--spread">
            <span>
              <ClockIcon size={14} />
              <span style={{ marginLeft: '0.4rem' }}>Wake-up Timeline</span>
            </span>
            <Badge tone={wakeEvents && wakeEvents.length > 0 ? 'success' : 'subtle'}>
              {wakeEvents === null ? 'Loading' : `${wakeEvents.length} events / ${days}d`}
            </Badge>
          </div>

          {wakeEvents === null ? (
            <p className="text-sm text-muted-600">Loading alarm history…</p>
          ) : wakeEvents.length === 0 ? (
            <div className="rp-baseline">
              <div className="rp-baseline__title">No Wake-up Events In Range</div>
              <p className="text-sm text-muted-600">
                No alarms triggered in the last {days} days. Create an alarm to start building history.
              </p>
            </div>
          ) : (
            <ul className="timeline">
              {wakeEvents.map(ev => (
                <li key={ev.alarm_id} className="timeline__row">
                  <span className={`led ${ev.was_enabled ? 'led--on' : ''}`} aria-hidden="true" />
                  <div className="timeline__body">
                    <div className="timeline__title">{ev.title || 'Alarm'}</div>
                    <div className="timeline__meta text-xs text-muted-600">
                      {ev.next_trigger ? formatDateTime(ev.next_trigger) : '-'}
                      {' · '}{ev.alarm_type || 'One-Time'}
                      {' · '}{ev.times_snoozed === 0 ? 'no snoozes' : `${ev.times_snoozed} snooze${ev.times_snoozed === 1 ? '' : 's'}`}
                    </div>
                  </div>
                  <Badge tone={ev.was_enabled ? 'success' : 'subtle'}>
                    {ev.was_enabled ? 'Active' : 'Dismissed'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Productivity: manual user-entered tracking + inferred correlation */}
        <section className="bento bento--productivity">
          <div className="bento__head bento__head--spread">
            <span>
              <FileTextIcon size={14} />
              <span style={{ marginLeft: '0.4rem' }}>Productivity</span>
            </span>
            <Badge tone="subtle">user-entered data</Badge>
          </div>

          <p className="text-sm text-muted-600" style={{ lineHeight: 1.55 }}>
            The app cannot measure productivity — these scores are typed in by you.
            The trend below plots your own logs; the wake-up association is computed
            (inferred) and appears only with enough paired days.
          </p>

          <form onSubmit={submitLog} className="prod-log__form" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
            <label className="text-xs text-muted-600" htmlFor="prod-score">
              Today&apos;s score (0-100)
            </label>
            <input
              id="prod-score"
              className="form-input"
              type="number"
              min="0"
              max="100"
              value={logScore}
              onChange={e => setLogScore(e.target.value)}
              placeholder="e.g. 75"
              aria-label="Today's productivity score 0 to 100"
              style={{ maxWidth: '140px' }}
            />
            <input
              className="form-input"
              type="text"
              value={logNote}
              onChange={e => setLogNote(e.target.value)}
              placeholder="Note (optional)"
              aria-label="Productivity note"
              maxLength={500}
              style={{ flex: '1 1 160px' }}
            />
            <button type="submit" className="btn btn-primary" disabled={logState === 'saving'}>
              {logState === 'saving' ? 'Saving…' : 'Log today'}
            </button>
          </form>
          {logState === 'saved' && (
            <div className="chart-note" role="status" style={{ marginTop: '0.6rem' }}>
              <InfoIcon size={14} /> Saved today&apos;s user-entered score.
            </div>
          )}

          {prodHistory.length >= 2 ? (
            <>
              <div className="chart-card chart-card--sm" style={{ marginTop: '0.8rem' }}>
                <Line data={prodTrendData} options={chartOpts} />
              </div>
              <div className="chart-note">
                <InfoIcon size={14} />
                {prodTrend?.available
                  ? `Your logged trend is ${prodTrend.trend} (user-entered, ${prodHistory.length} logged days).`
                  : `Tracking ${prodHistory.length} logged days.`}
              </div>
            </>
          ) : (
            <div className="rp-baseline" style={{ marginTop: '0.8rem' }}>
              <div className="rp-baseline__title">No Productivity Trend Yet</div>
              <p className="text-sm text-muted-600">
                Log at least 2 days above — the trend plots only days you entered.
              </p>
            </div>
          )}

          <div className="chart-note" style={{ marginTop: '0.6rem' }} role="status">
            <InfoIcon size={14} />
            {prodCorr?.available ? (
              <span>
                <Badge tone="subtle">inferred</Badge>{' '}
                {prodCorr.message}
              </span>
            ) : (
              <span>Wake-up/productivity association unavailable: {prodCorr?.reason || 'log daily scores first.'}</span>
            )}
          </div>
        </section>

        {/* Export tiles */}
        {REPORT_TYPES.map(r => {
          const Icon = r.icon;
          return (
            <section key={r.type} className={`bento bento--export bento--${r.area}`}>
              <div className="bento__head">
                <Icon size={14} />
                <span>{r.short}</span>
                <span className="bento__chip">CSV &middot; PDF &middot; Excel</span>
              </div>

              <div className="rp-exp__title">{r.title}</div>
              <p className="rp-exp__desc">{r.desc}</p>

              <div className="export-actions">
                {Object.entries(FORMATS).map(([key, fmt]) => (
                  <button
                    key={key}
                    className="btn btn-secondary"
                    onClick={() => download(r.type, key)}
                    disabled={downloading === `${r.type}:${key}`}
                  >
                    <DownloadIcon size={14} /> {downloading === `${r.type}:${key}` ? 'Exporting…' : fmt.label}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}