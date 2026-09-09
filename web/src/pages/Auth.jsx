import React, { useState } from 'react';
import {
  AuthLayout,
  AuthBranding,
  AuthTabs,
  AuthDivider,
  TextInput,
  PasswordInput,
  SelectInput,
  Button,
  BenefitList,
} from '../components/auth';

import { buildTimeZoneOptions } from '../utils/timezones';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DIFFICULTIES = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];
const TIME_ZONE_OPTIONS = buildTimeZoneOptions();

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    timezone: 'UTC',
    difficulty_preference: 'Medium',
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address.';

    if (!form.password) e.password = 'Password is required.';
    else if (mode === 'register' && form.password.length < 8) {
      e.password = 'Password must contain at least 8 characters.';
    }

    if (mode === 'register' && !form.full_name.trim()) {
      e.full_name = 'Full name is required.';
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const first = ['full_name', 'email', 'password'].find((k) => nextErrors[k]);
      if (first) document.getElementById(first)?.focus();
      return;
    }

    setLoading(true);

    const isLogin = mode === 'login';
    const url = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const body = isLogin
      ? { email: form.email.trim(), password: form.password }
      : { ...form, email: form.email.trim() };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage({ type: 'error', text: data.detail || `HTTP ${res.status}` });
        setLoading(false);
        return;
      }

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onAuth(data);
    } catch (err) {
      setMessage({ type: 'error', text: `Backend unreachable: ${err.message}` });
      setLoading(false);
    }
  };

  const demoLogin = async () => {
    setMessage(null);
    setErrors({});
    setLoading(true);
    const email = 'demo@cerebro.com';
    const password = 'password123';
    try {
      let res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.status === 401) {
        res = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: 'Demo User', timezone: 'UTC', difficulty_preference: 'Medium' }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'login failed');
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onAuth(data);
    } catch (err) {
      setMessage({ type: 'error', text: `Demo login failed: ${err.message}` });
      setLoading(false);
    }
  };

  const hero = (
    <>
      <AuthBranding />
      <div className="hero-copy">
        <h1>Win your mornings with a smarter alarm.</h1>
        <p>
          An AI-powered cognitive alarm that wakes you with adaptive,
          brain-engaging challenges — and turns waking up into a daily habit.
        </p>
      </div>
      <BenefitList />
    </>
  );

  const formEl = (
    <div className="auth-form">
      <AuthTabs mode={mode} onChange={setMode} />

      {message && (
        <div
          className={`banner ${message.type === 'error' ? 'banner-error' : 'banner-success'}`}
          role="alert"
        >
          {message.type === 'error' ? '⚠️' : '✓'} {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {mode === 'register' && (
          <>
            <TextInput
              id="full_name"
              label="Full name"
              value={form.full_name}
              onChange={update('full_name')}
              placeholder="e.g. Alex Morgan"
              autoComplete="name"
              error={errors.full_name}
            />
            <SelectInput
              id="difficulty_preference"
              label="Preferred difficulty"
              value={form.difficulty_preference}
              onChange={update('difficulty_preference')}
              error={errors.difficulty_preference}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </SelectInput>
            <SelectInput
              id="timezone"
              label="Timezone"
              value={form.timezone}
              onChange={update('timezone')}
              error={errors.timezone}
            >
              {TIME_ZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </SelectInput>
          </>
        )}

        <TextInput
          id="email"
          label="Email"
          type="email"
          value={form.email}
          onChange={update('email')}
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email}
        />

        <PasswordInput
          id="password"
          label="Password"
          value={form.password}
          onChange={update('password')}
          placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
          minLength={mode === 'register' ? 8 : undefined}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          error={errors.password}
        />

        <div className="auth-form__actions">
          <Button loading={loading}>
            {loading
              ? (mode === 'login' ? 'Logging in…' : 'Creating account…')
              : (mode === 'login' ? 'Login' : 'Create Account')}
          </Button>
        </div>
      </form>

      <AuthDivider />

      <Button variant="secondary" onClick={demoLogin} loading={loading} type="button">
        {loading ? 'Signing in…' : 'Login with Demo Account'}
      </Button>
    </div>
  );

  return <AuthLayout hero={hero} form={formEl} />;
}