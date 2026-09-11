import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../context/AuthContext';
import { useHabitScore } from '../../hooks/useHabitScore';
import { apiFetch } from '../../utils/api';
import { offlineStore } from '../../sync/offlineStore';
import { useSync } from '../../sync/useSync';
import { useTheme } from '../../theme/ThemeContext';
import { SysLabel, StatusPill, ScoreRing, SectionHeader } from '../../components/ui';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatCountdown(iso) {
  const diff = new Date(iso) - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return 'due now';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h >= 24 ? `in ${Math.floor(h / 24)}d ${h % 24}h` : `in ${h}h ${String(m).padStart(2, '0')}m`;
}

export default function HomeTab({ navigation }) {
  const { user, token } = useAuthContext();
  const { colors, ui, fonts } = useTheme();
  const { score: habitScore, loading: scoreLoading, fetchHabitScore } = useHabitScore(token);
  const { syncing, run: runSync } = useSync(token);
  const [alarms, setAlarms] = useState([]);
  const [alarmsLoading, setAlarmsLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  const fetchAlarms = useCallback(async () => {
    setAlarmsLoading(true);
    try {
      const response = await apiFetch('/api/v1/alarms', { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setAlarms(data);
        for (const a of data) await offlineStore.upsertLocal('alarms', { ...a, synced: true });
        setOfflineMode(false);
      }
    } catch (error) {
      try {
        const cached = await offlineStore.listAll('alarms');
        setAlarms(cached);
        setOfflineMode(true);
      } catch {}
    } finally {
      setAlarmsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchAlarms();
        runSync();
        fetchHabitScore();
      }
    }, [token, fetchAlarms, runSync, fetchHabitScore])
  );

  useEffect(() => {
    if (habitScore) offlineStore.upsertLocal('habit_scores', { date: habitScore.date, payload: habitScore, synced: true });
  }, [habitScore]);

  if (alarmsLoading || scoreLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator size="large" color={colors.violet} />
        <Text style={[styles.loadingText, { color: colors.textFaint }]}>BOOTING SYSTEMS</Text>
      </View>
    );
  }

  const name = String(user?.full_name || user?.email?.split('@')[0] || 'User').split(' ')[0];
  const score = Number(habitScore?.overall_score) || 0;
  const enabled = alarms.filter((a) => a.is_enabled);
  const upcoming = [...enabled].sort((a, b) =>
    (a.next_trigger || '').toString().localeCompare((b.next_trigger || '').toString())
  )[0];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <SysLabel icon="radio-outline" tone="violet">Cognitive alarm system</SysLabel>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text, fontFamily: fonts.displayBold }]}>
              {greeting()}, {name}.
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Your cognitive status for today</Text>
          </View>
          <StatusPill label={offlineMode ? 'Offline' : 'Online'} tone={offlineMode ? 'amber' : 'emerald'} />
        </View>

        <View style={[ui.card, styles.heroCard]}>
          <View style={styles.heroRow}>
            <ScoreRing score={score} size={88} label="Score" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroSys, { color: colors.textMuted, fontFamily: fonts.monoSemi }]}>NEXT WINDOW</Text>
              {upcoming ? (
                <>
                  <Text style={[styles.heroTime, { color: colors.text, fontFamily: fonts.displayExtra }]}>
                    {upcoming.time || 'Not set'}
                  </Text>
                  <Text style={[styles.heroMeta, { color: colors.textMuted }]}>
                    {upcoming.title || 'Untitled alarm'} · {upcoming.alarm_type}
                    {upcoming.challenge_type ? ` · ${upcoming.challenge_type}` : ''}
                  </Text>
                  <Text style={[styles.heroCountdown, { color: colors.violet, fontFamily: fonts.monoMedium }]}>
                    <Ionicons name="timer-outline" size={14} color={colors.violet} /> {formatCountdown(upcoming.next_trigger)}
                  </Text>
                </>
              ) : (
                <Text style={[styles.heroMeta, { color: colors.textMuted }]}>No alarm scheduled - set one to begin the loop.</Text>
              )}
            </View>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.violet }]} onPress={() => navigation.navigate('Challenge')}>
              <Ionicons name="flash-outline" size={16} color="#FFFFFF" />
              <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Practice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionGhost, { backgroundColor: colors.surface2, borderColor: colors.borderStrong }]}
              onPress={() => navigation.navigate('AlarmForm')}
            >
              <Ionicons name="add" size={16} color={colors.violet} />
              <Text style={[styles.actionBtnText, { color: colors.violet }]}>New alarm</Text>
            </TouchableOpacity>
          </View>
        </View>

        <SectionHeader style={styles.sectionHeader}>Active windows · {enabled.length}</SectionHeader>
        <FlatList
          data={enabled}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[ui.card, styles.alarmItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('Alarm', { alarmId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={`Alarm at ${item.time || 'Not set'} titled ${item.title || 'Untitled'}`}
            >
              <View style={styles.alarmLeft}>
                <Text style={[styles.alarmTime, { color: colors.text, fontFamily: fonts.displayBold }]}>{item.time || 'Not set'}</Text>
                <Text style={[styles.alarmTitle, { color: colors.textMuted }]}>{item.title || 'Untitled Alarm'}</Text>
              </View>
              <View style={styles.alarmRight}>
                <View style={[styles.smallPill, { backgroundColor: colors.violetSoft }]}>
                  <Text style={[styles.smallPillText, { color: colors.violet }]}>{item.challenge_type || item.alarm_type}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textFaint }]}>No alarms scheduled - lock in a wake-up time.</Text>
          }
        />
      </ScrollView>

      {(offlineMode || syncing) && (
        <View style={[styles.statusBar, { backgroundColor: colors.surface2, borderTopColor: colors.border }]}>
          <Text style={[styles.statusText, { color: syncing ? colors.cyan : colors.amber, fontFamily: fonts.monoBold }]}>
            {syncing ? 'SYNCING' : 'OFFLINE · CACHED DATA'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  loadingText: { marginTop: 14, fontSize: 12, letterSpacing: 3 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginVertical: 18 },
  title: { fontSize: 24, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 2 },
  heroCard: { borderWidth: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroSys: { fontSize: 10, letterSpacing: 1.5 },
  heroTime: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  heroMeta: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  heroCountdown: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flex: 1, justifyContent: 'center' },
  actionGhost: { borderWidth: 1 },
  actionBtnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  sectionHeader: { marginBottom: 10, marginTop: 4 },
  alarmItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  alarmLeft: { flex: 1 },
  alarmTime: { fontSize: 22, fontWeight: '700' },
  alarmTitle: { fontSize: 13, marginTop: 2 },
  alarmRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  smallPillText: { fontSize: 11, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 24, fontSize: 14 },
  statusBar: { paddingVertical: 10, alignItems: 'center', borderTopWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
});