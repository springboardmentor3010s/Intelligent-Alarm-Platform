import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import NetInfo from '@react-native-community/netinfo';
import { apiFetch } from '../utils/api';
import { BRAND, ui } from '../theme/tokens';

export default function SettingsScreen() {
  const { user, token, logout } = useAuthContext();
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
    <ScrollView style={ui.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sysLabel}><Ionicons name="settings-outline" size={12} color={BRAND.primary} /> SYSTEM PREFERENCES</Text>
      <Text style={styles.title}>Settings</Text>

      <SettingRow
        label="Push Notifications"
        desc="Receive reminders and habit score updates"
        icon="notifications-outline"
        value={notifications}
        onChange={(v) => updateSetting('notifications', v, setNotifications)}
      />
      <SettingRow
        label="Auto-Dismiss"
        desc="Dismiss alarm instantly after solving a challenge"
        icon="flash-outline"
        value={autoDismiss}
        onChange={(v) => updateSetting('auto_dismiss', v, setAutoDismiss)}
      />
      <SettingRow
        label="Haptic Feedback"
        desc="Vibrate device during challenges"
        icon="phone-portrait-outline"
        value={vibrate}
        onChange={(v) => updateSetting('vibrate', v, setVibrate)}
      />

      <View style={styles.connectCard}>
        <Ionicons name={isOnline ? 'wifi' : 'cloud-offline-outline'} size={20} color={isOnline ? BRAND.success : BRAND.danger} />
        <View style={{ marginLeft: 14 }}>
          <Text style={styles.connectLabel}>CONNECTIVITY STATUS</Text>
          <Text style={[styles.connectValue, { color: isOnline ? BRAND.success : BRAND.danger }]}>
            {isOnline ? 'Connected to Internet' : 'Offline Mode'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color={BRAND.danger} />
        <Text style={styles.logoutText}>SIGN OUT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingRow({ label, desc, icon, value, onChange }) {
  return (
    <View style={styles.settingItem}>
      <View style={styles.settingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingLabel}>{label}</Text>
          <Text style={styles.settingDesc}>{desc}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: BRAND.borderStrong, true: BRAND.primary }}
          thumbColor={value ? '#fff' : BRAND.textFaint}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  sysLabel: { color: BRAND.primary, fontSize: 11, fontWeight: '700', letterSpacing: 2.5, marginBottom: 8, textTransform: 'uppercase' },
  title: { ...ui.title, marginBottom: 18 },
  settingItem: { backgroundColor: BRAND.surface, borderRadius: 16, borderWidth: 1, borderColor: BRAND.border, padding: 16, marginBottom: 12 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { color: BRAND.text, fontSize: 15, fontWeight: '600' },
  settingDesc: { color: BRAND.textFaint, fontSize: 12, marginTop: 4, lineHeight: 17 },
  connectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surface2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 16,
    marginTop: 6,
  },
  connectLabel: { color: BRAND.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  connectValue: { fontSize: 14, fontWeight: '700', marginTop: 3 },
  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 28, padding: 14, borderWidth: 1, borderColor: 'rgba(240,107,130,0.4)', borderRadius: 12 },
  logoutText: { color: BRAND.danger, fontWeight: '700', fontSize: 15, letterSpacing: 1 },
});