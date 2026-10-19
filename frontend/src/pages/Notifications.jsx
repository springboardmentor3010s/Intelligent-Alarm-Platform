
import { useEffect, useState } from "react";

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const email = localStorage.getItem("email");

  const loadNotifications = async () => {
    if (!email) {
      setError("Please log in again to view notifications.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `http://localhost:8001/notifications/${encodeURIComponent(email)}`
      );

      if (!response.ok) {
        throw new Error("Failed to load notifications.");
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(
        "Cannot load notifications. Please check whether the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAsRead = async (id) => {
    try {
      const response = await fetch(
        `http://localhost:8001/notifications/${id}/read`,
        { method: "PUT" }
      );

      if (!response.ok) {
        throw new Error("Failed to mark notification as read.");
      }

      setNotifications((previous) =>
        previous.map((item) =>
          item.id === id || item._id === id
            ? { ...item, read: true }
            : item
        )
      );
    } catch (err) {
      setError("Could not mark notification as read.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <h1>🔔 Notifications</h1>

      <p>Your COGNIA reminders and updates.</p>

      <button
        onClick={loadNotifications}
        disabled={loading}
        style={{
          padding: "10px 16px",
          marginBottom: "20px",
          border: "none",
          borderRadius: "8px",
          background: loading ? "#64748b" : "#2563eb",
          color: "#ffffff",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Refreshing..." : "🔄 Refresh Notifications"}
      </button>

      {error && (
        <p style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}

      {loading && <p>Loading notifications...</p>}

      {!loading && !error && notifications.length === 0 && (
        <p>No notifications yet. Create a reminder to see it here.</p>
      )}

      {notifications.map((item) => {
        const id = item.id || item._id;

        return (
          <div
            key={id}
            style={{
              padding: "18px",
              marginBottom: "14px",
              borderRadius: "12px",
              border: "1px solid #475569",
              background: item.read ? "#1e293b" : "#273449",
              color: "#ffffff",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
            }}
          >
            <h3
              style={{
                color: "#ffffff",
                marginTop: "0",
                marginBottom: "10px",
              }}
            >
              {!item.read && "🔵 "}
              {item.title}
            </h3>

            {item.message !== "Your notification system is working!" && (
  <p style={{ color: "#e2e8f0", lineHeight: "1.6" }}>
    {item.message}
  </p>
)}

            <small style={{ color: "#cbd5e1" }}>
              {item.created_at
                ? new Date(item.created_at).toLocaleString()
                : ""}
            </small>

            {!item.read && (
              <div>
                <button
                  onClick={() => markAsRead(id)}
                  style={{
                    display: "block",
                    marginTop: "14px",
                    padding: "9px 14px",
                    border: "none",
                    borderRadius: "6px",
                    background: "#2563eb",
                    color: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  Mark as read
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Notifications;
