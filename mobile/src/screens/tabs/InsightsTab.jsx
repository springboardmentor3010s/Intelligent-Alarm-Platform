import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuthContext } from '../../context/AuthContext';
import { useHabitScore } from '../../hooks/useHabitScore';
import { apiFetch } from '../../utils/api';
import { BRAND, ui } from '../../theme/tokens';
import { ScoreBadge } from './HomeTab';

const WEIGHTS = [
  { key: 'wake_up_consistency', label: 'WAKE-UP CONSISTENCY', weight: '35%' },
  { key: 'challenge_completion', label: 'CHALLENGE COMPLETION', weight: '25%' },
  { key: 'snooze_reduction', label: 'SNOOZE REDUCTION', weight: '20%' },
  { key: 'sleep_schedule_adherence', label: 'SLEEP ADHERENCE', weight: '20%' },
];

export default function InsightsTab() {
  const { token } = useAuthContext();
  const { score, loading, fetchHabitScore } = useHabitScore(token);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchHabitScore();
    apiFetch('/api/v1/habits/score/history?days=7', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [token, fetchHabitScore]);

  if (loading && !score) {
    return (
      <View style={ui.center}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sysLabel}>BEHAVIOR ANALYTICS</Text>
      <Text style={styles.title}>Insights</Text>
      <Text style={styles.subtitle}>Weighted composite · 35 / 25 / 20 / 20</Text>

      <View style={[ui.card, styles.heroCard]}>
        <ScoreBadge score={Number(score?.overall_score) || 0} size={104} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.heroLabel}>OVERALL SCORE</Text>
          <Text style={styles.heroDate}>Tracked · {score?.date || 'today'}</Text>
          <Text style={styles.heroMeta}>
            Built from real wake-ups, challenge completions, snooze windows and sleep schedule adherence.
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>PILLARS</Text>
      {WEIGHTS.map((w) => {
        const value = Number(score?.[w.key]) || 0;
        return (
          <View key={w.key} style={[ui.card, styles.pillar]}>
            <View style={styles.pillarTop}>
              <Text style={styles.pillarLabel}>{w.label}</Text>
              <Text style={styles.pillarValue}>{value}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.min(100, value)}%`, backgroundColor: value >= 70 ? BRAND.success : BRAND.primary }]} />
            </View>
            <Text style={styles.pillarWeight}>WEIGHT {w.weight}</Text>
          </View>
        );
      })}

      <Text style={styles.sectionLabel}>7-DAY TRACK</Text>
      {history.length > 0 ? (
        history.slice(-7).map((h) => {
          const v = Number(h.overall_score) || 0;
          return (
            <View key={h.date} style={styles.histRow}>
              <Text style={styles.histDate}>{String(h.date).slice(5)}</Text>
              <View style={styles.histBar}>
                <View style={[styles.histFill, { width: `${Math.min(100, v)}%` }]} />
              </View>
              <Text style={styles.histVal}>{v}</Text>
            </View>
          );
        })
      ) : (
        <Text style={styles.emptyText}>Not enough data yet — keep waking up to build your trend.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.space },
  content: { padding: 20, paddingBottom: 40 },
  sysLabel: { color: BRAND.primary, fontSize: 11, fontWeight: '700', letterSpacing: 2.5, marginBottom: 8, textTransform: 'uppercase' },
  title: { ...ui.title },
  subtitle: { ...ui.subtitle, marginBottom: 18 },
  heroCard: { flexDirection: 'row', alignItems: 'center', borderColor: 'rgba(62,124,23,0.5)' },
  heroLabel: { color: BRAND.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  heroDate: { color: BRAND.text, fontSize: 15, fontWeight: '700', marginTop: 4 },
  heroMeta: { color: BRAND.textDim, fontSize: 12, marginTop: 6, lineHeight: 17 },
  sectionLabel: { color: BRAND.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginTop: 18, marginBottom: 10, textTransform: 'uppercase' },
  pillar: { marginBottom: 12 },
  pillarTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pillarLabel: { color: BRAND.textDim, fontSize: 13, fontWeight: '600' },
  pillarValue: { color: BRAND.text, fontSize: 20, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: BRAND.surface2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  pillarWeight: { color: BRAND.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 8 },
  histRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  histDate: { color: BRAND.textDim, width: 52, fontSize: 12, fontWeight: '600' },
  histBar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: BRAND.surface2, overflow: 'hidden', marginRight: 10 },
  histFill: { height: '100%', borderRadius: 4, backgroundColor: BRAND.purpleSoft },
  histVal: { color: BRAND.text, width: 26, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  emptyText: { color: BRAND.textFaint, fontSize: 14, textAlign: 'center', marginTop: 16, lineHeight: 20 },
});