// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
/**
 * Pure alarm-scheduling logic (no native imports).
 *
 * Converts backend alarms into a list of on-device notifications to schedule,
 * then applies that plan through an injectable notifier. Keeping this free of
 * `expo-notifications` means it is fully unit-testable.
 *
 * Contract:
 *   alarm = { id, title, alarm_type, next_trigger, is_enabled,
 *             challenge_type, difficulty, recurrence }
 *   notifier = {
 *     cancelAllAlarmNotifications(): Promise<number>,
 *     schedule(identifier, date, content): Promise<any>,
 *   }
 */

export const ALARM_IDENTIFIER_PREFIX = 'alarm-';

// How many future occurrences to pre-schedule per recurring alarm. The first
// occurrence is always the backend-authoritative `next_trigger`; extras keep a
// recurring alarm alive even if the app stays force-closed for a few days.
export const DEFAULT_WINDOW_DAYS = 7;
export const DEFAULT_MAX_PER_ALARM = 7;

export function alarmIdentifier(alarmId, index = 0) {
  return index === 0
    ? `${ALARM_IDENTIFIER_PREFIX}${alarmId}`
    : `${ALARM_IDENTIFIER_PREFIX}${alarmId}-${index}`;
}

export function isAlarmIdentifier(identifier) {
  return typeof identifier === 'string' && identifier.startsWith(ALARM_IDENTIFIER_PREFIX);
}

export function resolveTrigger(alarm) {
  if (!alarm || !alarm.next_trigger) return null;
  const date = new Date(alarm.next_trigger);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function shouldSchedule(alarm, now = new Date()) {
  if (!alarm || !alarm.is_enabled) return false;
  const date = resolveTrigger(alarm);
  if (!date) return false;
  return date.getTime() > now.getTime();
}

/** Add whole days while preserving local wall-clock time (DST-safe). */
export function addLocalDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Return up to `count` upcoming trigger Dates for an alarm.
 * The first is the authoritative backend `next_trigger`; recurring alarms then
 * roll forward one local calendar day at a time (Weekday/Weekend filtered).
 */
export function nextAlarmDates(alarm, count = 1) {
  const primary = resolveTrigger(alarm);
  if (!primary) return [];
  const dates = [primary];
  if (alarm.alarm_type === 'One-Time') return dates;

  let cursor = primary;
  // Guard against pathological loops.
  let guard = 0;
  while (dates.length < count && guard < 400) {
    guard += 1;
    cursor = addLocalDays(cursor, 1);
    const day = cursor.getDay(); // 0=Sun .. 6=Sat
    if (alarm.alarm_type === 'Weekday' && (day === 0 || day === 6)) continue;
    if (alarm.alarm_type === 'Weekend' && day !== 0 && day !== 6) continue;
    dates.push(cursor);
  }
  return dates;
}

export function buildAlarmContent(alarm) {
  const challengeType = alarm.challenge_type || 'cognitive';
  return {
    title: alarm.title || 'Wake up',
    body: `Solve the ${challengeType} challenge to dismiss this alarm.`,
    sound: 'default',
    data: {
      type: 'alarm',
      alarm_id: alarm.id,
      challenge_type: alarm.challenge_type || null,
      difficulty: alarm.difficulty || null,
      next_trigger: alarm.next_trigger || null,
    },
  };
}

/**
 * Build the full schedule plan for a set of alarms.
 * Returns [{ identifier, alarmId, date, content }] for every occurrence that is
 * enabled and still in the future.
 */
export function planAlarmSchedule(
  alarms,
  now = new Date(),
  { maxPerAlarm = DEFAULT_MAX_PER_ALARM } = {}
) {
  const plan = [];
  for (const alarm of alarms || []) {
    if (!shouldSchedule(alarm, now)) continue;
    const dates = nextAlarmDates(alarm, maxPerAlarm);
    const content = buildAlarmContent(alarm);
    dates.forEach((date, index) => {
      plan.push({
        identifier: alarmIdentifier(alarm.id, index),
        alarmId: alarm.id,
        date,
        content,
      });
    });
  }
  return plan;
}

/**
 * Apply the schedule plan via a notifier: cancel every previously-scheduled
 * alarm notification, then schedule the fresh plan. Never throws; returns a
 * structured summary.
 */
export async function applyAlarmSchedule(
  alarms,
  notifier,
  now = new Date(),
  options = {}
) {
  const plan = planAlarmSchedule(alarms, now, options);
  const summary = {
    planned: plan.length,
    scheduled: 0,
    failed: 0,
    cancelled: 0,
    errors: [],
  };

  try {
    const cancelled = await notifier.cancelAllAlarmNotifications();
    summary.cancelled = typeof cancelled === 'number' ? cancelled : 0;
  } catch (e) {
    summary.errors.push(`cancel: ${e && e.message ? e.message : e}`);
  }

  for (const item of plan) {
    try {
      await notifier.schedule(item.identifier, item.date, item.content);
      summary.scheduled += 1;
    } catch (e) {
      summary.failed += 1;
      summary.errors.push(`schedule ${item.identifier}: ${e && e.message ? e.message : e}`);
    }
  }
  return summary;
}

export default {
  ALARM_IDENTIFIER_PREFIX,
  alarmIdentifier,
  isAlarmIdentifier,
  resolveTrigger,
  shouldSchedule,
  addLocalDays,
  nextAlarmDates,
  buildAlarmContent,
  planAlarmSchedule,
  applyAlarmSchedule,
};
