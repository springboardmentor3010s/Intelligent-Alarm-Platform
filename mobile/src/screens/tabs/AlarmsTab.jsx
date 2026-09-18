import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import { useAlarmScheduler } from '../../hooks/useAlarmScheduler';
import { offlineStore } from '../../sync/offlineStore';
import { useTheme } from '../../theme/ThemeContext';
import { SysLabel } from '../../components/ui';

export default function AlarmsTab({ navigation }) {
  const { token } = useAuthContext();
  const { colors, ui, fonts } = useTheme();
  const { syncAlarms, status: scheduleStatus } = useAlarmScheduler();
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/alarms', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('not-ok');
      const list = await res.json();
      setAlarms(list);
      setOffline(false);
      // Keep the on-device schedule in lockstep with the backend.
      syncAlarms(list);
      // Refresh the offline cache for the next cold/offline open.
      try {
        await offlineStore.clear('alarms');
        for (const item of list) {
          await offlineStore.upsertLocal('alarms', { ...item, synced: true });
        }
      } catch (e) {
        // cache write is best-effort
      }
    } catch (e) {
      // Offline / backend unreachable: fall back to the cached alarms.
      try {
        const cached = await offlineStore.listAll('alarms');
        const rows = cached.map((r) => r.payload || r);
        setAlarms(rows);
        setOffline(rows.length > 0);
        if (rows.length) syncAlarms(rows);
      } catch (cacheError) {
        setAlarms([]);
      }
    } finally {
      setLoading(false);
    }
  }, [token, syncAlarms]);

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
        <ActivityIndicator size="large" color={colors.violet} />
      </View>
    );
  }

  const meta = (item) => {
    const parts = [item.alarm_type];
    if (item.recurrence) parts.push(item.recurrence);
    if (item.difficulty) parts.push(item.difficulty);
    return parts.join(' · ');
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <SysLabel icon="alarm-outline" tone="violet">Wake-up scheduler</SysLabel>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.displayBold }]}>Alarms</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{alarms.length} configured · tap to open the challenge flow</Text>

        {offline && (
          <View style={[styles.offlineBanner, { backgroundColor: colors.surface2, borderColor: colors.borderStrong }]}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.offlineText, { color: colors.textMuted }]}>
              Offline - showing your last synced alarms.
            </Text>
          </View>
        )}

        {scheduleStatus?.synced && scheduleStatus.scheduled > 0 && (
          <Text style={[styles.scheduleNote, { color: colors.textFaint, fontFamily: fonts.monoMedium }]}>
            {scheduleStatus.scheduled} on-device reminder{scheduleStatus.scheduled === 1 ? '' : 's'} armed
          </Text>
        )}

        {alarms.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Alarm', { alarmId: item.id })}
            style={[ui.card, styles.alarmCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={`Open challenge for alarm ${item.title || 'Untitled'}`}
          >
            <View style={styles.alarmMain}>
              <Text style={[styles.alarmTime, { color: colors.text, fontFamily: fonts.displayBold }]}>{item.time || 'Not set'}</Text>
              <Text style={[styles.alarmTitle, { color: colors.textMuted }]}>{item.title || 'Untitled Alarm'}</Text>
              <Text style={[styles.alarmMeta, { color: colors.textFaint, fontFamily: fonts.monoMedium }]}>{meta(item)}</Text>
            </View>
            <View style={styles.alarmControls}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.navigate('AlarmForm', { alarmId: item.id })}
                accessibilityRole="button"
                accessibilityLabel={`Edit alarm ${item.title || 'Untitled'}`}
              >
                <Ionicons name="create-outline" size={20} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => removeAlarm(item)}
                disabled={busyId === item.id}
                accessibilityRole="button"
                accessibilityLabel={`Delete alarm ${item.title || 'Untitled'}`}
              >
                {busyId === item.id ? (
                  <ActivityIndicator size="small" color={colors.rose} />
                ) : (
                  <Ionicons name="trash-outline" size={20} color={colors.rose} />
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        {alarms.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textFaint }]}>No alarms configured. Create your first wake-up window below.</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.violet }]}
          onPress={() => navigation.navigate('AlarmForm')}
          accessibilityRole="button"
          accessibilityLabel="Create a new alarm"
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={[styles.addBtnText, { color: '#FFFFFF' }]}>New alarm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 24 },
  title: { fontSize: 26, marginTop: 4 },
  subtitle: { fontSize: 14, marginTop: 6, marginBottom: 20 },
  alarmCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alarmMain: { flex: 1 },
  alarmTime: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  alarmTitle: { fontSize: 14, marginTop: 2 },
  alarmMeta: { fontSize: 11, marginTop: 4, letterSpacing: 0.4 },
  alarmControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 6 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  offlineText: { fontSize: 13, flex: 1 },
  scheduleNote: { fontSize: 11, letterSpacing: 0.4, marginBottom: 10 },
  emptyText: { textAlign: 'center', marginTop: 24, fontSize: 14, lineHeight: 20 },
  footer: { paddingHorizontal: 20, paddingBottom: 12 },
  addBtn: { borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 15 },
  addBtnText: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
});