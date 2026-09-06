import { useState, useEffect, useCallback } from 'react';
import { apiFetch, authHeaders, parseApiError } from '../utils/api';

export function useHabitScore(token) {
  const [score, setScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHabitScore = useCallback(async () => {
    if (!token) return;
    try {
      const response = await apiFetch('/api/v1/habits/score', {
        headers: authHeaders(token),
      });
      if (response.ok) {
        setScore(await response.json());
      } else {
        console.error('Failed to load habit score:', await parseApiError(response));
      }
    } catch (error) {
      console.error('Failed to fetch habit score:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchHabitScore();
  }, [fetchHabitScore]);

  return { score, history, loading, fetchHabitScore };
}