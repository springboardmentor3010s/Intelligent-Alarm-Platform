// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { useChallenge } from '../hooks/useChallenge';
import { useAlarmScheduler } from '../hooks/useAlarmScheduler';
import { apiFetch, authHeaders, parseApiError } from '../utils/api';
import { useTheme } from '../theme/ThemeContext';
import { SysLabel } from '../components/ui';

export default function AlarmScreen({ navigation, route }) {
  const { token } = useAuthContext();
  const { colors, ui, fonts } = useTheme();
  const { current, loading, fetchChallenge, submitChallenge, elapsedSeconds } = useChallenge(token);
  const { syncAlarms } = useAlarmScheduler();
  const requestedAlarmId = route?.params?.alarmId;
  const [activeAlarm, setActiveAlarm] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [answers, setAnswers] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState(null);

  const loadFlow = useCallback(async () => {
    if (!token) return;
    setInitialLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/alarms', { headers: authHeaders(token) });
      if (!res.ok) throw new Error(await parseApiError(res));
      const alarms = await res.json();
      const target = requestedAlarmId
        ? alarms.find((a) => a.id === requestedAlarmId) || null
        : null;
      const enabled = target || alarms.find((a) => a.is_enabled);
      setActiveAlarm(enabled || null);
      if (enabled) {
        const challenge = await fetchChallenge({
          challengeType: enabled.challenge_type,
          difficulty: enabled.difficulty,
        });
        const total = challenge.puzzle_payload.total_questions || 1;
        setAnswers(Array(total).fill(''));
        setSecondsLeft(challenge.puzzle_payload.timeout_seconds || 90);
      }
    } catch (e) {
      setError(e.message || 'Failed to load alarm');
    } finally {
      setInitialLoading(false);
    }
  }, [token, requestedAlarmId]);

  useFocusEffect(
    useCallback(() => {
      loadFlow();
    }, [loadFlow])
  );

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0 || dismissed) return;
    const timer = setInterval(() => setSecondsLeft((s) => (s === null ? s : Math.max(0, s - 1))), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, dismissed]);

  const setAnswerAt = (index, value) => {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  };

  const handleDismiss = async () => {
    if (!current) return;
    if (answers.some((a) => !String(a).trim())) {
      Alert.alert('Incomplete', 'Answer all questions before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const timeTaken = elapsedSeconds();
      const result = await submitChallenge(answers, timeTaken);
      if (result.completed && result.correct) {
        const res = await apiFetch(`/api/v1/alarms/${activeAlarm.id}/dismiss`, {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify({
            challenge_attempt_id: result.challenge_attempt_id,
            correct_answers: result.correct_answers,
            total_questions: result.total_questions,
            time_taken_seconds: timeTaken,
          }),
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        setDismissed(true);
        // Recurring alarms were rescheduled server-side; mirror that on-device.
        try {
          const fresh = await apiFetch('/api/v1/alarms', { headers: authHeaders(token) });
          if (fresh.ok) await syncAlarms(await fresh.json());
        } catch (e) {
          // scheduling is best-effort; the next focus sync will retry
        }
      } else {
        Alert.alert(
          'Try again',
          `Incorrect (${result.correct_answers}/${result.total_questions}). A new challenge will be generated.`
        );
        await loadFlow();
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to dismiss alarm');
    } finally {
      setSubmitting(false);
    }
  };

  if (dismissed) {
    return (
      <View style={ui.center}>
        <Ionicons name="checkmark-circle" size={72} color={colors.violet} />
        <Text style={[styles.dismissTitle, { color: colors.text, fontFamily: fonts.displayBold }]}>Alarm dismissed</Text>
        <Text style={[styles.dismissSub, { color: colors.textMuted }]}>Great job waking up and solving the challenge.</Text>
        <TouchableOpacity style={ui.btnPrimary} onPress={() => navigation.goBack()}>
          <Text style={ui.btnPrimaryText}>Back to home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (initialLoading || loading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator size="large" color={colors.violet} />
        <Text style={[styles.loadingText, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>ARMING CHALLENGE</Text>
      </View>
    );
  }

  if (error || !activeAlarm) {
    return (
      <View style={ui.center}>
        <Text style={[styles.dismissSub, { color: colors.textMuted }]}>{error || 'No active alarms'}</Text>
        <TouchableOpacity style={ui.btnGhost} onPress={() => navigation.goBack()}>
          <Text style={ui.btnGhostText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const questions = current?.puzzle_payload?.questions || [];
  const timedOut = secondsLeft === 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SysLabel icon="alarm-outline" tone="violet">Wake-up verification</SysLabel>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.displayBold }]}>Solve to dismiss</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Complete every question to unlock this alarm.</Text>
      {secondsLeft !== null && (
        <View
          style={[
            styles.timerPill,
            {
              backgroundColor: colors.surface2,
              borderColor: timedOut ? colors.roseSoft : colors.violetSoft,
            },
          ]}
        >
          <Ionicons name="timer-outline" size={16} color={timedOut ? colors.rose : colors.violet} />
          <Text
            style={[
              styles.timerText,
              { color: timedOut ? colors.rose : colors.violet, fontFamily: fonts.monoBold },
            ]}
          >
            {timedOut ? 'TIME IS UP' : `${secondsLeft}s REMAINING`}
          </Text>
        </View>
      )}

      {questions.map((q, index) => (
        <View key={index} style={[ui.card, styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.questionLabel, { color: colors.violet, fontFamily: fonts.monoBold }]}>QUESTION {index + 1}</Text>
          <Text style={[styles.questionText, { color: colors.text }]}>{q.prompt}</Text>
          {q.options && q.options.length > 0 ? (
            <View style={styles.optionRow}>
              {q.options.map((opt) => {
                const selected = answers[index] === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.option,
                      {
                        backgroundColor: selected ? colors.violet : colors.surface2,
                        borderColor: selected ? colors.violet : colors.borderStrong,
                      },
                    ]}
                    onPress={() => setAnswerAt(index, opt)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Option ${opt}`}
                  >
                    <Text style={[styles.optionText, { color: selected ? '#FFFFFF' : colors.textMuted }]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface2, borderColor: colors.borderStrong, color: colors.text }]}
              placeholder="Your answer"
              placeholderTextColor={colors.textFaint}
              value={String(answers[index] || '')}
              onChangeText={(v) => setAnswerAt(index, v)}
              editable={!timedOut}
            />
          )}
        </View>
      ))}

      <TouchableOpacity
        style={[ui.btnPrimary, (submitting || timedOut) && styles.btnDisabled]}
        onPress={handleDismiss}
        disabled={submitting || timedOut}
        accessibilityRole="button"
        accessibilityLabel="Submit and dismiss alarm"
      >
        {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={ui.btnPrimaryText}>Submit & dismiss</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  loadingText: { marginTop: 14, fontSize: 12, letterSpacing: 3 },
  title: { fontSize: 28, marginTop: 6 },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 18 },
  dismissTitle: { fontSize: 28, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  dismissSub: { fontSize: 15, textAlign: 'center', marginBottom: 24, maxWidth: 280 },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    marginBottom: 18,
  },
  timerText: { fontSize: 13, fontWeight: '800', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  questionCard: { borderWidth: 1 },
  questionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  questionText: { fontSize: 18, fontWeight: '600', marginBottom: 16, lineHeight: 25 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  optionText: { fontWeight: '600', fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18, width: '100%' },
  btnDisabled: { opacity: 0.5 },
});