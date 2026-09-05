import React, { useState } from 'react';

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    timezone: 'UTC',
    difficulty_preference: 'Medium',
  });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const isLogin = mode === 'login';
    const url = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const body = isLogin
      ? { email: form.email, password: form.password }
      : { ...form };

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

  return (
    <div className="auth-shell">
      {/* Hero panel */}
      <div className="auth-hero">
        <div className="hero-brand">
          <span className="brand-mark">🧠</span> CerebroKognit
        </div>
        <h1>Win your mornings with a smarter alarm.</h1>
        <p>
          An AI-powered cognitive alarm that wakes you with adaptive,
          brain-engaging challenges — and turns waking up into a daily habit.
        </p>
        <div className="highlights">
          <div className="highlight"><span className="dot" style={{ background: 'var(--accent)' }} /> Adaptive difficulty, personalized to you</div>
          <div className="highlight"><span className="dot" style={{ background: 'var(--accent-2)' }} /> 7 challenge types engineered for your brain</div>
          <div className="highlight"><span className="dot" style={{ background: 'var(--accent-3)' }} /> Habit scoring & progress insights</div>
        </div>
      </div>

      {/* Auth panel */}
      <div className="auth-panel">
        <div className="auth-card">
          <div className="tabs">
            <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Login</button>
            <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Register</button>
          </div>

          {message && (
            <div className={`banner ${message.type === 'error' ? 'banner-error' : 'banner-success'}`} style={{ marginBottom: '1rem' }}>
              {message.type === 'error' ? '⚠️' : '✓'} {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <>
                <div className="auth-field">
                  <label className="auth-label">Full name</label>
                  <input value={form.full_name} onChange={update('full_name')} placeholder="e.g. Alex Morgan" />
                </div>
                <div className="auth-field">
                  <label className="auth-label">Preferred difficulty</label>
                  <select value={form.difficulty_preference} onChange={update('difficulty_preference')}>
                    <option value="Beginner">Beginner</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
                <div className="auth-field">
                  <label className="auth-label">Timezone</label>
                  <select value={form.timezone} onChange={update('timezone')}>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New York</option>
                    <option value="America/Los_Angeles">America/Los Angeles</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                  </select>
                </div>
              </>
            )}

            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input value={form.email} onChange={update('email')} type="email" required placeholder="you@example.com" />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input value={form.password} onChange={update('password')} type="password" required minLength={mode === 'register' ? 8 : undefined} placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'} />
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>

          <div className="auth-divider">or</div>

          <button onClick={demoLogin} className="demo-btn" disabled={loading}>
            Login with Demo Account
          </button>
        </div>
      </div>
    </div>
  );
}
