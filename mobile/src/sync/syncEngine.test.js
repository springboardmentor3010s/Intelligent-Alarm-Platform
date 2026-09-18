// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import {
  groupByTable,
  toSyncRecords,
  pushPending,
  pullServer,
  runSync,
} from './syncEngine';

function createMemoryStorage(initial = {}) {
  const tables = { alarms: [], challenge_attempts: [], habit_scores: [], ...initial };
  return {
    async listUnsynced(table) {
      return (tables[table] || []).filter((r) => !r.synced).map((r) => ({
        record_id: r.record_id,
        local_timestamp: r.local_timestamp,
        payload: r.payload,
      }));
    },
    async listAll(table) {
      return tables[table] || [];
    },
    async upsertLocal(table, record) {
      tables[table] = tables[table] || [];
      const idx = tables[table].findIndex((r) => r.record_id === record.record_id);
      if (idx >= 0) tables[table][idx] = { ...tables[table][idx], ...record };
      else tables[table].push(record);
    },
    async markSynced(table, id) {
      tables[table] = (tables[table] || []).map((r) =>
        r.record_id === id ? { ...r, synced: true } : r
      );
    },
    async clear(table) { tables[table] = []; },
    _tables: tables,
  };
}

const okResponse = (body) => ({ ok: true, status: 200, ...body });

describe('syncEngine helpers', () => {
  it('groups records by table name', () => {
    const out = groupByTable([
      { table_name: 'alarms' },
      { table_name: 'alarms' },
      { table_name: 'habit_scores' },
    ]);
    expect(out.alarms).toHaveLength(2);
    expect(out.habit_scores).toHaveLength(1);
  });

  it('maps unsynced rows to the sync wire format', () => {
    const rows = [
      { record_id: 1, local_timestamp: '2026-09-07T00:00:00Z', payload: { title: 'x' } },
    ];
    expect(toSyncRecords(rows)[0]).toEqual({
      table_name: undefined,
      record_id: 1,
      local_timestamp: '2026-09-07T00:00:00Z',
      payload: { title: 'x' },
    });
  });
});

describe('pushPending', () => {
  it('returns early when there is nothing unsynced', async () => {
    const storage = createMemoryStorage();
    const requestFn = jest.fn();
    const result = await pushPending({ storage, token: 't', requestFn });
    expect(requestFn).not.toHaveBeenCalled();
    expect(result.pushed).toBe(0);
  });

  it('posts unsynced records and marks them synced on success', async () => {
    const storage = createMemoryStorage({
      alarms: [{ record_id: 11, synced: false, payload: { title: 'Wake' }, local_timestamp: 'ts' }],
      habit_scores: [{ record_id: 22, synced: false, payload: { date: 'x' }, local_timestamp: 'ts2' }],
    });
    const requestFn = jest.fn().mockResolvedValue(
      okResponse({ synced_count: 2, failed_count: 0, failed_record_ids: [] })
    );
    const result = await pushPending({ storage, token: 't', requestFn });

    expect(requestFn).toHaveBeenCalledTimes(1);
    const call = requestFn.mock.calls[0];
    expect(call[0]).toBe('/api/v1/sync/pending');
    expect(call[1].method).toBe('POST');
    expect(call[1].body).toContain('"records"');
    expect(result.synced_count).toBe(2);

    // both rows now synced
    expect(storage._tables.alarms[0].synced).toBe(true);
    expect(storage._tables.habit_scores[0].synced).toBe(true);
  });

  it('leaves failed records unsynced', async () => {
    const storage = createMemoryStorage({
      alarms: [{ record_id: 1, synced: false, payload: { title: 'a' }, local_timestamp: 't' }],
      alarms2: [{ record_id: 2, synced: false, payload: { title: 'b' }, local_timestamp: 't' }],
    });
    storage._tables.alarms = storage._tables.alarms.concat(storage._tables.alarms2);
    const requestFn = jest.fn().mockResolvedValue(
      okResponse({ synced_count: 1, failed_count: 1, failed_record_ids: [2] })
    );
    const result = await pushPending({ storage, token: 't', requestFn });
    expect(result.failed_count).toBe(1);
    expect(storage._tables.alarms.find((r) => r.record_id === 1).synced).toBe(true);
    expect(storage._tables.alarms.find((r) => r.record_id === 2).synced).toBe(false);
  });
});

describe('pullServer', () => {
  it('stores pulled rows as synced and returns the server timestamp', async () => {
    const storage = createMemoryStorage();
    const requestFn = jest.fn().mockResolvedValue(
      okResponse({
        alarms: [{ id: 9, title: 'server alarm' }],
        challenge_attempts: [],
        habit_scores: [],
        server_timestamp: '2026-09-07T10:00:00Z',
      })
    );
    const res = await pullServer({ storage, token: 't', requestFn });
    expect(res.serverTimestamp).toBe('2026-09-07T10:00:00Z');
    expect(storage._tables.alarms[0].title).toBe('server alarm');
    expect(storage._tables.alarms[0].synced).toBe(true);
  });
});

describe('runSync', () => {
  it('pushes then pulls, tolerating a failed pull', async () => {
    const storage = createMemoryStorage({
      alarms: [{ record_id: 5, synced: false, payload: { title: 'a' }, local_timestamp: 't' }],
    });
    const requestFn = jest
      .fn()
      .mockResolvedValueOnce(okResponse({ synced_count: 1, failed_count: 0, failed_record_ids: [] }))
      .mockRejectedValueOnce(new Error('pull failed'));
    const result = await runSync({ storage, token: 't', requestFn });
    expect(result.pushed.synced_count).toBe(1);
    expect(result.pulled.error).toBe('pull failed');
  });
});