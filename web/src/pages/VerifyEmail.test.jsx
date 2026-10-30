// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmail from './VerifyEmail';

const renderAt = (path) =>
  render(<MemoryRouter initialEntries={[path]}><VerifyEmail /></MemoryRouter>);

describe('VerifyEmail', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('confirms the token and reports success', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true, status: 200, json: () => Promise.resolve({ message: 'Email verified successfully.' }),
    }));
    renderAt('/verify-email?token=abc');

    await waitFor(() => expect(screen.getByText('Email verified successfully.')).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/auth/verify-email/confirm',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('reports an invalid token', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false, status: 400, json: () => Promise.resolve({ detail: 'Invalid or expired verification token' }),
    }));
    renderAt('/verify-email?token=bad');

    await waitFor(() => expect(screen.getByText(/Invalid or expired verification token/i)).toBeInTheDocument());
  });

  it('does not call the API when no token is present', () => {
    global.fetch = vi.fn();
    renderAt('/verify-email');

    expect(screen.getByText(/No verification token was provided/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
