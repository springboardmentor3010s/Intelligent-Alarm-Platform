/**
 * Chart.js utility data and configuration for CerebroKognit dashboard.
 * Uses the midnight + aurora design palette.
 */

const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const series = [
  {
    name: 'wakeUp',
    label: 'Wake-up Consistency (%)',
    data: [65, 70, 75, 72, 80, 78, 85],
    border: '#7c8cff',
    bg: 'rgba(124, 140, 255, 0.15)',
  },
  {
    name: 'challenge',
    label: 'Challenge Completion (%)',
    data: [50, 60, 55, 70, 65, 75, 80],
    border: '#5ce1a8',
    bg: 'rgba(92, 225, 168, 0.15)',
  },
  {
    name: 'snooze',
    label: 'Snooze Reduction (%)',
    data: [30, 40, 45, 50, 55, 60, 70],
    border: '#ffd579',
    bg: 'rgba(255, 213, 121, 0.15)',
  },
  {
    name: 'sleep',
    label: 'Sleep Schedule Adherence (%)',
    data: [60, 65, 70, 68, 75, 80, 82],
    border: '#6ee7e0',
    bg: 'rgba(110, 231, 224, 0.15)',
  },
];

export const habitsChartData = Object.fromEntries(
  series.map((s) => [
    s.name,
    {
      labels,
      datasets: [
        {
          label: s.label,
          data: s.data,
          borderColor: s.border,
          backgroundColor: s.bg,
          tension: 0.4,
          fill: true,
        },
      ],
    },
  ])
);

const chartConfigs = {
  wakeUp: { label: 'Wake-up Consistency (%)', border: '#7c8cff', bg: 'rgba(124, 140, 255, 0.15)' },
  challenge: { label: 'Challenge Completion (%)', border: '#5ce1a8', bg: 'rgba(92, 225, 168, 0.15)' },
  snooze: { label: 'Snooze Reduction (%)', border: '#ffd579', bg: 'rgba(255, 213, 121, 0.15)' },
  sleep: { label: 'Sleep Schedule Adherence (%)', border: '#6ee7e0', bg: 'rgba(110, 231, 224, 0.15)' },
};

/**
 * Build line-chart datasets from a `/habits/score/history` payload.
 * history entries conform to HabitScoreRes with an ISO `date` field.
 */
export function buildHabitCharts(history = []) {
  const dayLabels = history.map((h) => {
    const d = new Date(h.date);
    return Number.isNaN(d.getTime()) ? h.date : d.toLocaleDateString(undefined, { weekday: 'short' });
  });

  return Object.fromEntries(
    Object.entries(chartConfigs).map(([key, cfg]) => [
      key,
      {
        labels: dayLabels,
        datasets: [
          {
            label: cfg.label,
            data: history.map((h) => h[key]),
            borderColor: cfg.border,
            backgroundColor: cfg.bg,
            tension: 0.4,
            fill: true,
          },
        ],
      },
    ])
  );
}

export const chartOptions = {
  responsive: true,
  plugins: {
    legend: { display: false },
    title: { display: false },
  },
  scales: {
    y: { min: 0, max: 100, grid: { color: 'rgba(148, 163, 255, 0.08)' } },
    x: { grid: { display: false } },
  },
};
