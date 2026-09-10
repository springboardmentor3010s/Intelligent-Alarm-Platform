import React, { useEffect, useState } from 'react';
import { Card } from '../styles';
import {
  EmptyState,
  Skeleton,
  AlarmClockIcon,
  PlusIcon,
  TrashIcon,
  ClockIcon,
  TimeInput,
} from '../components/ui';
import { formatTimeOfDay, formatDateTime } from '../utils/timeFormat';

const ALARM_TYPES = ['Daily', 'Weekday', 'Weekend', 'One-Time'];
const CHALLENGE_TYPES = ['Math', 'Logic', 'Memory', 'Word', 'Pattern', 'Riddle', 'QuickQuiz'];
const DIFFICULTIES = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];
const RECURRENCE = ['none', 'daily', 'weekdays', 'weekends'];

const RECURRENCE_LABEL = { none: 'One-Time', daily: 'Daily', weekdays: 'Weekdays', weekends: 'Weekends' };

const EMPTY_FORM = { title: '', type: 'Daily', time: '07:00', challenge_type: 'Math', difficulty: 'Medium', recurrence: 'none' };

export default function AlarmManagement() {
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token] = useState(localStorage.getItem('token'));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const loadAlarms = () => {
    setLoading(true);
    fetch('/api/v1/alarms', { headers })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setAlarms(Array.isArray(data) ? data : []))
      .catch(err => { console.error(err); setError('Could not load alarms.'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAlarms(); }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

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
      setForm(EMPTY_FORM);
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

  if (loading) {
    return (
      <div className="page">
        <AlarmHeader />
        <div className="alarm-row"><Skeleton tone="metric" style={{ width: '88px' }} /><Skeleton tone="block" style={{ flex: 1, height: '56px' }} /></div>
        <div className="alarm-row"><Skeleton tone="metric" style={{ width: '88px' }} /><Skeleton tone="block" style={{ flex: 1, height: '56px' }} /></div>
      </div>
    );
  }

  return (
    <div className="page">
      <AlarmHeader>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          <PlusIcon size={16} />
          {showForm ? 'Cancel' : 'New Alarm'}
        </button>
      </AlarmHeader>

      {error && <div className="banner banner-error">{error}</div>}

      {showForm && (
        <Card className="form-panel mb-6">
          <div className="card-label mb-4">New Alarm</div>
          <form onSubmit={createAlarm}>
            <div className="form-grid">
              <div>
                <label className="form-field-label" htmlFor="alarm-title">Alarm title</label>
                <input
                  id="alarm-title"
                  value={form.title}
                  onChange={set('title')}
                  placeholder="e.g. Morning Boost"
                />
              </div>
              <div>
                <label className="form-field-label" htmlFor="alarm-type">Alarm type</label>
                <select id="alarm-type" value={form.type} onChange={set('type')}>
                  {ALARM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="form-field-label" htmlFor="alarm-time">Time</label>
                <TimeInput id="alarm-time" value={form.time} onChange={value => setForm({ ...form, time: value })} />
              </div>
              <div>
                <label className="form-field-label" htmlFor="alarm-challenge">Challenge</label>
                <select id="alarm-challenge" value={form.challenge_type} onChange={set('challenge_type')}>
                  {CHALLENGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="form-field-label" htmlFor="alarm-difficulty">Difficulty</label>
                <select id="alarm-difficulty" value={form.difficulty} onChange={set('difficulty')}>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="form-field-label" htmlFor="alarm-recurrence">Recurrence</label>
                <select id="alarm-recurrence" value={form.recurrence} onChange={set('recurrence')}>
                  {RECURRENCE.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Create Alarm</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </Card>
      )}

      {alarms.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<AlarmClockIcon size={24} />}
            title="No alarms yet"
            description="Create your first cognitive alarm to begin your morning routine."
            action={
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                <PlusIcon size={16} /> New Alarm
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-6">
          {alarms.map((alarm) => (
            <div className="alarm-row" key={alarm.id}>
              <div className="alarm-time">{formatTimeOfDay(alarm.time) || '—:—'}</div>
              <div className="alarm-main">
                <div className="alarm-title">{alarm.title || 'Untitled alarm'}</div>
                <div className="alarm-meta">
                  {alarm.alarm_type}
                  {alarm.recurrence && alarm.recurrence !== 'none' && ` · ${RECURRENCE_LABEL[alarm.recurrence] || alarm.recurrence}`}
                  {alarm.challenge_type && ` · ${alarm.challenge_type} · ${alarm.difficulty || ''}`}
                </div>
                <div className="alarm-next">
                  <ClockIcon size={13} />
                  {alarm.next_trigger ? `Next: ${formatDateTime(alarm.next_trigger)}` : 'Not scheduled'}
                </div>
              </div>
              <div className="alarm-actions">
                <span className={`pill alarm-status ${alarm.is_enabled ? 'pill-success' : 'pill-neutral'}`}>
                  {alarm.is_enabled ? 'Enabled' : 'Disabled'}
                </span>
                <button className="btn btn-ghost" onClick={() => snoozeAlarm(alarm.id)}>
                  <AlarmClockIcon size={16} /> Snooze
                </button>
                <button className="btn btn-danger" onClick={() => deleteAlarm(alarm.id)} aria-label={`Delete ${alarm.title || 'alarm'}`}>
                  <TrashIcon size={15} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlarmHeader({ children }) {
  return (
    <div className="page-header">
      <div>
        <h1>Alarms</h1>
        <div className="subtitle">Create, snooze, and manage your wake-up alarms</div>
      </div>
      <div className="page-header__actions">{children}</div>
    </div>
  );
}