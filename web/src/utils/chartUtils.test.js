// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
/* eslint-env jest */
import { describe, it, expect } from 'vitest';
import { buildHabitCharts, chartOptions } from './chartUtils';

const entry = (date, values) => ({ date, ...values });

describe('buildHabitCharts', () => {
  it('builds all four configured series with aligned labels', () => {
    const history = [
      entry('2026-09-05', {
        wake_up_consistency: 80,
        challenge_completion: 60,
        snooze_reduction: 40,
        sleep_schedule_adherence: 70,
      }),
      entry('2026-09-06', {
        wake_up_consistency: 90,
        challenge_completion: 70,
        snooze_reduction: 50,
        sleep_schedule_adherence: 80,
      }),
    ];

    const charts = buildHabitCharts(history);

    expect(Object.keys(charts)).toEqual(['wakeUp', 'challenge', 'snooze', 'sleep']);

    for (const [key, expected] of [
      ['wakeUp', [80, 90]],
      ['challenge', [60, 70]],
      ['snooze', [40, 50]],
      ['sleep', [70, 80]],
    ]) {
      const chart = charts[key];
      expect(chart.labels).toHaveLength(2);
      expect(chart.datasets).toHaveLength(1);
      expect(chart.datasets[0].data).toEqual(expected);
    }
  });

  it('labels use short weekday names for valid dates', () => {
    const charts = buildHabitCharts([
      entry('2026-09-06', { wake_up_consistency: 50 }),
    ]);
    const label = charts.wakeUp.labels[0];
    expect(label).toBe('Sun');
  });

  it('falls back to the raw date for invalid dates', () => {
    const charts = buildHabitCharts([
      entry('not-a-date', { wake_up_consistency: 50 }),
    ]);
    expect(charts.wakeUp.labels[0]).toBe('not-a-date');
  });

  it('returns empty series for empty history', () => {
    const charts = buildHabitCharts([]);
    expect(charts.wakeUp.labels).toEqual([]);
    expect(charts.wakeUp.datasets[0].data).toEqual([]);
  });

  it('plots newest-first history oldest to newest so the x-axis runs forward', () => {
    const charts = buildHabitCharts([
      entry('2026-09-06', { wake_up_consistency: 90 }),
      entry('2026-09-05', { wake_up_consistency: 80 }),
    ]);
    expect(charts.wakeUp.datasets[0].data).toEqual([80, 90]);
    expect(charts.wakeUp.labels).toEqual(['Sat', 'Sun']);
  });
});

describe('chartOptions', () => {
  it('clamps the y-axis to the 0-100 percentage range', () => {
    expect(chartOptions.scales.y.min).toBe(0);
    expect(chartOptions.scales.y.max).toBe(100);
  });
});