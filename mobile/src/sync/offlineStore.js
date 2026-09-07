/**
 * AsyncStorage-backed offline store adapter for the sync engine.
 *
 * Each table maps to a namespaced AsyncStorage key whose value is a JSON array
 * of records. Records carry a `synced` flag + `local_timestamp` (ISO string)
 * matching the sync-engine contract.
 *
 * Using AsyncStorage (rather than expo-sqlite) keeps the offline cache usable
 * in Expo Go, survives app restarts, and is fully exercisable in jest.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'ck_offline';

const keyFor = (table) => `${PREFIX}_${table}`;

async function readTable(table) {
  const raw = await AsyncStorage.getItem(keyFor(table));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTable(table, rows) {
  return AsyncStorage.setItem(keyFor(table), JSON.stringify(rows));
}

export const offlineStore = {
  async listUnsynced(table) {
    const rows = await readTable(table);
    return rows.filter((r) => !r.synced).map((r) => ({
      record_id: r.record_id ?? r.id ?? null,
      local_timestamp: r.local_timestamp || null,
      payload: r.payload ?? r,
    }));
  },

  async listAll(table) {
    return readTable(table);
  },

  async upsertLocal(table, record) {
    const rows = await readTable(table);
    const id = record.record_id ?? record.id;
    const normalized = {
      ...record,
      record_id: id,
      local_timestamp: record.local_timestamp || new Date().toISOString(),
    };
    const idx = rows.findIndex((r) => (r.record_id ?? r.id) === id);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], ...normalized };
    } else {
      rows.push(normalized);
    }
    await writeTable(table, rows);
  },

  async markSynced(table, recordId) {
    const rows = await readTable(table);
    const idx = rows.findIndex((r) => (r.record_id ?? r.id) === recordId);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], synced: true };
      await writeTable(table, rows);
    }
  },

  async clear(table) {
    await AsyncStorage.removeItem(keyFor(table));
  },

  async clearAll() {
    const keys = await AsyncStorage.getAllKeys();
    const offlineKeys = keys.filter((k) => k.startsWith(PREFIX));
    if (offlineKeys.length) {
      await AsyncStorage.multiRemove(offlineKeys);
    }
  },
};

export default offlineStore;