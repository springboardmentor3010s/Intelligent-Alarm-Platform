import { describe, it, expect } from 'vitest';
import {
  allTimeZones,
  buildTimeZoneOptions,
  zoneOffsetLabel,
  zoneOffsetMinutes,
} from './timezones';

describe('timezone catalog', () => {
  it('exposes the full set including the fallbacks', () => {
    const zones = allTimeZones();
    expect(zones.length).toBeGreaterThanOrEqual(12);
    for (const z of ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London']) {
      expect(zones).toContain(z);
    }
  });

  it('builds offset-labelled options sorted by actual GMT offset', () => {
    const opts = buildTimeZoneOptions();
    expect(opts.length).toBeGreaterThanOrEqual(12);

    const utc = opts.find(o => o.value === 'UTC');
    expect(utc).toBeTruthy();
    expect(utc.label).toContain('UTC');

    for (const o of opts) {
      expect(o.label).toMatch(/\(GMT/);
      expect(typeof o.offset).toBe('number');
    }

    const offsets = opts.map(o => o.offset);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });

  it('computes offsets correctly for known zones', () => {
    expect(zoneOffsetLabel('Asia/Kolkata')).toMatch(/GMT\+05:30/);
    expect(zoneOffsetMinutes('Asia/Kolkata')).toBe(330);
    expect(zoneOffsetMinutes('UTC')).toBe(0);
  });
});