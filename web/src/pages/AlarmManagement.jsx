import React, { useEffect, useState } from 'react';
import { Card } from '../styles';

const ALARM_TYPES = ['Daily', 'Weekday', 'Weekend', 'One-Time'];
const CHALLENGE_TYPES = ['Math', 'Logic', 'Memory', 'Word', 'Pattern', 'Riddle', 'QuickQuiz'];
const DIFFICULTIES = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];
const RECURRENCE = ['none', 'daily', 'weekdays', 'weekends'];

export default function AlarmManagement() {
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token] = useState(localStorage.getItem('token'));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'Daily', time: '07:00', challenge_type: 'Math', difficulty: 'Medium', recurrence: 'none' });

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const loadAlarms = () => {
    setLoading(true);
    fetch('/api/v1/alarms', { headers })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setAlarms)
      .catch(err => { console.error(err); setError('Could not load alarms.'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAlarms(); }, []);

  const createAlarm = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/v1/alarms', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'create failed'); }
      setShowForm(false);
      setForm({ title: '', type: 'Daily', time: '07:00', challenge_type: 'Math', difficulty: 'Medium', recurrence: 'none' });
      loadAlarms();
    } catch (err) { setError(err.message); }
  };

  const deleteAlarm = async (id) => {
    try {
      const res = await fetch(`/api/v1/alarms/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('delete failed');
      loadAlarms();
    } catch (err) { setError(err.message); }
  };

  const snoozeAlarm = async (id) => {
    try {
      const res = await fetch(`/api/v1/alarms/${id}/snooze`, { method: 'POST', headers });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'snooze failed'); }
      loadAlarms();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <div className="page">Loading alarms…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Alarm Management</h1>
          <div className="subtitle">Create, snooze, and manage your wake-up alarms</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ New Alarm'}
        </button>
      </div>

      {error && <div className="banner banner-error">⚠️ {error}</div>}

      {showForm && (
        <Card className="mb-6">
          <div className="card-label mb-4">New Alarm</div>
          <form onSubmit={createAlarm} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Alarm title"
              required
              style={{ flex: 2, minWidth: '160px' }}
            />
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
              style={{ flex: 1, minWidth: '110px' }}
            >
              {ALARM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="time"
              value={form.time}
              onChange={e => setForm({ ...form, time: e.target.value })}
              style={{ flex: 1, minWidth: '110px' }}
            />
            <select
              value={form.challenge_type}
              onChange={e => setForm({ ...form, challenge_type: e.target.value })}
              style={{ flex: 1, minWidth: '110px' }}
            >
              {CHALLENGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={form.difficulty}
              onChange={e => setForm({ ...form, difficulty: e.target.value })}
              style={{ flex: 1, minWidth: '110px' }}
            >
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              value={form.recurrence}
              onChange={e => setForm({ ...form, recurrence: e.target.value })}
              style={{ flex: 1, minWidth: '110px' }}
            >
              {RECURRENCE.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="submit" className="btn btn-primary">Create Alarm</button>
          </form>
        </Card>
      )}

      {alarms.length === 0 ? (
        <div className="empty">
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⏰</div>
          No alarms found. Create your first alarm to get started.
        </div>
      ) : (
        alarms.map((alarm) => (
          <div className="list-row" key={alarm.id}>
            <div>
              <div className="title">{alarm.title || 'Untitled'}</div>
              <div className="meta">
                Next: {alarm.next_trigger ? new Date(alarm.next_trigger).toLocaleString() : 'N/A'}
                {alarm.challenge_type && (
                  <span style={{ marginLeft: '0.6rem' }}>
                    · Challenge: {alarm.challenge_type}/{alarm.difficulty}
                  </span>
                )}
                {alarm.recurrence && alarm.recurrence !== 'none' && (
                  <span style={{ marginLeft: '0.6rem' }}>· Recur: {alarm.recurrence}</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span className={`pill ${alarm.is_enabled ? 'pill-success' : 'pill-warm'}`}>
                {alarm.is_enabled ? 'Enabled' : 'Disabled'}
              </span>
              <span className="pill">{alarm.alarm_type}</span>
              {alarm.time && <span className="pill">{alarm.time}</span>}
              <span className="pill" style={{ background: 'rgba(255,213,121,0.15)', color: 'var(--accent-3)' }}>
                Snoozed {alarm.times_snoozed}x
              </span>
              <button className="btn btn-ghost" onClick={() => snoozeAlarm(alarm.id)}>Snooze</button>
              <button className="btn btn-danger" onClick={() => deleteAlarm(alarm.id)}>Delete</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
