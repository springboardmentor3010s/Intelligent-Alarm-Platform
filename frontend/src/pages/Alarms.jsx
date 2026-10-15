import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { apiFetch } from "../api";
import { useAuth } from "../auth";
import { enableNotifications, notificationState, unlockAudio } from "../components/AlarmScheduler";
import {
  CHALLENGE_LABELS,
  ErrorBox,
  Loading,
  RECURRENCE_LABELS,
  formatClock,
  titleCase,
} from "../components/ui";

const EMPTY_FORM = {
  title: "Morning Alarm",
  alarm_time: "07:00",
  recurrence: "daily",
  challenge_type: "math",
  snooze_limit: 2,
};

function Alarms() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [alarms, setAlarms] = useState(null);
  const [history, setHistory] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState(null); // null = closed
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notifyState, setNotifyState] = useState(notificationState());

  const load = useCallback(async () => {
    try {
      const [list, events, smart] = await Promise.all([
        apiFetch(`/alarms/user/${user.id}`),
        apiFetch(`/alarms/history/${user.id}?limit=10`),
        apiFetch(`/alarms/smart-suggestion/${user.id}`),
      ]);
      setAlarms(list);
      window.dispatchEvent(new Event("alarms-changed"));
      setHistory(events.items);
      setSuggestion(smart);
    } catch (err) {
      setError(err.message);
    }
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError("");
  };

  const openEdit = (alarm) => {
    setEditingId(alarm.id);
    setForm({
      title: alarm.title,
      alarm_time: alarm.alarm_time,
      recurrence: alarm.recurrence,
      challenge_type: alarm.challenge_type,
      snooze_limit: alarm.snooze_limit,
    });
    setError("");
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { ...form, snooze_limit: Number(form.snooze_limit) };
      if (editingId) {
        await apiFetch(`/alarms/${editingId}`, { method: "PUT", body });
        setNotice("Alarm updated.");
      } else {
        await apiFetch("/alarms/", { method: "POST", body: { ...body, user_id: user.id } });
        setNotice("Alarm created.");
      }
      setForm(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (alarm) => {
    try {
      await apiFetch(`/alarms/${alarm.id}/toggle`, {
        method: "PATCH",
        body: { enabled: !alarm.enabled },
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (alarm) => {
    if (!window.confirm(`Delete "${alarm.title}"?`)) return;
    try {
      await apiFetch(`/alarms/${alarm.id}`, { method: "DELETE" });
      setNotice("Alarm deleted.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const makeSmart = async (alarm) => {
    try {
      await apiFetch(`/alarms/${alarm.id}/apply-smart`, { method: "POST" });
      setNotice("Smart adaptive settings applied.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const ringNow = async (alarm) => {
    // The ring screen records the "triggered" event itself.
    navigate("/wake-up-verification", { state: { alarmId: alarm.id } });
  };

  const setField = (key) => (event) =>
    setForm((previous) => ({ ...previous, [key]: event.target.value }));

  if (!alarms) {
    return <div className="page-container">{error ? <ErrorBox message={error} /> : <Loading />}</div>;
  }

  const active = alarms.filter((a) => a.enabled).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">ALARM MANAGEMENT</p>
          <h1>Your Alarms</h1>
          <p className="subtitle">Create and manage your cognitive wake-up alarms.</p>
        </div>

        <button className="primary-button" onClick={openCreate}>
          <span>+</span> Create Alarm
        </button>
      </div>

      <ErrorBox message={error} />
      {notice && <div className="notice-box">{notice}</div>}

      <section className="alarms-card info-card">
        <p className="muted-line" style={{ margin: 0 }}>
          Alarms ring while Cognitive Alarm is open in a browser tab (it can be in the
          background). Keep the tab open, turn your volume up, and click the page once after
          opening it so the browser allows sound.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button className="small-button" onClick={unlockAudio}>Test sound permission</button>
          {notifyState === "default" && (
            <button
              className="small-button"
              onClick={() => enableNotifications().then(setNotifyState)}
            >
              Turn on desktop notifications
            </button>
          )}
          {notifyState === "granted" && <span className="muted-line">Desktop notifications are on.</span>}
          {notifyState === "denied" && (
            <span className="muted-line">Desktop notifications are blocked in your browser settings.</span>
          )}
        </div>
      </section>

      <div className="alarm-summary">
        <div className="summary-card">
          <span className="summary-icon purple">⏰</span>
          <div>
            <strong>{alarms.length}</strong>
            <span>Total Alarms</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-icon green">✓</span>
          <div>
            <strong>{active}</strong>
            <span>Active</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="summary-icon blue">🧠</span>
          <div>
            <strong>{alarms.filter((a) => a.recurrence === "smart").length}</strong>
            <span>Smart Adaptive</span>
          </div>
        </div>
      </div>

      {suggestion && (
        <section className="alarms-card info-card">
          <div className="card-header">
            <div>
              <h2>Smart adaptive suggestion</h2>
              <p>Based on your sleep goal, snooze habits and recent performance.</p>
            </div>
          </div>
          <ul className="reason-list">
            {suggestion.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="muted-line">
            Suggested: {CHALLENGE_LABELS[suggestion.challenge_type]} challenge ·{" "}
            {suggestion.snooze_limit} snoozes
            {suggestion.bedtime ? ` · bedtime ${suggestion.bedtime}` : ""}
          </p>
        </section>
      )}

      <section className="alarms-card">
        <div className="card-header">
          <div>
            <h2>Scheduled Alarms</h2>
            <p>Manage your wake-up schedule and challenges.</p>
          </div>
        </div>

        {alarms.length === 0 ? (
          <div className="empty-state">
            <strong>No alarms yet</strong>
            <p>Create your first alarm to begin.</p>
          </div>
        ) : (
          <div className="alarm-list">
            {alarms.map((alarm) => {
              const clock = formatClock(alarm.alarm_time);
              return (
                <div className="alarm-row" key={alarm.id} style={{ opacity: alarm.enabled ? 1 : 0.6 }}>
                  <div className="alarm-time-large">
                    <strong>{clock.time}</strong>
                    <span>{clock.period}</span>
                  </div>

                  <div className="alarm-info">
                    <h3>{alarm.title}</h3>
                    <p>{RECURRENCE_LABELS[alarm.recurrence] || alarm.recurrence}</p>
                  </div>

                  <div className="alarm-detail">
                    <span className="detail-label">Challenge</span>
                    <strong>🧠 {CHALLENGE_LABELS[alarm.challenge_type]}</strong>
                  </div>

                  <div className="alarm-detail">
                    <span className="detail-label">Difficulty</span>
                    <strong>Adaptive</strong>
                  </div>

                  <div className="alarm-status">
                    <span className="status-dot"></span>
                    {alarm.enabled ? "Active" : "Off"}
                  </div>

                  <div className="row-actions">
                    <button className="small-button" onClick={() => toggle(alarm)}>
                      {alarm.enabled ? "Turn off" : "Turn on"}
                    </button>
                    <button className="small-button" onClick={() => openEdit(alarm)}>Edit</button>
                    <button className="small-button" onClick={() => makeSmart(alarm)}>Smart</button>
                    <button className="small-button" onClick={() => ringNow(alarm)}>Test ring</button>
                    <button className="small-button danger" onClick={() => remove(alarm)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="alarms-card">
        <div className="card-header">
          <div>
            <h2>Alarm history</h2>
            <p>The latest rings, snoozes and dismissals.</p>
          </div>
        </div>
        {history.length === 0 ? (
          <div className="empty-state"><p>No alarm activity yet.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>When</th><th>Alarm</th><th>Event</th></tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td>{item.alarm_title}</td>
                  <td>{titleCase(item.event_type)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {form && (
        <div className="modal-backdrop" onClick={() => setForm(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{editingId ? "Edit alarm" : "New alarm"}</h2>

            <label>
              Name
              <input value={form.title} onChange={setField("title")} required maxLength={100} />
            </label>

            <label>
              Time
              <input type="time" value={form.alarm_time} onChange={setField("alarm_time")} required />
            </label>

            <label>
              Repeat
              <select value={form.recurrence} onChange={setField("recurrence")}>
                {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label>
              Challenge
              <select value={form.challenge_type} onChange={setField("challenge_type")}>
                {Object.entries(CHALLENGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <p className="rec-basis">
              Difficulty is adaptive. It is chosen automatically from your recent
              challenge performance each time the alarm rings.
            </p>

            <label>
              Snoozes allowed per day
              <input
                type="number"
                min={0}
                max={10}
                value={form.snooze_limit}
                onChange={setField("snooze_limit")}
              />
            </label>

            <ErrorBox message={error} />

            <div className="modal-actions">
              <button type="button" className="small-button" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button type="submit" className="generate-button" disabled={saving}>
                {saving ? "Saving..." : "Save alarm"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Alarms;
