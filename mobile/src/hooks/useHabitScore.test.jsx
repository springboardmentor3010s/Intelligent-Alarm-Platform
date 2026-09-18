// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import { renderHook, waitFor } from '@testing-library/react-native';
import { apiFetch, authHeaders, parseApiError, describeFetchError } from '../utils/api';
import { useHabitScore } from './useHabitScore';

jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
  authHeaders: jest.fn((token) => ({ Authorization: `Bearer ${token}` })),
  parseApiError: jest.fn(async (r) => `error ${r.status}`),
  describeFetchError: jest.fn((e) => e.message),
}));

const scorePayload = {
  date: '2026-09-07',
  wake_up_consistency: 80,
  challenge_completion: 75,
  snooze_reduction: 60,
  sleep_schedule_adherence: 70,
  overall_score: 72,
};

describe('useHabitScore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts in the loading state without a token', () => {
    const { result } = renderHook(() => useHabitScore(null));
    expect(result.current.loading).toBe(true);
    expect(result.current.score).toBeNull();
  });

  it('fetches and stores the habit score for an authenticated user', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => scorePayload });

    const { result } = renderHook(() => useHabitScore('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiFetch).toHaveBeenCalledWith('/api/v1/habits/score', {
      headers: { Authorization: 'Bearer tok' },
    });
    expect(result.current.score).toEqual(scorePayload);
    expect(result.current.loading).toBe(false);
  });

  it('handles a non-ok response without throwing', async () => {
    apiFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ detail: 'x' }) });

    const { result } = renderHook(() => useHabitScore('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.score).toBeNull();
  });
});