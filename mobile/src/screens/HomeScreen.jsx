import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useHabitScore } from '../hooks/useHabitScore';
import { apiFetch } from '../utils/api';

export default function HomeScreen({ navigation }) {
  const { user, token } = useAuth();
  const { score: habitScore, loading: scoreLoading } = useHabitScore(token);
  const [alarms, setAlarms] = useState([]);
  const [alarmsLoading, setAlarmsLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      if (token) {
        fetchAlarms();
      }
    }, [token])
  );

  const fetchAlarms = async () => {
    setAlarmsLoading(true);
    try {
      const response = await apiFetch('/api/v1/alarms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAlarms(data);
      }
    } catch (error) {
      console.error('Failed to fetch alarms:', error);
    } finally {
      setAlarmsLoading(false);
    }
  };

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
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 20 }
});
