import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import NetInfo from '@react-native-community/netinfo';
import { apiFetch } from '../utils/api';

export default function SettingsScreen({ navigation }) {
  const { user, token, logout } = useAuth();
  const [notifications, setNotifications] = useState(user?.notifications !== false);
  const [autoDismiss, setAutoDismiss] = useState(user?.auto_dismiss !== false);
  const [vibrate, setVibrate] = useState(user?.vibrate !== false);
  const [isOnline, setIsOnline] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      const unsubscribe = NetInfo.addEventListener(state => {
        setIsOnline(state.isConnected);
      });
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
      console.error(error);
      Alert.alert('Error', `Failed to update ${key} setting`);
      setter(oldValue); // Revert
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Preferences</Text>
      
      <View style={styles.settingItem}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Push Notifications</Text>
          <Switch
            value={notifications}
            onValueChange={(val) => updateSetting('notifications', val, setNotifications)}
            trackColor={{ false: '#e5e7eb', true: '#3b82f6' }}
          />
        </View>
        <Text style={styles.settingDesc}>Receive reminders and habit score updates</Text>
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Auto-Dismiss</Text>
          <Switch
            value={autoDismiss}
            onValueChange={(val) => updateSetting('auto_dismiss', val, setAutoDismiss)}
            trackColor={{ false: '#e5e7eb', true: '#3b82f6' }}
          />
        </View>
        <Text style={styles.settingDesc}>Dismiss alarm instantly after solving a challenge</Text>
      </View>

      <View style={styles.settingItem}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Haptic Feedback</Text>
          <Switch
            value={vibrate}
            onValueChange={(val) => updateSetting('vibrate', val, setVibrate)}
            trackColor={{ false: '#e5e7eb', true: '#3b82f6' }}
          />
        </View>
        <Text style={styles.settingDesc}>Vibrate device during challenges</Text>
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Connectivity Status</Text>
        <Text style={[styles.statusText, { color: isOnline ? '#10b981' : '#ef4444' }]}>
          {isOnline ? 'Connected to Internet' : 'Offline Mode'}
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', textAlign: 'center', marginBottom: 32 },
  settingItem: { marginBottom: 20, padding: 16, backgroundColor: 'white', borderRadius: 12, elevation: 1 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  settingLabel: { fontSize: 16, color: '#1f2937', fontWeight: '500' },
  settingDesc: { fontSize: 13, color: '#6b7280' },
  statusText: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  logoutBtn: { marginTop: 32, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444' },
  logoutText: { color: '#ef4444', fontWeight: '600', textAlign: 'center', fontSize: 16 }
});
