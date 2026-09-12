import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthContext } from '../../context/AuthContext';
import { useHabitScore } from '../../hooks/useHabitScore';
import { apiFetch } from '../../utils/api';
import { useTheme } from '../../theme/ThemeContext';
import { SysLabel, ScoreRing, SectionHeader } from '../../components/ui';

const WEIGHTS = [
  { key: 'wake_up_consistency', label: 'Wake-up consistency', weight: '35%' },
  { key: 'challenge_completion', label: 'Challenge completion', weight: '25%' },
  { key: 'snooze_reduction', label: 'Snooze reduction', weight: '20%' },
  { key: 'sleep_schedule_adherence', label: 'Sleep adherence', weight: '20%' },
];

export default function InsightsTab() {
  const { token } = useAuthContext();
  const { colors, ui, fonts } = useTheme();
  const { score, loading, fetchHabitScore } = useHabitScore(token);
  const [history, setHistory] = useState([]);

  useFocusEffect(
    React.useCallback(() => {
      fetchHabitScore();
      apiFetch('/api/v1/habits/score/history?days=7', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setHistory(Array.isArray(data) ? data : []))
        .catch(() => {});
    }, [token, fetchHabitScore])
  );

  if (loading && !score) {
    return (
      <View style={ui.center}>
        <ActivityIndicator size="large" color={colors.violet} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SysLabel tone="violet">Behavior analytics</SysLabel>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.displayBold }]}>Insights</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Weighted composite · 35 / 25 / 20 / 20</Text>

      <View style={[ui.card, styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ScoreRing score={Number(score?.overall_score) || 0} size={104} label="Score" />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[styles.heroLabel, { color: colors.textFaint, fontFamily: fonts.monoSemi }]}>OVERALL SCORE</Text>
          <Text style={[styles.heroDate, { color: colors.text }]}>Tracked · {score?.date || 'today'}</Text>
          <Text style={[styles.heroMeta, { color: colors.textMuted }]}>
            Built from real wake-ups, challenge completions, snooze windows and sleep schedule adherence.
          </Text>
        </View>
      </View>

      <SectionHeader tone="violet" style={styles.sectionHeader}>Pillars</SectionHeader>
      {WEIGHTS.map((w) => {
        const value = Number(score?.[w.key]) || 0;
        const healthy = value >= 70;
        const fill = healthy ? colors.violet : colors.violetDark;
        return (
          <View key={w.key} style={[ui.card, styles.pillar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.pillarTop}>
              <Text style={[styles.pillarLabel, { color: colors.textMuted }]}>{w.label}</Text>
              <Text style={[styles.pillarValue, { color: colors.text, fontFamily: fonts.displayBold }]}>{value}</Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: colors.surface2 }]}>
              <View style={[styles.barFill, { width: `${Math.min(100, value)}%`, backgroundColor: fill }]} />
            </View>
            <Text style={[styles.pillarWeight, { color: colors.textFaint, fontFamily: fonts.monoMedium }]}>WEIGHT {w.weight}</Text>
          </View>
        );
      })}

      <SectionHeader tone="violet" style={styles.sectionHeader}>7-day track</SectionHeader>
      {history.length > 0 ? (
        history.slice(-7).map((h) => {
          const v = Number(h.overall_score) || 0;
          return (
            <View key={h.date} style={styles.histRow}>
              <Text style={[styles.histDate, { color: colors.textMuted, fontFamily: fonts.monoMedium }]}>{String(h.date).slice(5)}</Text>
              <View style={[styles.histBar, { backgroundColor: colors.surface2 }]}>
                <View style={[styles.histFill, { width: `${Math.min(100, v)}%`, backgroundColor: colors.violet }]} />
              </View>
              <Text style={[styles.histVal, { color: colors.text, fontFamily: fonts.monoMedium }]}>{v}</Text>
            </View>
          );
        })
      ) : (
        <Text style={[styles.emptyText, { color: colors.textFaint }]}>Not enough data yet - keep waking up to build your trend.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, marginTop: 4 },
  subtitle: { fontSize: 14, marginTop: 6, marginBottom: 18 },
  heroCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  heroLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  heroDate: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  heroMeta: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  sectionHeader: { marginTop: 18, marginBottom: 10 },
  pillar: { marginBottom: 12 },
  pillarTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pillarLabel: { fontSize: 13, fontWeight: '600' },
  pillarValue: { fontSize: 20, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  pillarWeight: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 8 },
  histRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  histDate: { width: 52, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  histBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', marginRight: 10 },
  histFill: { height: '100%', borderRadius: 4 },
  histVal: { width: 26, fontSize: 12, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 16, lineHeight: 20 },
});