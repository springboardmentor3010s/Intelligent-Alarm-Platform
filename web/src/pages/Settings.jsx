import React, { useState } from 'react';
import { Card, Grid } from '../styles';

export default function Settings() {
  const [notifications, setNotifications] = useState(true);
  const [autoDismiss, setAutoDismiss] = useState(false);
  const [vibrate, setVibrate] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
  const [profile, setProfile] = useState({
    full_name: storedUser?.full_name || '',
    timezone: storedUser?.timezone || 'UTC',
    difficulty_preference: storedUser?.difficulty_preference || 'Medium',
  });
  const [profileMsg, setProfileMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('token');

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    setSaving(true);
    try {
      const res = await fetch('/api/v1/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(profile),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'update failed'); }
      const updated = await res.json();
      localStorage.setItem('user', JSON.stringify(updated));
      setProfileMsg({ type: 'success', text: 'Profile saved' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ label, desc, checked, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.9rem 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem' }}>{label}</div>
        {desc && <div className="text-sm text-muted-600" style={{ marginTop: '0.15rem' }}>{desc}</div>}
      </div>
      <label style={{ position: 'relative', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }}
        />
        <span style={{
          display: 'inline-block',
          width: '3rem',
          height: '1.7rem',
          borderRadius: '999px',
          background: checked ? 'var(--accent)' : 'var(--surface-3)',
          position: 'relative',
          transition: 'background 0.25s',
        }}>
          <span style={{
            position: 'absolute',
            top: '0.2rem',
            left: checked ? '1.5rem' : '0.2rem',
            width: '1.3rem',
            height: '1.3rem',
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.25s',
          }} />
        </span>
      </label>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <div className="subtitle">Personalize your alarm & notification preferences</div>
        </div>
      </div>

      <Grid>
        <Card className="p-4">
          <div className="card-label mb-2">Profile</div>
          <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div>
              <label className="auth-label">Full name</label>
              <input value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} placeholder="e.g. Alex Morgan" />
            </div>
            <div>
              <label className="auth-label">Timezone</label>
              <select value={profile.timezone} onChange={e => setProfile({ ...profile, timezone: e.target.value })}>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New York</option>
                <option value="America/Los_Angeles">America/Los Angeles</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
              </select>
            </div>
            <div>
              <label className="auth-label">Preferred difficulty</label>
              <select value={profile.difficulty_preference} onChange={e => setProfile({ ...profile, difficulty_preference: e.target.value })}>
                <option value="Beginner">Beginner</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
                <option value="Expert">Expert</option>
              </select>
            </div>
            {profileMsg && (
              <div className={`banner ${profileMsg.type === 'error' ? 'banner-error' : 'banner-success'}`}>
                {profileMsg.type === 'error' ? '⚠️' : '✓'} {profileMsg.text}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </Card>

        <Card className="p-4">
          <div className="card-label mb-2">Alarm Behavior</div>
          <Toggle label="Alarm notifications" desc="Receive alerts for scheduled alarms" checked={notifications} onChange={() => setNotifications(!notifications)} />
          <Toggle label="Auto-dismiss on challenge" desc="Dismiss the alarm once the challenge is solved" checked={autoDismiss} onChange={() => setAutoDismiss(!autoDismiss)} />
          <Toggle label="Haptic feedback" desc="Vibrate when the alarm triggers" checked={vibrate} onChange={() => setVibrate(!vibrate)} />
        </Card>

        <Card className="p-4">
          <div className="card-label mb-2">Appearance</div>
          <Toggle label="Dark theme" desc="Midnight interface (recommended)" checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
        </Card>
      </Grid>
    </div>
  );
}
