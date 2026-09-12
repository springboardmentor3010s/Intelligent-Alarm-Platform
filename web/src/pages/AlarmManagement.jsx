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
  Badge,
  SectionHeader,
  SparklesIcon,
} from '../components/ui';
import { formatTimeOfDay, formatDateTime } from '../utils/timeFormat';

const ALARM_TYPES = ['Daily', 'Weekday', 'Weekend', 'One-Time'];
const CHALLENGE_TYPES = ['Math', 'Logic', 'Memory', 'Word', 'Pattern', 'Riddle', 'QuickQuiz'];
const DIFFICULTIES = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];
const RECURRENCE = ['none', 'daily', 'weekdays', 'weekends'];
const RECURRENCE_LABEL = { none: 'One-Time', daily: 'Daily', weekdays: 'Weekdays', weekends: 'Weekends' };

const EMPTY_FORM = {
  title: '',
  type: 'Daily',
  time: '07:00',
  challenge_type: 'Math',
  difficulty: 'Medium',
  recurrence: 'daily',
};

const ALARM_ROLE = (title, type) => {
  const t = (title || '').toLowerCase();
  if (t.includes('focus') || t.includes('boost')) return { label: 'Focus Boost', tone: 'brand' };
  if (t.includes('deep') || t.includes('recovery')) return { label: 'Deep Recovery', tone: 'warm' };
  if (t.includes('mental') || t.includes('clarity')) return { label: 'Mental Clarity', tone: 'brand' };
  if (t.includes('meditation') || t.includes('mindful')) return { label: 'Mindfulness', tone: 'subtle' };
  return { label: type === 'Weekend' ? 'Weekend Reset' : type === 'Weekday' ? 'Weekday Anchor' : 'Wake Anchor', tone: 'subtle' };
};

export default function AlarmManagement() {
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token] = useState(localStorage.getItem('token'));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeCycleWakeTime, setActiveCycleWakeTime] = useState('07:00');

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const loadAlarms = () => {
    setLoading(true);
    fetch('/api/v1/alarms', { headers })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setAlarms(list);
        if (list.length > 0 && list[0].time) {
          setActiveCycleWakeTime(list[0].time);
        }
      })
      .catch(err => {
        console.error(err);
        setError('Could not load alarms.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlarms();
  }, []);

  const set = key => e => setForm({ ...form, [key]: e.target.value });

  const createAlarm = async e => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/v1/alarms', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Failed to create alarm');
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      loadAlarms();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteAlarm = async id => {
    try {
      const res = await fetch(`/api/v1/alarms/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Delete failed');
      loadAlarms();
    } catch (err) {
      setError(err.message);
    }
  };

  const snoozeAlarm = async id => {
    try {
      const res = await fetch(`/api/v1/alarms/${id}/snooze`, { method: 'POST', headers });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Snooze failed');
      }
      loadAlarms();
    } catch (err) {
      setError(err.message);
    }
  };

  // Compute REM bedtime recommendations based on wake time
  const calculateBedtimes = timeStr => {
    const [h, m] = (timeStr || '07:00').split(':').map(Number);
    const wakeDate = new Date();
    wakeDate.setHours(h || 7, m || 0, 0, 0);

    const calcTime = minutesBefore => {
      const bed = new Date(wakeDate.getTime() - minutesBefore * 60000);
      const hours = bed.getHours();
      const mins = bed.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedH = (hours % 12 || 12).toString().padStart(2, '0');
      const formattedM = mins.toString().padStart(2, '0');
      return `${formattedH}:${formattedM} ${ampm}`;
    };

    return [
      { cycles: 5, hours: '7.5 hrs', bedtime: calcTime(450 + 15), desc: 'Recommended balance for sustained cognitive focus' },
      { cycles: 6, hours: '9.0 hrs', bedtime: calcTime(540 + 15), desc: 'Deep recovery for physical fatigue & memory consolidation' },
      { cycles: 4, hours: '6.0 hrs', bedtime: calcTime(360 + 15), desc: 'Minimum recommended sleep window with full cycle completion' },
    ];
  };

  const bedtimes = calculateBedtimes(activeCycleWakeTime);

  if (loading) {
    return (
      <div className="page">
        <SectionHeader title="Alarms" subtitle="Intelligent wake schedules & cognitive verification" />
        <div className="alarm-row">
          <Skeleton tone="metric" style={{ width: '110px', height: '40px' }} />
          <Skeleton tone="block" style={{ flex: 1, height: '48px' }} />
        </div>
        <div className="alarm-row">
          <Skeleton tone="metric" style={{ width: '110px', height: '40px' }} />
          <Skeleton tone="block" style={{ flex: 1, height: '48px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <SectionHeader
        title="Alarms"
        subtitle="Intelligent wake schedules, cognitive gates & circadian alignment"
      >
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          <PlusIcon size={16} />
          {showForm ? 'Cancel' : 'New Alarm'}
        </button>
      </SectionHeader>

      {error && <div className="banner banner-error">{error}</div>}

      {/* New Alarm Form Drawer/Panel */}
      {showForm && (
        <Card className="form-panel mb-6">
          <div className="card-label mb-4"><span className="sys-label">Schedule Configuration</span></div>
          <form onSubmit={createAlarm}>
            <div className="form-grid">
              <div>
                <label className="form-field-label" htmlFor="alarm-title">Schedule Name</label>
                <input
                  id="alarm-title"
                  value={form.title}
                  onChange={set('title')}
                  placeholder="e.g. Peak Focus Routine"
                  required
                />
              </div>

              <div>
                <label className="form-field-label" htmlFor="alarm-time">Wake Time</label>
                <TimeInput
                  id="alarm-time"
                  value={form.time}
                  onChange={value => setForm({ ...form, time: value })}
                />
              </div>

              <div>
                <label className="form-field-label" htmlFor="alarm-type">Schedule Type</label>
                <select id="alarm-type" value={form.type} onChange={set('type')}>
                  {ALARM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="form-field-label" htmlFor="alarm-challenge">Cognitive Challenge Gate</label>
                <select id="alarm-challenge" value={form.challenge_type} onChange={set('challenge_type')}>
                  {CHALLENGE_TYPES.map(t => <option key={t} value={t}>{t} Puzzle</option>)}
                </select>
              </div>

              <div>
                <label className="form-field-label" htmlFor="alarm-difficulty">Puzzle Difficulty</label>
                <select id="alarm-difficulty" value={form.difficulty} onChange={set('difficulty')}>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="form-field-label" htmlFor="alarm-recurrence">Recurrence Frequency</label>
                <select id="alarm-recurrence" value={form.recurrence} onChange={set('recurrence')}>
                  {RECURRENCE.map(r => <option key={r} value={r}>{RECURRENCE_LABEL[r] || r}</option>)}
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Save Intelligent Alarm</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Dismiss</button>
            </div>
          </form>
        </Card>
      )}

      {/* Alarms List */}
      {alarms.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<AlarmClockIcon size={28} />}
            title="No wake schedules established"
            description="Create your first cognitive alarm to activate prefrontal morning stimulation and habit scoring."
            action={
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                <PlusIcon size={16} /> New Alarm
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-2">
          {alarms.map(alarm => (
            <div className="alarm-row" key={alarm.id}>
              <div className="alarm-time">
                {formatTimeOfDay(alarm.time) || '-:-'}
              </div>

              <div className="alarm-main">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span className="alarm-title">{alarm.title || 'Morning Alarm'}</span>
                  <span className={`pill ${alarm.is_enabled ? 'pill-success' : 'pill-neutral'}`}>
                    <span className="led led--on" style={{ marginRight: '0.25rem' }} />
                    {alarm.is_enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <div className="alarm-meta" style={{ marginTop: '0.25rem' }}>
                  <Badge tone={ALARM_ROLE(alarm.title, alarm.alarm_type).tone}>{ALARM_ROLE(alarm.title, alarm.alarm_type).label}</Badge>
                  <Badge tone="subtle">{alarm.alarm_type || 'Schedule'}</Badge>
                  {alarm.recurrence && alarm.recurrence !== 'none' && (
                    <Badge tone="subtle">{RECURRENCE_LABEL[alarm.recurrence] || alarm.recurrence}</Badge>
                  )}
                  {alarm.challenge_type && (
                    <Badge tone="brand">
                      <SparklesIcon size={12} style={{ marginRight: '0.2rem' }} />
                      {alarm.challenge_type} ({alarm.difficulty || 'Adaptive'})
                    </Badge>
                  )}
                </div>

                <div className="alarm-next">
                  <ClockIcon size={13} />
                  <span>Next trigger: {alarm.next_trigger ? formatDateTime(alarm.next_trigger) : 'Unscheduled'}</span>
                </div>
              </div>

              <div className="alarm-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => snoozeAlarm(alarm.id)}
                  title="Snooze for 5 minutes"
                >
                  <AlarmClockIcon size={15} /> Snooze
                </button>

                {/* Destructive Delete visually separated */}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => deleteAlarm(alarm.id)}
                  aria-label={`Delete ${alarm.title || 'alarm'}`}
                  title="Delete alarm"
                  style={{ color: 'var(--c-rose)', padding: '0.55rem 0.75rem' }}
                >
                  <TrashIcon size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bedtime Optimizer & REM Cycle Helper Module */}
      <Card className="mt-6 p-6">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div className="card-label mb-0"><span className="sys-label">Circadian Sleep Optimizer · REM Cycle Calculator</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span className="text-muted-600">Calibrated for Wake Time:</span>
            <input
              type="time"
              value={activeCycleWakeTime}
              onChange={e => setActiveCycleWakeTime(e.target.value)}
              style={{ width: '120px', height: '34px', padding: '0 0.5rem', fontSize: '0.875rem' }}
            />
          </div>
        </div>

        <p className="text-sm text-muted-600 mb-4" style={{ maxWidth: '720px', lineHeight: 1.5 }}>
          Sleep naturally flows in 90-minute ultradian cycles. Waking in sync with cycle boundaries avoids sleep inertia, eliminates grogginess, and maximizes cognitive puzzle scores.
        </p>

        <div className="grid-cards grid-cards--3">
          {bedtimes.map(b => (
            <div
              key={b.cycles}
              style={{
                background: 'var(--surface-2)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className={`pill ${b.cycles === 5 ? 'pill-brand' : b.cycles === 6 ? 'pill-success' : 'pill-neutral'}`}>
                    {b.cycles} Cycles ({b.hours})
                  </span>
                  <span className="text-xs text-muted-600">+15m to fall asleep</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.75rem', color: 'var(--text)' }}>
                  {b.bedtime}
                </div>
              </div>
              <div className="text-xs text-muted-600 mt-2" style={{ lineHeight: 1.4 }}>
                {b.desc}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}