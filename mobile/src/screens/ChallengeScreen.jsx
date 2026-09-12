import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { useChallenge } from '../hooks/useChallenge';
import { offlineStore } from '../sync/offlineStore';
import { useTheme } from '../theme/ThemeContext';
import { SysLabel } from '../components/ui';

const normalizeType = (raw) => {
  if (!raw) return undefined;
  const lower = String(raw).toLowerCase();
  const map = { math: 'Math', logic: 'Logic', memory: 'Memory', word: 'Word', pattern: 'Pattern', riddle: 'Riddle', quickquiz: 'QuickQuiz' };
  return map[lower] || String(raw);
};

export default function ChallengeScreen({ route, navigation }) {
  const { token } = useAuthContext();
  const { colors, ui, fonts } = useTheme();
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
        <ActivityIndicator size="large" color={colors.violet} />
      </View>
    );
  }

  if (result) {
    const ok = result.correct;
    return (
      <View style={ui.center}>
        <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={64} color={ok ? colors.violet : colors.rose} />
        <Text style={[styles.resultTitle, { color: colors.text, fontFamily: fonts.displayBold }]}>
          {ok ? 'Correct' : 'Incorrect'}
        </Text>
        <Text style={[styles.resultText, { color: colors.textMuted }]}>
          {ok
            ? 'Neural pathway engaged.'
            : `You got ${result.correctAnswers}/${result.total}. Try again with a new challenge.`}
        </Text>
        {!ok && (
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.violet }]}
            onPress={async () => { setResult(null); await loadChallenge(); }}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const questions = current?.puzzle_payload?.questions || [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SysLabel icon="flash-outline" tone="violet">Cognitive challenge</SysLabel>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.displayBold }]}>Wake-up drill</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {current ? `${current.challenge_type} · ${current.difficulty}` : 'Practice'}
      </Text>

      {questions.map((q, index) => (
        <View key={index} style={[ui.card, styles.challengeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
              placeholder="Enter your answer"
              placeholderTextColor={colors.textFaint}
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
        accessibilityRole="button"
        accessibilityLabel="Submit answer"
      >
        {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={ui.btnPrimaryText}>Submit answer</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, marginTop: 6 },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 24 },
  challengeCard: { borderWidth: 1 },
  questionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  questionText: { fontSize: 20, fontWeight: '700', marginBottom: 16, lineHeight: 27 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  optionText: { fontWeight: '600', fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 18, width: '100%', textAlign: 'center' },
  resultTitle: { fontSize: 32, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  resultText: { fontSize: 18, textAlign: 'center', marginBottom: 24, lineHeight: 24, maxWidth: 300 },
  retryBtn: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
});