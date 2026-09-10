import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../context/AuthContext';
import { useHabitScore } from '../../hooks/useHabitScore';
import { apiFetch } from '../../utils/api';
import { offlineStore } from '../../sync/offlineStore';
import { useSync } from '../../sync/useSync';
import { BRAND, ui, SHADOWS } from '../../theme/tokens';

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
  return h >= 24 ? `in ${Math.floor(h / 24)}d ${h % 24}h` : `in ${h}h ${m}m`;
}

export default function HomeTab({ navigation }) {
  const { user, token } = useAuthContext();
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
        <ActivityIndicator size="large" color={BRAND.primary} />
        <Text style={styles.loadingText}>BOOTING SYSTEMS…</Text>
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
        <Text style={styles.sysLabel}>
          <Ionicons name="radio-outline" size={12} color={BRAND.primary} /> COGNITIVE ALARM SYSTEM
        </Text>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{greeting()}, {name}.</Text>
            <Text style={styles.subtitle}>Your cognitive status for today</Text>
          </View>
          <View style={styles.onlineChip}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>ONLINE</Text>
          </View>
        </View>

        {/* Score hero */}
        <View style={[ui.card, styles.heroCard]}>
          <View style={styles.heroRow}>
            <ScoreBadge score={score} />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroSys}>NEXT WINDOW</Text>
              {upcoming ? (
                <>
                  <Text style={styles.heroTime}>{upcoming.time || '—'}</Text>
                  <Text style={styles.heroMeta}>
                    {upcoming.title || 'Untitled alarm'} · {upcoming.alarm_type}
                    {upcoming.challenge_type ? ` · ${upcoming.challenge_type}` : ''}
                  </Text>
                  <Text style={styles.heroCountdown}>⏱ {formatCountdown(upcoming.next_trigger)}</Text>
                </>
              ) : (
                <Text style={styles.heroMeta}>No alarm scheduled — set one to begin the loop.</Text>
              )}
            </View>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Challenge')}>
              <Ionicons name="flash-outline" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>PRACTICE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionGhost]} onPress={() => navigation.navigate('AlarmForm')}>
              <Ionicons name="add" size={16} color={BRAND.text} />
              <Text style={[styles.actionBtnText, { color: BRAND.text }]}>NEW ALARM</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Alarm queue */}
        <Text style={styles.sectionLabel}>ACTIVE WINDOWS · {enabled.length}</Text>
        <FlatList
          data={enabled}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity style={[ui.card, styles.alarmItem]} onPress={() => navigation.navigate('Alarm', { alarmId: item.id })}>
              <View style={styles.alarmLeft}>
                <Text style={styles.alarmTime}>{item.time || '—'}</Text>
                <Text style={styles.alarmTitle}>{item.title || 'Untitled Alarm'}</Text>
              </View>
              <View style={styles.alarmRight}>
                <View style={styles.smallPill}>
                  <Text style={styles.smallPillText}>{item.challenge_type || item.alarm_type}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={BRAND.textFaint} />
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No alarms scheduled — lock in a wake-up time.</Text>
          }
        />
      </ScrollView>

      {(offlineMode || syncing) && (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>{syncing ? 'SYNCING…' : 'OFFLINE · CACHED DATA'}</Text>
        </View>
      )}
    </View>
  );
}

export function ScoreBadge({ score, size = 88 }) {
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.ringInner, { width: size - 16, height: size - 16, borderRadius: (size - 16) / 2 }]}>
        <Text style={styles.ringNum}>{score}</Text>
        <Text style={styles.ringCap}>SCORE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.space },
  content: { padding: 20, paddingBottom: 32 },
  loadingText: { color: BRAND.textFaint, marginTop: 14, fontSize: 12, letterSpacing: 3 },
  sysLabel: { color: BRAND.primary, fontSize: 11, fontWeight: '700', letterSpacing: 2.5, marginBottom: 8, textTransform: 'uppercase' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  title: { ...ui.title, fontSize: 24 },
  subtitle: { ...ui.subtitle, marginTop: 2 },
  onlineChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: BRAND.border },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.success, marginRight: 6 },
  onlineText: { color: BRAND.success, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  heroCard: { borderColor: 'rgba(242,89,18,0.45)', ...SHADOWS.orangeGlow },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroSys: { ...ui.sysLabel, color: BRAND.textFaint, fontSize: 10 },
  heroTime: { fontSize: 34, fontWeight: '800', color: BRAND.text, letterSpacing: -0.5, marginTop: 2 },
  heroMeta: { color: BRAND.textDim, fontSize: 13, marginTop: 4, lineHeight: 18 },
  heroCountdown: { color: BRAND.primarySoft, fontSize: 13, fontWeight: '700', marginTop: 6 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BRAND.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, flex: 1, justifyContent: 'center' },
  actionGhost: { backgroundColor: BRAND.surface2, borderWidth: 1, borderColor: BRAND.borderStrong },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  sectionLabel: { color: BRAND.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' },
  alarmItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  alarmLeft: { flex: 1 },
  alarmTime: { fontSize: 22, fontWeight: '700', color: BRAND.text },
  alarmTitle: { color: BRAND.textFaint, fontSize: 13, marginTop: 2 },
  alarmRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallPill: { backgroundColor: 'rgba(92,62,148,0.35)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  smallPillText: { color: BRAND.purpleSoft, fontSize: 11, fontWeight: '600' },
  emptyText: { color: BRAND.textFaint, textAlign: 'center', marginTop: 24, fontSize: 14 },
  ring: {
    borderWidth: 4,
    borderColor: BRAND.primary,
    borderRadius: 44,
    backgroundColor: 'rgba(242,89,18,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    backgroundColor: BRAND.deepPurple,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BRAND.borderStrong,
  },
  ringNum: { fontSize: 30, fontWeight: '800', color: BRAND.text, letterSpacing: -0.5 },
  ringCap: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: BRAND.primarySoft, textTransform: 'uppercase', marginTop: 1 },
  statusBar: { backgroundColor: BRAND.surface2, paddingVertical: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: BRAND.border },
  statusText: { color: BRAND.warm, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
});