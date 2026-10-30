// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Admin from './Admin';

const coachUser = {
  id: 7, email: 'member@test.io', is_active: true, is_verified: true,
  created_at: '2026-09-01T00:00:00', role: 'User',
};

const detail = {
  user: coachUser,
  habit_score: {
    date: '2026-09-07', wake_up_consistency: 80, challenge_completion: 75,
    snooze_reduction: 60, sleep_schedule_adherence: 70, overall_score: 72,
  },
  habit_history: [
    { date: '2026-09-07', overall_score: 72, wake_up_consistency: 80, sleep_schedule_adherence: 70 },
  ],
  analytics: { total_alarms: 4, total_dismissals: 3, average_snooze_count: 1.2, wake_up_consistency_trend: 'stable' },
  sleep_trend: [70],
  wake_up_trend: [80],
  wake_up_consistency_trend: 'stable',
  challenge_performance: { Math: { attempts: 3, accuracy: 0.9, avg_solve_time_seconds: 22.5 } },
  progress: null,
};

function mockApi(routes, calls = []) {
  global.fetch = vi.fn((url, opts) => {
    calls.push([url, opts]);
    const key = String(url).split('?')[0];
    const hit = routes[key];
    if (!hit) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    return Promise.resolve({ ok: hit.status < 400, status: hit.status, json: () => Promise.resolve(hit.body) });
  });
}

function renderAdmin() {
  return render(<MemoryRouter><Admin /></MemoryRouter>);
}

describe('Admin page coach mode', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the empty-cohort state for coaches with no assigned users', async () => {
    mockApi({
      '/api/v1/dashboard/analytics': { status: 403, body: null },
      '/api/v1/dashboard/users': { status: 200, body: [] },
      '/api/v1/dashboard/coach/users': { status: 200, body: [] },
    });
    renderAdmin();

    await waitFor(() => expect(screen.getByText('Coaching Cohort')).toBeInTheDocument());
    expect(screen.getByText('No assigned users yet')).toBeInTheDocument();
  });

  it('lists the cohort and opens per-user detail', async () => {
    mockApi({
      '/api/v1/dashboard/analytics': { status: 403, body: null },
      '/api/v1/dashboard/users': { status: 200, body: [coachUser] },
      '/api/v1/dashboard/coach/users': { status: 200, body: [coachUser] },
      '/api/v1/dashboard/coach/users/7': { status: 200, body: detail },
    });
    renderAdmin();

    await waitFor(() => expect(screen.getByText('member@test.io')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'View detail' }));

    await waitFor(() => expect(screen.getByText('User Profile Summary')).toBeInTheDocument());
    expect(screen.getByText('Alarm Consistency')).toBeInTheDocument();
    expect(screen.getByText('Challenge Performance')).toBeInTheDocument();
    expect(screen.getByText(/Sleep Trend/)).toBeInTheDocument();
    expect(screen.getByText('Progress History')).toBeInTheDocument();
    expect(screen.getByText('Math')).toBeInTheDocument();
  });

  it('shows the denied panel when the directory itself is forbidden', async () => {
    mockApi({
      '/api/v1/dashboard/analytics': { status: 403, body: null },
      '/api/v1/dashboard/users': { status: 403, body: null },
    });
    renderAdmin();

    await waitFor(() => expect(screen.getByText('Access Restricted')).toBeInTheDocument());
  });

  it('keeps the admin telemetry view when both endpoints allow', async () => {
    mockApi({
      '/api/v1/dashboard/analytics': {
        status: 200,
        body: {
          total_users: 5, active_users_today: 2, new_users_this_week: 1,
          alarm_dismissal_success_rate: 0.8, platform_habit_score_avg: 71,
          top_challenge_types: [], system_uptime_percentage: 100,
        },
      },
      '/api/v1/dashboard/users': { status: 200, body: [coachUser] },
    });
    renderAdmin();

    await waitFor(() => expect(screen.getByText('Total Users')).toBeInTheDocument());
    expect(screen.getByText('Registered Users Directory')).toBeInTheDocument();
  });
});

describe('Admin management controls', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const adminBase = {
    '/api/v1/dashboard/analytics': {
      status: 200,
      body: {
        total_users: 3, active_users_today: 1, new_users_this_week: 0,
        alarm_dismissal_success_rate: 0.5, platform_habit_score_avg: 60,
        top_challenge_types: [], system_uptime_percentage: 100,
      },
    },
    '/api/v1/dashboard/users': {
      status: 200,
      body: [
        { id: 1, email: 'admin@test.io', is_active: true, is_verified: true, created_at: '2026-09-01T00:00:00', role: 'Administrator' },
        { id: 2, email: 'coach@test.io', is_active: true, is_verified: true, created_at: '2026-09-01T00:00:00', role: 'Wellness Coach' },
        coachUser,
      ],
    },
    '/api/v1/dashboard/coach/assignments': { status: 200, body: [{ id: 1, coach_id: 2, user_id: 7 }] },
    '/api/v1/announcements': { status: 200, body: [{ id: 1, title: 'Welcome', body: 'Platform is live', priority: 5, is_active: true }] },
  };

  it('changes a user role through the inline select', async () => {
    const calls = [];
    mockApi(adminBase, calls);
    renderAdmin();

    const select = await screen.findByLabelText('Role for coach@test.io');
    fireEvent.change(select, { target: { value: 'User' } });

    await waitFor(() =>
      expect(calls.some(([u, o]) => String(u).includes('/dashboard/users/2/role') && o?.method === 'PUT')).toBe(true),
    );
  });

  it('assigns a user to a coach cohort', async () => {
    const calls = [];
    mockApi(adminBase, calls);
    renderAdmin();

    expect(await screen.findByText('Coach Cohort Assignment')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Select coach'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Select user'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() =>
      expect(calls.some(([u, o]) => String(u).includes('/dashboard/coach/assignments') && o?.method === 'POST')).toBe(true),
    );
  });

  it('publishes an announcement with title and body', async () => {
    const calls = [];
    mockApi(adminBase, calls);
    renderAdmin();

    expect(await screen.findByText('Platform Announcements')).toBeInTheDocument();
    expect(screen.getByText('Welcome')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Announcement title'), { target: { value: 'Maintenance' } });
    fireEvent.change(screen.getByLabelText('Announcement body'), { target: { value: 'Downtime at 2am' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(calls.some(([u, o]) => String(u) === '/api/v1/announcements' && o?.method === 'POST')).toBe(true),
    );
  });
});
