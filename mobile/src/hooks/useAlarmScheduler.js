/**
 * useAlarmScheduler — keeps on-device notifications in sync with backend alarms.
 *
 * On every sync it: ensures permission + Android channel, cancels previously
 * scheduled alarm notifications, then schedules the fresh plan derived from the
 * backend's timezone-aware `next_trigger`. The native notifier is injectable so
 * the hook is unit-testable without a device.
 */
import { useCallback, useRef, useState } from 'react';

import * as defaultNotifier from '../notifications/expoNotifier';
import { applyAlarmSchedule } from '../notifications/scheduleAlarm';

export function useAlarmScheduler(options = {}) {
  const notifier = options.notifier || defaultNotifier;
  const [status, setStatus] = useState({
    synced: false,
    scheduled: 0,
    failed: 0,
    cancelled: 0,
    permissionGranted: null,
    errors: [],
  });
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);

  const syncAlarms = useCallback(
    async (alarms, now = new Date()) => {
      if (busy.current) return null;
      busy.current = true;
      setSyncing(true);
      setStatus((s) => ({ ...s, errors: [] }));
      try {
        const permissionGranted = notifier.ensurePermissions
          ? await notifier.ensurePermissions()
          : true;
        if (notifier.ensureAndroidChannel) {
          await notifier.ensureAndroidChannel();
        }
        if (!permissionGranted) {
          const denied = {
            synced: false,
            scheduled: 0,
            failed: 0,
            cancelled: 0,
            permissionGranted: false,
            errors: ['permission-denied'],
          };
          setStatus(denied);
          return denied;
        }
        const summary = await applyAlarmSchedule(alarms || [], notifier, now);
        const result = { synced: true, permissionGranted: true, ...summary };
        setStatus(result);
        return result;
      } catch (e) {
        const failed = {
          synced: false,
          scheduled: 0,
          failed: 0,
          cancelled: 0,
          permissionGranted: null,
          errors: [e && e.message ? e.message : String(e)],
        };
        setStatus(failed);
        return failed;
      } finally {
        busy.current = false;
        setSyncing(false);
      }
    },
    [notifier]
  );

  return { status, syncing, syncAlarms };
}

export default useAlarmScheduler;
