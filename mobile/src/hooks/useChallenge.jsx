import { useCallback, useState } from 'react';
import { apiFetch, authHeaders, parseApiError } from '../utils/api';

/**
 * Error carrying the HTTP status so screens can react precisely:
 * 400 malformed, 404 unknown/cross-user, 409 already submitted, 410 expired.
 */
export class ChallengeError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ChallengeError';
    this.status = status;
  }
}

/** Seconds left before a served challenge attempt expires (null when unknown). */
export function secondsUntil(expiresAt, from = Date.now()) {
  if (!expiresAt) return null;
  const deadline = Date.parse(expiresAt);
  if (Number.isNaN(deadline)) return null;
  return Math.max(0, Math.round((deadline - from) / 1000));
}

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
        throw new ChallengeError(await parseApiError(response), response.status);
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
      throw new ChallengeError(await parseApiError(response), response.status);
    }
    return response.json();
  };

  const reset = () => {
    setLoadState({ loading: false, current: null, error: null });
    setStartedAt(null);
  };

  return { ...loadState, fetchChallenge, submitChallenge, elapsedSeconds, reset };
}
