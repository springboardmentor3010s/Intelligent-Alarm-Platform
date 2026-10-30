// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout, AuthBranding, AuthVisual } from '../components/auth';
import { apiFetch } from '../utils/api';

/**
 * Email verification landing page. The verification link emails a `?token=`;
 * this page confirms it against the backend and reports the outcome.
 */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState(token ? 'loading' : 'idle');
  const [text, setText] = useState('');

  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      const res = await apiFetch('/api/v1/auth/verify-email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!alive) return;
      if (res.ok) {
        setState('ok');
        setText(data.message || 'Email verified successfully.');
      } else {
        setState('error');
        setText(data.detail || 'Invalid or expired verification token.');
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const hero = (
    <>
      <AuthBranding />
      <div className="hero-copy">
        <h1>Verify your email.</h1>
        <p>Email verification secures your account and enables reminder notifications.</p>
      </div>
      <AuthVisual />
    </>
  );

  const form = (
    <div className="auth-form">
      <div className="auth-form__head">
        <h2>Email verification</h2>
        <p>{token ? 'Confirming your verification link…' : 'Open the verification link we emailed you.'}</p>
      </div>

      {state === 'loading' && <p className="text-sm text-muted-600">Verifying…</p>}

      {(state === 'ok' || state === 'error') && (
        <div className={`banner ${state === 'ok' ? 'banner-success' : 'banner-error'}`} role="alert">
          {text}
        </div>
      )}

      {state === 'idle' && (
        <p className="text-sm text-muted-600">
          No verification token was provided. Check your inbox for the link, or resend it from your profile.
        </p>
      )}

      <p style={{ marginTop: '1rem', textAlign: 'center' }}>
        <Link to="/auth" className="btn btn-primary">Continue to sign in</Link>
      </p>
    </div>
  );

  return <AuthLayout hero={hero} form={form} />;
}
