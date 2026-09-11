/**
 * Chart.js utility data and configuration for CerebroKognit.
 * Charts are honest: they render exactly the data points the API returns —
 * nothing is padded or fabricated for visual completeness.
 */

const chartConfigs = {
  wakeUp: { label: 'Wake-up Consistency (%)', border: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', dataKey: 'wake_up_consistency' },
  challenge: { label: 'Challenge Completion (%)', border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', dataKey: 'challenge_completion' },
  snooze: { label: 'Snooze Reduction (%)', border: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', dataKey: 'snooze_reduction' },
  sleep: { label: 'Sleep Schedule Adherence (%)', border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', dataKey: 'sleep_schedule_adherence' },
};

function dayLabel(date) {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, { weekday: 'short' });
}

function makeDataset(cfg, data, labels) {
  return {
    label: cfg.label,
    data,
    labels,
    borderColor: cfg.border,
    backgroundColor: cfg.bg,
    pointBackgroundColor: cfg.border,
    pointBorderColor: cfg.border,
    pointRadius: 0,
    pointHoverRadius: 5,
    borderWidth: 2,
    tension: 0.35,
    fill: true,
  };
}

/**
 * Build a single honest line-series from a `/habits/score/history` payload.
 * @param {Array} history entries with an ISO `date` and the metric key
 * @param {{dataKey: string, label?: string, border?: string, bg?: string}} cfgOrKey
 */
export function buildSeries(history = [], cfgOrKey = {}) {
  const cfg = typeof cfgOrKey === 'string'
    ? chartConfigs[cfgOrKey] || { dataKey: cfgOrKey, label: cfgOrKey }
    : { ...{ dataKey: 'overall_score', label: 'Overall Score (%)' }, ...cfgOrKey };
  const labels = history.map(h => dayLabel(h.date));
  return {
    labels,
    datasets: [makeDataset(cfg, history.map(h => h[cfg.dataKey]), labels)],
  };
}

/**
 * Build all four sub-metric line-chart datasets from a history payload.
 * Returns the same stable key set: wakeUp, challenge, snooze, sleep.
 */
export function buildHabitCharts(history = []) {
  return Object.fromEntries(
    Object.entries(chartConfigs).map(([key, cfg]) => [
      key,
      buildSeries(history, cfg),
    ])
  );
}

/**
 * Theme-aware options, resolved at render time from the active CSS tokens so
 * tooltips/grids follow dark and light mode without a module-level rebuild.
 */
export function makeChartOptions() {
  const cs = typeof document !== 'undefined'
    ? getComputedStyle(document.documentElement)
    : null;
  const theme = (v, fallback) => (cs ? (cs.getPropertyValue(v).trim() || fallback) : fallback);
  const text = theme('--text', '#f2efe7');
  const muted = theme('--text-muted', '#a8b89d');
  const faint = theme('--text-faint', '#8c9d80');
  const surface = theme('--surface-2', '#1e6b1a');
  const border = theme('--border', 'rgba(158,178,133,0.14)');

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: surface,
        titleColor: text,
        bodyColor: muted,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        borderColor: border,
        borderWidth: 1,
        titleFont: { size: 12, weight: 600 },
        bodyFont: { size: 12 },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: { color: faint, font: { size: 10 }, stepSize: 25 },
        grid: { color: border },
        border: { display: false },
      },
      x: {
        ticks: { color: faint, font: { size: 10 }, maxRotation: 0 },
        grid: { display: false },
        border: { display: false },
      },
    },
  };
}

/**
 * Static baseline kept as the documented contract (0-100 clamp); pages render
 * through makeChartOptions() so charts track the active theme.
 */
export const chartOptions = {
  responsive: true,
  plugins: {
    legend: { display: false },
    title: { display: false },
  },
  scales: {
    y: { min: 0, max: 100, grid: { color: 'rgba(62, 124, 23, 0.1)' } },
    x: { grid: { display: false } },
  },
};