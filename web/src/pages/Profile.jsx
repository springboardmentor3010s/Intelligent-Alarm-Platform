// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
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
      <span className="tz-live__label">Current time</span>
      <strong className="tabular tz-live__time">{formatDateTime(now.toISOString(), { withSeconds: true })}</strong>
      <span className="tz-live__zone">({timezone})</span>
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
    <div className="page profile-page">
      <SectionHeader
        title="Profile"
        subtitle="Manage your identity, circadian timezone synchronization, and cognitive baseline"
      />

      <form className="profile-bento" onSubmit={save}>
        {/* Identity summary */}
        <Card className="profile-identity">
          <div className="profile-identity__top">
            <div className="nav-avatar avatar-lg">{initials(profile.full_name, profile.email)}</div>
            <div className="profile-identity__meta">
              <div className="profile-name">{profile.full_name || profile.email}</div>
              <div className="text-sm text-muted-600">{profile.email}</div>
            </div>
          </div>

          <div className={`pill ${profile.is_verified ? 'pill-success' : 'pill-neutral'}`}>
            <CheckCircleIcon size={13} /> {profile.is_verified ? 'Verified Account' : 'Unverified'}
          </div>

          <div className="profile-member">
            <span className="profile-member__label">Member Since</span>
            <strong className="tabular">{formatDate(profile.created_at)}</strong>
          </div>
        </Card>

        {/* Profile metadata */}
        <Card className="profile-meta">
          <div className="card-label"><span className="sys-label">Profile Metadata</span></div>
          <div className="profile-meta__row">
            <span className="profile-meta__label">Account ID</span>
            <strong className="tabular">#{profile.id}</strong>
          </div>
          <div className="profile-meta__row">
            <span className="profile-meta__label">Account Status</span>
            <strong>{profile.is_active ? 'Active' : 'Inactive'}</strong>
          </div>
        </Card>

        {/* Identity information */}
        <Card className="profile-info">
          <div className="card-label"><span className="sys-label">Identity Information</span></div>
          <div className="profile-fields">
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
              <label className="form-field-label" htmlFor="profile-email">Email Address</label>
              <input id="profile-email" value={profile.email} disabled />
            </div>
          </div>
          <span className="text-xs text-muted-600">
            Unique account identifier. Fixed to current login.
          </span>
        </Card>

        {/* Circadian timezone & clock */}
        <Card className="profile-time">
          <div className="card-label"><span className="sys-label">Circadian Timezone & Clock</span></div>
          <div className="form-group">
            <label className="form-field-label" htmlFor="profile-tz">Time zone</label>
            <TimezonePicker
              id="profile-tz"
              value={form.timezone}
              onChange={tz => setForm({ ...form, timezone: tz })}
            />
            <LiveZoneTime timezone={form.timezone} />
          </div>
        </Card>

        {/* Display time format */}
        <Card className="profile-format">
          <div className="card-label" id="profile-format-label"><span className="sys-label">Display Time Format</span></div>
          <div className="segmented segmented--format" role="radiogroup" aria-labelledby="profile-format-label" data-active={format}>
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
          <span className="text-xs text-muted-600">
            Standardizes time formatting across all alarm triggers, timelines, and status clocks.
          </span>
        </Card>

        {/* Cognitive difficulty baseline */}
        <Card className="profile-difficulty">
          <div className="card-label"><span className="sys-label">Cognitive Difficulty Baseline</span></div>
          <div className="form-group">
            <label className="form-field-label" htmlFor="profile-difficulty">Preferred Starting Difficulty</label>
            <select
              id="profile-difficulty"
              value={form.difficulty_preference}
              onChange={e => setForm({ ...form, difficulty_preference: e.target.value })}
            >
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <span className="text-xs text-muted-600">
              Serves as the starting anchor for the adaptive PyTorch neural difficulty engine.
            </span>
          </div>
        </Card>

        {/* Save actions */}
        <div className="profile-save">
          {error && <div className="banner banner-warning profile-save__banner">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="saved-hint"><CheckCircleIcon size={15} /> Preferences saved</span>}
        </div>
      </form>
    </div>
  );
}