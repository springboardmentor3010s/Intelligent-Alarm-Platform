import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import NetInfo from '@react-native-community/netinfo';
import { apiFetch } from '../utils/api';
import { SysLabel, SectionHeader, ChipRow } from '../components/ui';

const MODE_CHOICES = ['Dark', 'Light', 'System'];

export default function SettingsScreen() {
  const { user, token, logout } = useAuthContext();
  const { colors, ui, fonts, mode, setMode } = useTheme();
  const [notifications, setNotifications] = useState(user?.notifications !== false);
  const [autoDismiss, setAutoDismiss] = useState(user?.auto_dismiss !== false);
  const [vibrate, setVibrate] = useState(user?.vibrate !== false);
  const [isOnline, setIsOnline] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      const unsubscribe = NetInfo.addEventListener((state) => setIsOnline(state.isConnected));
      return () => unsubscribe();
    }, [])
  );

  const updateSetting = async (key, value, setter) => {
    const oldValue = !value;
    setter(value);
    try {
      const response = await apiFetch(`/api/v1/users/${key}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [key]: value })
      });
      if (!response.ok) throw new Error('Failed to update');
    } catch (error) {
      Alert.alert('Error', `Failed to update ${key} setting`);
      setter(oldValue);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SysLabel icon="settings-outline" tone="violet">System preferences</SysLabel>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.displayBold }]}>Settings</Text>

      <SectionHeader tone="violet" style={styles.sectionHeader}>Notifications</SectionHeader>
      <SettingRow
        label="Push notifications"
        desc="Receive reminders and habit score updates"
        icon="notifications-outline"
        value={notifications}
        onChange={(v) => updateSetting('notifications', v, setNotifications)}
      />
      <SettingRow
        label="Auto-dismiss"
        desc="Dismiss alarm instantly after solving a challenge"
        icon="flash-outline"
        value={autoDismiss}
        onChange={(v) => updateSetting('auto_dismiss', v, setAutoDismiss)}
      />
      <SettingRow
        label="Haptic feedback"
        desc="Vibrate device during challenges"
        icon="phone-portrait-outline"
        value={vibrate}
        onChange={(v) => updateSetting('vibrate', v, setVibrate)}
      />

      <SectionHeader tone="violet" style={styles.sectionHeader}>Appearance</SectionHeader>
      <ChipRow options={MODE_CHOICES} active={mode || 'dark'} onSelect={(label) => setMode(label.toLowerCase())} />

      <View style={[styles.connectCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
        <Ionicons name={isOnline ? 'wifi' : 'cloud-offline-outline'} size={20} color={isOnline ? colors.emerald : colors.rose} />
        <View style={{ marginLeft: 14 }}>
          <Text style={[styles.connectLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>CONNECTIVITY STATUS</Text>
          <Text style={[styles.connectValue, { color: isOnline ? colors.emerald : colors.rose }]}>
            {isOnline ? 'Connected to internet' : 'Offline mode'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: colors.roseSoft }]}
        onPress={logout}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Ionicons name="log-out-outline" size={18} color={colors.rose} />
        <Text style={[styles.logoutText, { color: colors.rose }]}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingRow({ label, desc, icon, value, onChange }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.settingRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.settingDesc, { color: colors.textMuted }]}>{desc}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.borderStrong, true: colors.violet }}
          thumbColor={value ? '#FFFFFF' : colors.textFaint}
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, marginTop: 6, marginBottom: 18 },
  sectionHeader: { marginTop: 6, marginBottom: 10 },
  settingItem: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { fontSize: 15, fontWeight: '600' },
  settingDesc: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  connectCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 18 },
  connectLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  connectValue: { fontSize: 14, fontWeight: '700', marginTop: 3 },
  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 28, padding: 14, borderWidth: 1, borderRadius: 12 },
  logoutText: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
});