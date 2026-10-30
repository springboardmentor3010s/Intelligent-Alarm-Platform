// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { useAlarmScheduler } from '../hooks/useAlarmScheduler';
import { useTheme } from '../theme/ThemeContext';
import { SysLabel, ChipRow } from '../components/ui';

const TYPES = ['Daily', 'Weekday', 'Weekend', 'One-Time', 'Smart Adaptive'];
const CHALLENGE_TYPES = ['Math', 'Logic', 'Memory', 'Word', 'Pattern', 'Riddle', 'QuickQuiz'];
const DIFFICULTY = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];
const COUNTS = [3, 4, 5];

export default function AlarmFormScreen({ route, navigation }) {
  const { token } = useAuthContext();
  const { colors, ui, fonts } = useTheme();
  const { syncAlarms } = useAlarmScheduler();
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
          setCount(alarm.question_count || 3);
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
      // Re-plan the on-device reminders so the new/edited window is armed.
      try {
        const fresh = await apiFetch('/api/v1/alarms', { headers: { Authorization: `Bearer ${token}` } });
        if (fresh.ok) await syncAlarms(await fresh.json());
      } catch (e) {
        // scheduling is best-effort; AlarmsTab resyncs on next focus
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save the alarm. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SysLabel icon="settings-outline" tone="violet">Wake-up config</SysLabel>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.displayBold }]}>{alarmId ? 'Edit alarm' : 'New alarm'}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Configure the window that gates your wake-up.</Text>

      <Text style={[styles.fieldLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>TITLE</Text>
      <TextInput
        style={ui.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Wake Up!"
        placeholderTextColor={ui.inputPlaceholder}
      />

      <Text style={[styles.fieldLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>TIME (HH:MM, 24H)</Text>
      <TextInput
        style={ui.input}
        value={time}
        onChangeText={setTime}
        placeholder="07:00"
        placeholderTextColor={ui.inputPlaceholder}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />

      <Text style={[styles.fieldLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>RECURRENCE</Text>
      <ChipRow options={TYPES} active={type} onSelect={setType} />

      <Text style={[styles.fieldLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>CHALLENGE ENGINE</Text>
      <ChipRow options={CHALLENGE_TYPES} active={challengeType} onSelect={setChallengeType} />

      <Text style={[styles.fieldLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>DIFFICULTY</Text>
      <ChipRow options={DIFFICULTY} active={difficulty} onSelect={setDifficulty} />

      <Text style={[styles.fieldLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>QUESTIONS PER WINDOW</Text>
      <ChipRow options={COUNTS.map(String)} active={String(count)} onSelect={(c) => setCount(Number(c))} />

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.violet }, saving && styles.saveBtnDisabled]} onPress={save} disabled={saving} accessibilityRole="button">
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{alarmId ? 'Save changes' : 'Create alarm'}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 26, marginTop: 6 },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: 18, marginBottom: 10 },
  saveBtn: { borderRadius: 12, alignItems: 'center', paddingVertical: 16, marginTop: 28 },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
});