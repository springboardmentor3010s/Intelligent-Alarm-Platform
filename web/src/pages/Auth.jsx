// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
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
  FormField,
  BenefitList,
  AuthVisual,
  AuthWakeCard,
} from '../components/auth';
import { TimezonePicker, AlertCircleIcon, CheckCircleIcon } from '../components/ui';
import { browserTimeZone } from '../utils/timezones';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DIFFICULTIES = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];

const SIGNUP_HEAD = { title: 'Create your account', sub: 'Set up your cognitive wake protocol in under a minute.' };
const LOGIN_HEAD = { title: 'Welcome back', sub: 'Sign in to stay sharp every morning.' };

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
timezone: browserTimeZone(),
    difficulty_preference: 'Medium',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const validateField = (field) => {
    const value = form[field];
    if (field === 'email') {
      if (!value.trim()) return 'Email is required.';
      if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address.';
    }
    if (field === 'password') {
      if (!value) return 'Password is required.';
      if (mode === 'register' && value.length < 8) {
        return 'Password must contain at least 8 characters.';
      }
    }
    if (field === 'full_name' && mode === 'register' && !value.trim()) {
      return 'Full name is required.';
    }
    return null;
  };

  const setFieldError = (field, err) => {
    setErrors(prev => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  const update = (field) => (e) => {
    const value = e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
    if (touched[field] || errors[field]) {
      setFieldError(field, validateField(field));
    }
  };

  const handleBlur = (field) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setFieldError(field, validateField(field));
  };

  const validate = () => {
    const fields = mode === 'register'
      ? ['full_name', 'email', 'password']
      : ['email', 'password'];
    const next = {};
    fields.forEach(f => {
      const err = validateField(f);
      if (err) next[f] = err;
    });
    return next;
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
      setLoading(false);
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
      setLoading(false);
    } catch (err) {
      setMessage({ type: 'error', text: `Demo login failed: ${err.message}` });
      setLoading(false);
    }
  };

  const head = mode === 'login' ? LOGIN_HEAD : SIGNUP_HEAD;

  const hero = (
    <>
      <AuthBranding />
      <div className="hero-copy">
        <h1>Win your mornings with a smarter alarm.</h1>
        <p>
          An AI-powered cognitive alarm that wakes you with adaptive,
          brain-engaging challenges, and turns waking up into a daily habit.
        </p>
      </div>
      <BenefitList />
      <div className="hero-stats">
        <div className="hero-stat">
          <strong>7</strong>
          <span>Cognitive challenge modes</span>
        </div>
        <div className="hero-stat">
          <strong>5</strong>
          <span>Difficulty tiers</span>
        </div>
        <div className="hero-stat">
          <strong>ML</strong>
          <span>Personalized difficulty</span>
        </div>
      </div>
      <p className="hero-note">
        Each morning&apos;s challenge is tuned by a trained neural difficulty engine;
        your wake-up data keeps it sharper every day.
      </p>
      <AuthWakeCard />
      <AuthVisual />
    </>
  );

  const formEl = (
    <div className="auth-form">
      <div className="auth-form__head">
        <h2>{head.title}</h2>
        <p>{head.sub}</p>
      </div>

      <AuthTabs mode={mode} onChange={setMode} />

      {message && (
        <div
          className={`banner ${message.type === 'error' ? 'banner-error' : 'banner-success'}`}
          role="alert"
          aria-live="assertive"
        >
          {message.type === 'error' ? (
            <AlertCircleIcon size={16} />
          ) : (
            <CheckCircleIcon size={16} />
          )}{' '}
          {message.text}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        id="auth-tabpanel"
        role="tabpanel"
        aria-labelledby={`auth-tab-${mode}`}
        aria-busy={loading || undefined}
      >
        <div className="auth-form__fields">
          {mode === 'register' && (
            <TextInput
              id="full_name"
              label="Full name"
              value={form.full_name}
              onChange={update('full_name')}
              onBlur={handleBlur('full_name')}
              placeholder="e.g. Alex Morgan"
              autoComplete="name"
              disabled={loading}
              error={errors.full_name}
            />
          )}

          <TextInput
            id="email"
            label="Email"
            type="email"
            value={form.email}
            onChange={update('email')}
            onBlur={handleBlur('email')}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={loading}
            error={errors.email}
          />

          <PasswordInput
            id="password"
            label="Password"
            value={form.password}
            onChange={update('password')}
            onBlur={handleBlur('password')}
            placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            disabled={loading}
            hint={mode === 'register' ? 'Minimum 8 characters' : undefined}
            error={errors.password}
          />

          {mode === 'register' && (
            <>
              <SelectInput
                id="difficulty_preference"
                label="Preferred difficulty"
                value={form.difficulty_preference}
                onChange={update('difficulty_preference')}
                disabled={loading}
                error={errors.difficulty_preference}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </SelectInput>
              <FormField id="timezone" label="Timezone" error={errors.timezone}>
                <TimezonePicker
                  id="timezone"
                  value={form.timezone}
                  onChange={tz => setForm({ ...form, timezone: tz })}
                  error={errors.timezone}
                />
              </FormField>
            </>
          )}
        </div>

        <div className="auth-form__actions">
          <Button loading={loading} disabled={loading}>
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