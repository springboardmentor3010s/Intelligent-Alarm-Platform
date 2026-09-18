import {
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
} from './scheduleAlarm';

const baseAlarm = (overrides = {}) => ({
  id: 7,
  title: 'Wake Up!',
  alarm_type: 'Daily',
  is_enabled: true,
  challenge_type: 'Math',
  difficulty: 'Easy',
  next_trigger: new Date(2026, 0, 5, 7, 0, 0).toISOString(), // Mon 07:00 local
  ...overrides,
});

describe('alarmIdentifier', () => {
  it('prefixes the alarm id', () => {
    expect(alarmIdentifier(7)).toBe('alarm-7');
    expect(alarmIdentifier(7, 2)).toBe('alarm-7-2');
  });

  it('recognises alarm identifiers only', () => {
    expect(isAlarmIdentifier('alarm-7')).toBe(true);
    expect(isAlarmIdentifier('daily-reminder')).toBe(false);
    expect(isAlarmIdentifier(null)).toBe(false);
  });

  it('exposes the prefix constant', () => {
    expect(ALARM_IDENTIFIER_PREFIX).toBe('alarm-');
  });
});

describe('resolveTrigger / shouldSchedule', () => {
  it('resolves a valid ISO trigger', () => {
    const date = resolveTrigger(baseAlarm());
    expect(date).toBeInstanceOf(Date);
    expect(date.getHours()).toBe(7);
  });

  it('returns null for missing or invalid triggers', () => {
    expect(resolveTrigger(baseAlarm({ next_trigger: null }))).toBeNull();
    expect(resolveTrigger(baseAlarm({ next_trigger: 'nonsense' }))).toBeNull();
  });

  it('schedules enabled future alarms', () => {
    const now = new Date(2026, 0, 5, 6, 0, 0);
    expect(shouldSchedule(baseAlarm(), now)).toBe(true);
  });

  it('skips disabled alarms', () => {
    const now = new Date(2026, 0, 5, 6, 0, 0);
    expect(shouldSchedule(baseAlarm({ is_enabled: false }), now)).toBe(false);
  });

  it('skips alarms whose trigger is in the past', () => {
    const now = new Date(2026, 0, 5, 8, 0, 0);
    expect(shouldSchedule(baseAlarm(), now)).toBe(false);
  });
});

describe('addLocalDays', () => {
  it('preserves local wall-clock time', () => {
    const start = new Date(2026, 0, 5, 7, 0, 0);
    const next = addLocalDays(start, 1);
    expect(next.getHours()).toBe(7);
    expect(next.getDate()).toBe(6);
  });
});

describe('nextAlarmDates', () => {
  it('returns a single occurrence for One-Time alarms', () => {
    expect(nextAlarmDates(baseAlarm({ alarm_type: 'One-Time' }), 5)).toHaveLength(1);
  });

  it('rolls daily alarms forward one day at a time', () => {
    const dates = nextAlarmDates(baseAlarm(), 3);
    expect(dates).toHaveLength(3);
    expect(dates[1].getDate()).toBe(6);
    expect(dates[2].getDate()).toBe(7);
  });

  it('skips weekends for Weekday alarms', () => {
    const friday = new Date(2026, 0, 9, 7, 0, 0); // Fri Jan 9 2026
    const dates = nextAlarmDates(baseAlarm({ alarm_type: 'Weekday', next_trigger: friday.toISOString() }), 2);
    // Monday Jan 12 after the weekend
    expect(dates[1].getDay()).toBe(1);
    expect(dates[1].getDate()).toBe(12);
  });
});

describe('buildAlarmContent', () => {
  it('carries the alarm pointer without leaking answers', () => {
    const content = buildAlarmContent(baseAlarm());
    expect(content.title).toBe('Wake Up!');
    expect(content.body).toContain('Math');
    expect(content.data).toMatchObject({
      type: 'alarm',
      alarm_id: 7,
      challenge_type: 'Math',
      difficulty: 'Easy',
    });
    expect(content.data.puzzle_payload).toBeUndefined();
  });
});

describe('planAlarmSchedule', () => {
  const now = new Date(2026, 0, 5, 6, 0, 0);

  it('plans only enabled future alarms', () => {
    const plan = planAlarmSchedule(
      [baseAlarm(), baseAlarm({ id: 8, is_enabled: false }), baseAlarm({ id: 9, next_trigger: new Date(2020, 0, 1).toISOString() })],
      now,
      { maxPerAlarm: 1 }
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].alarmId).toBe(7);
  });

  it('emits deterministic identifiers', () => {
    const plan = planAlarmSchedule([baseAlarm()], now, { maxPerAlarm: 2 });
    expect(plan.map((p) => p.identifier)).toEqual(['alarm-7', 'alarm-7-1']);
  });
});

describe('applyAlarmSchedule', () => {
  const now = new Date(2026, 0, 5, 6, 0, 0);

  const makeNotifier = () => ({
    cancelled: 0,
    scheduled: [],
    cancelAllAlarmNotifications: jest.fn(async function () {
      this.cancelled += 1;
      return 2;
    }),
    schedule: jest.fn(async function (identifier, date, content) {
      this.scheduled.push({ identifier, date, content });
      return { identifier };
    }),
  });

  it('cancels then schedules the plan', async () => {
    const notifier = makeNotifier();
    const summary = await applyAlarmSchedule([baseAlarm()], notifier, now, { maxPerAlarm: 1 });
    expect(notifier.cancelAllAlarmNotifications).toHaveBeenCalledTimes(1);
    expect(notifier.schedule).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ planned: 1, scheduled: 1, failed: 0, cancelled: 2 });
    expect(notifier.scheduled[0].identifier).toBe('alarm-7');
  });

  it('counts scheduling failures without throwing', async () => {
    const notifier = makeNotifier();
    notifier.schedule = jest.fn(async () => {
      throw new Error('boom');
    });
    const summary = await applyAlarmSchedule([baseAlarm()], notifier, now, { maxPerAlarm: 1 });
    expect(summary.scheduled).toBe(0);
    expect(summary.failed).toBe(1);
    expect(summary.errors[0]).toContain('boom');
  });

  it('records a cancel failure but still schedules', async () => {
    const notifier = makeNotifier();
    notifier.cancelAllAlarmNotifications = jest.fn(async () => {
      throw new Error('cancel-down');
    });
    const summary = await applyAlarmSchedule([baseAlarm()], notifier, now, { maxPerAlarm: 1 });
    expect(summary.scheduled).toBe(1);
    expect(summary.errors.some((e) => e.includes('cancel-down'))).toBe(true);
  });
});
