import { useEffect, useState } from "react";
import {
  deleteNotification,
  generateReminders,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/api";

function displayError(error) {
  return typeof error === "string" ? error : "Unable to update notifications.";
}

export default function NotificationsBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [items, count] = await Promise.all([
        getNotifications(),
        getUnreadNotificationCount(),
      ]);
      setNotifications(items);
      setUnreadCount(count);
      setError("");
    } catch (loadError) {
      setError(displayError(loadError));
    }
  }

  useEffect(() => {
    getUnreadNotificationCount()
      .then(setUnreadCount)
      .catch((loadError) => setError(displayError(loadError)));
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    Promise.all([getNotifications(), getUnreadNotificationCount()])
      .then(([items, count]) => {
        if (cancelled) return;
        setNotifications(items);
        setUnreadCount(count);
        setError("");
      })
      .catch((loadError) => {
        if (!cancelled) setError(displayError(loadError));
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  async function update(action) {
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (actionError) {
      setError(displayError(actionError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notification-menu">
      <button
        type="button"
        className="saas-notification-btn"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        🔔{unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
      </button>
      {isOpen && (
        <section className="notification-popover" aria-label="Notifications">
          <div className="notification-popover-header">
            <strong>Notifications</strong>
            <button
              type="button"
              className="text-button"
              disabled={busy || unreadCount === 0}
              onClick={() => update(markAllNotificationsRead)}
            >
              Mark all read
            </button>
          </div>
          {error && <p className="notification-error" role="alert">{error}</p>}
          <button
            type="button"
            className="btn btn-secondary btn-sm notification-reminder-btn"
            disabled={busy}
            onClick={() => update(generateReminders)}
          >
            Generate reminders
          </button>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <p className="notification-empty">You’re all caught up.</p>
            ) : notifications.map((notification) => (
              <article key={notification.id} className={`notification-item ${notification.is_read ? "" : "unread"}`}>
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <small>{notification.created_at ? new Date(notification.created_at).toLocaleString() : ""}</small>
                </div>
                <div className="notification-item-actions">
                  {!notification.is_read && (
                    <button type="button" className="text-button" disabled={busy} onClick={() => update(() => markNotificationRead(notification.id))}>
                      Mark read
                    </button>
                  )}
                  <button type="button" className="text-button danger-text" disabled={busy} onClick={() => update(() => deleteNotification(notification.id))}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
