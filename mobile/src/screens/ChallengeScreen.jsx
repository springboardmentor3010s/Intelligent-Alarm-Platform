import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { useChallenge, secondsUntil } from '../hooks/useChallenge';
import { offlineStore } from '../sync/offlineStore';
import { useTheme } from '../theme/ThemeContext';
import { SysLabel } from '../components/ui';

const normalizeType = (raw) => {
  if (!raw) return undefined;
  const lower = String(raw).toLowerCase();
  const map = { math: 'Math', logic: 'Logic', memory: 'Memory', word: 'Word', pattern: 'Pattern', riddle: 'Riddle', quickquiz: 'QuickQuiz' };
  return map[lower] || String(raw);
};

const NUMERIC_TYPES = new Set(['numeric', 'sequence']);

const formatClock = (totalSeconds) => {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function ChallengeScreen({ route, navigation }) {
  const { token } = useAuthContext();
  const { colors, ui, fonts } = useTheme();
  const { type } = route.params || {};
  const { current, loading, fetchChallenge, submitChallenge } = useChallenge(token);
  const [answers, setAnswers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const inputRefs = useRef([]);

  const questions = current?.puzzle_payload?.questions || [];
  const instructions = current?.puzzle_payload?.instructions;
  const expiresAt = current?.puzzle_payload?.expires_at || null;

  const loadChallenge = useCallback(async () => {
    setResult(null);
    setBlocked(null);
    try {
      const challenge = await fetchChallenge({ challengeType: normalizeType(type) });
      const total = challenge.puzzle_payload.total_questions || 1;
      setAnswers(Array(total).fill(''));
      setRemaining(secondsUntil(challenge.puzzle_payload.expires_at));
      await offlineStore.upsertLocal('challenge_attempts', {
        record_id: `challenge-${challenge.id}`,
        payload: challenge,
        synced: true,
        local_timestamp: new Date().toISOString(),
      });
    } catch (e) {
      // Offline fallback: reuse the most recent cached challenge payload.
      const cached = await offlineStore.listAll('challenge_attempts');
      const last = [...cached].reverse().find((r) => r.payload?.puzzle_payload?.questions);
      if (last) {
        setAnswers(Array(last.payload.puzzle_payload.total_questions || 1).fill(''));
        setBlocked(`Offline: showing your last cached ${last.payload.challenge_type} challenge.`);
      } else {
        setBlocked(e.message || 'Failed to load challenge');
      }
    }
  }, [token, type]);

  useFocusEffect(
    useCallback(() => {
      loadChallenge();
    }, [loadChallenge])
  );

  // Live countdown against the server-issued expiry.
  useEffect(() => {
    if (!expiresAt || result) return undefined;
    setRemaining(secondsUntil(expiresAt));
    const timer = setInterval(() => setRemaining(secondsUntil(expiresAt)), 1000);
    return () => clearInterval(timer);
  }, [expiresAt, result]);

  const expired = remaining !== null && remaining <= 0;

  const setAnswerAt = (index, value) => {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  };

  const answerTypeFor = (index) => questions[index]?.type || 'text';
  const allAnswered = answers.length > 0 && answers.every((a) => String(a).trim());

  const handleSubmit = async () => {
    if (!allAnswered || submitting || expired) return;
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
      setResult({
        correct: res.completed && res.correct,
        correctAnswers: res.correct_answers,
        total: res.total_questions,
        results: Array.isArray(res.results) ? res.results : [],
        message: res.message,
      });
      if (res.completed && res.correct) {
        setTimeout(() => navigation.goBack(), 1500);
      }
    } catch (e) {
      if ([400, 404, 409, 410].includes(e.status)) {
        setBlocked(e.message || 'This challenge can no longer be submitted.');
      } else {
        setBlocked(e.message || 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const answerTypeHint = useMemo(() => {
    if (!questions.length) return '';
    const types = new Set(questions.map((q) => q.type || 'text'));
    if (types.size === 1) {
      const [only] = types;
      if (only === 'choice') return 'Tap the correct option';
      if (only === 'numeric') return 'Type the number only';
      if (only === 'sequence') return 'Type the digits in order';
    }
    return 'Answer every question';
  }, [questions]);

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
      <ScrollView style={styles.screen} contentContainerStyle={[ui.center, styles.resultWrap]}>
        <View accessibilityLiveRegion="polite" style={styles.resultInner}>
          <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={64} color={ok ? colors.emerald : colors.rose} />
          <Text style={[styles.resultTitle, { color: colors.text, fontFamily: fonts.displayBold }]}>
            {ok ? 'Correct' : 'Incorrect'}
          </Text>
          <Text style={[styles.resultText, { color: colors.textMuted }]}>
            {ok
              ? 'Neural pathway engaged.'
              : `${result.message || 'Not all answers were correct.'} You got ${result.correctAnswers}/${result.total}.`}
          </Text>

          {result.results.map((r) => (
            <View
              key={r.index}
              style={[styles.feedbackRow, { borderColor: colors.border }]}
              accessibilityLabel={`Question ${r.index + 1}: ${r.correct ? 'correct' : 'incorrect'}. ${r.feedback}`}
            >
              <Ionicons
                name={r.correct ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={r.correct ? colors.emerald : colors.rose}
              />
              <Text style={[styles.feedbackText, { color: colors.textMuted }]}>
                Q{r.index + 1}: {r.feedback}
              </Text>
            </View>
          ))}

          {!ok && (
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.violet }]}
              onPress={async () => { setResult(null); await loadChallenge(); }}
              accessibilityRole="button"
              accessibilityLabel="Try a new challenge"
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headRow}>
          <View style={styles.headText}>
            <SysLabel icon="flash-outline" tone="violet">Cognitive challenge</SysLabel>
            <Text style={[styles.title, { color: colors.text, fontFamily: fonts.displayBold }]}>Wake-up drill</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {current ? `${current.challenge_type} · ${current.difficulty}` : 'Practice'}
            </Text>
          </View>
          {remaining !== null && (
            <View
              style={[styles.timerChip, { borderColor: expired ? colors.rose : colors.borderStrong }]}
              accessibilityLabel={`Time remaining ${formatClock(remaining)}`}
            >
              <Ionicons name="time-outline" size={15} color={expired ? colors.rose : colors.textMuted} />
              <Text style={[styles.timerText, { color: expired ? colors.rose : colors.text, fontFamily: fonts.monoBold }]}>
                {formatClock(remaining)}
              </Text>
            </View>
          )}
        </View>

        {instructions ? (
          <Text style={[styles.instructions, { color: colors.textMuted }]} accessibilityRole="text">
            {instructions}
          </Text>
        ) : null}

        {blocked ? (
          <View style={[styles.banner, { borderColor: colors.rose, backgroundColor: colors.roseSoft }]} accessibilityLiveRegion="polite">
            <Text style={[styles.bannerText, { color: colors.text }]}>{blocked}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.violet }]}
              onPress={async () => { setBlocked(null); await loadChallenge(); }}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>New challenge</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {questions.map((q, index) => {
          const answerType = answerTypeFor(index);
          const isChoice = q.options && q.options.length > 0;
          return (
            <View
              key={q.id ?? index}
              style={[ui.card, styles.challengeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.questionLabel, { color: colors.violet, fontFamily: fonts.monoBold }]}>
                QUESTION {index + 1} OF {questions.length}
              </Text>
              <Text style={[styles.questionText, { color: colors.text }]} accessibilityRole="text">
                {q.prompt}
              </Text>
              {isChoice ? (
                <View style={styles.optionRow} accessibilityRole="radiogroup">
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
                  ref={(el) => { inputRefs.current[index] = el; }}
                  style={[styles.input, { backgroundColor: colors.surface2, borderColor: colors.borderStrong, color: colors.text }]}
                  placeholder={answerTypeHint || 'Enter your answer'}
                  placeholderTextColor={colors.textFaint}
                  value={String(answers[index] || '')}
                  onChangeText={(v) => setAnswerAt(index, v)}
                  keyboardType={NUMERIC_TYPES.has(answerType) ? 'number-pad' : 'default'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus={index === 0}
                  returnKeyType={index < questions.length - 1 ? 'next' : 'done'}
                  onSubmitEditing={() => inputRefs.current[index + 1]?.focus()}
                  accessibilityLabel={`Answer for question ${index + 1}`}
                />
              )}
            </View>
          );
        })}

        <TouchableOpacity
          style={[ui.btnPrimary, (!allAnswered || expired) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={submitting || !allAnswered || expired}
          accessibilityRole="button"
          accessibilityLabel="Submit answer"
          accessibilityState={{ disabled: submitting || !allAnswered || expired, busy: submitting }}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={ui.btnPrimaryText}>Submit answer</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headText: { flexShrink: 1 },
  title: { fontSize: 28, marginTop: 6 },
  subtitle: { fontSize: 14, marginTop: 4 },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  timerText: { fontSize: 15, letterSpacing: 0.5 },
  instructions: { fontSize: 14, lineHeight: 20, marginTop: 10, marginBottom: 18 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16, gap: 10 },
  bannerText: { fontSize: 14, lineHeight: 20 },
  challengeCard: { borderWidth: 1 },
  questionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  questionText: { fontSize: 20, fontWeight: '700', marginBottom: 16, lineHeight: 27 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12 },
  optionText: { fontWeight: '600', fontSize: 17 },
  input: { borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 20, width: '100%', textAlign: 'center' },
  resultWrap: { paddingVertical: 48 },
  resultInner: { alignItems: 'center' },
  resultTitle: { fontSize: 32, fontWeight: '800', marginTop: 8, marginBottom: 8 },
  resultText: { fontSize: 18, textAlign: 'center', marginBottom: 20, lineHeight: 24, maxWidth: 320 },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    width: '100%',
    maxWidth: 360,
  },
  feedbackText: { fontSize: 14, flexShrink: 1, lineHeight: 19 },
  retryBtn: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, alignItems: 'center' },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
});
