import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../context/AuthContext';
import { BRAND, ui } from '../../theme/tokens';

export default function ProfileTab({ navigation }) {
  const { user, logout } = useAuthContext();

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
      <Text style={styles.sysLabel}>
        <Ionicons name="person-outline" size={12} color={BRAND.primary} /> OPERATOR IDENTITY
      </Text>
      <Text style={styles.title}>Profile</Text>

      <View style={[ui.card, styles.idCard]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || 'U'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.full_name || 'Cerebro Operator'}</Text>
          <Text style={styles.email}>{user?.email || '—'}</Text>
        </View>
        <View style={styles.statusChip}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>VERIFIED</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <InfoRow label="TIME ZONE" value={user?.timezone || 'UTC'} />
        <View style={styles.divider} />
        <InfoRow label="DIFFICULTY PREFS" value={user?.difficulty_preference || 'Medium'} />
        <View style={styles.divider} />
        <InfoRow label="HABIT ENGINE" value="35 / 25 / 20 / 20" />
      </View>

      <Text style={styles.sectionLabel}>CONTROLS</Text>
      <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Profile')}>
        <Ionicons name="create-outline" size={20} color={BRAND.textDim} />
        <Text style={styles.actionText}>Edit Profile</Text>
        <Ionicons name="chevron-forward" size={18} color={BRAND.textFaint} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Settings')}>
        <Ionicons name="settings-outline" size={20} color={BRAND.textDim} />
        <Text style={styles.actionText}>Settings</Text>
        <Ionicons name="chevron-forward" size={18} color={BRAND.textFaint} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.actionRow, styles.dangerRow]} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={20} color={BRAND.danger} />
        <Text style={[styles.actionText, { color: BRAND.danger }]}>Log Out</Text>
        <View style={{ flex: 1 }} />
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.space },
  content: { padding: 20, paddingBottom: 40 },
  sysLabel: { color: BRAND.primary, fontSize: 11, fontWeight: '700', letterSpacing: 2.5, marginBottom: 8, textTransform: 'uppercase' },
  title: { ...ui.title },
  idCard: { flexDirection: 'row', alignItems: 'center', borderColor: 'rgba(242,89,18,0.4)' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(242,89,18,0.2)',
    borderWidth: 2,
    borderColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { color: BRAND.text, fontSize: 20, fontWeight: '800' },
  name: { color: BRAND.text, fontSize: 18, fontWeight: '700' },
  email: { color: BRAND.textFaint, fontSize: 13, marginTop: 2 },
  statusChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.success, marginRight: 6 },
  statusText: { color: BRAND.success, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  infoCard: { backgroundColor: BRAND.surface, borderRadius: 16, borderWidth: 1, borderColor: BRAND.border, padding: 18, marginBottom: 18 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { color: BRAND.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  infoValue: { color: BRAND.textDim, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: BRAND.border, marginVertical: 12 },
  sectionLabel: { color: BRAND.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: BRAND.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 16,
    marginBottom: 10,
  },
  actionText: { flex: 1, color: BRAND.text, fontSize: 15, fontWeight: '600' },
  dangerRow: { borderColor: 'rgba(240,107,130,0.35)' },
});