/**
 * Chart.js utility data and configuration for CerebroKognit dashboard.
 * Uses the midnight + aurora design palette.
 */

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
