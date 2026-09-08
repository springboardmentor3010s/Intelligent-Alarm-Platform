import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthContext } from '../context/AuthContext';
import { useHabitScore } from '../hooks/useHabitScore';
import { apiFetch } from '../utils/api';
import { offlineStore } from '../sync/offlineStore';
import { useSync } from '../sync/useSync';

export default function HomeScreen({ navigation }) {
  const { user, token } = useAuthContext();
  const { score: habitScore, loading: scoreLoading, fetchHabitScore } = useHabitScore(token);
  const { syncing, run: runSync } = useSync(token);
  const [alarms, setAlarms] = useState([]);
  const [alarmsLoading, setAlarmsLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  const fetchAlarms = useCallback(async () => {
    setAlarmsLoading(true);
    try {
      const response = await apiFetch('/api/v1/alarms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAlarms(data);
        // cache latest alarms for offline use
        for (const a of data) {
          await offlineStore.upsertLocal('alarms', { ...a, synced: true });
        }
        setOfflineMode(false);
      }
    } catch (error) {
      console.error('Failed to fetch alarms (offline?):', error);
      // fall back to cached alarms when offline
      try {
        const cached = await offlineStore.listAll('alarms');
        setAlarms(cached);
        setOfflineMode(true);
      } catch {}
    } finally {
      setAlarmsLoading(false);
    }
  }, [token]);

  const cacheHabitScore = useCallback(async () => {
    if (habitScore) {
      await offlineStore.upsertLocal('habit_scores', {
        id: habitScore.id,
        date: habitScore.date,
        ...habitScore,
        payload: habitScore,
        synced: true,
      });
    }
  }, [habitScore]);

  useEffect(() => {
    if (habitScore) cacheHabitScore();
  }, [habitScore, cacheHabitScore]);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchAlarms();
        // Trigger offline sync: push unsynced records, then pull latest.
        runSync();
      }
    }, [token, fetchAlarms, runSync])
  );

  // Refresh habit score on focus too
  useFocusEffect(
    useCallback(() => {
      if (token) fetchHabitScore();
    }, [token, fetchHabitScore])
  );

  if (alarmsLoading || scoreLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={alarms}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.alarmItem}
            onPress={() => navigation.navigate('Alarm', { alarmId: item.id })}
          >
            <View style={styles.alarmInfo}>
              <Text style={styles.alarmTitle}>{item.title || 'Untitled Alarm'}</Text>
              <Text style={styles.alarmTime}>{item.alarm_type}</Text>
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={<Text style={styles.emptyText}>No alarms scheduled</Text>}
      />
      
      {habitScore && (
        <View style={styles.habitBox}>
          <Text style={styles.habitTitle}>Today's Habit Score</Text>
          <Text style={styles.habitScore}>{habitScore.overall_score || 0}</Text>
        </View>
      )}

      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('Challenge')}>
          <Text style={styles.navBtnText}>Practice Challenge</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.navBtnText}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.navBtnText}>Settings</Text>
        </TouchableOpacity>
      </View>

      {(offlineMode || syncing) && (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>
            {syncing ? 'Syncing…' : 'Offline — showing cached data'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  alarmItem: { padding: 16, backgroundColor: 'white', borderRadius: 12, marginBottom: 12, elevation: 2 },
  alarmInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alarmTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  alarmTime: { fontSize: 14, color: '#6b7280' },
  habitBox: { backgroundColor: 'white', padding: 20, borderRadius: 12, marginTop: 24, elevation: 2 },
  habitTitle: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  habitScore: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { flex: 1, backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, marginHorizontal: 4, alignItems: 'center' },
  navBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 20 },
  statusBox: { marginTop: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#fbbf24', backgroundColor: '#fffbeb', alignItems: 'center' },
  statusText: { color: '#b45309', fontSize: 13, fontWeight: '600' }
});
