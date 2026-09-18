import { act, renderHook } from '@testing-library/react-native';
import { apiFetch } from '../utils/api';
import { useChallenge, secondsUntil, ChallengeError } from './useChallenge';

jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
  authHeaders: jest.fn((token) => ({ Authorization: `Bearer ${token}` })),
  parseApiError: jest.fn(async (r) => `error ${r.status}`),
}));

const challenge = {
  id: 11,
  challenge_type: 'Math',
  difficulty: 'Easy',
  challenge_attempt_id: 77,
  puzzle_payload: {
    questions: [{ id: 1, prompt: '6 x 7', type: 'numeric', options: null }],
    total_questions: 1,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  },
};

describe('secondsUntil', () => {
  it('returns null for a missing or invalid deadline', () => {
    expect(secondsUntil(null)).toBeNull();
    expect(secondsUntil('not-a-date')).toBeNull();
  });

  it('never returns a negative value', () => {
    expect(secondsUntil(new Date(Date.now() - 5000).toISOString())).toBe(0);
    expect(secondsUntil(new Date(Date.now() + 5000).toISOString())).toBeGreaterThan(0);
  });
});

describe('useChallenge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches a challenge and exposes the current payload', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => challenge });

    const { result } = renderHook(() => useChallenge('tok'));
    let fetched;
    await act(async () => {
      fetched = await result.current.fetchChallenge({ challengeType: 'Math' });
    });

    expect(fetched.id).toBe(11);
    expect(result.current.current.challenge_attempt_id).toBe(77);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('submits the full answer array and returns the verification result', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => challenge });
    const { result } = renderHook(() => useChallenge('tok'));
    await act(async () => {
      await result.current.fetchChallenge({ challengeType: 'Math' });
    });

    apiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ challenge_attempt_id: 77, completed: true, correct_answers: 1, total_questions: 1, results: [] }),
    });

    let out;
    await act(async () => {
      out = await result.current.submitChallenge(['42'], 9);
    });

    const [, options] = apiFetch.mock.calls[1];
    const body = JSON.parse(options.body);
    expect(body.user_answers).toEqual(['42']);
    expect(body.challenge_attempt_id).toBe(77);
    expect(body.time_taken_seconds).toBe(9);
    expect(out.completed).toBe(true);
  });

  it('throws a status-carrying ChallengeError on replay (409)', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => challenge });
    const { result } = renderHook(() => useChallenge('tok'));
    await act(async () => {
      await result.current.fetchChallenge({ challengeType: 'Math' });
    });

    apiFetch.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ detail: 'already submitted' }) });

    let error;
    await act(async () => {
      try {
        await result.current.submitChallenge(['42']);
      } catch (e) {
        error = e;
      }
    });

    expect(error).toBeInstanceOf(ChallengeError);
    expect(error.status).toBe(409);
  });

  it('throws a status-carrying ChallengeError on expiry (410)', async () => {
    apiFetch.mockResolvedValueOnce({ ok: false, status: 410, json: async () => ({ detail: 'expired' }) });

    const { result } = renderHook(() => useChallenge('tok'));
    let error;
    await act(async () => {
      try {
        await result.current.fetchChallenge({ challengeType: 'Logic' });
      } catch (e) {
        error = e;
      }
    });

    expect(error.status).toBe(410);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('error 410');
  });
});
