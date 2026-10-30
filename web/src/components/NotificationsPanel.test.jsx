// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import NotificationsPanel from './NotificationsPanel';

function mockApi(routes, calls = []) {
  global.fetch = vi.fn((url, opts) => {
    calls.push([url, opts]);
    const key = `${opts?.method || 'GET'} ${String(url).split('?')[0]}`;
    const hit = routes[key] || routes[String(url).split('?')[0]];
    if (!hit) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    return Promise.resolve({ ok: hit.status < 400, status: hit.status, json: () => Promise.resolve(hit.body) });
  });
}

describe('NotificationsPanel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('disables sending when push delivery is not configured', async () => {
    mockApi({
      '/api/v1/notifications/status': {
        status: 200,
        body: { provider: 'noop', configured: false, registered_tokens: 0, message: 'Push delivery not configured.' },
      },
      '/api/v1/notifications/tokens': { status: 200, body: [] },
    });
    render(<NotificationsPanel />);

    await waitFor(() => expect(screen.getByText('Not configured')).toBeInTheDocument());
    expect(screen.getByText('Push delivery not configured.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send test notification' })).toBeDisabled();
  });

  it('sends a test notification when configured', async () => {
    const calls = [];
    mockApi({
      '/api/v1/notifications/status': {
        status: 200,
        body: { provider: 'expo', configured: true, registered_tokens: 1, message: 'Push delivery configured via Expo push relay.' },
      },
      '/api/v1/notifications/tokens': {
        status: 200,
        body: [{ id: 1, token: 'ExponentPushToken[abcdef123456]', platform: 'android', created_at: '2026-09-01T00:00:00' }],
      },
      'POST /api/v1/notifications/test': { status: 200, body: { attempted: 1, sent: 1, failed: 0 } },
    }, calls);
    render(<NotificationsPanel />);

    const btn = await screen.findByRole('button', { name: 'Send test notification' });
    await waitFor(() => expect(btn).not.toBeDisabled());
    expect(screen.getByText(/android · ExponentPush/)).toBeInTheDocument();

    fireEvent.click(btn);
    await waitFor(() => expect(calls.some(([u, o]) => String(u) === '/api/v1/notifications/test' && o?.method === 'POST')).toBe(true));
    await waitFor(() => expect(screen.getByText(/Sent 1 of 1/)).toBeInTheDocument());
  });
});
