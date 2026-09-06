import { useState } from 'react';
import { apiFetch, authHeaders, parseApiError } from '../utils/api';

export function useChallenge(token) {
  const [loadState, setLoadState] = useState({ loading: false, current: null, error: null });
  const [startedAt, setStartedAt] = useState(null);

  const fetchChallenge = async ({ challengeType, difficulty, questionCount } = {}) => {
    const params = new URLSearchParams();
    if (challengeType) params.set('challenge_type', challengeType);
    if (difficulty) params.set('difficulty', difficulty);
    if (questionCount) params.set('question_count', questionCount);
    const qs = params.toString();

    setLoadState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await apiFetch(`/api/v1/challenges/next${qs ? `?${qs}` : ''}`, {
        headers: authHeaders(token),
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      const data = await response.json();
      setStartedAt(Date.now());
      setLoadState({ loading: false, current: data, error: null });
      return data;
    } catch (error) {
      setLoadState((s) => ({ ...s, loading: false, error: error.message }));
      throw error;
    }
  };

  const elapsedSeconds = () =>
    startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

  const submitChallenge = async (answers, timeTakenSeconds = elapsedSeconds()) => {
    const { current } = loadState;
    if (!current) throw new Error('No active challenge');

    const payload = {
      challenge_id: current.id,
      challenge_attempt_id: current.challenge_attempt_id,
      user_answers: Array.isArray(answers) ? answers : [answers],
      time_taken_seconds: timeTakenSeconds,
    };

    const response = await apiFetch('/api/v1/challenges/submit', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }
    return response.json();
  };

  return { ...loadState, fetchChallenge, submitChallenge, elapsedSeconds };
}