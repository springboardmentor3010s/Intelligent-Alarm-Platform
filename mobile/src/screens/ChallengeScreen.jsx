import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { useChallenge } from '../hooks/useChallenge';
import { offlineStore } from '../sync/offlineStore';
import { BRAND, ui } from '../theme/tokens';

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
      <View style={ui.center}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  if (result) {
    return (
      <View style={[ui.center, result.correct ? styles.correctBg : styles.incorrectBg]}>
        <Ionicons name={result.correct ? 'checkmark-circle' : 'close-circle'} size={64} color="#fff" />
        <Text style={styles.resultTitle}>{result.correct ? 'CORRECT' : 'INCORRECT'}</Text>
        <Text style={styles.resultText}>
          {result.correct ? 'Neural pathway engaged.' : `You got ${result.correctAnswers}/${result.total}. Try again with a new challenge.`}
        </Text>
        {!result.correct && (
          <TouchableOpacity style={styles.retryBtn} onPress={async () => { setResult(null); await loadChallenge(); }}>
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const questions = current?.puzzle_payload?.questions || [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sysLabel}><Ionicons name="flash-outline" size={12} color={BRAND.primary} /> COGNITIVE CHALLENGE</Text>
      <Text style={styles.title}>Wake-Up Drill</Text>
      <Text style={styles.subtitle}>
        {current ? `${current.challenge_type} · ${current.difficulty}` : 'Practice'}
      </Text>

      {questions.map((q, index) => (
        <View key={index} style={[ui.card, styles.challengeCard]}>
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
              placeholder="Enter your answer"
              placeholderTextColor={ui.inputPlaceholder}
              value={String(answers[index] || '')}
              onChangeText={(v) => setAnswerAt(index, v)}
              autoFocus={index === 0}
            />
          )}
        </View>
      ))}

      <TouchableOpacity
        style={[ui.btnPrimary, (submitting || answers.some((a) => !String(a).trim())) && { opacity: 0.5 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={ui.btnPrimaryText}>SUBMIT ANSWER</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.space },
  content: { padding: 24, paddingBottom: 40 },
  sysLabel: { color: BRAND.primary, fontSize: 11, fontWeight: '700', letterSpacing: 2.5, marginBottom: 8, textTransform: 'uppercase' },
  title: { ...ui.title },
  subtitle: { ...ui.subtitle, marginBottom: 24 },
  challengeCard: {},
  questionLabel: { color: BRAND.primarySoft, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' },
  questionText: { fontSize: 20, fontWeight: '700', color: BRAND.text, marginBottom: 16, lineHeight: 27 },
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
    padding: 16,
    fontSize: 18,
    color: BRAND.text,
    width: '100%',
    textAlign: 'center',
  },
  correctBg: { backgroundColor: BRAND.success },
  incorrectBg: { backgroundColor: BRAND.danger },
  resultTitle: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 8, marginTop: 8 },
  resultText: { fontSize: 18, color: '#fff', textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  retryBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, borderWidth: 1, borderColor: '#fff' },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 1 },
});