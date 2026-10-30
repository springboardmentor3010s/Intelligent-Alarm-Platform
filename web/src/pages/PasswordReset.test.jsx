// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PasswordReset from './PasswordReset';

function mockApi(routes, calls = []) {
  global.fetch = vi.fn((url, opts) => {
    calls.push([url, opts]);
    const key = `${opts?.method || 'GET'} ${String(url).split('?')[0]}`;
    const hit = routes[key];
    if (!hit) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    return Promise.resolve({ ok: hit.status < 400, status: hit.status, json: () => Promise.resolve(hit.body) });
  });
}

const renderAt = (path) =>
  render(<MemoryRouter initialEntries={[path]}><PasswordReset /></MemoryRouter>);

describe('PasswordReset request mode', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('posts the email and shows the generic confirmation', async () => {
    const calls = [];
    mockApi({
      'POST /api/v1/auth/password-reset/request': {
        status: 200,
        body: { message: 'If an account exists with that email, a password reset link has been sent.' },
      },
    }, calls);
    renderAt('/reset-password');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@test.io' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => expect(screen.getByText(/password reset link has been sent/i)).toBeInTheDocument());
    expect(calls.some(([u, o]) => String(u) === '/api/v1/auth/password-reset/request' && o?.method === 'POST')).toBe(true);
  });

  it('rejects a malformed email without calling the API', async () => {
    const calls = [];
    mockApi({}, calls);
    renderAt('/reset-password');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument());
    expect(calls.length).toBe(0);
  });
});

describe('PasswordReset confirm mode', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('blocks mismatched passwords before submitting', async () => {
    const calls = [];
    mockApi({}, calls);
    renderAt('/reset-password?token=abc123');

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password@1234' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Password@9999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => expect(screen.getByText('Passwords do not match.')).toBeInTheDocument());
    expect(calls.length).toBe(0);
  });

  it('submits the token and new password', async () => {
    const calls = [];
    mockApi({
      'POST /api/v1/auth/password-reset/confirm': { status: 200, body: { message: 'Password updated successfully.' } },
    }, calls);
    renderAt('/reset-password?token=abc123');

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password@1234' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Password@1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => expect(screen.getByText('Password updated successfully.')).toBeInTheDocument());
    const call = calls.find(([u]) => String(u) === '/api/v1/auth/password-reset/confirm');
    expect(JSON.parse(call[1].body)).toEqual({ token: 'abc123', new_password: 'Password@1234' });
  });
});
