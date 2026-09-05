import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

export function useHabitScore(token) {
  const [score, setScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchHabitScore();
    }
  }, [token]);

  const fetchHabitScore = async () => {
    try {
      const response = await apiFetch('/api/v1/habits/score', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setScore(data);
      }
    } catch (error) {
      console.error('Failed to fetch habit score:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateScore = async (scoreData) => {
    try {
      const response = await apiFetch('/api/v1/habits/score', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(scoreData)
      });
      if (response.ok) {
        const data = await response.json();
        setScore(data);
        return { success: true };
      }
      return { success: false, error: 'Failed to update' };
    } catch (error) {
      console.error('Failed to update habit score:', error);
      return { success: false, error: 'Network error' };
    }
  };

  return { score, history, loading, fetchHabitScore, updateScore };
}