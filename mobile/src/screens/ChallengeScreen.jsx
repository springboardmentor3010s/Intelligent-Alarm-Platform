import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthContext } from '../context/AuthContext';
import { useChallenge } from '../hooks/useChallenge';
import { offlineStore } from '../sync/offlineStore';

const normalizeType = (raw) => {
  if (!raw) return undefined;
  const lower = String(raw).toLowerCase();
  const map = { math: 'Math', logic: 'Logic', memory: 'Memory', word: 'Word', pattern: 'Pattern', riddle: 'Riddle', quickquiz: 'QuickQuiz' };
  return map[lower] || String(raw);
};

export default function ChallengeScreen({ route, navigation }) {
  const { token } = useAuthContext();
  const { type } = route.params || {};
  const { current, loading, fetchChallenge, submitChallenge } = useChallenge(token);
  const [answers, setAnswers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const loadChallenge = useCallback(async () => {
    setResult(null);
    try {
      const challenge = await fetchChallenge({ challengeType: normalizeType(type) });
      const total = challenge.puzzle_payload.total_questions || 1;
      setAnswers(Array(total).fill(''));
      // Cache the challenge payload for offline retry.
      await offlineStore.upsertLocal('challenge_attempts', {
        record_id: `challenge-${challenge.id}`,
        payload: challenge,
        synced: true,
        local_timestamp: new Date().toISOString(),
      });
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load challenge');
    }
  }, [token, type]);

  useFocusEffect(
    useCallback(() => {
      loadChallenge();
    }, [loadChallenge])
  );

  const setAnswerAt = (index, value) => {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  };

  const handleSubmit = async () => {
    if (answers.some((a) => !String(a).trim())) return;
    setSubmitting(true);
    try {
      const res = await submitChallenge(answers);
      // Cache the completed attempt locally (unsynced) so the server scores it
      // via the offline sync engine if we lose connectivity later.
      await offlineStore.upsertLocal('challenge_attempts', {
        record_id: `attempt-${res.challenge_attempt_id || Date.now()}`,
        payload: {
          server_id: res.challenge_attempt_id,
          challenge_id: current?.id,
          completed: !!res.completed,
          correct_answers: res.correct_answers,
          total_questions: res.total_questions,
          time_taken_seconds: res.time_taken_seconds || 0,
        },
        synced: true,
        local_timestamp: new Date().toISOString(),
      });
      setResult({ correct: res.completed && res.correct, correctAnswers: res.correct_answers, total: res.total_questions });
      if (res.completed && res.correct) {
        setTimeout(() => navigation.goBack(), 1500);
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (result) {
    return (
      <View style={[styles.center, result.correct ? styles.correctBg : styles.incorrectBg]}>
        <Text style={styles.resultTitle}>{result.correct ? 'Correct!' : 'Incorrect'}</Text>
        <Text style={styles.resultText}>
          {result.correct ? 'Great job!' : `You got ${result.correctAnswers}/${result.total}. Try again with a new challenge.`}
        </Text>
        {!result.correct && (
          <TouchableOpacity style={styles.retryBtn} onPress={async () => { setResult(null); await loadChallenge(); }}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const questions = current?.puzzle_payload?.questions || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cognitive Challenge</Text>
      <Text style={styles.instruction}>
        {current ? `${current.challenge_type} · ${current.difficulty}` : 'Practice'}
      </Text>

      {questions.map((q, index) => (
        <View key={index} style={styles.challengeCard}>
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
              placeholder="Enter your answer"
              value={String(answers[index] || '')}
              onChangeText={(v) => setAnswerAt(index, v)}
              autoFocus={index === 0}
            />
          )}
        </View>
      ))}

      <TouchableOpacity
        style={[styles.btn, (submitting || answers.some((a) => !String(a).trim())) && { opacity: 0.5 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Submit Answer</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 24, alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 },
  instruction: { fontSize: 16, color: '#6b7280', marginBottom: 32 },
  challengeCard: { backgroundColor: 'white', padding: 24, borderRadius: 16, width: '100%', elevation: 3, marginBottom: 16 },
  questionLabel: { fontSize: 12, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 },
  questionText: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap' },
  option: { backgroundColor: '#e5e7eb', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginRight: 8, marginBottom: 8 },
  optionSelected: { backgroundColor: '#3b82f6' },
  optionText: { color: '#1f2937', fontWeight: '600', fontSize: 16 },
  optionTextSelected: { color: 'white' },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 16, fontSize: 18, width: '100%', textAlign: 'center' },
  btn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 8, width: '100%', alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '600', fontSize: 18 },
  correctBg: { backgroundColor: '#10b981' },
  incorrectBg: { backgroundColor: '#ef4444' },
  resultTitle: { fontSize: 32, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  resultText: { fontSize: 18, color: 'white', textAlign: 'center', marginBottom: 24 },
  retryBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8, borderWidth: 1, borderColor: 'white' },
  retryText: { color: 'white', fontWeight: '600', fontSize: 16 }
});