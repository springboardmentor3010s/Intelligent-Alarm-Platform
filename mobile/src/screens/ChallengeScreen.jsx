import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useChallenge } from '../hooks/useChallenge';

export default function ChallengeScreen({ route, navigation }) {
  const { type } = route.params || {};
  const { generateChallenge, completeChallenge } = useChallenge();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      const q = generateChallenge(type || 'math');
      setQuestion(q.question);
      setAnswer('');
      setShowResult(false);
    }, [type])
  );

  const handleSubmit = async () => {
    if (!answer.trim()) return;

    setLoading(true);
    try {
      const result = await completeChallenge(answer);
      setCorrect(result.correct);
      setShowResult(true);

      if (result.correct) {
        setTimeout(() => {
          navigation.goBack();
        }, 1500);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (showResult) {
    return (
      <View style={[styles.center, correct ? styles.correctBg : styles.incorrectBg]}>
        <Text style={styles.resultTitle}>{correct ? 'Correct!' : 'Incorrect'}</Text>
        <Text style={styles.resultText}>{correct ? 'Great job!' : 'That was not right. Try again.'}</Text>
        {!correct && (
          <TouchableOpacity style={styles.retryBtn} onPress={() => setShowResult(false)}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cognitive Challenge</Text>
      <Text style={styles.instruction}>Task: {type ? type.toUpperCase() : 'Math'}</Text>

      <View style={styles.challengeCard}>
        <Text style={styles.questionText}>{question}</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Enter your answer"
        value={answer}
        onChangeText={setAnswer}
        keyboardType={type === 'math' ? 'numeric' : 'default'}
        autoFocus
      />

      <TouchableOpacity
        style={[styles.btn, !answer.trim() && { opacity: 0.5 }]}
        onPress={handleSubmit}
        disabled={loading || !answer.trim()}
      >
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Submit Answer</Text>}
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
  challengeCard: { backgroundColor: 'white', padding: 40, borderRadius: 16, width: '100%', alignItems: 'center', elevation: 3, marginBottom: 32 },
  questionText: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', textAlign: 'center' },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 16, fontSize: 18, width: '100%', marginBottom: 24, textAlign: 'center' },
  btn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 8, width: '100%', alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '600', fontSize: 18 },
  correctBg: { backgroundColor: '#10b981' },
  incorrectBg: { backgroundColor: '#ef4444' },
  resultTitle: { fontSize: 32, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  resultText: { fontSize: 18, color: 'white', textAlign: 'center', marginBottom: 24 },
  retryBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8, borderWidth: 1, borderColor: 'white' },
  retryText: { color: 'white', fontWeight: '600', fontSize: 16 }
});
