import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { BRAND, ui } from '../theme/tokens';

const TYPES = ['Daily', 'Weekday', 'Weekend', 'One-Time', 'Smart Adaptive'];
const CHALLENGE_TYPES = ['Math', 'Logic', 'Memory', 'Word', 'Pattern', 'Riddle', 'QuickQuiz'];
const DIFFICULTY = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];
const COUNTS = [3, 4, 5];

export default function AlarmFormScreen({ route, navigation }) {
  const { token } = useAuthContext();
  const alarmId = route.params?.alarmId;

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState('Daily');
  const [challengeType, setChallengeType] = useState('Math');
  const [difficulty, setDifficulty] = useState('Medium');
  const [count, setCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!alarmId) return;
      apiFetch(`/api/v1/alarms`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => {
          const alarm = Array.isArray(list) ? list.find((a) => a.id === alarmId) : null;
          if (!alarm) return;
          setTitle(alarm.title || '');
          setTime(alarm.time || '');
          setType(alarm.alarm_type || 'Daily');
          setChallengeType(alarm.challenge_type || 'Math');
          setDifficulty(alarm.difficulty || 'Medium');
        })
        .catch(() => {});
    }, [alarmId, token])
  );

  const save = async () => {
    if (!title.trim()) return Alert.alert('Missing', 'Give the alarm a title.');
    if (!/^\d{2}:\d{2}$/.test(time.trim())) return Alert.alert('Missing', 'Enter wake-up time as HH:MM (24h).');

    setSaving(true);
    try {
      const body = JSON.stringify({
        title: title.trim(),
        type,
        time: time.trim(),
        recurrence: type === 'One-Time' ? undefined : 'Daily',
        challenge_type: challengeType,
        difficulty,
        question_count: count,
      });
      const res = await apiFetch(alarmId ? `/api/v1/alarms/${alarmId}` : '/api/v1/alarms', {
        method: alarmId ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) throw new Error('Request failed');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save the alarm. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sysLabel}><Ionicons name="settings-outline" size={12} color={BRAND.primary} /> WAKE-UP CONFIG</Text>
      <Text style={styles.title}>{alarmId ? 'Edit Alarm' : 'New Alarm'}</Text>
      <Text style={styles.subtitle}>Configure the window that gates your wake-up.</Text>

      <Text style={styles.fieldLabel}>TITLE</Text>
      <TextInput
        style={ui.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Wake Up!"
        placeholderTextColor={ui.inputPlaceholder}
      />

      <Text style={styles.fieldLabel}>TIME (HH:MM, 24H)</Text>
      <TextInput
        style={ui.input}
        value={time}
        onChangeText={setTime}
        placeholder="07:00"
        placeholderTextColor={ui.inputPlaceholder}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />

      <Text style={styles.fieldLabel}>RECURRENCE</Text>
      <ChipRow options={TYPES} active={type} onSelect={setType} />

      <Text style={styles.fieldLabel}>CHALLENGE ENGINE</Text>
      <ChipRow options={CHALLENGE_TYPES} active={challengeType} onSelect={setChallengeType} />

      <Text style={styles.fieldLabel}>DIFFICULTY</Text>
      <ChipRow options={DIFFICULTY} active={difficulty} onSelect={setDifficulty} />

      <Text style={styles.fieldLabel}>QUESTIONS PER WINDOW</Text>
      <ChipRow options={COUNTS.map(String)} active={String(count)} onSelect={(c) => setCount(Number(c))} />

      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{alarmId ? 'SAVE CHANGES' : 'CREATE ALARM'}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function ChipRow({ options, active, onSelect }) {
  return (
    <View style={styles.chipWrap}>
      {options.map((opt) => {
        const isActive = opt === active;
        return (
          <TouchableOpacity key={opt} style={[styles.chip, isActive && styles.chipActive]} onPress={() => onSelect(opt)}>
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.space },
  content: { padding: 20, paddingBottom: 48 },
  sysLabel: { color: BRAND.primary, fontSize: 11, fontWeight: '700', letterSpacing: 2.5, marginBottom: 8, textTransform: 'uppercase' },
  title: { ...ui.title },
  subtitle: { ...ui.subtitle, marginBottom: 24 },
  fieldLabel: { color: BRAND.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: 18, marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: BRAND.surface2,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: BRAND.deepPurple, borderColor: BRAND.primary },
  chipText: { color: BRAND.textDim, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: BRAND.text },
  saveBtn: { backgroundColor: BRAND.primary, borderRadius: 12, alignItems: 'center', paddingVertical: 16, marginTop: 28 },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 1 },
});