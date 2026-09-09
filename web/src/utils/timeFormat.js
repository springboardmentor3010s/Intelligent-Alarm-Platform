/**
 * Global time-format + timezone state for the web app.
 *
 * `ck-time-format` ('12' | '24') is the single source for how the whole site
 * renders times, mirroring the theme store: any control can read it, change it
 * (persists + broadcasts), and pages re-render on change. The user's timezone
 * comes from `localStorage['user'].timezone` (written at login and kept in
 * sync by the Profile page).
 */

export const TIME_FORMAT_KEY = 'ck-time-format';
export const TIME_FORMAT_EVENT = 'ck-time-format-changed';
export const DEFAULT_TIME_FORMAT = '12';

export function getTimeFormat() {
  try {
    return localStorage.getItem(TIME_FORMAT_KEY) === '24' ? '24' : '12';
  } catch {
    return DEFAULT_TIME_FORMAT;
  }
}

export function setTimeFormat(fmt) {
  const next = fmt === '24' ? '24' : '12';
  localStorage.setItem(TIME_FORMAT_KEY, next);
  window.dispatchEvent(new CustomEvent(TIME_FORMAT_EVENT, { detail: { timeFormat: next } }));
  return next;
}

export function subscribeTimeFormat(listener) {
  const onChange = event => {
    const next = event.detail?.timeFormat ?? (event.type === 'storage' ? event.newValue : null);
    if (next === '12' || next === '24') listener(next);
  };
  window.addEventListener(TIME_FORMAT_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(TIME_FORMAT_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function hour12() {
  return getTimeFormat() === '12';
}

export function getUserTimeZone() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.timezone) return user.timezone;
  } catch {
    /* unparsable user blob — fall through */
  }
  return 'UTC';
}

/**
 * Format an ISO date-time in the user's timezone, honoring the global 12/24
 * preference. `withSeconds` includes seconds (used by the live clock).
 */
export function formatDateTime(iso, { withSeconds = false } = {}) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || '—';
  const opts = {
    timeZone: getUserTimeZone(),
    hour: '2-digit',
    minute: '2-digit',
    hour12: hour12(),
  };
  if (withSeconds) opts.second = '2-digit';
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

/** Date-only (weekday + date), tz-aware. Unaffected by the 12/24 preference. */
export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || '—';
  return new Intl.DateTimeFormat(undefined, {
    timeZone: getUserTimeZone(),
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** Weekday-only label for a date, tz-aware. */
export function formatWeekday(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Scheduled';
  return new Intl.DateTimeFormat(undefined, {
    timeZone: getUserTimeZone(),
    weekday: 'short',
  }).format(d);
}

/**
 * Format a wall-clock "HH:MM" string (e.g. an alarm time) in the user's 12/24
 * preference without shifting it across timezones, e.g. "07:00" -> "07:00 AM".
 */
export function formatTimeOfDay(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm)) return hhmm || '—';
  const [h, m] = hhmm.split(':').map(Number);
  const safeH = Number.isFinite(h) ? h % 24 : 0;
  const safeM = Number.isFinite(m) ? m % 60 : 0;
  const date = new Date(Date.UTC(2000, 0, 1, safeH, safeM, 0));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: hour12(),
  }).format(date);
}

/** Parse a wall-clock "HH:MM" string into { hour, minute }. */
export function parseTimeOfDay(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Serialize a 24h { hour, minute } back to "HH:MM". */
export function toTimeInputValue({ hour, minute }) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}