import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { SysLabel, StatusPill, SectionHeader, ConnectRow } from '../../components/ui';

const LINKS = [
  {
    icon: 'mail-outline',
    label: 'Email',
    sublabel: 'iampawansimha.2004@gmail.com',
    url: 'mailto:iampawansimha.2004@gmail.com',
  },
  { icon: 'logo-github', label: 'GitHub', sublabel: 'github.com/PawanSimha', url: 'https://github.com/PawanSimha' },
  { icon: 'logo-linkedin', label: 'LinkedIn', sublabel: 'linkedin.com/in/pawansimha', url: 'https://www.linkedin.com/in/pawansimha' },
  { icon: 'globe-outline', label: 'Portfolio', sublabel: 'portfolio-pawansimha.vercel.app', url: 'https://portfolio-pawansimha.vercel.app' },
  { icon: 'logo-google', label: 'Google Developer', sublabel: 'g.dev/pawansimha', url: 'https://g.dev/pawansimha' },
];

export default function ProfileTab({ navigation }) {
  const { user, logout } = useAuthContext();
  const { colors, ui, fonts } = useTheme();

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
        </View>
        <StatusPill label="Verified" tone="emerald" />
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <InfoRow label="TIME ZONE" value={user?.timezone || 'UTC'} colors={colors} fonts={fonts} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <InfoRow label="DIFFICULTY PREFS" value={user?.difficulty_preference || 'Medium'} colors={colors} fonts={fonts} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <InfoRow label="HABIT ENGINE" value="35 / 25 / 20 / 20" colors={colors} fonts={fonts} />
      </View>

      <SectionHeader tone="violet" style={styles.sectionHeader}>About</SectionHeader>
      <View style={[ui.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.aboutText, { color: colors.textMuted }]}>
          CerebroKognit is an intelligent cognitive alarm and habit platform. Built by Pawan Simha, MCA student at Sapthagiri
          NPS University, as part of the Infosys Virtual Internship 7.0 program. Project mentor: Shanmukha Priya.
        </Text>
      </View>

      <SectionHeader tone="violet" style={styles.sectionHeader}>Connect</SectionHeader>
      {LINKS.map((l) => (
        <ConnectRow key={l.label} icon={l.icon} label={l.label} sublabel={l.sublabel} url={l.url} accessibilityLabel={`${l.label} - CerebroKognit project owner`} />
      ))}

      <SectionHeader tone="violet" style={styles.sectionHeader}>Controls</SectionHeader>
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
  infoCard: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 18 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, marginVertical: 12 },
  sectionHeader: { marginTop: 6, marginBottom: 10 },
  aboutText: { fontSize: 13, lineHeight: 20 },
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