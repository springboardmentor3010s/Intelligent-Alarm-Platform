// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import Profile from './Profile';

const profile = {
  id: 1,
  email: 'demo@cerebro.com',
  full_name: 'Demo User',
  timezone: 'UTC',
  difficulty_preference: 'Medium',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-01T00:00:00Z',
};

function mockFetch() {
  global.fetch = vi.fn((url, opts = {}) => {
    const method = opts.method || 'GET';
    const path = String(url).split('?')[0];
    if (path.endsWith('/users/profile')) {
      if (method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(profile) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...profile, ...JSON.parse(opts.body) }),
      });
    }
    if (path.endsWith('/users/settings')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ notifications: true, auto_dismiss: false, vibrate: true, time_format: '12' }),
      });
    }
    if (path.endsWith('/users/time_format')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ time_format: JSON.parse(opts.body).time_format, status: 'success' }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
  });
}

describe('Profile', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'tok');
    localStorage.setItem('user', JSON.stringify({ email: 'demo@cerebro.com', full_name: 'Demo User', timezone: 'UTC' }));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the timezone as a searchable picker backed by the full catalog', async () => {
    mockFetch();
    render(<Profile />);
    await waitFor(() => expect(screen.getByLabelText('Time zone')).toBeInTheDocument());

    const combobox = screen.getByRole('combobox', { name: 'Time zone' });
    expect(combobox.textContent).toContain('UTC');

    fireEvent.click(combobox);
    const listbox = screen.getByRole('listbox', { name: 'Time zone' });
    expect(within(listbox).getAllByRole('option').length).toBeGreaterThan(300);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Asia/Kolkata' } });
    const filtered = within(listbox).getAllByRole('option');
    expect(filtered.length).toBe(1);
    expect(filtered[0].textContent).toContain('Asia/Kolkata');
  });

  it('switching to 24-hour and saving persists to backend + local store', async () => {
    mockFetch();
    render(<Profile />);
    await waitFor(() => expect(screen.getByRole('radio', { name: '24-hour' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('radio', { name: '24-hour' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem('ck-time-format')).toBe('24'));

    const putCalls = global.fetch.mock.calls.filter(([, o]) => o && o.method === 'PUT');
    expect(
      putCalls.some(([url, o]) => String(url).includes('/users/time_format') && JSON.parse(o.body).time_format === '24')
    ).toBe(true);
    expect(JSON.parse(localStorage.getItem('user')).time_format).toBe('24');
  });

  it('updates full name and timezone through the profile PUT', async () => {
    mockFetch();
    render(<Profile />);
    await waitFor(() => expect(screen.getByLabelText('Full Name')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Name' } });

    const combobox = screen.getByRole('combobox', { name: 'Time zone' });
    fireEvent.click(combobox);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Asia/Kolkata' } });
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Asia\/Kolkata/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const profilePut = global.fetch.mock.calls.find(
      ([url, o]) => !String(url).includes('time_format') && o && o.method === 'PUT'
    );
    expect(profilePut).toBeTruthy();
    const body = JSON.parse(profilePut[1].body);
    expect(body.full_name).toBe('New Name');
    expect(body.timezone).toBe('Asia/Kolkata');

    await waitFor(() => expect(JSON.parse(localStorage.getItem('user')).timezone).toBe('Asia/Kolkata'));
  });
});