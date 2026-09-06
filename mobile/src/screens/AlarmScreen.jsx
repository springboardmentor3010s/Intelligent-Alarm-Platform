import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useChallenge } from '../hooks/useChallenge';
import { apiFetch, authHeaders, parseApiError } from '../utils/api';

export default function AlarmScreen({ navigation }) {
  const { token } = useAuth();
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
      <View style={styles.container}>
        <Text style={styles.title}>Alarm dismissed!</Text>
        <Text style={styles.subtitle}>Great job waking up and solving the challenge.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (initialLoading || loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (error || !activeAlarm) {
    return (
      <View style={styles.container}>
        <Text style={styles.subtitle}>{error || 'No active alarms'}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const questions = current?.puzzle_payload?.questions || [];
  const timedOut = secondsLeft === 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Wake Up Challenge</Text>
      <Text style={styles.subtitle}>Solve all questions to dismiss your alarm</Text>
      {secondsLeft !== null && (
        <Text style={[styles.timer, timedOut && styles.timerExpired]}>
          {timedOut ? 'Time is up' : `Time left: ${secondsLeft}s`}
        </Text>
      )}

      {questions.map((q, index) => (
        <View key={index} style={styles.questionCard}>
          <Text style={styles.questionLabel}>Question {index + 1}</Text>
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
              placeholderTextColor="#6b7280"
              value={String(answers[index] || '')}
              onChangeText={(v) => setAnswerAt(index, v)}
              editable={!timedOut}
            />
          )}
        </View>
      ))}

      <TouchableOpacity
        style={[styles.btn, (submitting || timedOut) && styles.btnDisabled]}
        onPress={handleDismiss}
        disabled={submitting || timedOut}
      >
        {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Submit & Dismiss</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 24, paddingBottom: 48 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#888', marginBottom: 16, textAlign: 'center' },
  timer: { fontSize: 18, fontWeight: '600', color: '#3b82f6', textAlign: 'center', marginBottom: 16 },
  timerExpired: { color: '#ef4444' },
  questionCard: { backgroundColor: '#1f2937', padding: 20, borderRadius: 16, marginBottom: 16 },
  questionLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' },
  questionText: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 16 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap' },
  option: { backgroundColor: '#374151', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginRight: 8, marginBottom: 8 },
  optionSelected: { backgroundColor: '#3b82f6' },
  optionText: { color: '#ddd', fontWeight: '600', fontSize: 16 },
  optionTextSelected: { color: '#fff' },
  input: { backgroundColor: '#374151', borderRadius: 8, padding: 14, fontSize: 18, color: '#fff' },
  btn: { backgroundColor: '#3b82f6', paddingVertical: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});