// Pure helpers for deciding when an alarm should ring. No browser APIs here,
// so the logic can be tested on its own.

export const SNOOZE_MS = 5 * 60 * 1000;
// An alarm is still rung if the app notices it up to 30 minutes late
// (for example after a browser tab was frozen), but not after that.
export const LATE_WINDOW_MS = 30 * 60 * 1000;

export function triggerKey(alarm) {
  return `${alarm.id}|${alarm.next_trigger}`;
}

/**
 * Returns what should ring now, or null.
 *   alarms:  enabled alarms with a next_trigger ISO time
 *   snoozed: [{ alarm, at }] re-rings after a snooze (at = ms timestamp)
 *   fired:   { [key]: timestamp } triggers that already rang
 */
export function findDue(alarms, snoozed, fired, now) {
  const resume = snoozed.find((item) => item.at <= now);
  if (resume) return { alarm: resume.alarm, key: null, snoozeItem: resume };

  for (const alarm of alarms) {
    if (!alarm.next_trigger) continue;
    const at = new Date(alarm.next_trigger).getTime();
    if (Number.isNaN(at)) continue;
    const key = triggerKey(alarm);
    if (at <= now && now - at < LATE_WINDOW_MS && !fired[key]) {
      return { alarm, key, snoozeItem: null };
    }
  }
  return null;
}
