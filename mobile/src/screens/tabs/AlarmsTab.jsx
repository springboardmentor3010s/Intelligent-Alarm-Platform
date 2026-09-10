import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { BRAND, ui } from '../../theme/tokens';

export default function AlarmsTab({ navigation }) {
  const { token } = useAuthContext();
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/alarms', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAlarms(await res.json());
    } catch (e) {
      setAlarms([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const removeAlarm = (alarm) => {
    Alert.alert('Delete alarm', `Delete "${alarm.title || 'Untitled Alarm'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(alarm.id);
          try {
            await apiFetch(`/api/v1/alarms/${alarm.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
          } finally {
            setBusyId(null);
            load();
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sysLabel}>
          <Ionicons name="alarm-outline" size={12} color={BRAND.primary} /> WAKE-UP SCHEDULER
        </Text>
        <Text style={styles.title}>Alarms</Text>
        <Text style={styles.subtitle}>{alarms.length} configured · tap to open challenge flow</Text>

        <FlatList
          data={alarms}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={[ui.card, styles.alarmCard]}>
              <View style={styles.alarmMain}>
                <Text style={styles.alarmTime}>{item.time || '—'}</Text>
                <Text style={styles.alarmTitle}>{item.title || 'Untitled Alarm'}</Text>
                <Text style={styles.alarmMeta}>
                  {item.alarm_type}
                  {item.recurrence ? ` · ${item.recurrence}` : ''}
                  {item.difficulty ? ` · ${item.difficulty}` : ''}
                </Text>
              </View>
              <View style={styles.alarmControls}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AlarmForm', { alarmId: item.id })}>
                  <Ionicons name="create-outline" size={20} color={BRAND.textDim} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => removeAlarm(item)} disabled={busyId === item.id}>
                  {busyId === item.id ? (
                    <ActivityIndicator size="small" color={BRAND.danger} />
                  ) : (
                    <Ionicons name="trash-outline" size={20} color={BRAND.danger} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No alarms configured. Create your first wake-up window below.</Text>
          }
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AlarmForm')}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>NEW ALARM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.space },
  content: { padding: 20, paddingBottom: 24 },
  sysLabel: { color: BRAND.primary, fontSize: 11, fontWeight: '700', letterSpacing: 2.5, marginBottom: 8, textTransform: 'uppercase' },
  title: { ...ui.title },
  subtitle: { ...ui.subtitle, marginBottom: 20 },
  alarmCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alarmMain: { flex: 1 },
  alarmTime: { fontSize: 26, fontWeight: '800', color: BRAND.text, letterSpacing: -0.4 },
  alarmTitle: { color: BRAND.textDim, fontSize: 14, marginTop: 2 },
  alarmMeta: { color: BRAND.textFaint, fontSize: 12, marginTop: 4 },
  alarmControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 6 },
  emptyText: { color: BRAND.textFaint, textAlign: 'center', marginTop: 24, fontSize: 14, lineHeight: 20 },
  footer: { paddingHorizontal: 20, paddingBottom: 12 },
  addBtn: {
    backgroundColor: BRAND.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 15,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 1 },
});