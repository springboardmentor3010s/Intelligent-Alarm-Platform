import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { useChallenge } from '../hooks/useChallenge';
import { apiFetch, authHeaders, parseApiError } from '../utils/api';
import { BRAND, ui } from '../theme/tokens';

export default function AlarmScreen({ navigation }) {
  const { token } = useAuthContext();
  const { current, loading, fetchChallenge, submitChallenge, elapsedSeconds } = useChallenge(token);
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
      const enabled = alarms.find((a) => a.is_enabled);
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
  }, [token]);

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
        <Ionicons name="checkmark-circle" size={72} color={BRAND.success} />
        <Text style={styles.dismissTitle}>ALARM DISMISSED</Text>
        <Text style={styles.dismissSub}>Great job waking up and solving the challenge.</Text>
        <TouchableOpacity style={ui.btnPrimary} onPress={() => navigation.goBack()}>
          <Text style={ui.btnPrimaryText}>BACK TO HOME</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (initialLoading || loading) {
    return (
      <View style={ui.center}>
        <ActivityIndicator size="large" color={BRAND.primary} />
        <Text style={styles.loadingText}>ARMING CHALLENGE…</Text>
      </View>
    );
  }

  if (error || !activeAlarm) {
    return (
      <View style={ui.center}>
        <Text style={styles.dismissSub}>{error || 'No active alarms'}</Text>
        <TouchableOpacity style={ui.btnGhost} onPress={() => navigation.goBack()}>
          <Text style={ui.btnGhostText}>GO BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const questions = current?.puzzle_payload?.questions || [];
  const timedOut = secondsLeft === 0;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sysLabel}><Ionicons name="alarm-outline" size={12} color={BRAND.primary} /> WAKE-UP VERIFICATION</Text>
      <Text style={styles.title}>Solve to Dismiss</Text>
      <Text style={styles.subtitle}>Complete every question to unlock this alarm.</Text>
      {secondsLeft !== null && (
        <View style={[styles.timerPill, timedOut && styles.timerExpired]}>
          <Ionicons name="timer-outline" size={16} color={timedOut ? BRAND.danger : BRAND.warm} />
          <Text style={[styles.timerText, timedOut && { color: BRAND.danger }]}>
            {timedOut ? 'TIME IS UP' : `${secondsLeft}s REMAINING`}
          </Text>
        </View>
      )}

      {questions.map((q, index) => (
        <View key={index} style={[ui.card, styles.questionCard]}>
          <Text style={styles.questionLabel}>QUESTION {index + 1}</Text>
          <Text style={styles.questionText}>{q.prompt}</Text>
          {q.options && q.options.length > 0 ? (
            <View style={styles.optionRow}>
              {q.options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.option, answers[index] === opt && styles.optionSelected]}
                  onPress={() => setAnswerAt(index, opt)}
                >
                  <Text style={[styles.optionText, answers[index] === opt && styles.optionTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TextInput
              style={styles.input}
              placeholder="Your answer"
              placeholderTextColor={ui.inputPlaceholder}
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
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={ui.btnPrimaryText}>SUBMIT & DISMISS</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  loadingText: { color: BRAND.textFaint, marginTop: 14, fontSize: 12, letterSpacing: 3 },
  sysLabel: { color: BRAND.primary, fontSize: 11, fontWeight: '700', letterSpacing: 2.5, marginBottom: 8, textTransform: 'uppercase' },
  title: { ...ui.title },
  subtitle: { ...ui.subtitle, marginBottom: 18 },
  dismissTitle: { fontSize: 28, fontWeight: '800', color: BRAND.text, marginTop: 10, marginBottom: 6 },
  dismissSub: { fontSize: 15, color: BRAND.textDim, textAlign: 'center', marginBottom: 24, maxWidth: 280 },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND.surface2,
    borderWidth: 1,
    borderColor: 'rgba(244,164,66,0.4)',
    borderRadius: 999,
    paddingVertical: 10,
    marginBottom: 18,
  },
  timerExpired: { borderColor: 'rgba(224,90,90,0.5)' },
  timerText: { color: BRAND.warm, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  questionCard: {},
  questionLabel: { color: BRAND.primarySoft, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' },
  questionText: { fontSize: 18, fontWeight: '600', color: BRAND.text, marginBottom: 16, lineHeight: 25 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    backgroundColor: BRAND.surface2,
    borderWidth: 1,
    borderColor: BRAND.borderStrong,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  optionSelected: { backgroundColor: BRAND.primary, borderColor: BRAND.primary },
  optionText: { color: BRAND.textDim, fontWeight: '600', fontSize: 16 },
  optionTextSelected: { color: '#fff' },
  input: {
    backgroundColor: BRAND.inputBg,
    borderWidth: 1,
    borderColor: BRAND.borderStrong,
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    color: BRAND.text,
  },
  btnDisabled: { opacity: 0.5 },
});