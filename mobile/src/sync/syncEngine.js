// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
/**
 * Offline sync engine (pure logic, storage-agnostic so it can be unit-tested).
 *
 * Tables mirrored from the server schema:
 *   - alarms
 *   - habit_scores
 *   - challenge_attempts (cached challenge payloads / local attempts)
 *
 * Records are stored with a `synced: boolean` flag + a `local_timestamp` (ISO).
 * The sync engine pushes unsynced records to `/api/v1/sync/pending` (idempotent
 * upsert) and pulls server state back via `/api/v1/sync/pull`.
 *
 * `storage` is injected and must implement:
 *   listUnsynced(tableName)          -> Promise<Array<{record_id, payload, local_timestamp, payload_json}>>
 *   markSynced(tableName, recordId)  -> Promise<void>
 *   upsertLocal(tableName, record)   -> Promise<void>
 *   listAll(tableName)               -> Promise<Array>
 *   clear(tableName)                 -> Promise<void>
 */

/**
 * Push any unsynced local records to the server via the idempotent
 * /sync/pending endpoint. Returns the server's SyncRes summary.
 */
export async function pushPending({ storage, token, requestFn }) {
  const tables = ['alarms', 'challenge_attempts', 'habit_scores'];
  const records = [];

  for (const table of tables) {
    const unsynced = await storage.listUnsynced(table);
    for (const row of unsynced) {
      records.push({
        table_name: table,
        record_id: row.record_id,
        local_timestamp: row.local_timestamp || null,
        payload: row.payload || {},
      });
    }
  }

  if (records.length === 0) {
    return { pushed: 0, synced_count: 0, failed_count: 0, failed_record_ids: [] };
  }

  const response = await requestFn('/api/v1/sync/pending', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  });

  if (!response.ok || !response.synced_count) {
    const failed = response && Number.isFinite(response.failed_count) ? response.failed_count : 0;
    const failedIds = response.failed_record_ids || [];
    // Server acknowledged but could not validate some; leave them unsynced.
    return {
      pushed: records.length,
      synced_count: response.synced_count || 0,
      failed_count: failed,
      failed_record_ids: failedIds,
    };
  }

  // Mark the pushed records as synced (only those the server accepted).
  const acceptedIds = new Set(records.map((r) => String(r.record_id)));
  const failedIds = new Set((response.failed_record_ids || []).map(String));
  for (const table of tables) {
    const unsynced = await storage.listUnsynced(table);
    for (const row of unsynced) {
      if (acceptedIds.has(String(row.record_id)) && !failedIds.has(String(row.record_id))) {
        await storage.markSynced(table, row.record_id);
      }
    }
  }

  return {
    pushed: records.length,
    synced_count: response.synced_count || 0,
    failed_count: response.failed_count || 0,
    failed_record_ids: response.failed_record_ids || [],
  };
}

/**
 * Pull the latest server state for the user and merge into local storage.
 * Returns the server payload grouped by table.
 */
export async function pullServer({ storage, token, requestFn, since }) {
  const qs = since ? `?since=${encodeURIComponent(since)}` : '';
  const response = await requestFn(`/api/v1/sync/pull${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(response.detail || `Sync pull failed (${response.status})`);
  }
  const serverTimestamp = response.server_timestamp;
  for (const table of ['alarms', 'challenge_attempts', 'habit_scores']) {
    const rows = response[table] || [];
    for (const row of rows) {
      await storage.upsertLocal(table, { ...row, synced: true });
    }
  }
  return { serverTimestamp, groups: response };
}

export async function runSync({ storage, token, requestFn, since }) {
  const pushResult = await pushPending({ storage, token, requestFn });
  let pullResult = null;
  try {
    pullResult = await pullServer({ storage, token, requestFn, since });
  } catch (e) {
    // Pull is best-effort after a successful push; surface it but don't throw.
    pullResult = { error: e.message };
  }
  return { pushed: pushResult, pulled: pullResult };
}