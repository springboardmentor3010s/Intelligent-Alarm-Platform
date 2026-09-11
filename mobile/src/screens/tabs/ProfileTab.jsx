import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../context/AuthContext';
import { useHabitScore } from '../../hooks/useHabitScore';
import { useTheme } from '../../theme/ThemeContext';
import { SysLabel, StatusPill, SectionHeader, ScoreRing } from '../../components/ui';

const METRICS = [
  { key: 'wake_up_consistency', label: 'WAKE-UP' },
  { key: 'challenge_completion', label: 'CHALLENGE' },
  { key: 'snooze_reduction', label: 'SNOOZE' },
  { key: 'sleep_schedule_adherence', label: 'SLEEP' },
];

export default function ProfileTab({ navigation }) {
  const { user, token, logout } = useAuthContext();
  const { colors, ui, fonts } = useTheme();
  const { score, loading } = useHabitScore(token);

  const confirmLogout = () => {
    Alert.alert('Log out', 'End this session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const initials = String(user?.full_name || user?.email || 'U')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const overall = score?.overall_score;
  const ringValue = loading || overall === undefined || overall === null ? '–' : overall;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SysLabel icon="person-outline" tone="violet">Operator identity</SysLabel>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.displayBold }]}>Profile</Text>

      <View style={[ui.card, styles.idCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.violetSoft, borderColor: colors.violet }]}>
          <Text style={[styles.avatarText, { color: colors.violet }]}>{initials || 'U'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.text }]}>{user?.full_name || 'Cerebro Operator'}</Text>
          <Text style={[styles.email, { color: colors.textFaint, fontFamily: fonts.monoMedium }]} numberOfLines={1}>
            {user?.email || 'No email set'}
          </Text>
          <StatusPill label="Verified" tone="emerald" style={styles.verifiedPill} />
        </View>
      </View>

      <View style={[ui.card, styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.scoreStage, { borderColor: colors.border }]}>
          <ScoreRing score={ringValue} size={86} label="Score" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.scoreLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>DAILY SCORE</Text>
          <Text style={[styles.scoreSub, { color: colors.textMuted }]}>
            {loading ? 'Loading your consistency…' : 'Today, across all four pillars.'}
          </Text>
          <View style={styles.metricGrid}>
            {METRICS.map((m) => {
              const value = score?.[m.key];
              return (
                <View key={m.key} style={styles.metricCell}>
                  <Text style={[styles.metricValue, { color: colors.text, fontFamily: fonts.monoSemi }]}>
                    {value === undefined || value === null ? '–' : value}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.textFaint, fontFamily: fonts.monoMedium }]}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <InfoRow label="TIME ZONE" value={user?.timezone || 'UTC'} colors={colors} fonts={fonts} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <InfoRow label="DIFFICULTY PREFS" value={user?.difficulty_preference || 'Medium'} colors={colors} fonts={fonts} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <InfoRow label="HABIT ENGINE" value="35 / 25 / 20 / 20" colors={colors} fonts={fonts} />
      </View>

      <SectionHeader tone="violet" style={styles.sectionHeader}>Controls</SectionHeader>
      <TouchableOpacity
        style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('About')}
        accessibilityRole="button"
        accessibilityLabel="About and Connect"
      >
        <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
        <Text style={[styles.actionText, { color: colors.text }]}>About & Connect</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('Profile')}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
      >
        <Ionicons name="create-outline" size={20} color={colors.textMuted} />
        <Text style={[styles.actionText, { color: colors.text }]}>Edit profile</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('Settings')}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
        <Text style={[styles.actionText, { color: colors.text }]}>Settings</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionRow, styles.dangerRow, { backgroundColor: colors.surface, borderColor: colors.roseSoft }]}
        onPress={confirmLogout}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Ionicons name="log-out-outline" size={20} color={colors.rose} />
        <Text style={[styles.actionText, { color: colors.rose }]}>Log out</Text>
        <View style={{ flex: 1 }} />
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value, colors, fonts }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textFaint, fontFamily: fonts.monoSemi }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.textMuted }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, marginTop: 4, marginBottom: 18 },
  idCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarText: { fontSize: 20, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '700' },
  email: { fontSize: 12, marginTop: 2 },
  verifiedPill: { alignSelf: 'flex-start', marginTop: 8 },
  scoreCard: { flexDirection: 'row', borderWidth: 1, alignItems: 'center' },
  scoreStage: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  scoreLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  scoreSub: { fontSize: 12, lineHeight: 17 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 10 },
  metricCell: { width: '45%' },
  metricValue: { fontSize: 16, fontWeight: '700' },
  metricLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginTop: 2 },
  infoCard: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 18 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, marginVertical: 12 },
  sectionHeader: { marginTop: 6, marginBottom: 10 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  actionText: { flex: 1, fontSize: 15, fontWeight: '600' },
  dangerRow: { borderWidth: 1 },
});