// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import {
  DEFAULT_TIME_FORMAT,
  TIME_FORMAT_KEY,
  getTimeFormat,
  setTimeFormat,
  subscribeTimeFormat,
  hour12,
  getUserTimeZone,
  formatTimeOfDay,
  formatDateTime,
  formatDate,
  formatWeekday,
} from './timeFormat';

describe('time format store', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('defaults to 12-hour when unset', () => {
    expect(getTimeFormat()).toBe(DEFAULT_TIME_FORMAT);
    expect(hour12()).toBe(true);
  });

  it('persists changes and broadcasts to subscribers', () => {
    const seen = [];
    const unsub = subscribeTimeFormat(f => seen.push(f));
    setTimeFormat('24');
    expect(getTimeFormat()).toBe('24');
    expect(hour12()).toBe(false);
    expect(localStorage.getItem(TIME_FORMAT_KEY)).toBe('24');
    setTimeFormat('12');
    expect(getTimeFormat()).toBe('12');
    expect(seen).toEqual(['24', '12']);
    unsub();
  });

  it('falls back to UTC when no user is stored', () => {
    expect(getUserTimeZone()).toBe('UTC');
  });
});

describe('format helpers', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('formats a wall-clock HH:MM per the 12/24 preference', () => {
    localStorage.setItem(TIME_FORMAT_KEY, '24');
    expect(formatTimeOfDay('07:00')).toBe('07:00');
    expect(formatTimeOfDay('19:30')).toBe('19:30');

    localStorage.setItem(TIME_FORMAT_KEY, '12');
    expect(formatTimeOfDay('07:00')).toMatch(/07:00 AM/);
    expect(formatTimeOfDay('19:30')).toMatch(/07:30 PM/);
    expect(formatTimeOfDay('00:05')).toMatch(/12:05 AM/);
  });

  it('formats ISO datetimes in the stored timezone', () => {
    localStorage.setItem('user', JSON.stringify({ timezone: 'Asia/Kolkata' }));
    const iso = '2026-09-08T10:00:00.000Z'; // 15:30 IST

    localStorage.setItem(TIME_FORMAT_KEY, '24');
    expect(formatDateTime(iso)).toContain('15:30');
    expect(formatDateTime(iso, { withSeconds: true })).toContain('15:30:00');

    localStorage.setItem(TIME_FORMAT_KEY, '12');
    expect(formatDateTime(iso)).toMatch(/03:30\s*(pm|PM)/i);

    expect(formatDate(iso)).toContain('2026');
    expect(formatWeekday(iso)).toMatch(/Tue/);
  });

  it('keeps fallbacks for malformed input', () => {
    expect(formatTimeOfDay('')).toBe('-');
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });
});