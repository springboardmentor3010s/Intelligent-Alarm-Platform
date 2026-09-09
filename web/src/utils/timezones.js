/**
 * Full IANA timezone catalog for the web app.
 *
 * Prefers `Intl.supportedValuesOf('timeZone')` (~400 zones) and falls back to a
 * curated list on runtimes that don't expose it. Every option is labelled with
 * its current GMT offset so a user can pick correctly, and sorted by offset so
 * geographically-related zones group together.
 */

export const FALLBACK_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export function allTimeZones() {
  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    try {
      const zones = Intl.supportedValuesOf('timeZone');
      if (Array.isArray(zones) && zones.length) {
        // Some ICU builds omit UTC and use legacy names (e.g., Asia/Calcutta instead of Asia/Kolkata)
        const guaranteed = ['UTC', 'Asia/Kolkata'];
        const extra = guaranteed.filter(g => !zones.includes(g));
        return [...extra, ...zones];
      }
    } catch {
      /* older runtime without the API */
    }
  }
  return FALLBACK_TIMEZONES;
}

/** GMT offset label for a zone at a given instant, e.g. "GMT+05:30". */
export function zoneOffsetLabel(zone, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'longOffset',
    }).formatToParts(at);
    const tz = parts.find(p => p.type === 'timeZoneName');
    return (tz && tz.value) || '';
  } catch {
    return '';
  }
}

/** Numeric offset in minutes so options sort by actual GMT offset. */
export function zoneOffsetMinutes(zone, at = new Date()) {
  const m = String(zoneOffsetLabel(zone, at)).match(/[+-]\d{2}:\d{2}/);
  if (!m) return 0;
  const sign = m[0][0] === '-' ? -1 : 1;
  const [h, min] = m[0].slice(1).split(':').map(Number);
  return sign * (h * 60 + min);
}

export function buildTimeZoneOptions() {
  return allTimeZones()
    .map(zone => ({
      value: zone,
      label: `${zone} (${zoneOffsetLabel(zone)})`,
      offset: zoneOffsetMinutes(zone),
    }))
    .sort((a, b) => a.offset - b.offset || a.value.localeCompare(b.value));
}