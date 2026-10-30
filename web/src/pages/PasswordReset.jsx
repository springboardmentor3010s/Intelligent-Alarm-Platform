// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AuthLayout,
  AuthBranding,
  AuthVisual,
  TextInput,
  PasswordInput,
  Button,
} from '../components/auth';
import { apiFetch } from '../utils/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PasswordReset() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const requestReset = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!EMAIL_RE.test(email.trim())) {
      setMessage({ type: 'error', text: 'Enter a valid email address.' });
      return;
    }
    setBusy(true);
    const res = await apiFetch('/api/v1/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(res.ok
      ? { type: 'success', text: data.message || 'If an account exists with that email, a reset link has been sent.' }
      : { type: 'error', text: data.detail || 'Could not start password reset.' });
  };

  const confirmReset = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Password must contain at least 8 characters.' });
      return;
    }
    if (password !== confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setBusy(true);
    const res = await apiFetch('/api/v1/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMessage({ type: 'success', text: data.message || 'Password updated. Redirecting to sign in…' });
      setTimeout(() => navigate('/auth'), 1500);
    } else {
      setMessage({ type: 'error', text: data.detail || 'Invalid or expired reset token.' });
    }
  };

  const hero = (
    <>
      <AuthBranding />
      <div className="hero-copy">
        <h1>{token ? 'Set a new password.' : 'Reset your password.'}</h1>
        <p>
          {token
            ? 'Choose a strong password to regain access to your account.'
            : 'Enter the email tied to your account and we will send a single-use reset link.'}
        </p>
      </div>
      <AuthVisual />
    </>
  );

  const form = (
    <div className="auth-form">
      <div className="auth-form__head">
        <h2>{token ? 'New password' : 'Forgot password'}</h2>
        <p>
          {token
            ? 'Your reset link is single-use and expires in 30 minutes.'
            : 'We will email you a secure reset link.'}
        </p>
      </div>

      {message && (
        <div
          className={`banner ${message.type === 'error' ? 'banner-error' : 'banner-success'}`}
          role="alert"
          aria-live="assertive"
        >
          {message.text}
        </div>
      )}

      <form onSubmit={token ? confirmReset : requestReset} noValidate aria-busy={busy || undefined}>
        <div className="auth-form__fields">
          {token ? (
            <>
              <PasswordInput
                id="new_password"
                label="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                autoComplete="new-password"
                disabled={busy}
              />
              <PasswordInput
                id="confirm_password"
                label="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                disabled={busy}
              />
            </>
          ) : (
            <TextInput
              id="reset_email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={busy}
            />
          )}
        </div>

        <Button type="submit" loading={busy} disabled={busy}>
          {busy ? 'Please wait…' : token ? 'Update password' : 'Send reset link'}
        </Button>
      </form>

      <p className="text-sm text-muted-600" style={{ marginTop: '1rem', textAlign: 'center' }}>
        <Link to="/auth">Back to sign in</Link>
      </p>
    </div>
  );

  return <AuthLayout hero={hero} form={form} />;
}
