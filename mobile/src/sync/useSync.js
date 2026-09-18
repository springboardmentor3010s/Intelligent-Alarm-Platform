// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import { useState, useCallback } from 'react';
import { offlineStore } from './offlineStore';
import { runSync, pushPending } from './syncEngine';
import { syncRequest } from './syncRequest';

/**
 * useSync(token) exposes an offline-first sync flow:
 *   - run()      pushes unsynced local records then pulls server state
 *   - pushOnly() uploads unsynced records without a pull
 *   - status     last result summary (pushed/pulled/error)
 *   - syncing    in-flight flag
 *
 * Storage and request plumbing are injectable for tests.
 */
export function useSync(token, { store = offlineStore, request = syncRequest } = {}) {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState({ syncedCount: 0, lastRun: null, error: null });

  const pushOnly = useCallback(async () => {
    if (!token) return { pushed: null, error: 'No auth token' };
    setSyncing(true);
    try {
      const result = await pushPending({ storage: store, token, requestFn: request });
      setStatus((s) => ({ ...s, syncedCount: result.synced_count || 0, lastRun: new Date().toISOString(), error: null }));
      return result;
    } catch (e) {
      const msg = (e && e.message) || String(e);
      setStatus((s) => ({ ...s, error: msg }));
      return { pushed: null, error: msg };
    } finally {
      setSyncing(false);
    }
  }, [token, store, request]);

  const run = useCallback(
    async (since) => {
      if (!token) return { pushed: null, error: 'No auth token' };
      setSyncing(true);
      try {
        const result = await runSync({ storage: store, token, requestFn: request, since });
        const syncedCount = result.pushed?.synced_count || 0;
        setStatus((s) => ({ ...s, syncedCount, lastRun: new Date().toISOString(), error: null }));
        return result;
      } catch (e) {
        const msg = (e && e.message) || String(e);
        setStatus((s) => ({ ...s, error: msg }));
        return { pushed: null, error: msg };
      } finally {
        setSyncing(false);
      }
    },
    [token, store, request]
  );

  return { syncing, status, run, pushOnly };
}

export default useSync;