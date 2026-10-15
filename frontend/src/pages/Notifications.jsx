import { useCallback, useEffect, useState } from "react";
import "../App.css";
import { apiFetch } from "../api";
import { useAuth } from "../auth";
import { Empty, ErrorBox, Loading, formatDateTime, titleCase } from "../components/ui";

const ICONS = {
  bedtime: "🌙",
  wake_up: "⏰",
  habit: "✦",
  challenge: "🧠",
  progress: "📈",
  announcement: "📣",
  reminder: "🔔",
  general: "•",
};

function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", due_at: "", repeat_rule: "once" });

  const load = useCallback(async () => {
    try {
      const [list, rems, p] = await Promise.all([
        apiFetch(`/notifications?user_id=${user.id}&unread_only=${unreadOnly}&limit=100`),
        apiFetch(`/reminders?user_id=${user.id}`),
        apiFetch(`/notification-preferences/${user.id}`),
      ]);
      setItems(list.items);
      setReminders(rems);
      setPrefs(p);
    } catch (err) {
      setError(err.message);
    }
  }, [user.id, unreadOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn, message) => {
    setError("");
    try {
      await fn();
      if (message) setNotice(message);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const markRead = (id) =>
    act(() => apiFetch(`/notifications/${id}/read?user_id=${user.id}`, { method: "PATCH" }));
  const markAll = () =>
    act(() => apiFetch(`/notifications/read-all?user_id=${user.id}`, { method: "POST" }), "All marked as read.");

  const savePrefs = (changes) => {
    const next = { ...prefs, ...changes };
    setPrefs(next);
    act(() =>
      apiFetch(`/notification-preferences/${user.id}`, {
        method: "PUT",
        body: {
          in_app_enabled: next.in_app_enabled,
          reminder_enabled: next.reminder_enabled,
          wellness_enabled: next.wellness_enabled,
        },
      })
    );
  };

  const addReminder = (event) => {
    event.preventDefault();
    act(async () => {
      await apiFetch("/reminders", {
        method: "POST",
        body: {
          user_id: user.id,
          title: form.title,
          message: form.message,
          due_at: new Date(form.due_at).toISOString(),
          repeat_rule: form.repeat_rule,
        },
      });
      setForm({ title: "", message: "", due_at: "", repeat_rule: "once" });
    }, "Reminder added.");
  };

  const autoSetup = () =>
    act(async () => {
      const result = await apiFetch(`/reminders/auto-setup/${user.id}`, { method: "POST" });
      if (!result.created.length) throw new Error(result.note || "Nothing to set up yet.");
    }, "Bedtime and wake-up reminders are set from your profile.");

  if (!items || !prefs) {
    return <div className="page-container">{error ? <ErrorBox message={error} /> : <Loading />}</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">NOTIFICATIONS AND REMINDERS</p>
          <h1>Notifications</h1>
          <p className="subtitle">Bedtime and wake-up reminders, habit alerts, progress and announcements.</p>
        </div>
        <button className="primary-button" onClick={markAll}>Mark all as read</button>
      </div>

      <ErrorBox message={error} />
      {notice && <div className="notice-box">{notice}</div>}

      <div className="two-column">
        <section className="alarms-card">
          <div className="card-header">
            <div><h2>Inbox</h2></div>
            <label className="check-line">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
              Unread only
            </label>
          </div>
          {items.length === 0 ? (
            <Empty title="Nothing here" />
          ) : (
            <div className="notification-list">
              {items.map((n) => (
                <div key={n.id} className={`notification-item ${n.is_read ? "read" : ""}`}>
                  <span className="notification-icon">{ICONS[n.category] || "•"}</span>
                  <div>
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                    <small>{titleCase(n.category)} · {formatDateTime(n.created_at)}</small>
                  </div>
                  {!n.is_read && (
                    <button className="small-button" onClick={() => markRead(n.id)}>Mark read</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="alarms-card">
          <div className="card-header"><div><h2>Preferences</h2></div></div>
          {[
            ["in_app_enabled", "In-app notifications"],
            ["reminder_enabled", "Reminders"],
            ["wellness_enabled", "Wellness tips and habit alerts"],
          ].map(([key, label]) => (
            <label className="check-line" key={key}>
              <input type="checkbox" checked={prefs[key]} onChange={(e) => savePrefs({ [key]: e.target.checked })} />
              {label}
            </label>
          ))}

          <div className="card-header" style={{ marginTop: 22 }}>
            <div><h2>Reminders</h2></div>
            <button className="small-button" onClick={autoSetup}>Set bedtime and wake-up</button>
          </div>
          {reminders.length === 0 ? (
            <Empty title="No reminders yet" />
          ) : (
            <table className="data-table">
              <tbody>
                {reminders.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{formatDateTime(r.due_at)}</td>
                    <td>{titleCase(r.repeat_rule)}</td>
                    <td>
                      <button
                        className="small-button danger"
                        onClick={() =>
                          act(() => apiFetch(`/reminders/${r.id}?user_id=${user.id}`, { method: "DELETE" }))
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <form className="inline-form" onSubmit={addReminder}>
            <input placeholder="Title" value={form.title} required maxLength={160}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input type="datetime-local" value={form.due_at} required
              onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
            <select value={form.repeat_rule} onChange={(e) => setForm({ ...form, repeat_rule: e.target.value })}>
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <button className="small-button" type="submit">Add</button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Notifications;
