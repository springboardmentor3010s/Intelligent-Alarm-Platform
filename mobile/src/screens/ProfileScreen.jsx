import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { BRAND, ui } from '../theme/tokens';

export default function ProfileScreen() {
  const { user, token, logout, updateUser } = useAuthContext();
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
        Alert.alert('Success', 'Profile updated successfully!');
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
    <ScrollView style={ui.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sysLabel}><Ionicons name="person-outline" size={12} color={BRAND.primary} /> OPERATOR PROFILE</Text>
      <Text style={styles.title}>Edit Profile</Text>

      <Text style={styles.fieldLabel}>EMAIL</Text>
      <TextInput style={[ui.input, { opacity: 0.6 }]} value={email} editable={false} />

      <Text style={styles.fieldLabel}>FULL NAME</Text>
      <TextInput style={ui.input} value={fullName} onChangeText={setFullName} placeholder="Enter your name" placeholderTextColor={ui.inputPlaceholder} />

      <Text style={styles.fieldLabel}>TIMEZONE</Text>
      <TextInput style={ui.input} value={timezone} onChangeText={setTimezone} placeholder="e.g. UTC, Asia/Kolkata" placeholderTextColor={ui.inputPlaceholder} />

      <Text style={styles.fieldLabel}>DIFFICULTY PREFERENCE</Text>
      <TextInput style={ui.input} value={difficulty} onChangeText={setDifficulty} placeholder="Beginner/Easy/Medium/Hard/Expert" placeholderTextColor={ui.inputPlaceholder} />

      <TouchableOpacity style={[ui.btnPrimary, styles.saveBtn]} onPress={saveProfile} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={ui.btnPrimaryText}>SAVE CHANGES</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color={BRAND.danger} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  sysLabel: { color: BRAND.primary, fontSize: 11, fontWeight: '700', letterSpacing: 2.5, marginBottom: 8, textTransform: 'uppercase' },
  title: { ...ui.title, marginBottom: 24 },
  fieldLabel: { color: BRAND.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
  saveBtn: { marginTop: 28 },
  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24, padding: 12 },
  logoutText: { color: BRAND.danger, fontWeight: '700', fontSize: 15 },
});