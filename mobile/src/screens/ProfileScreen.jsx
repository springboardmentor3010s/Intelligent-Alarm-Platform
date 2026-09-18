// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { useTheme } from '../theme/ThemeContext';
import { SysLabel, ChipRow } from '../components/ui';

const DIFFICULTY = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];

export default function ProfileScreen() {
  const { user, token, logout, updateUser } = useAuthContext();
  const { colors, ui, fonts } = useTheme();
  const [email, setEmail] = useState(user?.email || '');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [difficulty, setDifficulty] = useState(user?.difficulty_preference || 'Medium');
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      setEmail(user?.email || '');
      setFullName(user?.full_name || '');
      setTimezone(user?.timezone || 'UTC');
      setDifficulty(user?.difficulty_preference || 'Medium');
    }, [user])
  );

  const saveProfile = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/v1/users/profile', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, timezone, difficulty_preference: difficulty })
      });

      if (response.ok) {
        const profile = await response.json();
        await updateUser(profile);
        Alert.alert('Profile updated', 'Your profile was saved.');
      } else {
        Alert.alert('Error', 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SysLabel icon="person-outline" tone="violet">Operator profile</SysLabel>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.displayBold }]}>Edit profile</Text>

      <Text style={[styles.fieldLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>EMAIL</Text>
      <TextInput style={[ui.input, { opacity: 0.6 }]} value={email} editable={false} />

      <Text style={[styles.fieldLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>FULL NAME</Text>
      <TextInput style={ui.input} value={fullName} onChangeText={setFullName} placeholder="Enter your name" placeholderTextColor={ui.inputPlaceholder} />

      <Text style={[styles.fieldLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>TIMEZONE</Text>
      <TextInput style={ui.input} value={timezone} onChangeText={setTimezone} placeholder="e.g. UTC, Asia/Kolkata" placeholderTextColor={ui.inputPlaceholder} />

      <Text style={[styles.fieldLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>DIFFICULTY PREFERENCE</Text>
      <ChipRow options={DIFFICULTY} active={difficulty} onSelect={setDifficulty} />

      <TouchableOpacity style={[ui.btnPrimary, styles.saveBtn]} onPress={saveProfile} disabled={loading} accessibilityRole="button">
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={ui.btnPrimaryText}>Save changes</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout} accessibilityRole="button" accessibilityLabel="Log out">
        <Ionicons name="log-out-outline" size={18} color={colors.rose} />
        <Text style={[styles.logoutText, { color: colors.rose }]}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, marginTop: 6, marginBottom: 18 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
  saveBtn: { marginTop: 28 },
  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24, padding: 12 },
  logoutText: { fontWeight: '700', fontSize: 15 },
});