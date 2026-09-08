import React, { useEffect, useState } from 'react';
import { Card } from '../styles';
import { CardSkeleton, ErrorState, CheckCircleIcon } from '../components/ui';

const DIFFICULTIES = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function initials(name, email) {
  const src = (name || '').trim() || email;
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '')
    .join('');
}

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ full_name: '', timezone: '', difficulty_preference: '' });
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    Promise.all([
      fetch('/api/v1/users/profile', { headers }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }),
    ])
      .then(([p]) => {
        setProfile(p);
        setForm({ full_name: p.full_name || '', timezone: p.timezone || 'UTC', difficulty_preference: p.difficulty_preference || 'Medium' });
      })
      .catch(err => {
        console.error(err);
        setError('Could not load profile.');
        setProfile(null);
      });
  }, []);

  const save = async e => {
    e.preventDefault();
    setSaved(false);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'save failed');
      }
      const updated = await res.json();
      setProfile(updated);
      localStorage.setItem('user', JSON.stringify({ ...(JSON.parse(localStorage.getItem('user') || '{}')), full_name: updated.full_name }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    if (error) {
      return (
        <div className="page">
          <div className="page-header">
            <div>
              <h1>Profile</h1>
              <div className="subtitle">Your account identity</div>
            </div>
          </div>
          <Card><ErrorState description={error} /></Card>
        </div>
      );
    }
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Loading…</h1>
            <div className="subtitle" role="status">Loading profile…</div>
          </div>
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Profile</h1>
          <div className="subtitle">Your account identity</div>
        </div>
      </div>

      <div className="profile-layout">
        <Card className="profile-side">
          <div className="nav-avatar avatar-xl">{initials(profile.full_name, profile.email)}</div>
          <div className="profile-name">{profile.full_name || profile.email}</div>
          <div className="text-sm text-muted-600">{profile.email}</div>
          <div className="pill pill-success mt-3">
            <CheckCircleIcon size={13} /> {profile.is_verified ? 'Verified' : 'Unverified'}
          </div>
          <div className="profile-meta mt-4">
            <div className="text-xs text-muted-600">Member since</div>
            <div className="text-sm">{new Date(profile.created_at).toLocaleDateString()}</div>
          </div>
        </Card>

        <Card className="profile-main">
          <div className="card-label mb-4">Profile Details</div>
          <form onSubmit={save}>
            <div className="form-col">
              <div>
                <label className="form-field-label" htmlFor="profile-name">Full Name</label>
                <input
                  id="profile-name"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="form-field-label">Email</label>
                <input value={profile.email} disabled />
                <div className="text-xs text-muted-600 mt-1">Email address cannot be changed.</div>
              </div>
              <div>
                <label className="form-field-label" htmlFor="profile-tz">Time zone</label>
                <input id="profile-tz" list="tz-list" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} />
                <datalist id="tz-list">
                  {TIMEZONES.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
              <div>
                <label className="form-field-label" htmlFor="profile-difficulty">Preferred difficulty</label>
                <select id="profile-difficulty" value={form.difficulty_preference} onChange={e => setForm({ ...form, difficulty_preference: e.target.value })}>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="text-xs text-muted-600 mt-1">Used as a starting point for adaptive challenges.</div>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {saved && <span className="text-sm saved-hint"><CheckCircleIcon size={14} /> Saved</span>}
            </div>
          </form>
          {error && <div className="banner banner-warning">{error}</div>}
        </Card>
      </div>
    </div>
  );
}