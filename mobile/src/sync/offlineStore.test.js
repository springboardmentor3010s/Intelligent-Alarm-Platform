import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineStore } from './offlineStore';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('offlineStore', () => {
  it('upserts and lists records per table', async () => {
    await offlineStore.upsertLocal('alarms', { record_id: 1, title: 'Wake', synced: false });
    await offlineStore.upsertLocal('alarms', { record_id: 1, title: 'Wake Up', synced: false });
    const rows = await offlineStore.listAll('alarms');
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Wake Up');
  });

  it('listUnsynced returns only unsynced rows plus record_id/payload', async () => {
    await offlineStore.upsertLocal('habit_scores', { record_id: 10, date: 'x', payload: { overall: 70 }, synced: false });
    await offlineStore.upsertLocal('habit_scores', { record_id: 11, date: 'y', payload: { overall: 80 }, synced: true });
    const unsynced = await offlineStore.listUnsynced('habit_scores');
    expect(unsynced).toHaveLength(1);
    expect(unsynced[0].record_id).toBe(10);
    expect(unsynced[0].payload.overall).toBe(70);
  });

  it('markSynced flips the synced flag for one record', async () => {
    await offlineStore.upsertLocal('alarms', { record_id: 7, title: 'a', synced: false });
    await offlineStore.markSynced('alarms', 7);
    const rows = await offlineStore.listAll('alarms');
    expect(rows[0].synced).toBe(true);
  });

  it('survives a round-trip through AsyncStorage (persistence)', async () => {
    await offlineStore.upsertLocal('alarms', { record_id: 3, title: 'persist', synced: true });
    const cached = await AsyncStorage.getItem('ck_offline_alarms');
    expect(JSON.parse(cached)[0].title).toBe('persist');
  });

  it('clearAll removes offline keys', async () => {
    await offlineStore.upsertLocal('alarms', { record_id: 3, title: 'a' });
    await offlineStore.clearAll();
    expect(await offlineStore.listAll('alarms')).toEqual([]);
  });
});