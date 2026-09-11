import React from 'react';
import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Auth from './Auth';

describe('Auth login/register UI', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.clear();
  });

  it('renders the login form by default with brand hero', () => {
    render(<Auth onAuth={() => {}} />);
    expect(screen.getByText('Win your mornings with a smarter alarm.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login with Demo Account' })).toBeInTheDocument();
    // Benefits preserved
    expect(screen.getByText('Adaptive difficulty, personalized to you')).toBeInTheDocument();
    expect(screen.getByText('7 challenge types engineered for your brain')).toBeInTheDocument();
    expect(screen.getByText('Habit scoring & progress insights')).toBeInTheDocument();
  });

  it('renders the "Next wake window" product-card mock in the hero', () => {
    render(<Auth onAuth={() => {}} />);
    expect(screen.getByText('Next wake window')).toBeInTheDocument();
    expect(screen.getByText('ARMED')).toBeInTheDocument();
    expect(screen.getByText('07')).toBeInTheDocument();
    expect(screen.getByText('05')).toBeInTheDocument();
    expect(screen.getByText('SCORE')).toBeInTheDocument();
  });

  it('switching to Register reveals all five fields', () => {
    render(<Auth onAuth={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Register' }));
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Preferred difficulty')).toBeInTheDocument();
    expect(screen.getByLabelText('Timezone')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('shows inline validation errors on an empty submit', () => {
    render(<Auth onAuth={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
  });

  it('register enforces the existing 8-char password rule', () => {
    render(<Auth onAuth={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Register' }));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Alex Morgan' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByText('Password must contain at least 8 characters.')).toBeInTheDocument();
  });

  it('email accepts valid format and blocks malformed input', () => {
    render(<Auth onAuth={() => {}} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('password visibility toggle reveals and hides the value', () => {
    render(<Auth onAuth={() => {}} />);
    const pw = screen.getByLabelText('Password');
    expect(pw).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(pw).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(pw).toHaveAttribute('type', 'password');
  });

  it('theme toggle switches the data-theme attribute', () => {
    render(<Auth onAuth={() => {}} />);
    const toggle = screen.getByRole('button', { name: 'Switch to light theme' });
    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });
});