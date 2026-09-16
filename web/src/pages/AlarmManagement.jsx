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
  BrainIcon,
  CalendarIcon,
  SunIcon,
} from '../components/ui';
import { formatTimeOfDay, formatDateTime } from '../utils/timeFormat';
import { apiFetch } from '../utils/api';

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

const sunProgress = time => {
  const [h = 7, m = 0] = String(time || '07:00').split(':').map(Number);
  return (h * 60 + (m || 0)) / 1440;
};

const SUN_TICKS = [
  { t: 0.08, label: '2 AM' },
  { t: 0.29, label: '7 AM' },
  { t: 0.5, label: '12 PM' },
  { t: 0.71, label: '5 PM' },
  { t: 0.92, label: '10 PM' },
];

/** Point on a quadratic bezier day-arc at fraction t in [0, 1]. */
const dayArc = (t, p0, c, p2) => {
  const mt = 1 - t;
  return {
    x: mt * mt * p0[0] + 2 * mt * t * c[0] + t * t * p2[0],
    y: mt * mt * p0[1] + 2 * mt * t * c[1] + t * t * p2[1],
  };
};

export default function AlarmManagement() {
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeCycleWakeTime, setActiveCycleWakeTime] = useState('07:00');

  const loadAlarms = () => {
    setLoading(true);
    apiFetch('/api/v1/alarms')
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
      const res = await apiFetch('/api/v1/alarms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await apiFetch(`/api/v1/alarms/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      loadAlarms();
    } catch (err) {
      setError(err.message);
    }
  };

  const snoozeAlarm = async id => {
    try {
      const res = await apiFetch(`/api/v1/alarms/${id}/snooze`, { method: 'POST' });
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
        <div className="ab-alarms">
          <div className="ab-tile">
            <Skeleton tone="metric" style={{ width: '110px', height: '42px' }} />
            <Skeleton tone="block" style={{ width: '60%', height: '16px' }} />
            <Skeleton tone="block" style={{ width: '80%', height: '14px' }} />
          </div>
          <div className="ab-tile">
            <Skeleton tone="metric" style={{ width: '110px', height: '42px' }} />
            <Skeleton tone="block" style={{ width: '60%', height: '16px' }} />
            <Skeleton tone="block" style={{ width: '80%', height: '14px' }} />
          </div>
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

      {/* New Alarm Form - Configuration Workspace */}
      {showForm && (
        <Card className="form-panel mb-6">
          <div className="form-panel__head">
            <div className="card-label"><span className="sys-label">Schedule Configuration</span></div>
            <Badge tone="brand">
              <SparklesIcon size={12} style={{ marginRight: '0.2rem' }} /> Intelligent Alarm
            </Badge>
          </div>

          <form onSubmit={createAlarm}>
            <div className="alarm-bento">
              <section className="bento bento--wake">
                <div className="bento__head">
                  <AlarmClockIcon size={15} />
                  <span>Wake Time</span>
                  <span className="bento__chip">Primary anchor</span>
                </div>

                <TimeInput
                  id="alarm-time"
                  value={form.time}
                  onChange={value => setForm({ ...form, time: value })}
                />

                <div className="wake-sun">
                  <div className="wake-sun__title">
                    <SunIcon size={13} />
                    <span>Daily Sun Arc</span>
                  </div>
                  <svg viewBox="0 0 320 96">
                    <path
                      className="wake-sun__horizon"
                      d="M8 76 Q 160 66 312 76"
                      fill="none"
                      strokeWidth="1.5"
                    />
                    <path
                      className="wake-sun__sunpath"
                      d="M8 76 Q 160 18 312 76"
                      fill="none"
                      strokeWidth="1.5"
                      strokeDasharray="3 5"
                    />
                    {SUN_TICKS.map(({ t, label }) => {
                      const x = 8 + t * 304;
                      const onArc = dayArc(t, [8, 76], [160, 18], [312, 76]);
                      return (
                        <g key={t}>
                          <line
                            className="wake-sun__tick"
                            x1={x}
                            y1={onArc.y + 4}
                            x2={x}
                            y2="76"
                            strokeWidth="1"
                          />
                          <text className="wake-sun__tick-label" x={x} y="90" textAnchor="middle">
                            {label}
                          </text>
                        </g>
                      );
                    })}
                    {(() => {
                      const p = sunProgress(form.time);
                      const onArc = dayArc(p, [8, 76], [160, 18], [312, 76]);
                      return (
                        <g>
                          <circle className="wake-sun__halo" cx={onArc.x} cy={onArc.y} r="10" fill="none" strokeWidth="1" strokeDasharray="2 4" />
                          <circle className="wake-sun__body" cx={onArc.x} cy={onArc.y} r="5" />
                          <line
                            className="wake-sun__plumb"
                            x1={onArc.x}
                            y1={onArc.y + 5}
                            x2={onArc.x}
                            y2="76"
                            strokeWidth="1"
                            strokeDasharray="2 3"
                          />
                        </g>
                      );
                    })()}
                  </svg>
                  <div className="wake-sun__caption">
                    <span className="wake-sun__sun-chip" aria-hidden="true" />
                    Sun height at <strong>{formatTimeOfDay(form.time)}</strong> - highest at noon
                  </div>
                </div>

                <div className="wake-note">
                  <AlarmClockIcon size={14} />
                  <span>
                    Arms at <strong>{formatTimeOfDay(form.time)}</strong> ·{' '}
                    {RECURRENCE_LABEL[form.recurrence] || form.recurrence}
                  </span>
                </div>
              </section>

              <section className="bento bento--details">
                <div className="bento__head">
                  <CalendarIcon size={14} />
                  <span>Schedule Details</span>
                </div>
                <div className="bento__field">
                  <label className="form-field-label" htmlFor="alarm-title">Schedule Name</label>
                  <input
                    id="alarm-title"
                    value={form.title}
                    onChange={set('title')}
                    placeholder="e.g. Peak Focus Routine"
                    required
                  />
                </div>
                <p className="bento__hint">Shown on the live preview and in your alarm list.</p>
              </section>

              <section className="bento bento--schedule">
                <div className="bento__head">
                  <CalendarIcon size={14} />
                  <span>Schedule &amp; Recurrence</span>
                </div>
                <div className="bento__field">
                  <label className="form-field-label" htmlFor="alarm-type">Schedule Type</label>
                  <select id="alarm-type" value={form.type} onChange={set('type')}>
                    {ALARM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="bento__field">
                  <label className="form-field-label" htmlFor="alarm-recurrence">Recurrence Frequency</label>
                  <select id="alarm-recurrence" value={form.recurrence} onChange={set('recurrence')}>
                    {RECURRENCE.map(r => <option key={r} value={r}>{RECURRENCE_LABEL[r] || r}</option>)}
                  </select>
                </div>
              </section>

              <section className="bento bento--challenge">
                <div className="bento__lead">
                  <span className="bento__lead-icon"><BrainIcon size={18} /></span>
                  <div className="bento__lead-text">
                    <div className="bento__head">Cognitive Challenge</div>
                    <p className="bento__hint">A mental gate verifies you are awake before the alarm steps down.</p>
                  </div>
                </div>
                <div className="bento__row">
                  <div className="bento__field">
                    <label className="form-field-label" htmlFor="alarm-challenge">Challenge Gate</label>
                    <select id="alarm-challenge" value={form.challenge_type} onChange={set('challenge_type')}>
                      {CHALLENGE_TYPES.map(t => <option key={t} value={t}>{t} Puzzle</option>)}
                    </select>
                  </div>
                  <div className="bento__field">
                    <label className="form-field-label" htmlFor="alarm-difficulty">Difficulty</label>
                    <select id="alarm-difficulty" value={form.difficulty} onChange={set('difficulty')}>
                      {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              <aside className="bento bento--preview">
                <div className="alarm-preview">
                  <div className="alarm-preview__sky">
                    <div className="alarm-preview__sky-head">
                      <SunIcon size={13} />
                      <span>Sunrise at your wake time</span>
                    </div>
                    <svg viewBox="0 0 240 96" className="alarm-preview__sunrise" role="img" aria-label="Sun position at chosen wake time">
                      <path
                        className="alarm-preview__sunpath"
                        d="M0 72 Q 120 10 240 72"
                        fill="none"
                        strokeWidth="1.5"
                        strokeDasharray="3 5"
                      />
                      <path
                        className="alarm-preview__horizon"
                        d="M0 72 Q 60 52 120 68 T 240 64"
                        fill="none"
                        strokeWidth="1.5"
                      />
                      {(() => {
                        const p = sunProgress(form.time);
                        const sun = dayArc(p, [0, 72], [120, 10], [240, 72]);
                        return (
                          <g>
                            <circle className="alarm-preview__halo" cx={sun.x} cy={sun.y} r="11" fill="none" strokeWidth="1" strokeDasharray="2 4" />
                            <circle className="alarm-preview__sun" cx={sun.x} cy={sun.y} r="6" />
                            <line className="alarm-preview__plumb" x1={sun.x} y1={sun.y + 4} x2={sun.x} y2="72" strokeWidth="1" strokeDasharray="2 3" />
                          </g>
                        );
                      })()}
                      <text className="alarm-preview__tag" x="12" y="24" textAnchor="start">6 AM</text>
                      <text className="alarm-preview__tag" x="120" y="22" textAnchor="middle">noon</text>
                      <text className="alarm-preview__tag" x="228" y="24" textAnchor="end">6 PM</text>
                    </svg>
                    <div className="alarm-preview__sky-note">
                      The dotted arc is the sun&apos;s path across the day - the circle marks how high the sun sits at{' '}
                      <strong>{formatTimeOfDay(form.time)}</strong>.
                    </div>
                  </div>

                  <div className="alarm-preview__body">
                    <div className="alarm-preview__status">
                      <span className="led led--on" />
                      Configuration Ready
                    </div>

                    <div className="alarm-preview__identity">
                      <div className="alarm-preview__name">{form.title || 'Morning Alarm'}</div>
                      <div className="alarm-preview__time">{formatTimeOfDay(form.time)}</div>
                    </div>

                    <div className="alarm-preview__spec">
                      <div className="alarm-preview__row">
                        <span className="alarm-preview__key">Schedule Type</span>
                        <span className="alarm-preview__val">{form.type}</span>
                      </div>
                      <div className="alarm-preview__row">
                        <span className="alarm-preview__key">Recurrence</span>
                        <span className="alarm-preview__val">{RECURRENCE_LABEL[form.recurrence] || form.recurrence}</span>
                      </div>
                      <div className="alarm-preview__row">
                        <span className="alarm-preview__key">Challenge Gate</span>
                        <span className="alarm-preview__val">{form.challenge_type}</span>
                      </div>
                      <div className="alarm-preview__row">
                        <span className="alarm-preview__key">Difficulty</span>
                        <span className="alarm-preview__val">{form.difficulty}</span>
                      </div>
                    </div>

                    <div className="alarm-preview__divider" />

                    <div className="alarm-preview__challenge">
                      <div className="alarm-preview__challenge-head">
                        <BrainIcon size={13} />
                        <span>Cognitive Verification</span>
                      </div>
                      <p className="alarm-preview__challenge-note">
                        At ring time you must solve <strong>{form.challenge_type}</strong>{' '}
                        ({form.difficulty}) correctly before the alarm steps down.
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Save Intelligent Alarm</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Dismiss</button>
            </div>
          </form>
        </Card>
      )}

      {/* Alarms + Circadian Optimizer - Two Column Layout */}
      <div className="alarms-cols">
        <div className="alarms-cols__left">
          {alarms.length === 0 ? (
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
          ) : (
            <div className="ab-alarms">
              {alarms.map(alarm => (
                <div className="ab-tile ab-tile--alarm" key={alarm.id}>
                  <div className="ab-alarm-head">
                    <div className="ab-alarm-time">
                      <ClockIcon size={14} />
                      {formatTimeOfDay(alarm.time) || '-:-'}
                    </div>
                    <span className={`pill ${alarm.is_enabled ? 'pill-success' : 'pill-neutral'}`}>
                      <span className="led led--on" style={{ marginRight: '0.25rem' }} />
                      {alarm.is_enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div className="ab-alarm-title">{alarm.title || 'Morning Alarm'}</div>

                  <div className="ab-alarm-badges">
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

                  <div className="ab-tile__next">
                    <ClockIcon size={13} />
                    <span className="ab-snooze-count" title={`Snoozed ${alarm.times_snoozed || 0} of 5 times`}>
                      Snoozed {alarm.times_snoozed || 0}/5
                    </span>
                    <span className="ab-tile__next-sep" aria-hidden="true" />
                    <span>Next trigger: {alarm.next_trigger ? formatDateTime(alarm.next_trigger) : 'Unscheduled'}</span>
                  </div>

                  <div className="ab-alarm-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => snoozeAlarm(alarm.id)}
                      title="Snooze for 5 minutes"
                      disabled={alarm.times_snoozed >= 5}
                    >
                      <AlarmClockIcon size={15} /> Snooze
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => deleteAlarm(alarm.id)}
                      aria-label={`Delete ${alarm.title || 'alarm'}`}
                      title="Delete alarm"
                    >
                      <TrashIcon size={15} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bedtime Optimizer & REM Cycle Helper Module */}
        <div className="alarms-cols__right">
          <Card className="circadian-card">
            <div className="card-label mb-0"><span className="sys-label">Circadian Sleep Optimizer · REM Cycle Calculator</span></div>

            <p className="text-sm text-muted-600" style={{ lineHeight: 1.5 }}>
              Sleep naturally flows in 90-minute ultradian cycles. Waking in sync with cycle boundaries avoids sleep inertia, eliminates grogginess, and maximizes cognitive puzzle scores.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.6rem 0.8rem',
              }}
            >
              <span className="text-muted-600">Calibrated for Wake Time:</span>
              <input
                type="time"
                value={activeCycleWakeTime}
                onChange={e => setActiveCycleWakeTime(e.target.value)}
                style={{ width: '120px', height: '34px', padding: '0 0.5rem', fontSize: '0.875rem' }}
              />
            </div>

            <div className="bedtime-stack">
              {bedtimes.map(b => (
                <div key={b.cycles} className="bedtime-row">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={`pill ${b.cycles === 5 ? 'pill-brand' : b.cycles === 6 ? 'pill-success' : 'pill-neutral'}`}>
                      {b.cycles} Cycles ({b.hours})
                    </span>
                    <span className="text-xs text-muted-600">+15m to fall asleep</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>
                    {b.bedtime}
                  </div>
                  <div className="text-xs text-muted-600" style={{ lineHeight: 1.4 }}>
                    {b.desc}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}