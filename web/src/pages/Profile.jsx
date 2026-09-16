import React, { useEffect, useState } from 'react';
import { Card } from '../styles';
import {
  CardSkeleton,
  ErrorState,
  CheckCircleIcon,
  ClockIcon,
  TimezonePicker,
  SectionHeader,
} from '../components/ui';
import {
  formatDateTime,
  formatDate,
  getTimeFormat,
  setTimeFormat,
} from '../utils/timeFormat';
import { apiFetch } from '../utils/api';

const DIFFICULTIES = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];

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
      <span className="text-xs text-muted-600">({timezone})</span>
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
    Promise.all([
      apiFetch('/api/v1/users/profile'),
      apiFetch('/api/v1/users/settings'),
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
      const res = await apiFetch('/api/v1/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Save failed');
      }
      const updated = await res.json();

      if (format !== initialFormat) {
        const fmtRes = await apiFetch('/api/v1/users/time_format', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ time_format: format }),
        });
        if (!fmtRes.ok) {
          const d = await fmtRes.json().catch(() => ({}));
          throw new Error(d.detail || 'Could not save time format');
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
          <SectionHeader title="Profile" subtitle="Your account identity & preferences" />
          <Card><ErrorState description={error} /></Card>
        </div>
      );
    }
    return (
      <div className="page">
        <SectionHeader title="Profile" subtitle="Loading profile settings…" />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="page">
      <SectionHeader
        title="Profile"
        subtitle="Manage your identity, circadian timezone synchronization, and cognitive baseline"
      />

      <div className="profile-layout">
        {/* Left Side: Identity Card */}
        <Card className="profile-side">
          <div className="nav-avatar avatar-xl">{initials(profile.full_name, profile.email)}</div>
          <div className="profile-name">{profile.full_name || profile.email}</div>
          <div className="text-sm text-muted-600">{profile.email}</div>

          <div className="pill pill-success mt-3">
            <CheckCircleIcon size={13} /> {profile.is_verified ? 'Verified Account' : 'Unverified'}
          </div>

          <div style={{ marginTop: '1.5rem', width: '100%', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
            <div className="text-xs text-muted-600 uppercase" style={{ letterSpacing: '0.05em' }}>Member Since</div>
            <div className="text-sm font-semibold" style={{ marginTop: '0.2rem', color: 'var(--text)' }}>
              {formatDate(profile.created_at)}
            </div>
          </div>
        </Card>

        {/* Right Side: Grouped Preferences Form */}
        <Card className="profile-main">
          <form onSubmit={save}>
            <div className="form-col">
              {/* Group 1: Identity */}
              <div>
                <div className="card-label mb-3"><span className="sys-label">Identity Information</span></div>
                <div className="form-group">
                  <label className="form-field-label" htmlFor="profile-name">Full Name</label>
                  <input
                    id="profile-name"
                    value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Your legal or preferred name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-field-label">Email Address</label>
                  <input value={profile.email} disabled />
                  <span className="text-xs text-muted-600 mt-1">Unique account identifier. Fixed to current login.</span>
                </div>
              </div>

              {/* Group 2: Timezone & Clock */}
              <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div className="card-label mb-3"><span className="sys-label">Circadian Timezone & Clock</span></div>
                <div className="form-group">
                  <label className="form-field-label" htmlFor="profile-tz">Time zone</label>
                  <TimezonePicker
                    id="profile-tz"
                    value={form.timezone}
                    onChange={tz => setForm({ ...form, timezone: tz })}
                  />
                  <LiveZoneTime timezone={form.timezone} />
                </div>

                <div className="form-group">
                  <span className="form-field-label" id="profile-format-label">Display Time Format</span>
                  <div className="segmented segmented--format" role="radiogroup" aria-labelledby="profile-format-label" style={{ marginTop: '0.35rem' }}>
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
                  <span className="text-xs text-muted-600 mt-1">
                    Standardizes time formatting across all alarm triggers, timelines, and status clocks.
                  </span>
                </div>
              </div>

              {/* Group 3: Cognitive Preferences */}
              <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div className="card-label mb-3"><span className="sys-label">Cognitive Difficulty Baseline</span></div>
                <div className="form-group">
                  <label className="form-field-label" htmlFor="profile-difficulty">Preferred Starting Difficulty</label>
                  <select
                    id="profile-difficulty"
                    value={form.difficulty_preference}
                    onChange={e => setForm({ ...form, difficulty_preference: e.target.value })}
                  >
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <span className="text-xs text-muted-600 mt-1">
                    Serves as the starting anchor for the adaptive PyTorch neural difficulty engine.
                  </span>
                </div>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
              <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {saved && <span className="saved-hint"><CheckCircleIcon size={15} /> Preferences saved</span>}
            </div>
          </form>
          {error && <div className="banner banner-warning mt-4">{error}</div>}
        </Card>
      </div>
    </div>
  );
}