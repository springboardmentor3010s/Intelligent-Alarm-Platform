import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Animated, ScrollView, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../context/AuthContext';
import { useHabitScore } from '../../hooks/useHabitScore';
import { apiFetch } from '../../utils/api';
import { offlineStore } from '../../sync/offlineStore';
import { useSync } from '../../sync/useSync';
import { useTheme } from '../../theme/ThemeContext';
import { StatusPill, ScoreRing, SectionHeader } from '../../components/ui';

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

function MicroBadge({ children, colors, fonts }) {
  return (
    <View style={[styles.microBadge, { backgroundColor: colors.surface2, borderColor: colors.borderStrong }]}>
      <Text style={[styles.microBadgeText, { color: colors.textMuted, fontFamily: fonts.monoMedium }]}>{children}</Text>
    </View>
  );
}

export default function HomeTab({ navigation }) {
  const { user, token } = useAuthContext();
  const { colors, ui, fonts, reduceMotion } = useTheme();
  const { score: habitScore, loading: scoreLoading, fetchHabitScore } = useHabitScore(token);
  const { syncing, run: runSync, pushOnly } = useSync(token);
  const [alarms, setAlarms] = useState([]);
  const [alarmsLoading, setAlarmsLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [scoreHistory, setScoreHistory] = useState(null);

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

  const fetchScoreHistory = useCallback(async () => {
    try {
      const response = await apiFetch('/api/v1/habits/score/history?days=7', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const rows = await response.json();
        setScoreHistory(Array.isArray(rows) ? rows : null);
      }
    } catch {}
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchAlarms();
        fetchScoreHistory();
        runSync();
        fetchHabitScore();
      }
    }, [token, fetchAlarms, fetchScoreHistory, runSync, fetchHabitScore])
  );

  useEffect(() => {
    if (habitScore) offlineStore.upsertLocal('habit_scores', { date: habitScore.date, payload: habitScore, synced: true });
  }, [habitScore]);

  const name = String(user?.full_name || user?.email?.split('@')[0] || 'User').split(' ')[0];
  const score = Number(habitScore?.overall_score) || 0;
  const enabled = alarms.filter((a) => a.is_enabled);
  const upcoming = [...enabled].sort((a, b) =>
    (a.next_trigger || '').toString().localeCompare((b.next_trigger || '').toString())
  )[0];
  const sorted = [...alarms].sort((a, b) =>
    (a.time || a.next_trigger || '').toString().localeCompare((b.time || b.next_trigger || '').toString())
  );

  const historyRows = Array.isArray(scoreHistory)
    ? scoreHistory.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    : [];
  const lastRow = historyRows.length ? historyRows[historyRows.length - 1] : null;
  const prevRow = historyRows.length > 1 ? historyRows[historyRows.length - 2] : null;
  const lastScore = Number(lastRow?.overall_score);
  const prevScore = Number(prevRow?.overall_score);
  const delta =
    Number.isFinite(lastScore) && Number.isFinite(prevScore) && prevRow
      ? lastScore - prevScore
      : null;
  const deltaLabel =
    delta === null
      ? null
      : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)}% vs yesterday`;
  const tone = score >= 75 ? 'emerald' : score >= 50 ? 'amber' : 'rose';

  const dueNow = upcoming ? formatCountdown(upcoming.next_trigger) === 'due now' : false;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!dueNow || reduceMotion) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dueNow, reduceMotion, pulse]);

  const toggleAlarm = async (item, next) => {
    const toggled = { ...item, is_enabled: next };
    setAlarms((prev) => prev.map((a) => a.id === item.id ? toggled : a));
    try {
      await offlineStore.upsertLocal('alarms', { ...toggled, synced: false });
      pushOnly();
    } catch {
      setAlarms((prev) => prev.map((a) => a.id === item.id ? item : a));
    }
  };

  if (alarmsLoading || scoreLoading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator size="large" color={colors.emerald} />
        <Text style={[styles.loadingText, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>BOOTING SYSTEMS</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.topMeta, { color: colors.textFaint, fontFamily: fonts.monoMedium }]}>
          CEREBROKOGNIT · COGNITIVE ALARM SYSTEM
        </Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.displayBold }]}>
          {greeting()}, {name}.
        </Text>
        <View style={styles.subRow}>
          <View style={styles.subTextWrap}>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Your cognitive status for today</Text>
          </View>
          <StatusPill label={offlineMode ? 'Offline' : 'Online'} tone={offlineMode ? 'amber' : 'emerald'} />
        </View>

        <View style={[ui.card, styles.heroCard]}>
          <View style={styles.heroRow}>
            <View style={styles.heroRingWrap}>
              <ScoreRing score={score} size={92} label="Score" tone={tone} />
              {deltaLabel ? (
                <Text
                  style={[
                    styles.ringDelta,
                    { color: delta > 0 ? colors.emerald : colors.amber, fontFamily: fonts.monoMedium },
                  ]}
                >
                  {deltaLabel}
                </Text>
              ) : null}
            </View>
            <View style={styles.heroRight}>
              <Text style={[styles.heroCaption, { color: colors.textMuted, fontFamily: fonts.monoMedium }]}>
                NEXT WINDOW
              </Text>
              {upcoming ? (
                <>
                  <Text style={[styles.heroTime, { color: colors.text, fontFamily: fonts.displayExtra }]}>
                    {upcoming.time || 'Not set'}
                  </Text>
                  <View style={styles.metaChips}>
                    {upcoming.alarm_type ? <MicroBadge colors={colors} fonts={fonts}>{upcoming.alarm_type}</MicroBadge> : null}
                    {upcoming.recurrence ? <MicroBadge colors={colors} fonts={fonts}>{upcoming.recurrence}</MicroBadge> : null}
                    {upcoming.challenge_type ? <MicroBadge colors={colors} fonts={fonts}>{upcoming.challenge_type}</MicroBadge> : null}
                  </View>
                  <Animated.View style={[styles.heroCountdownRow, dueNow && { opacity: pulse }]}>
                    {dueNow ? (
                      <>
                        <Ionicons name="alarm-outline" size={14} color={colors.amber} />
                        <Text style={[styles.heroCountdown, { color: colors.amber, fontFamily: fonts.monoMedium }]}>
                          due now
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                        <Text style={[styles.heroCountdown, { color: colors.textMuted, fontFamily: fonts.monoMedium }]}>
                          {formatCountdown(upcoming.next_trigger)}
                        </Text>
                      </>
                    )}
                  </Animated.View>
                </>
              ) : (
                <Text style={[styles.heroMeta, { color: colors.textMuted }]}>No alarm scheduled - set one to begin the loop.</Text>
              )}
            </View>
          </View>

          <View style={styles.heroActions}>
            <Pressable
              onPress={() => navigation.navigate('Challenge')}
              accessibilityRole="button"
              accessibilityLabel="Practice"
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.emerald },
                pressed && styles.actionPressed,
              ]}
            >
              <Ionicons name="flash-outline" size={17} color="#FFFFFF" />
              <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Practice</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('AlarmForm')}
              accessibilityRole="button"
              accessibilityLabel="New alarm"
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.surface2, borderColor: colors.borderStrong },
                pressed && styles.actionPressed,
              ]}
            >
              <Ionicons name="add" size={17} color={colors.text} />
              <Text style={[styles.actionBtnText, { color: colors.text }]}>New alarm</Text>
            </Pressable>
          </View>
        </View>

        <SectionHeader style={styles.sectionHeader}>Active windows · {enabled.length}</SectionHeader>
        <ScrollView scrollEnabled={false}>
          {sorted.map((item) => {
            const isNext = upcoming && item.id === upcoming.id;
            return (
              <Pressable
                key={String(item.id)}
                style={({ pressed }) => [
                  styles.alarmItem,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => navigation.navigate('Alarm', { alarmId: item.id })}
                accessibilityRole="button"
                accessibilityLabel={`Alarm at ${item.time || 'Not set'} titled ${item.title || 'Untitled'}`}
              >
                <View style={styles.alarmLeft}>
                  <View style={styles.alarmTimeRow}>
                    <Text style={[styles.alarmTime, { color: colors.text, fontFamily: fonts.displayBold }]}>
                      {item.time || 'Not set'}
                    </Text>
                    {isNext ? (
                      <View style={[styles.nextChip, { backgroundColor: colors.emeraldSoft, borderColor: colors.emeraldGlow }]}>
                        <Text style={[styles.nextChipText, { color: colors.emerald, fontFamily: fonts.monoBold }]}>NEXT</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.alarmTitle, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.title || 'Untitled alarm'}
                  </Text>
                  {item.challenge_type ? (
                    <MicroBadge colors={colors} fonts={fonts}>{item.challenge_type}</MicroBadge>
                  ) : null}
                </View>
                <View style={styles.alarmRight}>
                  <Switch
                    value={!!item.is_enabled}
                    onValueChange={(next) => toggleAlarm(item, next)}
                    trackColor={{ false: colors.borderStrong, true: colors.emerald }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel={`Toggle ${item.title || 'alarm'}`}
                  />
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </View>
              </Pressable>
            );
          })}
          {sorted.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textFaint }]}>No alarms scheduled - lock in a wake-up time.</Text>
          ) : null}
        </ScrollView>
      </ScrollView>

      {(offlineMode || syncing) && (
        <View style={[styles.statusBar, { backgroundColor: colors.surface2, borderTopColor: colors.border }]}>
          <Text style={[styles.statusText, { color: syncing ? colors.emerald : colors.amber, fontFamily: fonts.monoBold }]}>
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
  topMeta: { fontSize: 11, letterSpacing: 0.6, marginBottom: 12 },
  title: { fontSize: 26, letterSpacing: -0.5, lineHeight: 32 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 24 },
  subTextWrap: { flex: 1, minWidth: 0 },
  subtitle: { fontSize: 14 },
  heroCard: { borderWidth: 1, borderRadius: 20, padding: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  heroRingWrap: { flexShrink: 0, alignItems: 'center' },
  ringDelta: { fontSize: 10, fontWeight: '700', marginTop: 8, fontVariant: ['tabular-nums'] },
  heroRight: { flex: 1, minWidth: 0 },
  heroCaption: { fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  heroTime: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 },
  heroMeta: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  metaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  microBadge: {
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  microBadgeText: { fontSize: 11, fontWeight: '600' },
  heroCountdownRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  heroCountdown: { fontSize: 12, fontWeight: '700' },
  heroActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9999,
    height: 48,
    paddingHorizontal: 16,
    flex: 1,
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  actionBtnText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  sectionHeader: { marginBottom: 12, marginTop: 24 },
  alarmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    minHeight: 64,
  },
  alarmLeft: { flex: 1, minWidth: 0 },
  alarmTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alarmTime: { fontSize: 20, fontWeight: '700' },
  alarmTitle: { fontSize: 13, marginTop: 2 },
  nextChip: { borderRadius: 9999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  nextChipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  alarmRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 12 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 14, marginBottom: 8 },
  statusBar: { paddingVertical: 10, alignItems: 'center', borderTopWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
});