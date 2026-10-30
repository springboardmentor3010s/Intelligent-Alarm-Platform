// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import Reports from './Reports';

vi.mock('react-chartjs-2', () => ({
  Line: () => null,
}));

const score = {
  date: '2026-09-07', wake_up_consistency: 80, challenge_completion: 75,
  snooze_reduction: 60, sleep_schedule_adherence: 70, overall_score: 72,
};

function mockApi(routes, calls = []) {
  global.fetch = vi.fn((url, opts) => {
    calls.push([url, opts]);
    const key = `${opts?.method || 'GET'} ${url.split('?')[0]}`;
    const hit = routes[key];
    if (!hit) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    return Promise.resolve({
      ok: hit.status < 400, status: hit.status, json: () => Promise.resolve(hit.body),
    });
  });
}

const base = {
  'GET /api/v1/habits/score': { status: 200, body: score },
  'GET /api/v1/habits/score/history': { status: 200, body: [score] },
  'GET /api/v1/dashboard/reports/wake-up': { status: 200, body: { data: [] } },
  'GET /api/v1/productivity/history': { status: 200, body: [] },
  'GET /api/v1/productivity/trend': { status: 200, body: { available: false } },
  'GET /api/v1/productivity/correlation': { status: 200, body: { available: false, reason: 'log daily scores first.' } },
};

describe('Reports productivity section', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('labels productivity as user-entered with an honest empty state', async () => {
    mockApi(base);
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Productivity')).toBeInTheDocument());
    expect(screen.getByText('user-entered data')).toBeInTheDocument();
    expect(screen.getByText('No Productivity Trend Yet')).toBeInTheDocument();
    expect(screen.getByText('Self-Logged Productivity Report')).toBeInTheDocument();
  });

  it('submits a valid score and confirms the save', async () => {
    const saved = { id: 1, date: '2026-09-07', score: 75, note: null, source: 'user-entered' };
    const calls = [];
    mockApi({ ...base, 'POST /api/v1/productivity/log': { status: 201, body: saved } }, calls);
    render(<Reports />);

    await waitFor(() => expect(screen.getByLabelText("Today's productivity score 0 to 100")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Today's productivity score 0 to 100"), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log today' }));

    await waitFor(() => expect(screen.getByText("Saved today's user-entered score.")).toBeInTheDocument());
    const post = calls.find(([url, opts]) => opts?.method === 'POST');
    // eslint-disable-next-line no-console
    console.log('POSTED BODY:', post?.[1]?.body);
    expect(JSON.parse(post[1].body)).toEqual({ score: 75, note: null });
  });

  it('rejects an out-of-range score without posting', async () => {
    const calls = [];
    mockApi(base, calls);
    const { container } = render(<Reports />);

    await waitFor(() => expect(screen.getByLabelText("Today's productivity score 0 to 100")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Today's productivity score 0 to 100"), { target: { value: '140' } });
    // NOTE: a button click never reaches onSubmit here because native
    // max=100 validation blocks implicit submission (correct browser
    // behavior); dispatch submit directly to exercise the React-level guard.
    fireEvent.submit(container.querySelector('form.prod-log__form'));

    await waitFor(() => expect(screen.getByText(/must be a number from 0 to 100/)).toBeInTheDocument());
    expect(calls.some(([, opts]) => opts?.method === 'POST')).toBe(false);
  });
});
