// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import App from './App';

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

const history = [
  { date: '2026-09-06', wake_up_consistency: 70, challenge_completion: 70, snooze_reduction: 55, sleep_schedule_adherence: 68, overall_score: 66 },
  { date: '2026-09-07', wake_up_consistency: 80, challenge_completion: 75, snooze_reduction: 60, sleep_schedule_adherence: 70, overall_score: 72 },
];

function mockFetch(responseByPath) {
  global.fetch = vi.fn((url) => {
    const key = url.split('?')[0];
    const payload = responseByPath[key] ?? {};
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
  });
}

describe('App navigation (§21 grouping)', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ email: 'demo@test.io', full_name: 'Demo' }));
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('ck-theme', 'dark');
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders Overview / Wake / Account groups with all destinations', async () => {
    mockFetch({ '/api/v1/habits/score': habitScore });
    render(<App />);

    await waitFor(() => expect(screen.getAllByText('Overview').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Wake').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Account').length).toBeGreaterThan(0);

    for (const label of ['Dashboard', 'Analytics', 'Alarms', 'Challenges', 'History', 'Profile', 'Admin']) {
      expect(screen.getAllByRole('link', { name: label }).length).toBeGreaterThan(0);
    }
  });

  it('home loads today progress once data arrives', async () => {
    mockFetch({
      '/api/v1/habits/score': habitScore,
      '/api/v1/habits/score/history': history,
    });
    render(<App />);

    await waitFor(() => expect(screen.getByText("Today's Progress")).toBeInTheDocument());
    expect(screen.getAllByText('72').length).toBeGreaterThan(0);
  });

  it('logs out when the stored token is invalid/expired (401)', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ detail: 'Invalid auth' }) })
    );
    render(<App />);

    await waitFor(() => expect(screen.getByText(/WAKE WITH PURPOSE/i)).toBeInTheDocument());
    expect(localStorage.getItem('token')).toBeNull();
  });
});

describe('global theme toggle (topbar)', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ email: 'demo@test.io', full_name: 'Demo' }));
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('ck-theme', 'dark');
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('switches the entire app to Light and persists it', async () => {
    mockFetch({ '/api/v1/habits/score': habitScore });
    render(<App />);

    await waitFor(() => expect(screen.getByRole('navigation')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('ck-theme')).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });

  it('restores the persisted Light theme on boot', async () => {
    localStorage.setItem('ck-theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    mockFetch({ '/api/v1/habits/score': habitScore });
    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
    );
  });
});