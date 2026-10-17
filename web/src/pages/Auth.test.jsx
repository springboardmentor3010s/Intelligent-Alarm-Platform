// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Auth from './Auth';

function renderAuth() {
  return render(
    <MemoryRouter>
      <Auth onAuth={() => {}} />
    </MemoryRouter>
  );
}

describe('Auth login/register UI', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.clear();
  });

  it('renders the login form by default with brand hero', () => {
    renderAuth();
    expect(screen.getByText('Win your mornings with a smarter alarm.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in as User' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in as Wellness Coach' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in as Administrator' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
    // Benefits preserved
    expect(screen.getByText('Adaptive difficulty, personalized to you')).toBeInTheDocument();
    expect(screen.getByText('7 challenge types engineered for your brain')).toBeInTheDocument();
    expect(screen.getByText('Habit scoring & progress insights')).toBeInTheDocument();
  });

  it('renders the "Next wake window" product-card mock in the hero', () => {
    renderAuth();
    expect(screen.getByText('Next wake window')).toBeInTheDocument();
    expect(screen.getByText('ARMED')).toBeInTheDocument();
    expect(screen.getByText('07')).toBeInTheDocument();
    expect(screen.getByText('05')).toBeInTheDocument();
    expect(screen.getByText('SCORE')).toBeInTheDocument();
  });

  it('switching to Register reveals all five fields', () => {
    renderAuth();
    fireEvent.click(screen.getByRole('tab', { name: 'Register' }));
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Preferred difficulty')).toBeInTheDocument();
    expect(screen.getByLabelText('Timezone')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('shows inline validation errors on an empty submit', () => {
    renderAuth();
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
  });

  it('register enforces the existing 8-char password rule', () => {
    renderAuth();
    fireEvent.click(screen.getByRole('tab', { name: 'Register' }));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Alex Morgan' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByText('Password must contain at least 8 characters.')).toBeInTheDocument();
  });

  it('email accepts valid format and blocks malformed input', () => {
    renderAuth();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('password visibility toggle reveals and hides the value', () => {
    renderAuth();
    const pw = screen.getByLabelText('Password');
    expect(pw).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(pw).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(pw).toHaveAttribute('type', 'password');
  });

  it('theme toggle switches the data-theme attribute', () => {
    renderAuth();
    const toggle = screen.getByRole('button', { name: 'Switch to light theme' });
    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });

  it('renders the Google sign-in button', () => {
    renderAuth();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  it('google sign-in requests the backend consent URL', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ detail: 'Google OAuth is not configured on this server' }),
      }),
    );
    renderAuth();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(global.fetch.mock.calls[0][0]).toContain('/api/v1/auth/oauth/google/login');
    expect(await screen.findByText(/not configured/i)).toBeInTheDocument();
  });

  it('completes the Google callback and calls onAuth', async () => {
    window.history.pushState({}, '', '/auth?code=abc&state=xyz');
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ access_token: 'tok', user: { id: 1, email: 'g@test.io' } }),
      }),
    );
    const onAuth = vi.fn();
    render(
      <MemoryRouter>
        <Auth onAuth={onAuth} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(onAuth).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/auth/oauth/google/callback',
      expect.objectContaining({ method: 'POST' }),
    );
    window.history.pushState({}, '', '/');
  });
});