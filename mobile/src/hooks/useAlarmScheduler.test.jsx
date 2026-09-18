import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAlarmScheduler } from './useAlarmScheduler';

const futureIso = (daysAhead = 1) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(7, 0, 0, 0);
  return d.toISOString();
};

const alarm = (overrides = {}) => ({
  id: 3,
  title: 'Wake Up!',
  alarm_type: 'One-Time',
  is_enabled: true,
  challenge_type: 'Memory',
  difficulty: 'Medium',
  next_trigger: futureIso(1),
  ...overrides,
});

const makeNotifier = () => ({
  ensurePermissions: jest.fn(async () => true),
  ensureAndroidChannel: jest.fn(async () => true),
  cancelAllAlarmNotifications: jest.fn(async () => 0),
  schedule: jest.fn(async (identifier) => ({ identifier })),
});

describe('useAlarmScheduler', () => {
  it('schedules the planned alarms when permission is granted', async () => {
    const notifier = makeNotifier();
    const { result } = renderHook(() => useAlarmScheduler({ notifier }));

    let summary;
    await act(async () => {
      summary = await result.current.syncAlarms([alarm()]);
    });

    expect(summary.synced).toBe(true);
    expect(summary.scheduled).toBe(1);
    expect(notifier.ensurePermissions).toHaveBeenCalled();
    expect(notifier.ensureAndroidChannel).toHaveBeenCalled();
    expect(notifier.schedule).toHaveBeenCalledTimes(1);
    expect(result.current.syncing).toBe(false);
  });

  it('skips scheduling when permission is denied', async () => {
    const notifier = makeNotifier();
    notifier.ensurePermissions = jest.fn(async () => false);
    const { result } = renderHook(() => useAlarmScheduler({ notifier }));

    let summary;
    await act(async () => {
      summary = await result.current.syncAlarms([alarm()]);
    });

    expect(summary.synced).toBe(false);
    expect(summary.permissionGranted).toBe(false);
    expect(notifier.schedule).not.toHaveBeenCalled();
  });

  it('reports a native failure without throwing', async () => {
    const notifier = makeNotifier();
    notifier.cancelAllAlarmNotifications = jest.fn(async () => {
      throw new Error('native-down');
    });
    const { result } = renderHook(() => useAlarmScheduler({ notifier }));

    await act(async () => {
      await result.current.syncAlarms([alarm()]);
    });

    await waitFor(() => expect(result.current.status.errors.length).toBeGreaterThan(0));
  });

  it('does not schedule disabled alarms', async () => {
    const notifier = makeNotifier();
    const { result } = renderHook(() => useAlarmScheduler({ notifier }));

    await act(async () => {
      await result.current.syncAlarms([alarm({ is_enabled: false })]);
    });

    expect(notifier.schedule).not.toHaveBeenCalled();
  });
});
