import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useChallenge } from '../hooks/useChallenge';
import { apiFetch } from '../utils/api';

export default function AlarmScreen({ navigation }) {
  const { user, token } = useAuth();
  const { generateChallenge, completeChallenge } = useChallenge();
  const [loading, setLoading] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [activeAlarm, setActiveAlarm] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      if (!token) return;

      setLoading(true);
      apiFetch('/api/v1/alarms', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.length > 0 && data[0].is_enabled) {
            setActiveAlarm(data[0]);
            setShowChallenge(true);
            setCurrentChallenge(generateChallenge(data[0].challenge_type || 'math'));
          }
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }, [token])
  );

  const handleDismiss = async (result) => {
    if (!activeAlarm) return;
    setLoading(true);
    try {
      const challengeResult = await completeChallenge(result);
      // Mark alarm as dismissed
      await apiFetch(`/api/v1/alarms/${activeAlarm.id}/dismiss`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ challenge_result: challengeResult })
      });
      setShowChallenge(false);
      Alert.alert('Success', 'Alarm dismissed! Great job waking up!');
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to dismiss alarm. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );

  if (showChallenge && currentChallenge) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Wake Up Challenge</Text>
        <Text style={styles.subtitle}>Solve this to dismiss your alarm</Text>
        <View style={styles.challengeBox}>
          <Text style={styles.challengeText}>{currentChallenge.question}</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={() => handleDismiss({ answer: currentChallenge.answer })}>
          <Text style={styles.btnText}>Submit Answer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>No active alarms</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
        <Text style={styles.btnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#888', marginBottom: 24 },
  challengeBox: { backgroundColor: '#1f2937', padding: 32, borderRadius: 16, width: '100%', alignItems: 'center', marginBottom: 24 },
  challengeText: { fontSize: 22, fontWeight: '600', color: '#fff', textAlign: 'center' },
  btn: { backgroundColor: '#3b82f6', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8 },
  btnText: { color: 'white', fontWeight: '600', fontSize: 16 }
});
