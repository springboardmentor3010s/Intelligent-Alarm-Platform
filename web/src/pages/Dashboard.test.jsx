// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import Dashboard from './Dashboard';

vi.mock('react-chartjs-2', () => ({
  Line: () => null,
}));

const habitScore = {
  date: '2026-09-07',
  wake_up_consistency: 80,
  challenge_completion: 75,
  snooze_reduction: 60,
  sleep_schedule_adherence: 70,
  overall_score: 72,
};

const analytics = {
  total_alarms: 4,
  total_dismissals: 3,
  average_snooze_count: 1.2,
  challenge_accuracy: 0.92,
};

const recommendations = [
  { id: 1, category: 'sleep', priority: 1, title: 'Go to bed 15 min earlier', message: 'Improves sleep adherence.' },
];

function mockFetch() {
  global.fetch = vi.fn((url) => {
    const key = url.split('?')[0];
    const payloads = {
      '/api/v1/habits/score': habitScore,
      '/api/v1/habits/score/history': [habitScore],
      '/api/v1/analytics/me': analytics,
      '/api/v1/analytics/recommendations': recommendations,
    };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payloads[key] ?? {}) });
  });
}

describe('Dashboard page', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders metrics from the real backend payloads', async () => {
    localStorage.setItem('token', 't');
    mockFetch();

    render(<Dashboard />);

    await waitFor(() => expect(screen.getByText('Analytics')).toBeInTheDocument());
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Go to bed 15 min earlier')).toBeInTheDocument();
  });
});