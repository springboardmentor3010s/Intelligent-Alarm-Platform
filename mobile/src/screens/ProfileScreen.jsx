import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

export default function ProfileScreen({ navigation }) {
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
        headers: { 
          Authorization: `Bearer ${token}`
        },
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
      console.error(error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput style={[styles.input, { backgroundColor: '#e5e7eb' }]} value={email} editable={false} />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Enter your name" />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Timezone</Text>
        <TextInput style={styles.input} value={timezone} onChangeText={setTimezone} placeholder="e.g. UTC, Asia/Kolkata" />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Difficulty Preference</Text>
        <TextInput style={styles.input} value={difficulty} onChangeText={setDifficulty} placeholder="Beginner/Easy/Medium/Hard/Expert" />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={loading}>
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>Save Changes</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', textAlign: 'center', marginBottom: 32 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, width: '100%', backgroundColor: 'white' },
  saveBtn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 8, width: '100%', alignItems: 'center', marginTop: 24 },
  saveText: { color: 'white', fontWeight: '600', fontSize: 16 },
  logoutBtn: { marginTop: 24, alignSelf: 'center', padding: 10 },
  logoutText: { color: '#ef4444', fontWeight: '600' }
});
