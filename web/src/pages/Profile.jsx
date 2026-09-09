import React, { useEffect, useState } from 'react';
import { Card } from '../styles';
import {
  CardSkeleton,
  ErrorState,
  CheckCircleIcon,
  ClockIcon,
} from '../components/ui';
import { buildTimeZoneOptions } from '../utils/timezones';
import {
  formatDateTime,
  formatDate,
  getTimeFormat,
  setTimeFormat,
} from '../utils/timeFormat';

const DIFFICULTIES = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];
const TIME_ZONE_OPTIONS = buildTimeZoneOptions();

function initials(name, email) {
  const src = (name || '').trim() || email;
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '')
    .join('');
}

/** Live readout of the current time in the selected zone + 12/24 format. */
function LiveZoneTime({ timezone }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="tz-live">
      <ClockIcon size={13} />
      <span>Current time:</span>
      <strong className="tabular">{formatDateTime(now.toISOString(), { withSeconds: true })}</strong>
      <span className="text-xs text-muted-600">{timezone}</span>
    </div>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ full_name: '', timezone: 'UTC', difficulty_preference: 'Medium' });
  const [format, setFormat] = useState(getTimeFormat);
  const [initialFormat, setInitialFormat] = useState(getTimeFormat);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    Promise.all([
      fetch('/api/v1/users/profile', { headers }),
      fetch('/api/v1/users/settings', { headers }),
    ])
      .then(([profRes, setRes]) =>
        Promise.all([profRes.ok ? profRes.json() : Promise.reject(new Error(`HTTP ${profRes.status}`)), setRes.json()])
      )
      .then(([p, settings]) => {
        setProfile(p);
        setForm({
          full_name: p.full_name || '',
          timezone: p.timezone || 'UTC',
          difficulty_preference: p.difficulty_preference || 'Medium',
        });
        const savedFormat = settings?.time_format === '24' ? '24' : '12';
        setFormat(savedFormat);
        setInitialFormat(savedFormat);
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
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      };

      const res = await fetch('/api/v1/users/profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'save failed');
      }
      const updated = await res.json();

      if (format !== initialFormat) {
        const fmtRes = await fetch('/api/v1/users/time_format', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ time_format: format }),
        });
        if (!fmtRes.ok) {
          const d = await fmtRes.json().catch(() => ({}));
          throw new Error(d.detail || 'could not save time format');
        }
      }

      setProfile(updated);
      setInitialFormat(format);
      setTimeFormat(format);
      localStorage.setItem(
        'user',
        JSON.stringify({
          ...(JSON.parse(localStorage.getItem('user') || '{}')),
          full_name: updated.full_name,
          timezone: updated.timezone,
          difficulty_preference: updated.difficulty_preference,
          time_format: format,
        })
      );
      setForm({
        full_name: updated.full_name || '',
        timezone: updated.timezone || 'UTC',
        difficulty_preference: updated.difficulty_preference || 'Medium',
      });
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
            <div className="text-sm">{formatDate(profile.created_at)}</div>
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
                <select
                  id="profile-tz"
                  value={form.timezone}
                  onChange={e => setForm({ ...form, timezone: e.target.value })}
                >
                  {TIME_ZONE_OPTIONS.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
                <LiveZoneTime timezone={form.timezone} />
              </div>
              <div>
                <label className="form-field-label" htmlFor="profile-difficulty">Preferred difficulty</label>
                <select id="profile-difficulty" value={form.difficulty_preference} onChange={e => setForm({ ...form, difficulty_preference: e.target.value })}>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="text-xs text-muted-600 mt-1">Used as a starting point for adaptive challenges.</div>
              </div>
              <div>
                <span className="form-field-label" id="profile-format-label">Time format</span>
                <div className="segmented segmented--format" role="radiogroup" aria-labelledby="profile-format-label">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={format === '12'}
                    className={format === '12' ? 'is-active' : ''}
                    onClick={() => setFormat('12')}
                  >
                    12-hour (AM/PM)
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={format === '24'}
                    className={format === '24' ? 'is-active' : ''}
                    onClick={() => setFormat('24')}
                  >
                    24-hour
                  </button>
                </div>
                <div className="text-xs text-muted-600 mt-1">
                  Applies to every time shown across the app — Home, Alarms, and the clock.
                </div>
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