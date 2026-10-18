import { useEffect, useRef, useState } from "react";
import "./App.css";
import ChallengePerformanceChart from "./ChallengePerformanceChart";
import Plot from "react-plotly.js";
import {
  requestNotificationPermission,
  listenForForegroundMessages,
} from "./notifications";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function NotificationBell({ token }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const bellRef = useRef(null);

  const loadNotifications = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/notifications?limit=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;

      const data = await response.json();
      setNotifications(
        Array.isArray(data.notifications) ? data.notifications : [],
      );
      setUnreadCount(Number(data.unread_count) || 0);
    } catch (error) {
      console.error("Notification loading failed:", error);
    }
  };

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(loadNotifications, 15000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const markRead = async (notificationId) => {
    try {
      await fetch(`${API_URL}/notifications/${notificationId}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      console.error("Mark notification read failed:", error);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_URL}/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true })),
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Mark all notifications read failed:", error);
    }
  };

  const iconForType = (type) => {
    if (type === "alarm") return "⏰";
    if (type === "recommendation") return "💡";
    if (type === "admin") return "👤";
    if (type === "account") return "🎉";
    return "🔔";
  };

  const timeAgo = (value) => {
    if (!value) return "";
    const diff = Math.max(0, Date.now() - new Date(value).getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    return new Date(value).toLocaleDateString();
  };

  return (
    <div ref={bellRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) loadNotifications();
        }}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        style={{
          position: "relative",
          width: "46px",
          height: "46px",
          borderRadius: "14px",
          border: "1px solid #e2e8f0",
          background: "#ffffff",
          cursor: "pointer",
          fontSize: "21px",
          display: "grid",
          placeItems: "center",
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              minWidth: "20px",
              height: "20px",
              padding: "0 5px",
              borderRadius: "999px",
              background: "#ef4444",
              color: "#fff",
              fontSize: "11px",
              fontWeight: 800,
              display: "grid",
              placeItems: "center",
              border: "2px solid #fff",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "54px",
            right: 0,
            width: "360px",
            maxWidth: "calc(100vw - 32px)",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "18px",
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
            overflow: "hidden",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #eef2f7",
            }}
          >
            <strong style={{ fontSize: "17px" }}>Notifications</strong>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              style={{
                border: 0,
                background: "transparent",
                color: unreadCount ? "#6366f1" : "#94a3b8",
                cursor: unreadCount ? "pointer" : "default",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              Mark all as read
            </button>
          </div>

          <div style={{ maxHeight: "390px", overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: "38px 20px",
                  textAlign: "center",
                  color: "#64748b",
                }}
              >
                🔔 No notifications yet
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => !item.is_read && markRead(item.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: 0,
                    borderBottom: "1px solid #f1f5f9",
                    background: item.is_read ? "#fff" : "#f8f7ff",
                    padding: "14px 16px",
                    cursor: item.is_read ? "default" : "pointer",
                    display: "flex",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "12px",
                      background: item.is_read ? "#f1f5f9" : "#eee8ff",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {iconForType(item.notification_type)}
                  </span>

                  <span style={{ minWidth: 0 }}>
                    <strong
                      style={{
                        display: "block",
                        color: "#0f172a",
                        fontSize: "13px",
                        marginBottom: "3px",
                      }}
                    >
                      {item.title}
                    </strong>
                    <span
                      style={{
                        display: "block",
                        color: "#64748b",
                        fontSize: "12px",
                        lineHeight: 1.45,
                      }}
                    >
                      {item.message}
                    </span>
                    <span
                      style={{
                        display: "block",
                        color: "#94a3b8",
                        fontSize: "11px",
                        marginTop: "5px",
                      }}
                    >
                      {timeAgo(item.created_at)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BehavioralTrendChart({ dailyActivity, period }) {
  if (!dailyActivity || dailyActivity.length === 0) {
    return (
      <div className="empty-state">
        No behavioral activity recorded for this period.
      </div>
    );
  }

  const data = dailyActivity;
  const maxValue = Math.max(
    1,
    ...data.map((day) =>
      Math.max(
        Number(day.wake_up_completed) || 0,
        Number(day.snoozed) || 0,
        Number(day.alarm_triggered) || 0,
        Number(day.challenge_answered) || 0,
      ),
    ),
  );

  const width = Math.max(760, data.length * 70);
  const height = 320;
  const left = 55;
  const right = 25;
  const top = 25;
  const bottom = 65;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const xStep = data.length > 1 ? chartWidth / (data.length - 1) : 0;

  const point = (value, index) => {
    const x = left + index * xStep;
    const y =
      top + chartHeight - ((Number(value) || 0) / maxValue) * chartHeight;
    return `${x},${y}`;
  };

  const wakePoints = data
    .map((day, index) => point(day.wake_up_completed, index))
    .join(" ");
  const snoozePoints = data
    .map((day, index) => point(day.snoozed, index))
    .join(" ");
  const alarmPoints = data
    .map((day, index) => point(day.alarm_triggered, index))
    .join(" ");
  const challengePoints = data
    .map((day, index) => point(day.challenge_answered, index))
    .join(" ");

  const labelForDate = (value) => {
    const text = String(value);
    if (period === "monthly" || period === "custom") {
      return text.slice(5);
    }
    return text.slice(5);
  };

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: "100%",
          minWidth: `${Math.min(width, 760)}px`,
          height: "340px",
        }}
        role="img"
        aria-label="Behavioral activity trend showing alarms, snoozes, wake-ups and challenges"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = top + chartHeight - ratio * chartHeight;
          const label = Math.round(ratio * maxValue);
          return (
            <g key={ratio}>
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fill="#64748b"
              >
                {label}
              </text>
            </g>
          );
        })}

        <polyline
          points={alarmPoints}
          fill="none"
          stroke="#6366f1"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={wakePoints}
          fill="none"
          stroke="#10b981"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={snoozePoints}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={challengePoints}
          fill="none"
          stroke="#ec4899"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((day, index) => {
          const alarm = point(day.alarm_triggered, index).split(",");
          const wake = point(day.wake_up_completed, index).split(",");
          const snooze = point(day.snoozed, index).split(",");
          const challenge = point(day.challenge_answered, index).split(",");
          const x = left + index * xStep;

          return (
            <g key={day.date}>
              <circle cx={alarm[0]} cy={alarm[1]} r="4" fill="#6366f1" />
              <circle cx={wake[0]} cy={wake[1]} r="5" fill="#10b981" />
              <circle cx={snooze[0]} cy={snooze[1]} r="4" fill="#f59e0b" />
              <circle
                cx={challenge[0]}
                cy={challenge[1]}
                r="4"
                fill="#ec4899"
              />
              <text
                x={x}
                y={height - 25}
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
              >
                {labelForDate(day.date)}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        style={{
          display: "flex",
          gap: "18px",
          justifyContent: "center",
          marginTop: "-8px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "13px" }}>🟣 Alarms</span>
        <span style={{ fontSize: "13px" }}>🟢 Wake-ups</span>
        <span style={{ fontSize: "13px" }}>🟠 Snoozes</span>
        <span style={{ fontSize: "13px" }}>🩷 Challenges</span>
      </div>
    </div>
  );
}

function HabitMetricsCharts({ habitScore, habitTracking }) {
  const accuracy = Math.max(
    0,
    Math.min(100, Number(habitScore?.accuracy_score) || 0),
  );
  const responseTime = Math.max(
    0,
    Number(habitScore?.average_time_seconds) || 0,
  );
  const attempts = Math.max(0, Number(habitScore?.average_attempts) || 0);

  const maxResponseTime = Math.max(30, responseTime);
  const maxAttempts = Math.max(3, attempts);

  return (
    <section className="panel" style={{ marginTop: "24px" }}>
      <div className="section-heading">
        <div>
          <h3>Habit & Cognitive Performance</h3>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}></p>
        </div>
        <span className="section-icon">📊</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "20px",
          marginTop: "24px",
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "22px",
            background: "#ffffff",
            minHeight: "300px",
          }}
        >
          <h4 style={{ margin: "0 0 18px" }}>Challenge Accuracy</h4>
          <div
            style={{
              width: "170px",
              height: "170px",
              margin: "0 auto",
              borderRadius: "50%",
              background: `conic-gradient(#6366f1 ${accuracy}%, #e5e7eb 0)`,
              display: "grid",
              placeItems: "center",
            }}
          >
            <div
              style={{
                width: "112px",
                height: "112px",
                borderRadius: "50%",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                textAlign: "center",
              }}
            >
              <strong style={{ fontSize: "26px" }}>
                {Math.round(accuracy)}%
              </strong>
            </div>
          </div>
          <p
            style={{
              textAlign: "center",
              color: "#64748b",
              margin: "18px 0 0",
            }}
          >
            Correct challenge answers
          </p>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "22px",
            background: "#ffffff",
            minHeight: "300px",
          }}
        >
          <h4 style={{ margin: "0 0 24px" }}>Average Response Time</h4>
          <div style={{ marginTop: "45px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "10px",
              }}
            >
              <span>Current average</span>
              <strong>{responseTime.toFixed(1)} sec</strong>
            </div>
            <div
              style={{
                height: "26px",
                background: "#eef2f7",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(
                    (responseTime / maxResponseTime) * 100,
                    100,
                  )}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #06b6d4, #6366f1)",
                  borderRadius: "999px",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#64748b",
                fontSize: "12px",
                marginTop: "8px",
              }}
            >
              <span>0 sec</span>
              <span>{maxResponseTime.toFixed(0)} sec</span>
            </div>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "22px",
            background: "#ffffff",
            minHeight: "300px",
          }}
        >
          <h4 style={{ margin: "0 0 18px" }}>Average Attempts</h4>
          <div
            style={{
              height: "190px",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: "34px",
              borderBottom: "1px solid #cbd5e1",
              padding: "0 20px",
            }}
          >
            <div
              style={{
                width: "54px",
                height: `${Math.max((attempts / maxAttempts) * 150, attempts ? 10 : 0)}px`,
                background: "linear-gradient(180deg, #8b5cf6, #6366f1)",
                borderRadius: "10px 10px 0 0",
                position: "relative",
              }}
              title={`${attempts.toFixed(1)} average attempts`}
            >
              <span
                style={{
                  position: "absolute",
                  top: "-24px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {attempts.toFixed(1)}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: "12px" }}>
            <span style={{ color: "#64748b" }}>Current average attempts</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function HabitTrendCharts({ behavioralAnalytics }) {
  const dailyActivity = behavioralAnalytics?.daily_activity || [];
  if (!dailyActivity.length) return null;

  const rows = dailyActivity.slice(-14);
  const shortDate = (value) => String(value || "").slice(5);
  const wakeValues = rows.map((day) => {
    const alarms = Number(day.alarm_triggered) || 0;
    const wakeUps = Number(day.wake_up_completed) || 0;
    return alarms > 0 ? Math.min(100, (wakeUps / alarms) * 100) : 0;
  });
  const snoozeValues = rows.map((day) => Number(day.snoozed) || 0);
  const activityValues = rows.map(
    (day) =>
      (Number(day.alarm_triggered) || 0) +
      (Number(day.wake_up_completed) || 0) +
      (Number(day.snoozed) || 0) +
      (Number(day.challenge_answered) || 0),
  );

  const LineChart = ({ values, maxValue, yLabel, ariaLabel }) => {
    const width = 620,
      height = 250,
      left = 48,
      right = 18,
      top = 20,
      bottom = 42;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const max = Math.max(1, maxValue);
    const step = values.length > 1 ? chartWidth / (values.length - 1) : 0;
    const points = values.map((value, index) => [
      left + index * step,
      top + chartHeight - (value / max) * chartHeight,
    ]);
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "260px" }}
        role="img"
        aria-label={ariaLabel}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = top + chartHeight - ratio * chartHeight;
          return (
            <g key={ratio}>
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
              />
              <text
                x={left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#64748b"
              >
                {Math.round(ratio * max)}
              </text>
            </g>
          );
        })}
        {points.length > 1 && (
          <polyline
            points={points.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="#6366f1"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {points.map(([x, y], index) => (
          <g key={`${rows[index]?.date || index}-${index}`}>
            <circle cx={x} cy={y} r="5" fill="#6366f1" />
            <text
              x={x}
              y={height - 18}
              textAnchor="middle"
              fontSize="10"
              fill="#64748b"
            >
              {shortDate(rows[index]?.date)}
            </text>
          </g>
        ))}
        <text
          x="12"
          y={top + chartHeight / 2}
          fontSize="10"
          fill="#64748b"
          transform={`rotate(-90 12 ${top + chartHeight / 2})`}
        >
          {yLabel}
        </text>
      </svg>
    );
  };

  const maxSnooze = Math.max(1, ...snoozeValues);
  const maxActivity = Math.max(1, ...activityValues);
  return (
    <section className="panel" style={{ marginTop: "24px" }}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">HABIT TRENDS</span>
          <h3>Habit Progress Trends</h3>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>
            Real daily activity from the selected analytics period.
          </p>
        </div>
        <span className="section-icon">📈</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
          marginTop: "24px",
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "18px",
            background: "#fff",
          }}
        >
          <h4 style={{ margin: "0 0 4px" }}>Wake-Up Consistency Trend</h4>
          <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
            Wake-ups completed ÷ alarms triggered
          </p>
          <LineChart
            values={wakeValues}
            maxValue={100}
            yLabel="%"
            ariaLabel="Wake-up consistency trend"
          />
        </div>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "18px",
            background: "#fff",
          }}
        >
          <h4 style={{ margin: "0 0 4px" }}>Snooze Trend</h4>
          <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
            Number of snoozes per day
          </p>
          <div
            style={{
              height: "260px",
              display: "flex",
              alignItems: "flex-end",
              gap: "8px",
              padding: "20px 4px 30px",
              borderBottom: "1px solid #cbd5e1",
            }}
          >
            {snoozeValues.map((value, index) => (
              <div
                key={`${rows[index]?.date || index}-snooze`}
                style={{
                  flex: 1,
                  height: "210px",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
                title={`${rows[index]?.date || ""}: ${value} snoozes`}
              >
                <div
                  style={{
                    width: "70%",
                    minWidth: "10px",
                    height: `${Math.max(value ? (value / maxSnooze) * 190 : 0, value ? 8 : 0)}px`,
                    background: "linear-gradient(180deg, #f59e0b, #f97316)",
                    borderRadius: "8px 8px 0 0",
                  }}
                />
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#64748b",
              fontSize: "10px",
              marginTop: "6px",
            }}
          >
            <span>{shortDate(rows[0]?.date)}</span>
            <span>{shortDate(rows[rows.length - 1]?.date)}</span>
          </div>
        </div>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "18px",
            background: "#fff",
          }}
        >
          <h4 style={{ margin: "0 0 4px" }}>Daily Activity Trend</h4>
          <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
            Alarms + wake-ups + snoozes + challenges
          </p>
          <LineChart
            values={activityValues}
            maxValue={maxActivity}
            yLabel="Events"
            ariaLabel="Daily habit activity trend"
          />
        </div>
      </div>
    </section>
  );
}

function TrendDirection({ values, positiveWhen = "up" }) {
  if (!values || values.length < 2) {
    return (
      <span style={{ color: "#64748b", fontSize: "13px" }}>
        Not enough data
      </span>
    );
  }
  const first = Number(values[0]) || 0;
  const last = Number(values[values.length - 1]) || 0;
  const difference = last - first;
  if (Math.abs(difference) < 0.001) {
    return <span style={{ color: "#64748b", fontSize: "13px" }}>→ Stable</span>;
  }
  const increasing = difference > 0;
  const isPositive = positiveWhen === "up" ? increasing : !increasing;
  const symbol = increasing ? "↑" : "↓";
  const label = increasing ? "Increasing" : "Decreasing";
  return (
    <span
      style={{
        color: isPositive ? "#16a34a" : "#dc2626",
        fontWeight: 700,
        fontSize: "13px",
      }}
    >
      {symbol} {label}
    </span>
  );
}

function BehavioralPatternCharts({ behavioralAnalytics }) {
  const rows = (behavioralAnalytics?.daily_activity || []).slice(-14);
  if (!rows.length) {
    return (
      <section className="panel" style={{ marginTop: "24px" }}>
        <div className="empty-state">
          No daily behavioral records are available for this period.
        </div>
      </section>
    );
  }

  const dates = rows.map((day) => String(day.date || "").slice(5));
  const wakeConsistency = rows.map((day) => {
    const alarms = Number(day.alarm_triggered) || 0;
    const wakes = Number(day.wake_up_completed) || 0;
    return alarms > 0 ? Math.min(100, (wakes / alarms) * 100) : 0;
  });
  const snoozes = rows.map((day) => Number(day.snoozed) || 0);
  const challenges = rows.map((day) => Number(day.challenge_answered) || 0);
  const wakeUps = rows.map((day) => Number(day.wake_up_completed) || 0);

  const Line = ({ values, maxValue = null, suffix = "", ariaLabel }) => {
    const width = 650;
    const height = 250;
    const left = 50;
    const right = 18;
    const top = 22;
    const bottom = 44;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const max = Math.max(1, maxValue ?? Math.max(...values));
    const step = values.length > 1 ? chartWidth / (values.length - 1) : 0;
    const points = values.map((value, index) => {
      const x = left + index * step;
      const y = top + chartHeight - ((Number(value) || 0) / max) * chartHeight;
      return [x, y];
    });

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "250px" }}
        role="img"
        aria-label={ariaLabel}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = top + chartHeight - ratio * chartHeight;
          return (
            <g key={ratio}>
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
              />
              <text
                x={left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#64748b"
              >
                {Math.round(ratio * max)}
                {suffix}
              </text>
            </g>
          );
        })}
        {points.length > 1 && (
          <polyline
            points={points.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="#6366f1"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {points.map(([x, y], index) => (
          <g key={`${dates[index]}-${index}`}>
            <circle cx={x} cy={y} r="5" fill="#6366f1" />
            <text
              x={x}
              y={height - 18}
              textAnchor="middle"
              fontSize="10"
              fill="#64748b"
            >
              {dates[index]}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  return (
    <section className="panel" style={{ marginTop: "24px" }}>
      <div className="section-heading">
        <div>
          <h3>Behavior Changes Over Time</h3>
        </div>
        <span className="section-icon">📈</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "20px",
          marginTop: "24px",
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "18px",
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div>
              <h4 style={{ margin: 0 }}>Wake-Up Consistency</h4>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "#64748b",
                  fontSize: "13px",
                }}
              >
                Completed wake-ups ÷ alarm triggers
              </p>
            </div>
            <TrendDirection values={wakeConsistency} positiveWhen="up" />
          </div>
          <Line
            values={wakeConsistency}
            maxValue={100}
            suffix="%"
            ariaLabel="Wake-up consistency trend"
          />
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "18px",
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div>
              <h4 style={{ margin: 0 }}>Snooze Pattern</h4>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "#64748b",
                  fontSize: "13px",
                }}
              >
                Daily snooze count
              </p>
            </div>
            <TrendDirection values={snoozes} positiveWhen="down" />
          </div>
          <Line values={snoozes} ariaLabel="Snooze count trend" />
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "18px",
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div>
              <h4 style={{ margin: 0 }}>Challenge Activity</h4>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "#64748b",
                  fontSize: "13px",
                }}
              >
                Challenges answered per day
              </p>
            </div>
            <TrendDirection values={challenges} positiveWhen="up" />
          </div>
          <Line values={challenges} ariaLabel="Challenge activity trend" />
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "18px",
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div>
              <h4 style={{ margin: 0 }}>Wake-Up Activity</h4>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "#64748b",
                  fontSize: "13px",
                }}
              >
                Completed wake-ups per day
              </p>
            </div>
            <TrendDirection values={wakeUps} positiveWhen="up" />
          </div>
          <Line values={wakeUps} ariaLabel="Wake-up activity trend" />
        </div>
      </div>

      <div
        style={{
          marginTop: "18px",
          padding: "14px 16px",
          borderRadius: "12px",
          background: "#f8fafc",
          color: "#64748b",
          fontSize: "13px",
        }}
      ></div>
    </section>
  );
}

function CoachMetricChart({
  title,
  type = "line",
  x = [],
  y = [],
  labels = [],
  yTitle = "Value",
  suffix = "",
}) {
  if (!x.length || !y.length) {
    return (
      <div className="empty-state">Not enough data for this chart yet.</div>
    );
  }

  const trace =
    type === "bar"
      ? {
          x: labels.length ? labels : x,
          y,
          type: "bar",
          marker: { color: "#6366f1" },
        }
      : {
          x,
          y,
          type: "scatter",
          mode: "lines+markers",
          line: { color: "#6366f1", width: 3 },
          marker: { color: "#6366f1", size: 7 },
        };

  return (
    <Plot
      data={[trace]}
      layout={{
        title: { text: title, font: { size: 16 } },
        margin: { l: 48, r: 18, t: 48, b: 48 },
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        font: { family: "Arial, sans-serif", color: "#334155" },
        xaxis: { title: "Date / Category", automargin: true },
        yaxis: { title: yTitle, automargin: true },
        autosize: true,
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%", height: "300px" }}
    />
  );
}

function SleepWakeTrend({ trend = [] }) {
  const validTrend = trend.filter(
    (item) => item.alarm_time || item.wake_up_time,
  );

  if (!validTrend.length) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-lg font-semibold text-slate-800">
          Sleep & Wake Trend
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          Alarm and actual wake-up pattern
        </p>
        <div className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
          No recorded alarm and wake-up timing data for this period yet.
        </div>
      </section>
    );
  }

  const toMinutes = (value) => {
    if (!value) return null;
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const formatTime = (minutes) => {
    if (minutes === null || minutes === undefined) return "";
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.round(minutes % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const alarmTimes = validTrend.map((item) => toMinutes(item.alarm_time));
  const wakeTimes = validTrend.map((item) => toMinutes(item.wake_up_time));
  const delays = validTrend
    .map((item) => item.wake_up_delay_minutes)
    .filter((value) => value !== null && value !== undefined);
  const averageDelay = delays.length
    ? Math.round(
        (delays.reduce((sum, value) => sum + Number(value), 0) /
          delays.length) *
          10,
      ) / 10
    : 0;

  const tickValues = [0, 360, 480, 600, 720, 840, 960, 1080, 1200, 1320, 1439];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            Sleep & Wake Trend
          </h3>
        </div>
        <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
          Average wake-up delay:{" "}
          <strong className="text-slate-900">{averageDelay} min</strong>
        </div>
      </div>

      <Plot
        data={[
          {
            x: validTrend.map((item) => item.date),
            y: alarmTimes,
            type: "scatter",
            mode: "lines+markers",
            name: "Alarm Time",
            line: { width: 3 },
          },
          {
            x: validTrend.map((item) => item.date),
            y: wakeTimes,
            type: "scatter",
            mode: "lines+markers",
            name: "Wake-Up Time",
            line: { width: 3 },
            connectgaps: false,
          },
        ]}
        layout={{
          margin: { l: 60, r: 20, t: 20, b: 55 },
          paper_bgcolor: "#ffffff",
          plot_bgcolor: "#ffffff",
          font: { family: "Arial, sans-serif", color: "#334155" },
          xaxis: { title: "Date", automargin: true },
          yaxis: {
            title: "Time",
            tickmode: "array",
            tickvals: tickValues,
            ticktext: tickValues.map(formatTime),
            range: [0, 1440],
          },
          legend: { orientation: "h", y: -0.2 },
          autosize: true,
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%", height: "320px" }}
      />
    </section>
  );
}

function ProgressMonitoring({ analytics }) {
  const progress = analytics?.progress_monitoring || {};
  const current = progress.current || {};
  const dailyProgress = progress.daily || analytics?.daily_activity || [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-800">
          Progress Monitoring
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          [
            "Habit Score",
            current.habit_score ?? analytics?.habit_score ?? 0,
            "Overall habit performance",
          ],
          [
            "Wake-Up Consistency",
            current.wake_up_consistency ?? analytics?.wake_up_consistency ?? 0,
            "Completed / triggered",
          ],
          [
            "Challenge Accuracy",
            current.challenge_accuracy ?? analytics?.challenge_accuracy ?? 0,
            "Correct challenge answers",
          ],
        ].map(([label, value, description]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">
              {Number(value).toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        {dailyProgress.length ? (
          <Plot
            data={[
              {
                x: dailyProgress.map((item) => item.date),
                y: dailyProgress.map(
                  (item) => Number(item.wake_up_consistency) || 0,
                ),
                type: "scatter",
                mode: "lines+markers",
                name: "Wake-Up Consistency",
                line: { width: 3 },
              },
              {
                x: dailyProgress.map((item) => item.date),
                y: dailyProgress.map(
                  (item) => Number(item.challenge_accuracy) || 0,
                ),
                type: "scatter",
                mode: "lines+markers",
                name: "Challenge Accuracy",
                line: { width: 3 },
              },
            ]}
            layout={{
              margin: { l: 50, r: 20, t: 20, b: 55 },
              paper_bgcolor: "#ffffff",
              plot_bgcolor: "#ffffff",
              font: { family: "Arial, sans-serif", color: "#334155" },
              xaxis: { title: "Date", automargin: true },
              yaxis: { title: "Progress %", range: [0, 100] },
              legend: { orientation: "h", y: -0.2 },
              autosize: true,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "320px" }}
          />
        ) : (
          <div className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
            No progress data available for this period yet.
          </div>
        )}
      </div>
    </section>
  );
}

function ImprovementAreas({ analytics }) {
  const progress = analytics?.progress_monitoring || {};
  const current = progress.current || {};

  const wakeConsistency = Number(
    current.wake_up_consistency ?? analytics?.wake_up_consistency ?? 0,
  );
  const challengeAccuracy = Number(
    current.challenge_accuracy ?? analytics?.challenge_accuracy ?? 0,
  );
  const averageAttempts = Number(analytics?.average_attempts ?? 0);

  const sleepWakeTrend = Array.isArray(analytics?.sleep_wake_trend)
    ? analytics.sleep_wake_trend
    : [];
  const delays = sleepWakeTrend
    .map((item) => Number(item.wake_up_delay_minutes))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const averageDelay = delays.length
    ? delays.reduce((sum, value) => sum + value, 0) / delays.length
    : null;

  const areas = [];

  if (wakeConsistency < 80) {
    areas.push({
      icon: "⏰",
      title: "Improve wake-up consistency",
      detail: `Wake-up consistency is ${wakeConsistency.toFixed(1)}%. Aim for more consistent completion of scheduled wake-ups.`,
    });
  }

  if (challengeAccuracy < 70) {
    areas.push({
      icon: "🧠",
      title: "Improve challenge accuracy",
      detail: `Challenge accuracy is ${challengeAccuracy.toFixed(1)}%. Consider reviewing challenge performance and difficulty.`,
    });
  }

  if (averageDelay !== null && averageDelay > 15) {
    areas.push({
      icon: "⏱️",
      title: "Reduce wake-up delay",
      detail: `Average wake-up delay is ${averageDelay.toFixed(1)} minutes. Encourage a more consistent wake-up routine.`,
    });
  }

  if (averageAttempts > 2.5) {
    areas.push({
      icon: "🔁",
      title: "Reduce repeated attempts",
      detail: `The user averages ${averageAttempts.toFixed(1)} attempts per challenge. Consider improving first-attempt accuracy.`,
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-800">
          🎯 Improvement Areas
        </h3>
      </div>

      {areas.length === 0 ? (
        <div className="rounded-xl bg-emerald-50 p-5 text-center">
          <p className="font-semibold text-emerald-700">
            ✅ No major improvement areas identified
          </p>
          <p className="mt-1 text-sm text-emerald-600">
            The user's current performance is stable based on the available
            analytics.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {areas.map((area) => (
            <div
              key={area.title}
              className="rounded-xl border border-amber-200 bg-amber-50 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{area.icon}</span>
                <div>
                  <p className="font-semibold text-slate-800">{area.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {area.detail}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState(null);

  // Firebase Cloud Messaging (FCM) notification setup
  useEffect(() => {
    if (!token) return;

    const setupNotifications = async () => {
      const fcmToken = await requestNotificationPermission(token);

      if (fcmToken) {
        console.log("FCM notifications enabled");
        console.log("FCM Token:", fcmToken);
      }
    };

    setupNotifications();

    listenForForegroundMessages();
  }, [token, role]);

  // M3 behavioral event logger
  const logBehaviorEvent = async (eventType, eventData = {}) => {
    if (!userId) return;

    try {
      await fetch(`${API_URL}/behavior/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          event_type: eventType,
          event_data: eventData,
        }),
      });
    } catch (error) {
      console.error("Behavior event logging failed:", error);
    }
  };

  // Registration state
  const [showRegister, setShowRegister] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerRole, setRegisterRole] = useState("user");

  const [alarms, setAlarms] = useState([]);
  const [alarmTime, setAlarmTime] = useState("");
  const [alarmName, setAlarmName] = useState("");
  const [editingAlarmId, setEditingAlarmId] = useState(null);

  // Alarm repetition
  const [repeatType, setRepeatType] = useState("daily");
  const [repeatDays, setRepeatDays] = useState([]);

  const [recommendations, setRecommendations] = useState([]);

  // Habit Tracking Dashboard state
  const [habitScore, setHabitScore] = useState(null);
  const [behavioralAnalytics, setBehavioralAnalytics] = useState(null);
  const [autoRecommendations, setAutoRecommendations] = useState([]);
  const [currentRecommendation, setCurrentRecommendation] = useState("");
  const [currentRecommendationCreatedAt, setCurrentRecommendationCreatedAt] =
    useState(null);
  const [recommendationHistory, setRecommendationHistory] = useState([]);
  const [habitView, setHabitView] = useState("habit");
  const [challengeAnalytics, setChallengeAnalytics] = useState(null);
  const [habitLoading, setHabitLoading] = useState(false);

  // Behavioral Analytics history controls
  const getLocalDateString = (value = new Date()) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [behaviorPeriod, setBehaviorPeriod] = useState("weekly");
  const [behaviorAnchorDate, setBehaviorAnchorDate] =
    useState(getLocalDateString());
  const [behaviorCustomStart, setBehaviorCustomStart] = useState(
    getLocalDateString(new Date(new Date().setDate(new Date().getDate() - 6))),
  );
  const [behaviorCustomEnd, setBehaviorCustomEnd] =
    useState(getLocalDateString());
  const [behaviorHistoryLoading, setBehaviorHistoryLoading] = useState(false);

  const [wakeUpTime, setWakeUpTime] = useState("");
  const [sleepDuration, setSleepDuration] = useState("");
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");
  const [productivityGoal, setProductivityGoal] = useState("");
  const [difficultyPreference, setDifficultyPreference] = useState("Medium");
  const [habitPreferences, setHabitPreferences] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);

  const [coachUsers, setCoachUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [coachRecommendation, setCoachRecommendation] = useState("");
  const [coachRecommendations, setCoachRecommendations] = useState([]);
  const [coachPage, setCoachPage] = useState("overview");
  const [coachAnalytics, setCoachAnalytics] = useState(null);
  const [coachOverview, setCoachOverview] = useState(null);
  const [coachAnalyticsLoading, setCoachAnalyticsLoading] = useState(false);
  const [coachAnalyticsPeriod, setCoachAnalyticsPeriod] = useState("monthly");
  const [coachAnalyticsMonth, setCoachAnalyticsMonth] = useState(
    getLocalDateString().slice(0, 7),
  );

  const [adminMessage, setAdminMessage] = useState("");
  const [adminPage, setAdminPage] = useState("overview");
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);

  const [adminAnalytics, setAdminAnalytics] = useState(null);
  const [adminAnalyticsLoading, setAdminAnalyticsLoading] = useState(false);
  const [adminReportLoading, setAdminReportLoading] = useState(false);
  const [adminRecommendations, setAdminRecommendations] = useState(null);
  const [adminRecommendationsLoading, setAdminRecommendationsLoading] =
    useState(false);
  const [adminStartDate, setAdminStartDate] = useState(() => {
    const today = new Date();
    return getLocalDateString(
      new Date(today.getFullYear(), today.getMonth(), 1),
    );
  });
  const [adminEndDate, setAdminEndDate] = useState(() => getLocalDateString());
  const [adminAppliedStartDate, setAdminAppliedStartDate] = useState(() => {
    const today = new Date();
    return getLocalDateString(
      new Date(today.getFullYear(), today.getMonth(), 1),
    );
  });
  const [adminAppliedEndDate, setAdminAppliedEndDate] = useState(() =>
    getLocalDateString(),
  );
  const [message, setMessage] = useState("");
  // Cognitive Challenge state
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [challengeType, setChallengeType] = useState("math");
  const [challengeDifficulty, setChallengeDifficulty] = useState("easy");
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [challengeResult, setChallengeResult] = useState(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeStartTime, setChallengeStartTime] = useState(null);
  const [memorySequenceVisible, setMemorySequenceVisible] = useState(false);

  // Wake-up verification state
  const [alarmChallenge, setAlarmChallenge] = useState(null);
  const [alarmChallengeAnswer, setAlarmChallengeAnswer] = useState("");
  const [alarmChallengeResult, setAlarmChallengeResult] = useState(null);
  const [alarmChallengeLoading, setAlarmChallengeLoading] = useState(false);
  const [alarmChallengeStartTime, setAlarmChallengeStartTime] = useState(null);

  const [ringingAlarm, setRingingAlarm] = useState(null);
  const [isRinging, setIsRinging] = useState(false);

  // User navigation: each feature is now a separate screen.
  const [page, setPage] = useState("dashboard");

  const audioContext = useRef(null);
  const oscillator = useRef(null);
  const triggeredAlarms = useRef(new Set());

  const startSound = () => {
    if (!audioContext.current) {
      audioContext.current = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }

    const ctx = audioContext.current;
    if (ctx.state === "suspended") ctx.resume();

    if (oscillator.current) {
      try {
        oscillator.current.stop();
      } catch {}
    }

    oscillator.current = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.current.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.current.type = "sine";
    oscillator.current.frequency.value = 1000;
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    oscillator.current.start();

    setIsRinging(true);
  };

  const stopSound = () => {
    if (oscillator.current) {
      try {
        oscillator.current.stop();
      } catch {}
      oscillator.current = null;
    }

    setIsRinging(false);
    setRingingAlarm(null);
  };

  const generateAlarmChallenge = async (alarm = ringingAlarm) => {
    if (!token || !alarm) return;

    setAlarmChallengeLoading(true);
    setAlarmChallenge(null);
    setAlarmChallengeAnswer("");
    setAlarmChallengeResult(null);
    setAlarmChallengeStartTime(null);

    const difficulty = String(difficultyPreference || "Medium").toLowerCase();
    const challengeTypes = [
      "math",
      "logic",
      "memory",
      "word",
      "pattern",
      "riddle",
      "quiz",
    ];
    const selectedType =
      challengeTypes[Math.floor(Math.random() * challengeTypes.length)];

    try {
      const response = await fetch(`${API_URL}/challenges/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          challenge_type: selectedType,
          difficulty: ["easy", "medium", "hard"].includes(difficulty)
            ? difficulty
            : "medium",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not generate wake-up challenge");
        return;
      }

      setAlarmChallenge(data);
      setAlarmChallengeStartTime(Date.now());
      setMessage("");
    } catch {
      setMessage("Cannot connect to backend for wake-up challenge");
    } finally {
      setAlarmChallengeLoading(false);
    }
  };

  const submitAlarmChallenge = async () => {
    if (!alarmChallenge) {
      setMessage("Wake-up challenge is not ready yet");
      return;
    }

    if (!alarmChallengeAnswer.trim()) {
      setMessage("Please answer the challenge");
      return;
    }

    const timeTaken = alarmChallengeStartTime
      ? Math.floor((Date.now() - alarmChallengeStartTime) / 1000)
      : null;

    try {
      const response = await fetch(
        `${API_URL}/challenges/${alarmChallenge.id}/answer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            answer: alarmChallengeAnswer.trim(),
            time_taken: timeTaken,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not verify wake-up challenge");
        return;
      }

      setAlarmChallengeResult(data);

      if (data.is_correct) {
        setMessage("Correct! Alarm dismissed.");

        // Record successful wake-up
        await logBehaviorEvent("wake_up_completed", {
          alarm_id: ringingAlarm?.alarm_id,
          alarm_name: ringingAlarm?.alarm_name,
          challenge_id: alarmChallenge.id,
          challenge_type: alarmChallenge.challenge_type,
          challenge_difficulty: alarmChallenge.difficulty,
          time_taken: timeTaken,
        });

        stopSound();
        setRingingAlarm(null);
        setAlarmChallenge(null);
        setAlarmChallengeAnswer("");
        setAlarmChallengeStartTime(null);
      } else {
        setMessage("Incorrect answer. The alarm will continue ringing.");
        setAlarmChallengeAnswer("");
      }
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const snoozeAlarm = () => {
    if (!ringingAlarm) return;

    const alarm = ringingAlarm;

    stopSound();
    setAlarmChallenge(null);
    setAlarmChallengeAnswer("");
    setAlarmChallengeResult(null);
    setAlarmChallengeStartTime(null);
    setMessage("Alarm snoozed for 5 minutes");

    // Record snooze behavior for M3 analytics
    logBehaviorEvent("alarm_snoozed", {
      alarm_id: alarm.alarm_id,
      alarm_name: alarm.alarm_name,
      snooze_duration_minutes: 5,
    });

    setTimeout(
      async () => {
        setRingingAlarm(alarm);
        startSound();

        // Record that the alarm rang again after snooze
        await logBehaviorEvent("alarm_resumed_after_snooze", {
          alarm_id: alarm.alarm_id,
          alarm_name: alarm.alarm_name,
        });

        await generateAlarmChallenge(alarm);
      },
      5 * 60 * 1000,
    );
  };

  // Check whether an alarm should run on the current day.
  // This keeps the browser-side ringing consistent with the backend schedule.
  const shouldTriggerAlarmToday = (alarm) => {
    const repeatType = alarm.repeat_type || "daily";
    const dayIndex = new Date().getDay(); // Sunday = 0
    const currentDay = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ][dayIndex];

    if (repeatType === "daily") return true;
    if (repeatType === "weekdays") return dayIndex >= 1 && dayIndex <= 5;
    if (repeatType === "weekends") return dayIndex === 0 || dayIndex === 6;

    if (repeatType === "custom") {
      const days = Array.isArray(alarm.repeat_days) ? alarm.repeat_days : [];
      return days.map((day) => String(day).toLowerCase()).includes(currentDay);
    }

    return true;
  };

  useEffect(() => {
    if (!token || role !== "user") return;

    const checkAlarms = () => {
      const now = new Date();
      const currentTime =
        String(now.getHours()).padStart(2, "0") +
        ":" +
        String(now.getMinutes()).padStart(2, "0");

      alarms.forEach((alarm) => {
        if (
          alarm.is_active &&
          alarm.alarm_time.substring(0, 5) === currentTime &&
          shouldTriggerAlarmToday(alarm) &&
          !triggeredAlarms.current.has(alarm.alarm_id)
        ) {
          triggeredAlarms.current.add(alarm.alarm_id);
          setRingingAlarm(alarm);
          startSound();

          logBehaviorEvent("alarm_triggered", {
            alarm_id: alarm.alarm_id,
            alarm_name: alarm.alarm_name,
            scheduled_time: alarm.alarm_time,
          });

          generateAlarmChallenge(alarm);
        }
      });
    };

    const interval = setInterval(checkAlarms, 5000);
    return () => clearInterval(interval);
  }, [alarms, token, role]);

  const login = async () => {
    if (!email || !password) {
      setMessage("Enter email and password");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Login failed");
        return;
      }

      setToken(data.access_token);
      setRole(data.role);
      setUserName(data.name);
      setUserId(data.user_id);
      setMessage("");

      audioContext.current = new (
        window.AudioContext || window.webkitAudioContext
      )();
      await audioContext.current.resume();

      if (data.role === "user") {
        setPage("dashboard");
        getAlarms(data.access_token);
        getRecommendations(data.access_token);
        getHabitDashboard(data.access_token);
      } else if (data.role === "wellness_coach") {
        setCoachPage("overview");
        getCoachUsers(data.access_token);
        getCoachOverview(data.access_token);
      } else if (data.role === "admin") {
        setAdminPage("overview");
        getAdminStatus(data.access_token);
        getAdminAnalytics(data.access_token);
        getAdminRecommendations(data.access_token);
      }
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const logout = () => {
    stopSound();
    setToken("");
    setRole("");
    setUserName("");
    setUserId(null);
    setEmail("");
    setPassword("");
    setAlarms([]);
    setRecommendations([]);
    setHabitScore(null);
    setBehavioralAnalytics(null);
    setAutoRecommendations([]);
    setChallengeAnalytics(null);
    setCoachUsers([]);
    setSelectedUserId("");
    setSelectedUserProfile(null);
    setCoachRecommendation("");
    setCoachPage("overview");
    setCoachAnalytics(null);
    setCoachOverview(null);
    setAdminMessage("");
    setAdminPage("overview");
    setAdminRecommendations(null);
    setMessage("");
    setEditingAlarmId(null);
    setRepeatType("daily");
    setRepeatDays([]);
    setAlarmChallenge(null);
    setAlarmChallengeAnswer("");
    setAlarmChallengeResult(null);
    setAlarmChallengeLoading(false);
    setAlarmChallengeStartTime(null);
    setPage("dashboard");
    triggeredAlarms.current.clear();
  };

  const getAlarms = async (currentToken = token) => {
    try {
      const response = await fetch(`${API_URL}/alarms`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not get alarms");
        return;
      }

      setAlarms(data);
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const getRecommendations = async (currentToken = token) => {
    try {
      const response = await fetch(`${API_URL}/recommendations`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not get recommendations");
        return;
      }

      setRecommendations(data);
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const deleteAutomaticRecommendation = async (recommendationId) => {
    if (!recommendationId || !window.confirm("Delete this recommendation?"))
      return;
    try {
      const response = await fetch(
        `${API_URL}/recommendations/auto/${recommendationId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.detail || "Could not delete recommendation");
        return;
      }
      setRecommendationHistory((current) =>
        current.filter((item) => item.recommendation_id !== recommendationId),
      );
      if (recommendationHistory[0]?.recommendation_id === recommendationId) {
        setCurrentRecommendation("");
        setCurrentRecommendationCreatedAt(null);
      }
      setMessage("Recommendation deleted successfully");
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const getBehavioralAnalytics = async (
    currentToken = token,
    period = behaviorPeriod,
    anchorDate = behaviorAnchorDate,
    customStart = behaviorCustomStart,
    customEnd = behaviorCustomEnd,
  ) => {
    if (!currentToken) return null;

    setBehaviorHistoryLoading(true);

    try {
      const params = new URLSearchParams({
        period,
        anchor_date: anchorDate,
      });

      if (period === "custom") {
        if (!customStart || !customEnd) {
          setMessage("Select both custom start and end dates");
          return null;
        }
        params.set("start_date", customStart);
        params.set("end_date", customEnd);
      }

      const response = await fetch(
        `${API_URL}/challenges/behavioral-analytics?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${currentToken}` },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not load behavioral analytics");
        return null;
      }

      setBehavioralAnalytics(data);
      return data;
    } catch {
      setMessage("Cannot connect to backend");
      return null;
    } finally {
      setBehaviorHistoryLoading(false);
    }
  };

  const getHabitDashboard = async (currentToken = token) => {
    if (!currentToken) return;

    setHabitLoading(true);

    try {
      const headers = {
        Authorization: `Bearer ${currentToken}`,
      };

      const [
        habitResponse,
        analyticsResponse,
        recommendationResponse,
        challengeAnalyticsResponse,
      ] = await Promise.all([
        fetch(`${API_URL}/habit-score`, { headers }),
        fetch(
          `${API_URL}/challenges/behavioral-analytics?period=${encodeURIComponent(
            behaviorPeriod,
          )}&anchor_date=${encodeURIComponent(behaviorAnchorDate)}${
            behaviorPeriod === "custom"
              ? `&start_date=${encodeURIComponent(
                  behaviorCustomStart,
                )}&end_date=${encodeURIComponent(behaviorCustomEnd)}`
              : ""
          }`,
          { headers },
        ),
        fetch(`${API_URL}/recommendations/auto`, { headers }),
        fetch(`${API_URL}/challenges/analytics`, { headers }),
      ]);

      const habitData = await habitResponse.json();
      const analyticsData = await analyticsResponse.json();
      const recommendationData = await recommendationResponse.json();
      const challengeAnalyticsData = await challengeAnalyticsResponse.json();

      if (!habitResponse.ok) {
        setMessage(habitData.detail || "Could not load habit score");
        return;
      }

      if (!analyticsResponse.ok) {
        setMessage(
          analyticsData.detail || "Could not load behavioral analytics",
        );
        return;
      }

      if (!recommendationResponse.ok) {
        setMessage(
          recommendationData.detail ||
            "Could not load automatic recommendations",
        );
        return;
      }

      if (!challengeAnalyticsResponse.ok) {
        setMessage(
          challengeAnalyticsData.detail || "Could not load challenge analytics",
        );
        return;
      }

      setHabitScore(habitData);
      setBehavioralAnalytics(analyticsData);
      setAutoRecommendations(recommendationData.recommendations || []);
      setCurrentRecommendation(recommendationData.current_recommendation || "");
      setCurrentRecommendationCreatedAt(
        recommendationData.current_recommendation_created_at || null,
      );
      setRecommendationHistory(recommendationData.recommendation_history || []);
      setChallengeAnalytics(challengeAnalyticsData);
    } catch {
      setMessage("Cannot connect to backend");
    } finally {
      setHabitLoading(false);
    }
  };

  const changeBehaviorPeriod = async (period) => {
    setBehaviorPeriod(period);
    await getBehavioralAnalytics(token, period, behaviorAnchorDate);
  };

  const selectBehaviorCalendarDate = async (date) => {
    if (!date) return;
    const today = getLocalDateString();
    if (date > today) {
      setMessage("Future dates cannot be selected");
      return;
    }
    setBehaviorAnchorDate(date);
    await getBehavioralAnalytics(token, behaviorPeriod, date);
  };

  const selectBehaviorMonth = async (monthValue) => {
    if (!monthValue) return;
    const currentMonth = getLocalDateString().slice(0, 7);
    if (monthValue > currentMonth) {
      setMessage("Future months cannot be selected");
      return;
    }
    const monthAnchor = `${monthValue}-01`;
    setBehaviorAnchorDate(monthAnchor);
    await getBehavioralAnalytics(token, "monthly", monthAnchor);
  };

  const goToCurrentBehaviorPeriod = async () => {
    const today = getLocalDateString();
    setBehaviorAnchorDate(today);
    if (behaviorPeriod === "custom") {
      setBehaviorCustomEnd(today);
      await getBehavioralAnalytics(
        token,
        "custom",
        today,
        behaviorCustomStart,
        today,
      );
    } else {
      await getBehavioralAnalytics(token, behaviorPeriod, today);
    }
  };

  const applyCustomBehaviorRange = async () => {
    if (!behaviorCustomStart || !behaviorCustomEnd) {
      setMessage("Select both custom start and end dates");
      return;
    }

    const today = getLocalDateString();
    if (behaviorCustomStart > today || behaviorCustomEnd > today) {
      setMessage("Future dates cannot be selected");
      return;
    }

    if (behaviorCustomStart > behaviorCustomEnd) {
      setMessage("Start date cannot be after end date");
      return;
    }

    await getBehavioralAnalytics(
      token,
      "custom",
      behaviorAnchorDate,
      behaviorCustomStart,
      behaviorCustomEnd,
    );
  };

  const loadMyProfile = async (currentToken = token) => {
    if (!currentToken || role !== "user") return;

    try {
      const response = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (response.status === 404) {
        setProfileSaved(false);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        console.error("Profile loading failed:", data.detail);
        return;
      }

      setWakeUpTime(data.preferred_wake_up_time || "");
      setSleepDuration(
        data.sleep_duration !== null && data.sleep_duration !== undefined
          ? String(data.sleep_duration)
          : "",
      );
      setTimeZone(data.time_zone || "Asia/Kolkata");
      setProductivityGoal(data.productivity_goal || "");
      setDifficultyPreference(data.difficulty_preference || "Medium");
      setHabitPreferences(data.habit_preferences || "");
      setProfileSaved(true);
    } catch (error) {
      console.error("Profile loading failed:", error);
    }
  };

  useEffect(() => {
    if (token && role === "user") {
      loadMyProfile(token);
    }
  }, [token, role]);

  const saveProfile = async () => {
    if (
      !wakeUpTime ||
      !sleepDuration ||
      !timeZone ||
      !productivityGoal ||
      !difficultyPreference ||
      !habitPreferences
    ) {
      setMessage("Please fill all profile fields");
      return;
    }

    const sleepHours = Number(sleepDuration);
    if (!Number.isInteger(sleepHours) || sleepHours < 1 || sleepHours > 24) {
      setMessage(
        "Sleep duration must be a whole number between 1 and 24 hours",
      );
      return;
    }

    try {
      const response = await fetch(`${API_URL}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preferred_wake_up_time: wakeUpTime,
          sleep_duration: sleepHours,
          time_zone: timeZone,
          productivity_goal: productivityGoal,
          difficulty_preference: difficultyPreference,
          habit_preferences: habitPreferences,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not save profile");
        return;
      }

      setProfileSaved(true);
      setProfileEditing(false);
      setMessage("Wellness profile saved successfully");
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const createAlarm = async () => {
    if (!alarmTime || !alarmName) {
      setMessage("Enter alarm time and alarm name");
      return;
    }

    if (repeatType === "custom" && repeatDays.length === 0) {
      setMessage("Select at least one day for custom repetition");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/alarms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          alarm_time: alarmTime,
          alarm_name: alarmName,
          is_active: true,
          repeat_type: repeatType,
          repeat_days: repeatType === "custom" ? repeatDays : [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not create alarm");
        return;
      }

      setMessage("Alarm created successfully");
      setAlarmTime("");
      setAlarmName("");
      setEditingAlarmId(null);
      setRepeatType("daily");
      setRepeatDays([]);
      await getAlarms();
      setPage("alarms");
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const updateAlarm = async () => {
    if (!alarmTime || !alarmName || !editingAlarmId) {
      setMessage("Enter alarm time and alarm name");
      return;
    }

    if (repeatType === "custom" && repeatDays.length === 0) {
      setMessage("Select at least one day for custom repetition");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/alarms/${editingAlarmId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          alarm_time: alarmTime,
          alarm_name: alarmName,
          is_active: true,
          repeat_type: repeatType,
          repeat_days: repeatType === "custom" ? repeatDays : [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not update alarm");
        return;
      }

      setMessage("Alarm updated successfully");
      setAlarmTime("");
      setAlarmName("");
      setEditingAlarmId(null);
      setRepeatType("daily");
      setRepeatDays([]);
      await getAlarms();
      setPage("alarms");
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const editAlarm = (alarm) => {
    setEditingAlarmId(alarm.alarm_id);
    setAlarmTime(alarm.alarm_time.substring(0, 5));
    setAlarmName(alarm.alarm_name || "");
    setRepeatType(alarm.repeat_type || "daily");
    setRepeatDays(Array.isArray(alarm.repeat_days) ? alarm.repeat_days : []);
    setPage("add-alarm");
  };

  const cancelEdit = () => {
    setEditingAlarmId(null);
    setAlarmTime("");
    setAlarmName("");
    setRepeatType("daily");
    setRepeatDays([]);
    setPage("alarms");
  };

  const toggleRepeatDay = (day) => {
    setRepeatDays((currentDays) =>
      currentDays.includes(day)
        ? currentDays.filter((item) => item !== day)
        : [...currentDays, day],
    );
  };

  const formatRepeat = (alarm) => {
    const type = alarm.repeat_type || "daily";

    if (type === "weekdays") return "Weekdays";
    if (type === "weekends") return "Weekends";

    if (type === "custom") {
      const days = Array.isArray(alarm.repeat_days) ? alarm.repeat_days : [];
      if (!days.length) return "Custom";
      const labels = {
        monday: "Mon",
        tuesday: "Tue",
        wednesday: "Wed",
        thursday: "Thu",
        friday: "Fri",
        saturday: "Sat",
        sunday: "Sun",
      };
      return days
        .map((day) => labels[String(day).toLowerCase()] || day)
        .join(", ");
    }

    return "Every day";
  };

  const toggleAlarm = async (alarm) => {
    try {
      const response = await fetch(`${API_URL}/alarms/${alarm.alarm_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          alarm_time: alarm.alarm_time.substring(0, 5),
          alarm_name: alarm.alarm_name,
          is_active: !alarm.is_active,
          repeat_type: alarm.repeat_type || "daily",
          repeat_days: Array.isArray(alarm.repeat_days)
            ? alarm.repeat_days
            : [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not update alarm");
        return;
      }

      setMessage(alarm.is_active ? "Alarm disabled" : "Alarm enabled");
      getAlarms();
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const deleteAlarm = async (alarmId) => {
    try {
      const response = await fetch(`${API_URL}/alarms/${alarmId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not delete alarm");
        return;
      }

      setMessage("Alarm deleted successfully");
      getAlarms();
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const getCoachUsers = async (currentToken = token) => {
    try {
      const response = await fetch(`${API_URL}/coach/users`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not get users");
        return;
      }

      setCoachUsers(data);
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const getUserProfile = async (userId) => {
    if (!userId) {
      setSelectedUserProfile(null);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/coach/users/${userId}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setSelectedUserProfile(null);
        setMessage(data.detail || "Could not get user profile");
        return;
      }

      setSelectedUserProfile(data);
      setSelectedUserId(String(userId));
      setCoachPage("analytics");
      await getCoachAnalytics(
        userId,
        coachAnalyticsPeriod,
        coachAnalyticsMonth,
      );
      await getCoachRecommendations(userId);
      setMessage("User profile and analytics loaded");
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const getCoachRecommendations = async (userId = selectedUserId) => {
    if (!userId || !token) {
      setCoachRecommendations([]);
      return;
    }
    try {
      const response = await fetch(
        `${API_URL}/coach/users/${userId}/recommendations`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.detail || "Could not load recommendations");
        return;
      }
      setCoachRecommendations(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Cannot connect to backend for recommendations");
    }
  };

  const deleteCoachRecommendation = async (recommendationId) => {
    if (
      !selectedUserId ||
      !recommendationId ||
      !window.confirm("Delete this recommendation?")
    )
      return;
    try {
      const response = await fetch(
        `${API_URL}/coach/users/${selectedUserId}/recommendations/${recommendationId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.detail || "Could not delete recommendation");
        return;
      }
      setCoachRecommendations((current) =>
        current.filter((item) => item.recommendation_id !== recommendationId),
      );
      setMessage("Recommendation deleted successfully");
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const getCoachAnalytics = async (
    userId,
    period = coachAnalyticsPeriod,
    monthValue = coachAnalyticsMonth,
  ) => {
    if (!userId || !token) {
      setCoachAnalytics(null);
      return;
    }

    const anchorDate =
      period === "monthly" ? `${monthValue}-01` : getLocalDateString();

    setCoachAnalyticsLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/coach/users/${userId}/analytics?period=${encodeURIComponent(
          period,
        )}&anchor_date=${encodeURIComponent(anchorDate)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();

      if (!response.ok) {
        setCoachAnalytics(null);
        setMessage(data.detail || "Could not load user analytics");
        return;
      }

      setCoachAnalytics(data);
    } catch {
      setCoachAnalytics(null);
      setMessage("Cannot connect to backend for user analytics");
    } finally {
      setCoachAnalyticsLoading(false);
    }
  };

  const changeCoachAnalyticsMonth = async (monthValue) => {
    if (!monthValue) return;
    setCoachAnalyticsMonth(monthValue);
    if (selectedUserId) {
      await getCoachAnalytics(selectedUserId, "monthly", monthValue);
    }
  };

  const getCoachOverview = async (currentToken = token) => {
    if (!currentToken) return;
    try {
      const response = await fetch(`${API_URL}/coach/analytics/overview`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await response.json();
      if (!response.ok) {
        setCoachOverview(null);
        setMessage(data.detail || "Could not load coach analytics");
        return;
      }
      setCoachOverview(data);
    } catch {
      setCoachOverview(null);
      setMessage("Cannot connect to backend for coach analytics");
    }
  };

  const giveRecommendation = async () => {
    if (!selectedUserId) {
      setMessage("Select a user first");
      return;
    }

    if (!coachRecommendation.trim()) {
      setMessage("Enter a recommendation");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/coach/users/${selectedUserId}/recommendation?recommendation=${encodeURIComponent(
          coachRecommendation,
        )}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not save recommendation");
        return;
      }

      setMessage("Recommendation sent successfully");
      setCoachRecommendation("");
      await getCoachRecommendations(selectedUserId);
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  const printCoachUserReport = () => {
    if (!selectedUserId || !coachAnalytics) {
      setMessage("Select a user and load analytics first");
      return;
    }

    const selectedUser = coachUsers.find(
      (user) => String(user.user_id) === String(selectedUserId),
    );

    const monthLabel = coachAnalyticsMonth
      ? new Date(`${coachAnalyticsMonth}-01T00:00:00`).toLocaleDateString(
          "en-US",
          { month: "long", year: "numeric" },
        )
      : coachAnalytics.period_label || "Selected period";

    const analytics = coachAnalytics;
    const dailyActivity = Array.isArray(analytics.daily_activity)
      ? analytics.daily_activity
      : [];
    const sleepWakeTrend = Array.isArray(analytics.sleep_wake_trend)
      ? analytics.sleep_wake_trend
      : [];
    const progressMonitoring = analytics.progress_monitoring || {};
    const progressTrend = Array.isArray(progressMonitoring.daily)
      ? progressMonitoring.daily
      : dailyActivity;
    const typePerformance = analytics.performance_by_type || {};
    const difficultyPerformance = analytics.performance_by_difficulty || {};

    const reportWindow = window.open("", "_blank", "width=1200,height=1000");
    if (!reportWindow) {
      setMessage("Please allow pop-ups to print the report");
      return;
    }

    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const valueOrNA = (value) =>
      value === null || value === undefined || value === "" ? "N/A" : value;

    const chartWidth = 900;
    const chartHeight = 300;

    const buildLineChart = (
      title,
      labels,
      series,
      yMax = 100,
      ySuffix = "%",
    ) => {
      if (!labels.length || !series.length) {
        return `<div class="chart-empty">No graph data available for this period.</div>`;
      }

      const left = 55;
      const right = 20;
      const top = 38;
      const bottom = 48;
      const plotW = chartWidth - left - right;
      const plotH = chartHeight - top - bottom;
      const xStep = labels.length > 1 ? plotW / (labels.length - 1) : plotW;

      const grid = [0, 25, 50, 75, 100]
        .map((v) => {
          const y = top + plotH - (v / yMax) * plotH;
          return `<line x1="${left}" y1="${y}" x2="${chartWidth - right}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>
                  <text x="${left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#64748b">${v}${ySuffix}</text>`;
        })
        .join("");

      const xLabels = labels
        .map((label, i) => {
          const x = labels.length === 1 ? left + plotW / 2 : left + i * xStep;
          return `<text x="${x}" y="${chartHeight - 14}" text-anchor="middle" font-size="10" fill="#64748b">${escapeHtml(String(label).slice(5))}</text>`;
        })
        .join("");

      const colors = ["#4f46e5", "#16a34a", "#f97316"];
      const lines = series
        .map((item, seriesIndex) => {
          const points = labels.map((_, i) => {
            const raw = item.values[i];
            if (raw === null || raw === undefined || raw === "") return null;
            const value = Math.max(0, Math.min(yMax, Number(raw) || 0));
            const x = labels.length === 1 ? left + plotW / 2 : left + i * xStep;
            const y = top + plotH - (value / yMax) * plotH;
            return { x, y, value };
          });
          const valid = points.filter(Boolean);
          if (!valid.length) return "";
          const path = valid
            .map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`)
            .join(" ");
          const circles = valid
            .map(
              (p) =>
                `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${colors[seriesIndex % colors.length]}"/>`,
            )
            .join("");
          return `<path d="${path}" fill="none" stroke="${colors[seriesIndex % colors.length]}" stroke-width="3"/>${circles}`;
        })
        .join("");

      const legend = series
        .map(
          (item, i) =>
            `<span class="legend-item"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span>${escapeHtml(item.name)}</span>`,
        )
        .join("");

      return `<div class="chart-block">
        <div class="chart-title">${escapeHtml(title)}</div>
        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" class="chart-svg" role="img" aria-label="${escapeHtml(title)}">
          ${grid}
          <line x1="${left}" y1="${top + plotH}" x2="${chartWidth - right}" y2="${top + plotH}" stroke="#94a3b8"/>
          ${lines}
          ${xLabels}
        </svg>
        <div class="legend">${legend}</div>
      </div>`;
    };

    const buildBarChart = (title, labels, values, suffix = "%") => {
      if (!labels.length) {
        return `<div class="chart-empty">No graph data available for this period.</div>`;
      }
      const max = Math.max(100, ...values.map((v) => Number(v) || 0));
      const barAreaH = 210;
      const barW = Math.max(34, Math.min(70, 680 / labels.length));
      const gap = Math.max(
        16,
        (680 - labels.length * barW) / Math.max(1, labels.length + 1),
      );
      const svgW = 900;
      const svgH = 300;
      const baseX = 90;
      const baseY = 235;
      const bars = labels
        .map((label, i) => {
          const value = Math.max(0, Number(values[i]) || 0);
          const h = (value / max) * barAreaH;
          const x = baseX + gap + i * (barW + gap);
          const y = baseY - h;
          return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="5" fill="#6366f1"/>
                  <text x="${x + barW / 2}" y="${y - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#334155">${value}${suffix}</text>
                  <text x="${x + barW / 2}" y="${baseY + 22}" text-anchor="middle" font-size="11" fill="#64748b">${escapeHtml(String(label).slice(0, 12))}</text>`;
        })
        .join("");
      return `<div class="chart-block">
        <div class="chart-title">${escapeHtml(title)}</div>
        <svg viewBox="0 0 ${svgW} ${svgH}" class="chart-svg" role="img" aria-label="${escapeHtml(title)}">
          <line x1="70" y1="${baseY}" x2="850" y2="${baseY}" stroke="#94a3b8"/>
          <line x1="70" y1="25" x2="70" y2="${baseY}" stroke="#94a3b8"/>
          ${bars}
        </svg>
      </div>`;
    };

    const sleepLabels = sleepWakeTrend.map((d) => d.date);
    const alarmMinutes = sleepWakeTrend.map((d) => {
      if (!d.alarm_time) return null;
      const [h, m] = String(d.alarm_time).split(":").map(Number);
      return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
    });
    const wakeMinutes = sleepWakeTrend.map((d) => {
      if (!d.wake_up_time) return null;
      const [h, m] = String(d.wake_up_time).split(":").map(Number);
      return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
    });

    const sleepChart = sleepLabels.length
      ? (() => {
          const left = 55,
            right = 20,
            top = 38,
            bottom = 48;
          const plotW = chartWidth - left - right;
          const plotH = chartHeight - top - bottom;
          const minY = 0,
            maxY = 1440;
          const xStep =
            sleepLabels.length > 1 ? plotW / (sleepLabels.length - 1) : plotW;
          const y = (v) => top + plotH - ((v - minY) / (maxY - minY)) * plotH;
          const x = (i) =>
            sleepLabels.length === 1 ? left + plotW / 2 : left + i * xStep;
          const pathFor = (values, color) => {
            const valid = values
              .map((v, i) => (v == null ? null : { x: x(i), y: y(v) }))
              .filter(Boolean);
            if (!valid.length) return "";
            return `<path d="${valid.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ")}" fill="none" stroke="${color}" stroke-width="3"/>${valid.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}"/>`).join("")}`;
          };
          const ticks = [0, 360, 720, 1080, 1440]
            .map((v) => {
              const yy = y(v);
              const label =
                v === 0
                  ? "12 AM"
                  : v === 360
                    ? "6 AM"
                    : v === 720
                      ? "12 PM"
                      : v === 1080
                        ? "6 PM"
                        : "12 AM";
              return `<line x1="${left}" y1="${yy}" x2="${chartWidth - right}" y2="${yy}" stroke="#e2e8f0"/><text x="${left - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#64748b">${label}</text>`;
            })
            .join("");
          const xs = sleepLabels
            .map(
              (d, i) =>
                `<text x="${x(i)}" y="${chartHeight - 14}" text-anchor="middle" font-size="10" fill="#64748b">${escapeHtml(String(d).slice(5))}</text>`,
            )
            .join("");
          return `<div class="chart-block"><div class="chart-title">Sleep &amp; Wake Trend — Alarm Time vs Actual Wake-Up Time</div><svg viewBox="0 0 ${chartWidth} ${chartHeight}" class="chart-svg">${ticks}<line x1="${left}" y1="${top + plotH}" x2="${chartWidth - right}" y2="${top + plotH}" stroke="#94a3b8"/>${pathFor(alarmMinutes, "#4f46e5")}${pathFor(wakeMinutes, "#16a34a")}${xs}</svg><div class="legend"><span class="legend-item"><span class="legend-dot" style="background:#4f46e5"></span>Alarm Time</span><span class="legend-item"><span class="legend-dot" style="background:#16a34a"></span>Wake-Up Time</span></div></div>`;
        })()
      : `<div class="chart-empty">No recorded sleep/wake trend for this period.</div>`;

    const progressLabels = progressTrend.map((d) => d.date);
    const progressChart = buildLineChart(
      "Progress Monitoring — Wake-Up Consistency and Challenge Accuracy",
      progressLabels,
      [
        {
          name: "Wake-Up Consistency",
          values: progressTrend.map((d) => Number(d.wake_up_consistency) || 0),
        },
        {
          name: "Challenge Accuracy",
          values: progressTrend.map((d) => Number(d.challenge_accuracy) || 0),
        },
      ],
    );

    const typeLabels = Object.keys(typePerformance);
    const typeValues = typeLabels.map(
      (type) => Number(typePerformance[type]?.accuracy) || 0,
    );
    const difficultyLabels = Object.keys(difficultyPerformance);
    const difficultyValues = difficultyLabels.map(
      (d) => Number(difficultyPerformance[d]?.accuracy) || 0,
    );

    const activityLabels = dailyActivity.map((d) => d.date);
    const activityChart = buildLineChart(
      "Daily Activity Trend",
      activityLabels,
      [
        {
          name: "Alarms",
          values: dailyActivity.map((d) => Number(d.alarm_triggered) || 0),
        },
        {
          name: "Wake-Ups",
          values: dailyActivity.map((d) => Number(d.wake_up_completed) || 0),
        },
        {
          name: "Snoozes",
          values: dailyActivity.map((d) => Number(d.snoozed) || 0),
        },
      ],
      Math.max(
        100,
        ...dailyActivity.flatMap((d) => [
          Number(d.alarm_triggered) || 0,
          Number(d.wake_up_completed) || 0,
          Number(d.snoozed) || 0,
        ]),
      ),
      "",
    );

    reportWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>User Analytics Report - ${escapeHtml(selectedUser?.name || "User")}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; color: #1e293b; line-height: 1.45; }
          h1 { color: #4f46e5; margin-bottom: 4px; }
          h2 { margin-top: 30px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
          h3 { color: #475569; margin-top: 22px; }
          .subtitle { color: #64748b; margin-bottom: 24px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
          .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
          .label { color: #64748b; font-size: 12px; }
          .value { font-size: 22px; font-weight: 700; margin-top: 5px; }
          .note { background: #f8fafc; border-left: 4px solid #6366f1; padding: 10px 12px; margin: 12px 0; color: #475569; }
          .chart-block { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 14px 0; page-break-inside: avoid; }
          .chart-title { font-size: 16px; font-weight: 700; color: #334155; margin-bottom: 8px; }
          .chart-svg { width: 100%; max-width: 900px; height: auto; display: block; }
          .legend { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 4px; font-size: 12px; color: #475569; }
          .legend-item { display: inline-flex; align-items: center; gap: 6px; }
          .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
          .chart-empty, .empty { color: #64748b; padding: 18px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
          th { background: #f8fafc; }
          .page-break { page-break-before: always; }
          @media print { body { margin: 15mm; } .chart-block { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <h1>Intelligent Cognitive Alarm</h1>
        <h2>User Analytics Report</h2>
        <div class="subtitle">
          <strong>User:</strong> ${escapeHtml(selectedUser?.name || "Selected User")}
          &nbsp; | &nbsp; <strong>Email:</strong> ${escapeHtml(selectedUser?.email || "N/A")}
          &nbsp; | &nbsp; <strong>Period:</strong> ${escapeHtml(monthLabel)}
        </div>

        <h2>Performance Summary</h2>
        <div class="grid">
          <div class="card"><div class="label">Habit Score</div><div class="value">${escapeHtml(valueOrNA(analytics.habit_score))}</div></div>
          <div class="card"><div class="label">Challenge Accuracy</div><div class="value">${escapeHtml(valueOrNA(analytics.challenge_accuracy))}%</div></div>
          <div class="card"><div class="label">Average Attempts</div><div class="value">${escapeHtml(valueOrNA(analytics.average_attempts))}</div></div>
          <div class="card"><div class="label">Average Response Time</div><div class="value">${escapeHtml(valueOrNA(analytics.average_time_seconds))} sec</div></div>
          <div class="card"><div class="label">Wake-Up Consistency</div><div class="value">${escapeHtml(valueOrNA(analytics.wake_up_consistency))}%</div></div>
          <div class="card"><div class="label">Snooze Count</div><div class="value">${escapeHtml(valueOrNA(analytics.snooze_count))}</div></div>
          <div class="card"><div class="label">Strongest Challenge</div><div class="value">${escapeHtml(valueOrNA(analytics.strongest_challenge_type))}</div></div>
          <div class="card"><div class="label">Weakest Challenge</div><div class="value">${escapeHtml(valueOrNA(analytics.weakest_challenge_type))}</div></div>
          <div class="card"><div class="label">Alarm Count</div><div class="value">${escapeHtml(valueOrNA(analytics.alarm_count))}</div></div>
        </div>

        <h2>Sleep &amp; Wake Trend</h2>
        <div class="note">This graph compares recorded alarm times with actual wake-up event times. It does not estimate bedtime or actual sleep duration.</div>
        ${sleepChart}
        ${sleepWakeTrend.length ? `<table><thead><tr><th>Date</th><th>Alarm Time</th><th>Wake-Up Time</th><th>Wake-Up Delay</th><th>Consistency</th></tr></thead><tbody>${sleepWakeTrend.map((day) => `<tr><td>${escapeHtml(day.date)}</td><td>${escapeHtml(valueOrNA(day.alarm_time))}</td><td>${escapeHtml(valueOrNA(day.wake_up_time))}</td><td>${escapeHtml(valueOrNA(day.wake_up_delay_minutes))}${day.wake_up_delay_minutes != null ? " min" : ""}</td><td>${escapeHtml(valueOrNA(day.wake_up_consistency))}%</td></tr>`).join("")}</tbody></table>` : ""}

        <h2>Progress Monitoring</h2>
        <div class="grid">
          <div class="card"><div class="label">Current Habit Score</div><div class="value">${escapeHtml(valueOrNA(progressMonitoring.habit_score ?? analytics.habit_score))}</div></div>
          <div class="card"><div class="label">Current Wake-Up Consistency</div><div class="value">${escapeHtml(valueOrNA(progressMonitoring.wake_up_consistency ?? analytics.wake_up_consistency))}%</div></div>
          <div class="card"><div class="label">Current Challenge Accuracy</div><div class="value">${escapeHtml(valueOrNA(progressMonitoring.challenge_accuracy ?? analytics.challenge_accuracy))}%</div></div>
        </div>
        ${progressChart}

        <h2 class="page-break">Challenge Performance</h2>
        ${buildBarChart("Challenge Accuracy by Type", typeLabels, typeValues)}
        ${
          typeLabels.length
            ? `<table><thead><tr><th>Challenge Type</th><th>Total</th><th>Correct</th><th>Accuracy</th></tr></thead><tbody>${typeLabels
                .map((type) => {
                  const v = typePerformance[type] || {};
                  return `<tr><td>${escapeHtml(type)}</td><td>${v.total ?? 0}</td><td>${v.correct ?? 0}</td><td>${v.accuracy ?? 0}%</td></tr>`;
                })
                .join("")}</tbody></table>`
            : ""
        }

        <h2>Difficulty Progress</h2>
        ${buildBarChart("Challenge Accuracy by Difficulty", difficultyLabels, difficultyValues)}
        ${
          difficultyLabels.length
            ? `<table><thead><tr><th>Difficulty</th><th>Total</th><th>Correct</th><th>Accuracy</th></tr></thead><tbody>${difficultyLabels
                .map((d) => {
                  const v = difficultyPerformance[d] || {};
                  return `<tr><td>${escapeHtml(d)}</td><td>${v.total ?? 0}</td><td>${v.correct ?? 0}</td><td>${v.accuracy ?? 0}%</td></tr>`;
                })
                .join("")}</tbody></table>`
            : ""
        }

        <h2>Daily Activity</h2>
        ${activityChart}
        ${dailyActivity.length ? `<table><thead><tr><th>Date</th><th>Alarms</th><th>Wake-Ups</th><th>Snoozes</th><th>Challenges</th><th>Wake Consistency</th><th>Challenge Accuracy</th></tr></thead><tbody>${dailyActivity.map((day) => `<tr><td>${escapeHtml(day.date)}</td><td>${day.alarm_triggered ?? 0}</td><td>${day.wake_up_completed ?? 0}</td><td>${day.snoozed ?? 0}</td><td>${day.challenge_answered ?? 0}</td><td>${day.wake_up_consistency ?? 0}%</td><td>${day.challenge_accuracy ?? 0}%</td></tr>`).join("")}</tbody></table>` : '<p class="empty">No daily activity recorded for this period.</p>'}

        <h2>Coach Recommendation</h2>
        <p>${escapeHtml(coachRecommendation || analytics.latest_recommendation?.recommendation || "No recommendation entered.")}</p>
      </body>
      </html>
    `);

    // Keep exactly ONE Daily Activity details table in the generated report.
    // This removes any duplicate Daily Activity table that may be present from
    // an older/merged report block while keeping the final table.
    const dailyTables = reportWindow.document.querySelectorAll("h2");
    const dailyActivityHeadings = Array.from(dailyTables).filter(
      (heading) => heading.textContent.trim() === "Daily Activity",
    );

    if (dailyActivityHeadings.length > 1) {
      dailyActivityHeadings.slice(0, -1).forEach((heading) => {
        let node = heading.nextElementSibling;
        while (node && node.tagName !== "H2") {
          const next = node.nextElementSibling;
          node.remove();
          node = next;
        }
        heading.remove();
      });
    }

    reportWindow.document.close();
    reportWindow.focus();
    setTimeout(() => reportWindow.print(), 300);
  };

  const getAdminUsers = async (currentToken = token) => {
    if (!currentToken) return;

    setAdminUsersLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not load accounts");
        return;
      }

      setAdminUsers(data);
    } catch {
      setMessage("Cannot connect to backend for account management");
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const deleteAdminUser = async (accountUserId) => {
    const selectedUser = adminUsers.find(
      (item) => Number(item.user_id) === Number(accountUserId),
    );

    if (!selectedUser) return;

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the account for ${selectedUser.name} (${selectedUser.email})?\n\nThis will remove the account and its stored profile, alarms, recommendations, challenge results, notifications, and behavioral history.`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/admin/users/${accountUserId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not delete account");
        return;
      }

      setAdminUsers((current) =>
        current.filter(
          (item) => Number(item.user_id) !== Number(accountUserId),
        ),
      );

      setMessage(`Account for ${selectedUser.name} deleted successfully`);
      getAdminAnalytics(token);
      getAdminRecommendations(token);
    } catch {
      setMessage("Cannot connect to backend for account deletion");
    }
  };

  const getAdminStatus = async (currentToken = token) => {
    try {
      const response = await fetch(`${API_URL}/admin-test`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const data = await response.json();

      if (!response.ok) {
        setAdminMessage(data.detail || "Admin access failed");
        return;
      }

      setAdminMessage("");
    } catch {
      setAdminMessage("Cannot connect to backend");
    }
  };

  const getAdminAnalytics = async (
    currentToken = token,
    startDate = adminAppliedStartDate,
    endDate = adminAppliedEndDate,
  ) => {
    if (!currentToken) return;

    setAdminAnalyticsLoading(true);

    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const response = await fetch(
        `${API_URL}/admin/executive-analytics?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${currentToken}` },
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not load executive analytics");
        return;
      }

      setAdminAnalytics(data);
    } catch {
      setMessage("Cannot connect to backend for executive analytics");
    } finally {
      setAdminAnalyticsLoading(false);
    }
  };

  const getAdminRecommendations = async (
    currentToken = token,
    startDate = adminAppliedStartDate,
    endDate = adminAppliedEndDate,
  ) => {
    if (!currentToken) return;

    setAdminRecommendationsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const response = await fetch(
        `${API_URL}/admin/recommendations?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${currentToken}` },
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not load recommendation monitoring");
        return;
      }

      setAdminRecommendations(data);
    } catch {
      setMessage("Cannot connect to backend for recommendation monitoring");
    } finally {
      setAdminRecommendationsLoading(false);
    }
  };

  const applyAdminDateFilter = () => {
    if (!adminStartDate || !adminEndDate) {
      setMessage("Please select both From Date and To Date");
      return;
    }

    const today = getLocalDateString();
    if (adminStartDate > today || adminEndDate > today) {
      setMessage("Future dates cannot be selected");
      return;
    }

    if (adminStartDate > adminEndDate) {
      setMessage("From Date cannot be after To Date");
      return;
    }

    setAdminAppliedStartDate(adminStartDate);
    setAdminAppliedEndDate(adminEndDate);
    getAdminAnalytics(token, adminStartDate, adminEndDate);
    getAdminRecommendations(token, adminStartDate, adminEndDate);
  };

  const downloadAdminReport = async (format) => {
    if (!token) return;

    setAdminReportLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        start_date: adminAppliedStartDate,
        end_date: adminAppliedEndDate,
      });

      const response = await fetch(
        `${API_URL}/admin/reports/${format}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        let errorMessage = "Could not generate report";
        try {
          const data = await response.json();
          errorMessage = data.detail || errorMessage;
        } catch {
          // Keep default error message.
        }
        setMessage(errorMessage);
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download =
        format === "pdf"
          ? "cognitive_alarm_executive_report.pdf"
          : "cognitive_alarm_executive_report.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setMessage(
        format === "pdf"
          ? "PDF report downloaded successfully"
          : "Excel report downloaded successfully",
      );
    } catch {
      setMessage("Cannot connect to backend for report generation");
    } finally {
      setAdminReportLoading(false);
    }
  };

  // =========================================================
  // COGNITIVE CHALLENGE FUNCTIONS - 7B
  // =========================================================

  useEffect(() => {
    if (!currentChallenge || currentChallenge.challenge_type !== "memory") {
      setMemorySequenceVisible(false);
      return;
    }

    setMemorySequenceVisible(true);
    const timer = setTimeout(() => {
      setMemorySequenceVisible(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, [currentChallenge]);

  const generateChallenge = async () => {
    if (!token) {
      setMessage("Please login first");
      return;
    }

    setChallengeLoading(true);
    setChallengeResult(null);
    setChallengeAnswer("");

    try {
      const response = await fetch(`${API_URL}/challenges/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          challenge_type: challengeType,
          difficulty: challengeDifficulty,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not generate challenge");
        return;
      }

      setCurrentChallenge(data);
      setChallengeStartTime(Date.now());
      setMessage("");
    } catch (error) {
      setMessage("Cannot connect to backend");
    } finally {
      setChallengeLoading(false);
    }
  };

  const submitChallenge = async () => {
    if (!currentChallenge) {
      setMessage("Generate a challenge first");
      return;
    }

    if (!challengeAnswer.trim()) {
      setMessage("Enter your answer");
      return;
    }

    const timeTaken = challengeStartTime
      ? Math.floor((Date.now() - challengeStartTime) / 1000)
      : null;

    try {
      const response = await fetch(
        `${API_URL}/challenges/${currentChallenge.id}/answer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            answer: challengeAnswer.trim(),
            time_taken: timeTaken,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Could not submit answer");
        return;
      }

      setChallengeResult(data);
      setMessage("");
    } catch (error) {
      setMessage("Cannot connect to backend");
    }
  };

  const resetChallenge = () => {
    setCurrentChallenge(null);
    setChallengeAnswer("");
    setChallengeResult(null);
    setChallengeStartTime(null);
    setMessage("");
  };
  const formatTime = (value) => {
    if (!value) return "--:--";
    const [hour, minute] = value.substring(0, 5).split(":");
    const date = new Date();
    date.setHours(Number(hour), Number(minute), 0, 0);
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const activeAlarms = alarms.filter((alarm) => alarm.is_active).length;

  const register = async () => {
    if (
      !registerName.trim() ||
      !registerEmail.trim() ||
      !registerPassword ||
      !confirmPassword
    ) {
      setMessage("Please fill all registration fields");
      return;
    }

    if (registerPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    if (registerPassword.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerName.trim(),
          email: registerEmail.trim(),
          password: registerPassword,
          role: registerRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Registration failed");
        return;
      }

      // Registration succeeded. Return to login.
      setEmail(registerEmail.trim());
      setPassword("");
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setConfirmPassword("");
      setRegisterRole("user");
      setShowRegister(false);
      setMessage("Registration successful. Please login.");
    } catch {
      setMessage("Cannot connect to backend");
    }
  };

  // ---------------- LOGIN / REGISTER ----------------
  if (!token) {
    return (
      <div className="app-shell auth-shell">
        <div className="brand brand-center">
          <div className="brand-icon">🧠</div>
          <div>
            <h1>Intelligent Cognitive Alarm Platform</h1>
          </div>
        </div>

        <div className="login-layout">
          <div className="panel login-card">
            {showRegister ? (
              <>
                <h2>Register</h2>
                <p className="muted">Create an account to use the platform.</p>

                <label className="role-title">Select Your Role</label>
                <div className="role-options">
                  <button
                    type="button"
                    className={`role-option user-role ${registerRole === "user" ? "selected" : ""}`}
                    onClick={() => setRegisterRole("user")}
                  >
                    <span className="role-option-icon">👤</span>
                    <span>User</span>
                  </button>

                  <button
                    type="button"
                    className={`role-option admin-role ${registerRole === "admin" ? "selected" : ""}`}
                    onClick={() => setRegisterRole("admin")}
                  >
                    <span className="role-option-icon">🛡️</span>
                    <span>Admin</span>
                  </button>

                  <button
                    type="button"
                    className={`role-option coach-role ${registerRole === "wellness_coach" ? "selected" : ""}`}
                    onClick={() => setRegisterRole("wellness_coach")}
                  >
                    <span className="role-option-icon">👨‍💼</span>
                    <span>Coach</span>
                  </button>
                </div>

                <label>Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                />

                <label>Email</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                />

                <label>Password</label>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                />

                <label>Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                <button className="primary-btn full-btn" onClick={register}>
                  Register
                </button>

                {message && <div className="status-message">{message}</div>}

                <button
                  type="button"
                  className="text-link auth-switch"
                  onClick={() => {
                    setShowRegister(false);
                    setMessage("");
                  }}
                >
                  Already have an account? Login
                </button>
              </>
            ) : (
              <>
                <h2>Login</h2>
                <p className="muted">
                  Use your registered account to continue.
                </p>

                <label>Email</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <label>Password</label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button className="primary-btn full-btn" onClick={login}>
                  Login
                </button>

                {message && <div className="status-message">{message}</div>}

                <button
                  type="button"
                  className="text-link auth-switch"
                  onClick={() => {
                    setShowRegister(true);
                    setMessage("");
                  }}
                >
                  No account? Register
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------- USER ----------------
  if (role === "user") {
    const renderUserPage = () => {
      if (page === "dashboard") {
        return (
          <>
            <section className="welcome-section text-center py-8 md:py-10">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                Hello, {userName} 👋
              </h2>
            </section>

            <section className="stats-grid grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <div className="stat-card blue rounded-2xl border border-sky-100 shadow-sm p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <span className="stat-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-2xl shadow-sm">
                  ⏰
                </span>
                <div className="min-w-0">
                  <small>Alarms</small>
                  <strong>{alarms.length}</strong>
                  <span>{activeAlarms} active</span>
                </div>
              </div>

              <div className="stat-card green rounded-2xl border border-emerald-100 shadow-sm p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <span className="stat-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-2xl shadow-sm">
                  😴
                </span>
                <div className="min-w-0">
                  <small>Sleep Score</small>
                  <strong>{sleepDuration || "—"}</strong>
                  <span>{sleepDuration ? "hours" : "Set profile"}</span>
                </div>
              </div>

              <div className="stat-card purple rounded-2xl border border-violet-100 shadow-sm p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <span className="stat-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-2xl shadow-sm">
                  🧠
                </span>
                <div className="min-w-0">
                  <small>Difficulty</small>
                  <strong>{difficultyPreference || "—"}</strong>
                  <span>Cognitive level</span>
                </div>
              </div>

              <div className="stat-card orange rounded-2xl border border-orange-100 shadow-sm p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <span className="stat-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-2xl shadow-sm">
                  🎯
                </span>
                <div className="min-w-0">
                  <small>Wake Time</small>
                  <strong>{formatTime(wakeUpTime)}</strong>
                  <span>Preferred time</span>
                </div>
              </div>
            </section>

            <section className="panel mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
              <div className="section-heading flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 md:text-2xl">
                    Upcoming alarms
                  </h3>
                </div>
                <button
                  className="primary-btn compact rounded-xl shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                  onClick={() => {
                    setEditingAlarmId(null);
                    setAlarmTime("");
                    setAlarmName("");
                    setRepeatType("daily");
                    setRepeatDays([]);
                    setPage("add-alarm");
                  }}
                >
                  + Add Alarm
                </button>
              </div>

              <div className="alarm-list mt-5 grid gap-4">
                {alarms.length === 0 ? (
                  <div className="empty-state rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    No alarms found.
                  </div>
                ) : (
                  alarms
                    .slice(0, 3)
                    .map((alarm) => (
                      <AlarmCard
                        key={alarm.alarm_id}
                        alarm={alarm}
                        formatTime={formatTime}
                        formatRepeat={formatRepeat}
                        toggleAlarm={toggleAlarm}
                        editAlarm={editAlarm}
                        deleteAlarm={deleteAlarm}
                      />
                    ))
                )}
              </div>

              <button
                className="text-link mt-5 inline-flex items-center font-semibold transition-colors hover:text-violet-600"
                onClick={() => setPage("alarms")}
              >
                View all alarms →
              </button>
            </section>
          </>
        );
      }

      if (page === "habits") {
        const performance = behavioralAnalytics?.performance || {};
        const dailyActivity = behavioralAnalytics?.daily_activity || [];
        const wakeBehavior = behavioralAnalytics?.wake_up_behavior || {};
        const snoozeBehavior = behavioralAnalytics?.snooze_behavior || {};

        return (
          <section className="page-section">
            <div className="page-title-row">
              <div>
                <h2>Habits & Behavioral Analytics</h2>
              </div>
              <button
                className="ghost-btn"
                onClick={() => getHabitDashboard()}
                disabled={habitLoading}
              >
                {habitLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                margin: "20px 0",
              }}
            >
              <button
                className={habitView === "habit" ? "primary-btn" : "ghost-btn"}
                onClick={() => setHabitView("habit")}
              >
                Habit Tracking
              </button>
              <button
                className={
                  habitView === "behavior" ? "primary-btn" : "ghost-btn"
                }
                onClick={() => setHabitView("behavior")}
              >
                Behavioral Analytics
              </button>
              <button
                className={
                  habitView === "recommendation" ? "primary-btn" : "ghost-btn"
                }
                onClick={() => setHabitView("recommendation")}
              >
                Recommendation
              </button>
            </div>

            {habitLoading && !habitScore ? (
              <div className="panel empty-state">
                Loading habit analytics...
              </div>
            ) : habitView === "habit" ? (
              <>
                <section className="stats-grid">
                  <div className="stat-card purple">
                    <span className="stat-icon">🏆</span>
                    <div>
                      <small>Habit Score</small>
                      <strong>{habitScore?.habit_score ?? "—"}</strong>
                      <span>Overall habit performance</span>
                    </div>
                  </div>

                  <div className="stat-card purple">
                    <span className="stat-icon">🎯</span>
                    <div>
                      <small>Challenge Accuracy</small>
                      <strong>
                        {habitScore ? `${habitScore.accuracy_score}%` : "—"}
                      </strong>
                      <span>Correct challenge answers</span>
                    </div>
                  </div>

                  <div className="stat-card green">
                    <span className="stat-icon">⏰</span>
                    <div>
                      <small>Wake-Up Consistency</small>
                      <strong>
                        {habitScore?.wake_up_consistency_score != null
                          ? `${habitScore.wake_up_consistency_score}%`
                          : wakeBehavior.wake_up_consistency_percentage != null
                            ? `${wakeBehavior.wake_up_consistency_percentage}%`
                            : "—"}
                      </strong>
                      <span>Alarm completion behavior</span>
                    </div>
                  </div>
                </section>

                <HabitMetricsCharts habitScore={habitScore} />

                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h3>Challenge Performance</h3>
                    </div>
                    <span className="section-icon">🧠</span>
                  </div>
                  {challengeAnalytics && (
                    <div style={{ marginTop: "30px" }}>
                      <ChallengePerformanceChart
                        analytics={challengeAnalytics}
                      />
                    </div>
                  )}
                  {Object.keys(performance).length > 0 ? (
                    <div
                      style={{
                        display: "grid",
                        gap: "18px",
                        marginTop: "10px",
                      }}
                    >
                      {[
                        "math",
                        "logic",
                        "memory",
                        "word",
                        "pattern",
                        "riddle",
                        "quiz",
                      ].map((type) => {
                        const stats = performance[type] || {
                          accuracy: 0,
                          correct: 0,
                          total: 0,
                        };
                        return (
                          <div key={type}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "12px",
                                marginBottom: "7px",
                              }}
                            >
                              <strong>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </strong>
                              <span>{stats.accuracy}%</span>
                            </div>
                            <div
                              style={{
                                height: "10px",
                                background: "#e9edf5",
                                borderRadius: "999px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(Number(stats.accuracy) || 0, 100)}%`,
                                  height: "100%",
                                  background:
                                    "linear-gradient(90deg, #6366f1, #06b6d4)",
                                  borderRadius: "999px",
                                }}
                              />
                            </div>
                            <small
                              style={{ display: "block", marginTop: "6px" }}
                            >
                              {stats.correct} correct / {stats.total} attempts
                            </small>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      No challenge performance data available yet.
                    </div>
                  )}
                </section>
              </>
            ) : habitView === "behavior" ? (
              <>
                {/* BEHAVIOR SUMMARY */}
                <section className="stats-grid">
                  <div className="stat-card blue">
                    <span className="stat-icon">🔔</span>
                    <div>
                      <small>Alarm Triggers</small>
                      <strong>{wakeBehavior.alarm_trigger_count ?? 0}</strong>
                      <span>Total recorded alarms</span>
                    </div>
                  </div>

                  <div className="stat-card orange">
                    <span className="stat-icon">😴</span>
                    <div>
                      <small>Snooze Count</small>
                      <strong>{snoozeBehavior.snooze_count ?? 0}</strong>
                      <span>{snoozeBehavior.status || "No data"}</span>
                    </div>
                  </div>

                  <div className="stat-card green">
                    <span className="stat-icon">⏰</span>
                    <div>
                      <small>Wake-Up Consistency</small>
                      <strong>
                        {wakeBehavior.wake_up_consistency_percentage != null
                          ? `${wakeBehavior.wake_up_consistency_percentage}%`
                          : "0%"}
                      </strong>
                      <span>Completed wake-ups / alarm triggers</span>
                    </div>
                  </div>

                  <div className="stat-card purple">
                    <span className="stat-icon">📈</span>
                    <div>
                      <small>Snooze Rate</small>
                      <strong>
                        {snoozeBehavior.snooze_rate_percentage ?? 0}%
                      </strong>
                      <span>Based on alarm triggers</span>
                    </div>
                  </div>
                </section>

                {/* BEHAVIOR PATTERNS */}
                <BehavioralPatternCharts
                  behavioralAnalytics={behavioralAnalytics}
                />

                <section className="panel" style={{ marginBottom: "20px" }}>
                  <div className="section-heading">
                    <div>
                      <h3>Behavioral Activity Period</h3>
                    </div>
                    <span className="section-icon">🗓️</span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                      alignItems: "center",
                      marginTop: "14px",
                    }}
                  >
                    {["daily", "weekly", "monthly", "custom"].map((period) => (
                      <button
                        key={period}
                        className={
                          behaviorPeriod === period
                            ? "primary-btn"
                            : "ghost-btn"
                        }
                        onClick={() => changeBehaviorPeriod(period)}
                        disabled={behaviorHistoryLoading}
                      >
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                      </button>
                    ))}
                  </div>

                  {behaviorPeriod !== "custom" ? (
                    <div
                      style={{
                        display: "flex",
                        gap: "14px",
                        flexWrap: "wrap",
                        alignItems: "center",
                        marginTop: "14px",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 14px",
                          borderRadius: "12px",
                          background: "#f4efff",
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ fontSize: "20px" }}>📅</span>
                        <span>Select date</span>

                        {behaviorPeriod === "monthly" ? (
                          <input
                            type="month"
                            value={behaviorAnchorDate.slice(0, 7)}
                            max={getLocalDateString().slice(0, 7)}
                            onChange={(event) =>
                              selectBehaviorMonth(event.target.value)
                            }
                            disabled={behaviorHistoryLoading}
                            style={{
                              padding: "8px 10px",
                              borderRadius: "8px",
                              border: "1px solid #ddd6fe",
                              background: "white",
                              fontWeight: 600,
                            }}
                          />
                        ) : (
                          <input
                            type="date"
                            value={behaviorAnchorDate}
                            max={getLocalDateString()}
                            onChange={(event) =>
                              selectBehaviorCalendarDate(event.target.value)
                            }
                            disabled={behaviorHistoryLoading}
                            style={{
                              padding: "8px 10px",
                              borderRadius: "8px",
                              border: "1px solid #ddd6fe",
                              background: "white",
                              fontWeight: 600,
                            }}
                          />
                        )}
                      </label>

                      <strong>
                        {behavioralAnalytics?.period_label || "Current period"}
                      </strong>

                      <button
                        className="ghost-btn"
                        onClick={goToCurrentBehaviorPeriod}
                        disabled={behaviorHistoryLoading}
                      >
                        📍 Today
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        alignItems: "end",
                        marginTop: "14px",
                      }}
                    >
                      <label style={{ display: "grid", gap: "6px" }}>
                        <span>From</span>
                        <input
                          type="date"
                          value={behaviorCustomStart}
                          max={getLocalDateString()}
                          onChange={(event) =>
                            setBehaviorCustomStart(event.target.value)
                          }
                        />
                      </label>

                      <label style={{ display: "grid", gap: "6px" }}>
                        <span>To</span>
                        <input
                          type="date"
                          value={behaviorCustomEnd}
                          max={getLocalDateString()}
                          onChange={(event) =>
                            setBehaviorCustomEnd(event.target.value)
                          }
                        />
                      </label>

                      <button
                        className="primary-btn"
                        onClick={applyCustomBehaviorRange}
                        disabled={behaviorHistoryLoading}
                      >
                        {behaviorHistoryLoading ? "Loading..." : "Apply Range"}
                      </button>
                    </div>
                  )}

                  {behaviorHistoryLoading && (
                    <p style={{ marginTop: "12px" }}>
                      Loading selected history...
                    </p>
                  )}
                </section>

                {/* 3. SELECTED PERIOD — graph comes after the filter */}
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h3>Behavioral Activity Trend</h3>
                    </div>
                    <span className="section-icon">📈</span>
                  </div>

                  <div style={{ marginTop: "24px" }}>
                    <BehavioralTrendChart
                      dailyActivity={dailyActivity}
                      period={behaviorPeriod}
                    />
                  </div>
                </section>

                {/* 4. HISTORY RECORDS */}
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h3>Behavioral Activity History</h3>
                    </div>
                    <span className="section-icon">📅</span>
                  </div>

                  <p style={{ marginTop: 0, opacity: 0.75 }}>
                    {behavioralAnalytics?.period_label || "Selected period"} —
                    showing all available daily records in this period.
                  </p>

                  {dailyActivity.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{ width: "100%", borderCollapse: "collapse" }}
                      >
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", padding: "10px" }}>
                              Date
                            </th>
                            <th>Events</th>
                            <th>Alarms</th>
                            <th>Snoozes</th>
                            <th>Wake-Ups</th>
                            <th>Challenges</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyActivity.map((day) => (
                            <tr key={day.date}>
                              <td style={{ padding: "10px" }}>{day.date}</td>
                              <td>{day.events}</td>
                              <td>{day.alarm_triggered}</td>
                              <td>{day.snoozed}</td>
                              <td>{day.wake_up_completed}</td>
                              <td>{day.challenge_answered}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">
                      No daily activity recorded yet.
                    </div>
                  )}
                </section>
              </>
            ) : (
              <section className="panel">
                <div className="section-heading">
                  <div></div>
                  <span className="section-icon">💡</span>
                </div>
                {currentRecommendation ? (
                  <div className="recommendation-card">
                    <div className="recommendation-icon">💡</div>
                    <div style={{ width: "100%" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "12px",
                        }}
                      >
                        <strong>{"Based on your latest activity"}</strong>
                      </div>
                      <p>{currentRecommendation}</p>
                      {currentRecommendationCreatedAt && (
                        <small>
                          {new Date(
                            currentRecommendationCreatedAt,
                          ).toLocaleString()}
                        </small>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    No recommendation available yet. Complete some activity
                    first.
                  </div>
                )}

                <section
                  className="panel"
                  style={{
                    marginTop: "24px",
                    background: "#f8fafc",
                  }}
                >
                  <div className="section-heading">
                    <div>
                      <p
                        style={{
                          margin: "6px 0 0",
                          color: "#64748b",
                        }}
                      ></p>
                    </div>
                  </div>

                  {recommendationHistory.length > 1 ? (
                    <div
                      style={{
                        display: "grid",
                        gap: "12px",
                        marginTop: "20px",
                      }}
                    >
                      {recommendationHistory.slice(1, 3).map((item, index) => (
                        <div
                          key={`${item.created_at || "recommendation"}-${index}`}
                          className="recommendation-card"
                          style={{ margin: 0 }}
                        >
                          <div className="recommendation-icon">🗂️</div>
                          <div style={{ width: "100%" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "12px",
                                flexWrap: "wrap",
                              }}
                            >
                              <strong>
                                {item.recommendation_area ||
                                  "Personalized Guidance"}
                              </strong>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                <small>
                                  {item.created_at
                                    ? new Date(item.created_at).toLocaleString()
                                    : "Date/time unavailable"}
                                </small>
                              </div>
                            </div>
                            <p style={{ marginBottom: 0 }}>
                              {item.recommendation}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ marginTop: "18px" }}>
                      No previous recommendations yet. A new history entry will
                      appear when the recommendation changes.
                    </div>
                  )}
                </section>
              </section>
            )}
          </section>
        );
      }

      if (page === "alarms") {
        return (
          <section className="page-section">
            <div className="page-title-row">
              <div>
                <h2>My Alarms</h2>
              </div>
              <button
                className="primary-btn"
                onClick={() => setPage("add-alarm")}
              >
                + Add Alarm
              </button>
            </div>

            <div className="alarm-list large-list">
              {alarms.length === 0 ? (
                <div className="empty-state">No alarms found.</div>
              ) : (
                alarms.map((alarm) => (
                  <AlarmCard
                    key={alarm.alarm_id}
                    alarm={alarm}
                    formatTime={formatTime}
                    formatRepeat={formatRepeat}
                    toggleAlarm={toggleAlarm}
                    editAlarm={editAlarm}
                    deleteAlarm={deleteAlarm}
                  />
                ))
              )}
            </div>

            <button className="ghost-btn" onClick={() => getAlarms()}>
              Refresh Alarms
            </button>
          </section>
        );
      }

      if (page === "add-alarm") {
        return (
          <section className="page-section narrow-page">
            <button className="back-btn" onClick={cancelEdit}>
              ← Back
            </button>

            <div className="panel form-panel">
              <h2>{editingAlarmId ? "Edit Alarm" : "Add Alarm"}</h2>

              <label>Alarm Name</label>
              <input
                type="text"
                placeholder="Morning Alarm"
                value={alarmName}
                onChange={(e) => setAlarmName(e.target.value)}
              />

              <label>Time</label>
              <input
                type="time"
                value={alarmTime}
                onChange={(e) => setAlarmTime(e.target.value)}
              />

              <div className="fake-field-row">
                <div>
                  <label>Repeat</label>
                  <select
                    value={repeatType}
                    onChange={(e) => {
                      setRepeatType(e.target.value);
                      if (e.target.value !== "custom") {
                        setRepeatDays([]);
                      }
                    }}
                    className="readonly-field"
                  >
                    <option value="daily">Every day</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekends">Weekends</option>
                    <option value="custom">Custom</option>
                  </select>

                  {repeatType === "custom" && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                        marginTop: "8px",
                      }}
                    >
                      {[
                        ["monday", "Mon"],
                        ["tuesday", "Tue"],
                        ["wednesday", "Wed"],
                        ["thursday", "Thu"],
                        ["friday", "Fri"],
                        ["saturday", "Sat"],
                        ["sunday", "Sun"],
                      ].map(([day, label]) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleRepeatDay(day)}
                          className={
                            repeatDays.includes(day)
                              ? "primary-btn"
                              : "outline-btn"
                          }
                          style={{
                            padding: "6px 10px",
                            minWidth: "42px",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label>Challenge Type</label>
                  <div className="readonly-field">Cognitive Challenge</div>
                </div>
              </div>

              <label>Snooze</label>
              <div className="readonly-field">5 minutes</div>

              <div className="button-row">
                <button
                  className="primary-btn full-btn"
                  onClick={editingAlarmId ? updateAlarm : createAlarm}
                >
                  {editingAlarmId ? "Update Alarm" : "Save Alarm"}
                </button>
                {editingAlarmId && (
                  <button className="outline-btn full-btn" onClick={cancelEdit}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </section>
        );
      }

      if (page === "profile") {
        return (
          <section className="page-section narrow-page">
            <div className="page-title-row">
              <div>
                <h2>My Profile</h2>
              </div>
              <div className="profile-avatar">👤</div>
            </div>

            <div className="panel form-panel">
              <div className="profile-name">
                <div className="large-avatar">👤</div>
                <div>
                  <h3>{userName}</h3>
                  <p>Test User</p>
                </div>
              </div>

              <div className="profile-grid">
                <div>
                  <label>Preferred Wake-up Time</label>
                  <input
                    type="time"
                    value={wakeUpTime}
                    disabled={profileSaved && !profileEditing}
                    onChange={(e) => setWakeUpTime(e.target.value)}
                  />
                </div>

                <div>
                  <label>Sleep Duration (hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    placeholder="8"
                    value={sleepDuration}
                    disabled={profileSaved && !profileEditing}
                    onChange={(e) => setSleepDuration(e.target.value)}
                  />
                </div>

                <div>
                  <label>Time Zone</label>
                  <input
                    type="text"
                    value={timeZone}
                    disabled={profileSaved && !profileEditing}
                    onChange={(e) => setTimeZone(e.target.value)}
                  />
                </div>

                <div>
                  <label>Difficulty Preference</label>
                  <select
                    value={difficultyPreference}
                    disabled={profileSaved && !profileEditing}
                    onChange={(e) => setDifficultyPreference(e.target.value)}
                  >
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </div>

                <div className="full-span">
                  <label>Productivity Goal</label>
                  <input
                    type="text"
                    placeholder="Improve daily productivity"
                    value={productivityGoal}
                    disabled={profileSaved && !profileEditing}
                    onChange={(e) => setProductivityGoal(e.target.value)}
                  />
                </div>

                <div className="full-span">
                  <label>Habit Preferences</label>
                  <textarea
                    rows="4"
                    placeholder="Exercise, meditation, reading..."
                    value={habitPreferences}
                    disabled={profileSaved && !profileEditing}
                    onChange={(e) => setHabitPreferences(e.target.value)}
                  />
                </div>
              </div>

              <button
                className="primary-btn full-btn"
                onClick={() => {
                  if (profileSaved && !profileEditing) {
                    setProfileEditing(true);
                  } else {
                    saveProfile();
                  }
                }}
              >
                {profileSaved && !profileEditing
                  ? "✏️ Edit Profile"
                  : profileSaved && profileEditing
                    ? "Save Changes"
                    : "Save Profile"}
              </button>
            </div>
          </section>
        );
      }

      if (page === "coach") {
        return (
          <section className="page-section narrow-page">
            <div className="coach-header">
              <div className="coach-avatar large">👩‍⚕️</div>
              <div>
                <h2>Wellness Coach</h2>
              </div>
            </div>

            <div className="recommendation-list">
              {recommendations.length === 0 ? (
                <div className="empty-state">
                  No recommendations yet. Your coach can add personalized
                  guidance.
                </div>
              ) : (
                recommendations.map((rec, index) => (
                  <div
                    className="recommendation-card"
                    key={rec.recommendation_id}
                  >
                    <div className="recommendation-icon">💡</div>
                    <div style={{ width: "100%" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "12px",
                        }}
                      >
                        <div>
                          {index === 0 && (
                            <strong>Recommendation for You</strong>
                          )}
                          <p>{rec.recommendation}</p>
                          <small>{rec.created_at}</small>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button className="ghost-btn" onClick={() => getRecommendations()}>
              Refresh Recommendations
            </button>
          </section>
        );
      }

      if (page === "challenges") {
        return (
          <section className="page-section">
            <div className="page-title-row">
              <div>
                <h2>Challenges</h2>
              </div>
            </div>

            {/* =====================================================
                CHALLENGE SETUP
                ===================================================== */}

            {!currentChallenge && !challengeResult && (
              <div className="panel challenge-panel">
                <div className="challenge-icon-large">🧠</div>

                <h2>Cognitive Challenge</h2>

                <div className="challenge-form">
                  <div>
                    <label>Challenge Type</label>

                    <select
                      value={challengeType}
                      onChange={(e) => setChallengeType(e.target.value)}
                    >
                      <option value="math">🧮 Math Problems</option>
                      <option value="logic">🧩 Logic Puzzles</option>
                      <option value="memory">🧠 Memory Challenges</option>
                      <option value="word">🔤 Word Games</option>
                      <option value="pattern">🔢 Pattern Recognition</option>
                      <option value="riddle">💡 Riddles</option>
                      <option value="quiz">❓ Quick Quizzes</option>
                    </select>
                  </div>

                  <div>
                    <label>Difficulty</label>

                    <select
                      value={challengeDifficulty}
                      onChange={(e) => setChallengeDifficulty(e.target.value)}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <button
                  className="primary-btn full-btn"
                  onClick={generateChallenge}
                  disabled={challengeLoading}
                >
                  {challengeLoading ? "Generating..." : "Start Challenge"}
                </button>
              </div>
            )}

            {/* =====================================================
                ACTIVE CHALLENGE
                ===================================================== */}

            {currentChallenge && !challengeResult && (
              <div className="panel challenge-question-panel">
                <div className="challenge-top">
                  <div>
                    <span className="eyebrow">
                      {currentChallenge.challenge_type}
                    </span>

                    <h2>Solve the Challenge</h2>
                  </div>

                  <span className="difficulty-badge">
                    {currentChallenge.difficulty}
                  </span>
                </div>

                <div className="challenge-question">
                  {currentChallenge.challenge_type === "memory"
                    ? (() => {
                        const match = String(
                          currentChallenge.question || "",
                        ).match(
                          /^Remember this sequence:\s*(.*?)\.\s*(What is.*)$/i,
                        );

                        if (!match) {
                          return currentChallenge.question;
                        }

                        return memorySequenceVisible
                          ? `Remember this sequence: ${match[1]}`
                          : match[2];
                      })()
                    : currentChallenge.question}
                </div>

                {currentChallenge.challenge_type === "memory" &&
                memorySequenceVisible ? (
                  <p
                    style={{
                      textAlign: "center",
                      color: "#64748b",
                      margin: "18px 0 0",
                      fontSize: "14px",
                    }}
                  >
                    Memorize the sequence. It will disappear in a few seconds.
                  </p>
                ) : (
                  <>
                    <label>Your Answer</label>

                    {currentChallenge.challenge_type === "quiz" ? (
                      <div className="quiz-options">
                        {currentChallenge.options
                          ?.split("|")
                          .map((option) => option.trim())
                          .filter(Boolean)
                          .map((option, index) => (
                            <button
                              key={index}
                              type="button"
                              className={`quiz-option ${
                                challengeAnswer === option ? "selected" : ""
                              }`}
                              onClick={() => setChallengeAnswer(option)}
                            >
                              <span className="quiz-option-letter">
                                {String.fromCharCode(65 + index)}
                              </span>

                              <span>{option}</span>
                            </button>
                          ))}
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="Enter your answer"
                        value={challengeAnswer}
                        onChange={(e) => setChallengeAnswer(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            submitChallenge();
                          }
                        }}
                      />
                    )}

                    <div className="button-row">
                      <button
                        className="primary-btn full-btn"
                        onClick={submitChallenge}
                      >
                        Submit Answer
                      </button>

                      <button
                        className="outline-btn full-btn"
                        onClick={resetChallenge}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* =====================================================
                CHALLENGE RESULT
                ===================================================== */}

            {challengeResult && (
              <div className="panel challenge-result-panel">
                <div className="result-icon">
                  {challengeResult.is_correct ? "🎉" : "❌"}
                </div>

                <h2>
                  {challengeResult.is_correct
                    ? "Correct Answer!"
                    : "Incorrect Answer"}
                </h2>

                <p className="muted">
                  {challengeResult.is_correct
                    ? "Excellent! You solved the challenge."
                    : "Don't worry. Try another challenge."}
                </p>

                <div className="result-details">
                  <div>
                    <span>Your Answer</span>
                    <strong>{challengeResult.user_answer}</strong>
                  </div>

                  <div>
                    <span>Correct Answer</span>
                    <strong>{challengeResult.correct_answer}</strong>
                  </div>

                  <div>
                    <span>Time Taken</span>
                    <strong>{challengeResult.time_taken ?? 0} sec</strong>
                  </div>
                </div>

                <button
                  className="primary-btn full-btn"
                  onClick={resetChallenge}
                >
                  Try Another Challenge
                </button>
              </div>
            )}
          </section>
        );
      }

      return null;
    };

    return (
      <div className="app-shell user-app">
        <header className="topbar">
          <div className="brand">
            <div className="brand-icon small">🧠</div>
            <div>
              <h1>Intelligent Cognitive Alarm</h1>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <NotificationBell token={token} />
            <button className="outline-btn" onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        <main className="dashboard pb-28">{renderUserPage()}</main>

        {message && <div className="toast-message">{message}</div>}

        <nav className="bottom-nav flex items-center justify-center gap-1 rounded-3xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur-md">
          <NavButton
            icon="⌂"
            label="Dashboard"
            active={page === "dashboard"}
            onClick={() => setPage("dashboard")}
          />
          <NavButton
            icon="◷"
            label="Alarms"
            active={page === "alarms" || page === "add-alarm"}
            onClick={() => setPage("alarms")}
          />
          <NavButton
            icon="✦"
            label="Challenges"
            active={page === "challenges"}
            onClick={() => setPage("challenges")}
          />
          <NavButton
            icon="📊"
            label="Habits"
            active={page === "habits"}
            onClick={() => {
              setPage("habits");
              getHabitDashboard();
            }}
          />
          <NavButton
            icon="♧"
            label="Coach"
            active={page === "coach"}
            onClick={() => setPage("coach")}
          />
          <NavButton
            icon="●"
            label="Profile"
            active={page === "profile"}
            onClick={() => setPage("profile")}
          />
        </nav>

        {isRinging && ringingAlarm && (
          <div className="alarm-popup">
            <div className="alarm-box dark-alarm">
              <div className="ring-icon">⏰</div>
              <span className="eyebrow light">ALARM TRIGGERED</span>
              <h2>Time to Wake Up!</h2>
              <h3>{ringingAlarm.alarm_name}</h3>

              <p>
                Solve the cognitive challenge correctly to turn off the alarm.
              </p>

              {alarmChallengeLoading && (
                <div className="alarm-challenge-loading">
                  🧠 Preparing your wake-up challenge...
                </div>
              )}

              {alarmChallenge && (
                <div className="alarm-challenge-box">
                  <div className="alarm-challenge-meta">
                    <span>{alarmChallenge.challenge_type}</span>
                    <span>{alarmChallenge.difficulty}</span>
                  </div>

                  <div className="alarm-challenge-question">
                    {alarmChallenge.question}
                  </div>

                  {alarmChallenge.challenge_type === "quiz" ? (
                    <div className="quiz-options">
                      {alarmChallenge.options
                        ?.split("|")
                        .map((option) => option.trim())
                        .filter(Boolean)
                        .map((option, index) => (
                          <button
                            key={index}
                            type="button"
                            className={`quiz-option ${
                              alarmChallengeAnswer === option ? "selected" : ""
                            }`}
                            onClick={() => setAlarmChallengeAnswer(option)}
                          >
                            <span className="quiz-option-letter">
                              {String.fromCharCode(65 + index)}
                            </span>
                            <span>{option}</span>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="Enter your answer"
                      value={alarmChallengeAnswer}
                      onChange={(e) => setAlarmChallengeAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          submitAlarmChallenge();
                        }
                      }}
                    />
                  )}

                  <button
                    className="primary-btn full-btn"
                    onClick={submitAlarmChallenge}
                  >
                    ✓ Verify Answer
                  </button>
                </div>
              )}

              {alarmChallengeResult && !alarmChallengeResult.is_correct && (
                <div className="alarm-wrong-answer">
                  ❌ Incorrect answer. Please try again.
                </div>
              )}

              <div className="button-row center-row">
                <button className="primary-btn" onClick={snoozeAlarm}>
                  😴 Snooze 5 min
                </button>
              </div>

              <small className="alarm-verification-note">
                🔒 Stop Alarm is locked until the challenge is solved.
              </small>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------- COACH ----------------
  if (role === "wellness_coach") {
    const overview = coachOverview || {};
    const attentionUsers =
      overview.users || overview.users_needing_attention || [];
    const analytics = coachAnalytics || {};
    const daily = analytics.daily_activity || [];
    const typePerformance = analytics.performance_by_type || {};
    const difficultyPerformance = analytics.performance_by_difficulty || {};
    const typeLabels = Object.keys(typePerformance);
    const typeAccuracy = typeLabels.map(
      (type) => Number(typePerformance[type]?.accuracy) || 0,
    );
    const difficultyLabels = ["easy", "medium", "hard"].filter(
      (d) => difficultyPerformance[d],
    );
    const difficultyAccuracy = difficultyLabels.map(
      (d) => Number(difficultyPerformance[d]?.accuracy) || 0,
    );

    return (
      <div className="app-shell role-app">
        <header className="topbar">
          <div className="brand">
            <div className="brand-icon small">🧠</div>
            <div>
              <h1>Intelligent Cognitive Alarm</h1>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <NotificationBell token={token} />
            <button className="outline-btn" onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        <main className="dashboard">
          <section className="welcome-section">
            <h2>Welcome Coach! 👋</h2>
          </section>

          <div
            className="button-row"
            style={{ marginBottom: "22px", justifyContent: "center" }}
          >
            <button
              className={`primary-btn compact ${coachPage === "overview" ? "" : "ghost-btn"}`}
              onClick={() => {
                setCoachPage("overview");
                getCoachOverview();
              }}
            >
              📊 Coach Overview
            </button>
            <button
              className={`primary-btn compact ${coachPage === "analytics" ? "" : "ghost-btn"}`}
              onClick={() => setCoachPage("analytics")}
            >
              👤 User Analytics
            </button>
            <button
              className={`primary-btn compact ${coachPage === "sleep-progress" ? "" : "ghost-btn"}`}
              onClick={() => {
                if (!selectedUserId) {
                  setMessage("Please select a user from User Analytics first");
                  setCoachPage("analytics");
                  return;
                }
                setCoachPage("sleep-progress");
              }}
            >
              😴 Sleep & Progress
            </button>
          </div>

          {coachPage === "overview" ? (
            <>
              <section className="stats-grid coach-stats">
                <div className="stat-card blue">
                  <span className="stat-icon">👥</span>
                  <div>
                    <small>Total Users</small>
                    <strong>{overview.total_users ?? coachUsers.length}</strong>
                    <span>Registered users</span>
                  </div>
                </div>
                <div className="stat-card green">
                  <span className="stat-icon">🏆</span>
                  <div>
                    <small>Average Habit Score</small>
                    <strong>{overview.average_habit_score ?? 0}%</strong>
                    <span>Across users</span>
                  </div>
                </div>
                <div className="stat-card purple">
                  <span className="stat-icon">⏰</span>
                  <div>
                    <small>Wake-Up Consistency</small>
                    <strong>
                      {overview.average_wake_up_consistency ?? 0}%
                    </strong>
                    <span>Average completion</span>
                  </div>
                </div>
                <div className="stat-card orange">
                  <span className="stat-icon">🧠</span>
                  <div>
                    <small>Challenge Accuracy</small>
                    <strong>{overview.average_challenge_accuracy ?? 0}%</strong>
                    <span>Across users</span>
                  </div>
                </div>
              </section>

              <section className="panel" style={{ marginTop: "24px" }}>
                <div className="section-heading">
                  <div>
                    <h3>All Users</h3>
                  </div>
                  <span className="section-icon">⚠️</span>
                </div>
                {attentionUsers.length === 0 ? (
                  <div className="empty-state">
                    No users currently need attention.
                  </div>
                ) : (
                  <div className="user-list">
                    {attentionUsers.map((user) => (
                      <div className="user-card" key={user.user_id}>
                        <div className="avatar">👤</div>
                        <div style={{ flex: 1 }}>
                          <strong>{user.name}</strong>
                          <span>{user.email}</span>
                          <small
                            style={{
                              display: "block",
                              marginTop: "5px",
                              color: "#64748b",
                            }}
                          >
                            Habit {user.habit_score}% · Wake-up{" "}
                            {user.wake_up_consistency}% · Accuracy{" "}
                            {user.challenge_accuracy}%
                          </small>
                        </div>
                        <button
                          className="primary-btn compact"
                          onClick={() => getUserProfile(user.user_id)}
                        >
                          View Analytics
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : coachPage === "analytics" ? (
            <>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h3>
                      {selectedUserProfile
                        ? `Selected User Analytics — ${
                            coachAnalytics?.period_label || coachAnalyticsMonth
                          }`
                        : "Select a User"}
                    </h3>
                  </div>
                  <button
                    className="ghost-btn"
                    onClick={() => {
                      setCoachPage("overview");
                    }}
                  >
                    ← Back to Overview
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    flexWrap: "wrap",
                    margin: "18px 0 22px",
                    padding: "14px 16px",
                    background: "#f8fafc",
                    borderRadius: "14px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <strong>Analytics Period</strong>
                  <label style={{ color: "#64748b" }}>Month:</label>
                  <input
                    type="month"
                    value={coachAnalyticsMonth}
                    max={getLocalDateString().slice(0, 7)}
                    onChange={(e) => changeCoachAnalyticsMonth(e.target.value)}
                    style={{
                      padding: "9px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      background: "#fff",
                    }}
                  />
                </div>

                {selectedUserProfile ? (
                  <div
                    className="user-card selected"
                    style={{ marginBottom: "22px" }}
                  >
                    <div className="avatar">👤</div>
                    <div style={{ flex: 1 }}>
                      <strong>
                        {coachUsers.find(
                          (user) =>
                            String(user.user_id) === String(selectedUserId),
                        )?.name || "Selected User"}
                      </strong>
                      <span>
                        {coachUsers.find(
                          (user) =>
                            String(user.user_id) === String(selectedUserId),
                        )?.email || "User analytics"}
                      </span>
                    </div>
                    <span
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: "#ede9fe",
                        color: "#5b21b6",
                        fontWeight: 600,
                        fontSize: "13px",
                      }}
                    >
                      Selected
                    </span>
                  </div>
                ) : (
                  <div className="user-list" style={{ marginBottom: "22px" }}>
                    {coachUsers.map((user) => (
                      <div className="user-card" key={user.user_id}>
                        <div className="avatar">👤</div>
                        <div style={{ flex: 1 }}>
                          <strong>{user.name}</strong>
                          <span>{user.email}</span>
                        </div>
                        <button
                          className="primary-btn compact"
                          onClick={() => getUserProfile(user.user_id)}
                        >
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {!selectedUserProfile ? (
                  <div className="empty-state">
                    Select a user to view real analytics from that user's
                    activity.
                  </div>
                ) : coachAnalyticsLoading ? (
                  <div className="empty-state">
                    Loading selected user analytics...
                  </div>
                ) : (
                  <>
                    <section className="stats-grid coach-stats">
                      <div className="stat-card blue">
                        <span className="stat-icon">🏆</span>
                        <div>
                          <small>Habit Score</small>
                          <strong>{analytics.habit_score ?? 0}%</strong>
                          <span>
                            {selectedUserProfile.productivity_goal ||
                              "Current score"}
                          </span>
                        </div>
                      </div>
                      <div className="stat-card green">
                        <span className="stat-icon">⏰</span>
                        <div>
                          <small>Wake-Up Consistency</small>
                          <strong>{analytics.wake_up_consistency ?? 0}%</strong>
                          <span>Completed / triggered</span>
                        </div>
                      </div>
                      <div className="stat-card purple">
                        <span className="stat-icon">🧠</span>
                        <div>
                          <small>Challenge Accuracy</small>
                          <strong>{analytics.challenge_accuracy ?? 0}%</strong>
                          <span>Correct answers</span>
                        </div>
                      </div>
                      <div className="stat-card orange">
                        <span className="stat-icon">⚡</span>
                        <div>
                          <small>Avg. Completion Time</small>
                          <strong>
                            {analytics.average_time_seconds ?? 0}s
                          </strong>
                          <span>Challenge response</span>
                        </div>
                      </div>
                    </section>

                    <div className="content-grid" style={{ marginTop: "24px" }}>
                      <section className="panel">
                        <CoachMetricChart
                          title="Wake-Up Consistency Trend"
                          x={daily.map((d) => d.date)}
                          y={daily.map(
                            (d) => Number(d.wake_up_consistency) || 0,
                          )}
                          yTitle="Consistency %"
                        />
                      </section>
                      <section className="panel">
                        <CoachMetricChart
                          title="Daily Challenge Accuracy"
                          x={daily.map((d) => d.date)}
                          y={daily.map(
                            (d) => Number(d.challenge_accuracy) || 0,
                          )}
                          yTitle="Accuracy %"
                        />
                      </section>
                    </div>

                    <div className="content-grid" style={{ marginTop: "24px" }}>
                      <section className="panel">
                        <CoachMetricChart
                          title="Challenge Performance by Type"
                          type="bar"
                          x={typeLabels}
                          labels={typeLabels}
                          y={typeAccuracy}
                          yTitle="Accuracy %"
                        />
                      </section>
                      <section className="panel">
                        <CoachMetricChart
                          title="Difficulty Progress"
                          type="bar"
                          x={difficultyLabels}
                          labels={difficultyLabels}
                          y={difficultyAccuracy}
                          yTitle="Accuracy %"
                        />
                      </section>
                    </div>

                    <section className="panel" style={{ marginTop: "24px" }}>
                      <div className="section-heading">
                        <div>
                          <h3>
                            {selectedUserProfile.user_id
                              ? `User #${selectedUserProfile.user_id}`
                              : "Selected User"}
                          </h3>
                        </div>
                        <span className="section-icon">📈</span>
                      </div>
                      <div className="profile-summary">
                        <div>
                          <span>Wake-up time</span>
                          <strong>
                            {selectedUserProfile.preferred_wake_up_time ||
                              "Not provided"}
                          </strong>
                        </div>
                        <div>
                          <span>Sleep duration</span>
                          <strong>
                            {selectedUserProfile.sleep_duration ??
                              "Not provided"}
                          </strong>
                        </div>
                        <div>
                          <span>Difficulty preference</span>
                          <strong>
                            {selectedUserProfile.difficulty_preference ||
                              "Not provided"}
                          </strong>
                        </div>
                        <div>
                          <span>Average attempts</span>
                          <strong>{analytics.average_attempts ?? 0}</strong>
                        </div>
                        <div className="wide">
                          <span>Strongest challenge</span>
                          <strong>
                            {analytics.strongest_challenge_type ||
                              "Not enough data"}
                          </strong>
                        </div>
                        <div className="wide">
                          <span>Weakest challenge</span>
                          <strong>
                            {analytics.weakest_challenge_type ||
                              "Not enough data"}
                          </strong>
                        </div>
                      </div>
                    </section>

                    <section className="panel" style={{ marginTop: "24px" }}>
                      <h3 className="subheading">💡 Give Recommendation</h3>
                      <textarea
                        placeholder="Enter recommendation for the selected user"
                        value={coachRecommendation}
                        onChange={(e) => setCoachRecommendation(e.target.value)}
                        rows="5"
                      />
                      <button
                        className="primary-btn full-btn"
                        onClick={giveRecommendation}
                      >
                        Send Recommendation
                      </button>
                    </section>

                    <section className="panel" style={{ marginTop: "24px" }}>
                      <div className="section-heading">
                        <div>
                          <h3>Recent Recommendations</h3>
                        </div>
                      </div>
                      {coachRecommendations.length === 0 ? (
                        <div className="empty-state">
                          No recommendations for this user.
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: "12px" }}>
                          {coachRecommendations.slice(0, 3).map((rec) => (
                            <div
                              key={rec.recommendation_id}
                              className="recommendation-card"
                              style={{ margin: 0 }}
                            >
                              <div className="recommendation-icon">💡</div>
                              <div style={{ width: "100%" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    gap: "12px",
                                  }}
                                >
                                  <p style={{ margin: 0 }}>
                                    {rec.recommendation}
                                  </p>
                                  <button
                                    type="button"
                                    className="ghost-btn"
                                    onClick={() =>
                                      deleteCoachRecommendation(
                                        rec.recommendation_id,
                                      )
                                    }
                                    style={{ flexShrink: 0, color: "#dc2626" }}
                                  >
                                    🗑️ Delete
                                  </button>
                                </div>
                                <small>{rec.created_at}</small>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="panel" style={{ marginTop: "24px" }}>
                      <div className="section-heading">
                        <div>
                          <h3>Print User Report</h3>
                        </div>
                        <span className="section-icon">📄</span>
                      </div>

                      <button
                        className="primary-btn full-btn"
                        onClick={printCoachUserReport}
                        disabled={!selectedUserId || !coachAnalytics}
                        style={{ marginTop: "18px" }}
                      >
                        🖨️ Print / Save User Report
                      </button>
                    </section>
                  </>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h3>Sleep & Progress Monitoring</h3>
                  </div>
                  <button
                    className="ghost-btn"
                    onClick={() => setCoachPage("analytics")}
                  >
                    ← Back to User Analytics
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    flexWrap: "wrap",
                    margin: "18px 0 22px",
                    padding: "14px 16px",
                    background: "#f8fafc",
                    borderRadius: "14px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <strong>Selected User</strong>
                  <span>
                    {coachUsers.find(
                      (user) => String(user.user_id) === String(selectedUserId),
                    )?.name || "Selected User"}
                  </span>
                  <span style={{ color: "#64748b" }}>
                    {coachUsers.find(
                      (user) => String(user.user_id) === String(selectedUserId),
                    )?.email || ""}
                  </span>
                  <label style={{ color: "#64748b", marginLeft: "auto" }}>
                    Month:
                  </label>
                  <input
                    type="month"
                    value={coachAnalyticsMonth}
                    onChange={(e) => changeCoachAnalyticsMonth(e.target.value)}
                    style={{
                      padding: "9px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      background: "#fff",
                    }}
                  />
                </div>

                {!selectedUserId ? (
                  <div className="empty-state">
                    Please select a user from User Analytics first.
                  </div>
                ) : coachAnalyticsLoading ? (
                  <div className="empty-state">
                    Loading sleep and progress data...
                  </div>
                ) : (
                  <>
                    <SleepWakeTrend trend={analytics.sleep_wake_trend || []} />
                    <div style={{ marginTop: "24px" }}>
                      <ProgressMonitoring analytics={analytics} />
                    </div>
                    <div style={{ marginTop: "24px" }}>
                      <ImprovementAreas analytics={analytics} />
                    </div>
                  </>
                )}
              </section>
            </>
          )}

          {message && (
            <div className="status-message page-message">{message}</div>
          )}
        </main>
      </div>
    );
  }

  // ---------------- ADMIN / MILESTONE 4 EXECUTIVE DASHBOARD ----------------
  if (role === "admin") {
    const analytics = adminAnalytics || {};
    const dailyActivity = analytics.daily_activity || [];
    const typePerformance = analytics.performance_by_type || {};
    const difficultyPerformance = analytics.performance_by_difficulty || {};
    const chartDates = dailyActivity.map((item) => item.date);
    const alarms = dailyActivity.map(
      (item) => Number(item.alarm_triggered) || 0,
    );
    const wakeUps = dailyActivity.map(
      (item) => Number(item.wake_up_completed) || 0,
    );
    const snoozes = dailyActivity.map((item) => Number(item.snoozed) || 0);
    const challenges = dailyActivity.map(
      (item) => Number(item.challenge_answered) || 0,
    );
    const typeLabels = Object.keys(typePerformance);
    const typeAccuracy = typeLabels.map(
      (type) => Number(typePerformance[type]?.accuracy) || 0,
    );
    const difficultyLabels = ["easy", "medium", "hard"].filter(
      (d) => difficultyPerformance[d],
    );
    const difficultyAccuracy = difficultyLabels.map(
      (d) => Number(difficultyPerformance[d]?.accuracy) || 0,
    );

    const plotLayout = (title, extra = {}) => ({
      title: { text: title, font: { size: 16 } },
      margin: { l: 48, r: 20, t: 48, b: 48 },
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
      font: { family: "Arial, sans-serif", color: "#334155" },
      autosize: true,
      ...extra,
    });

    return (
      <div className="app-shell role-app">
        <header className="topbar">
          <div className="brand">
            <div className="brand-icon small">🧠</div>
            <div>
              <h1>Intelligent Cognitive Alarm</h1>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <NotificationBell token={token} />
            <button className="outline-btn" onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        <main className="dashboard">
          <section className="welcome-section">
            <h2>Welcome Admin! 🔐</h2>
          </section>

          <div
            className="button-row"
            style={{ marginBottom: "22px", justifyContent: "center" }}
          >
            <button
              className={`primary-btn compact ${adminPage === "overview" ? "" : "ghost-btn"}`}
              onClick={() => setAdminPage("overview")}
            >
              📊 Platform Overview
            </button>
            <button
              className={`primary-btn compact ${adminPage === "reports" ? "" : "ghost-btn"}`}
              onClick={() => {
                setAdminPage("reports");
                if (token) getAdminUsers(token);
              }}
            >
              📄 Reports & Management
            </button>
            <button
              className={`primary-btn compact ${adminPage === "recommendations" ? "" : "ghost-btn"}`}
              onClick={() => {
                setAdminPage("recommendations");
                if (!adminRecommendations && token) {
                  getAdminRecommendations();
                }
              }}
            >
              💡 Recommendation Monitoring
            </button>
          </div>

          <section
            className="panel"
            style={{
              marginBottom: "24px",
              padding: "28px 24px 22px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "20px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "24px" }}>
                  Platform Activity Date Range
                </h3>
              </div>

              <div
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "14px",
                  background: "#f1eaff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "24px",
                  flexShrink: 0,
                }}
              >
                📅
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "16px",
                marginTop: "28px",
              }}
            >
              <label style={{ display: "block" }}>
                <span
                  style={{
                    display: "block",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: 600,
                    marginBottom: "8px",
                  }}
                >
                  From Date
                </span>
                <input
                  type="date"
                  value={adminStartDate}
                  max={getLocalDateString()}
                  onChange={(event) => setAdminStartDate(event.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "13px 14px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    background: "#fff",
                    fontSize: "15px",
                    fontWeight: 600,
                  }}
                />
              </label>

              <label style={{ display: "block" }}>
                <span
                  style={{
                    display: "block",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: 600,
                    marginBottom: "8px",
                  }}
                >
                  To Date
                </span>
                <input
                  type="date"
                  value={adminEndDate}
                  min={adminStartDate}
                  max={getLocalDateString()}
                  onChange={(event) => setAdminEndDate(event.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "13px 14px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    background: "#fff",
                    fontSize: "15px",
                    fontWeight: 600,
                  }}
                />
              </label>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "22px",
              }}
            >
              <button
                className="primary-btn"
                onClick={applyAdminDateFilter}
                disabled={adminAnalyticsLoading}
              >
                {adminAnalyticsLoading ? "Applying..." : "Apply Filter"}
              </button>
            </div>
          </section>

          {adminAnalyticsLoading && !adminAnalytics ? (
            <div className="panel empty-state">
              Loading executive analytics...
            </div>
          ) : adminPage === "overview" ? (
            <>
              <section className="stats-grid">
                <div className="stat-card blue">
                  <span className="stat-icon">👥</span>
                  <div>
                    <small>Total Users</small>
                    <strong>{analytics.total_users ?? 0}</strong>
                    <span>Registered user accounts</span>
                  </div>
                </div>
                <div className="stat-card purple">
                  <span className="stat-icon">⏰</span>
                  <div>
                    <small>Total Alarms</small>
                    <strong>{analytics.total_alarms ?? 0}</strong>
                    <span>Configured platform alarms</span>
                  </div>
                </div>
                <div className="stat-card green">
                  <span className="stat-icon">🌅</span>
                  <div>
                    <small>Wake-Up Success</small>
                    <strong>
                      {Number(
                        analytics.wake_up_success_rate_percentage || 0,
                      ).toFixed(1)}
                      %
                    </strong>
                    <span>Completed / triggers</span>
                  </div>
                </div>
                <div className="stat-card orange">
                  <span className="stat-icon">🔕</span>
                  <div>
                    <small>Snooze Rate</small>
                    <strong>
                      {Number(analytics.snooze_rate_percentage || 0).toFixed(1)}
                      %
                    </strong>
                    <span>Platform snooze behavior</span>
                  </div>
                </div>
                <div className="stat-card blue">
                  <span className="stat-icon">🧠</span>
                  <div>
                    <small>Challenge Accuracy</small>
                    <strong>
                      {Number(
                        analytics.challenge_accuracy_percentage || 0,
                      ).toFixed(1)}
                      %
                    </strong>
                    <span>Correct answers</span>
                  </div>
                </div>
                <div className="stat-card purple">
                  <span className="stat-icon">🏆</span>
                  <div>
                    <small>Platform Habit Score</small>
                    <strong>
                      {Number(analytics.platform_habit_score || 0).toFixed(1)}
                    </strong>
                    <span>Aggregate habit score</span>
                  </div>
                </div>
              </section>

              <section className="panel" style={{ marginTop: "24px" }}>
                <div className="section-heading">
                  <div>
                    <h3>Activity & Performance</h3>
                  </div>
                  <span className="section-icon">📊</span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "20px",
                    marginTop: "20px",
                  }}
                >
                  <div className="panel" style={{ margin: 0 }}>
                    <Plot
                      data={[
                        {
                          x: chartDates,
                          y: alarms,
                          type: "scatter",
                          mode: "lines+markers",
                          name: "Alarms",
                        },
                        {
                          x: chartDates,
                          y: wakeUps,
                          type: "scatter",
                          mode: "lines+markers",
                          name: "Wake-ups",
                        },
                      ]}
                      layout={plotLayout("Alarm vs Wake-Up Activity", {
                        xaxis: { title: "Date" },
                        yaxis: { title: "Events", rangemode: "tozero" },
                        legend: { orientation: "h" },
                      })}
                      config={{ responsive: true, displaylogo: false }}
                      style={{ width: "100%", height: "330px" }}
                      useResizeHandler
                    />
                  </div>
                  <div className="panel" style={{ margin: 0 }}>
                    <Plot
                      data={[
                        {
                          x: chartDates,
                          y: snoozes,
                          type: "bar",
                          name: "Snoozes",
                        },
                        {
                          x: chartDates,
                          y: challenges,
                          type: "bar",
                          name: "Challenges",
                        },
                      ]}
                      layout={plotLayout("Snooze and Challenge Activity", {
                        barmode: "group",
                        xaxis: { title: "Date" },
                        yaxis: { title: "Events", rangemode: "tozero" },
                        legend: { orientation: "h" },
                      })}
                      config={{ responsive: true, displaylogo: false }}
                      style={{ width: "100%", height: "330px" }}
                      useResizeHandler
                    />
                  </div>
                  <div className="panel" style={{ margin: 0 }}>
                    <Plot
                      data={[
                        {
                          x: typeLabels,
                          y: typeAccuracy,
                          type: "bar",
                          text: typeAccuracy.map((v) => `${v}%`),
                          textposition: "auto",
                          name: "Accuracy",
                        },
                      ]}
                      layout={plotLayout("Challenge Accuracy by Type", {
                        xaxis: { title: "Challenge Type" },
                        yaxis: { title: "Accuracy (%)", range: [0, 100] },
                      })}
                      config={{ responsive: true, displaylogo: false }}
                      style={{ width: "100%", height: "330px" }}
                      useResizeHandler
                    />
                  </div>
                  <div className="panel" style={{ margin: 0 }}>
                    <Plot
                      data={[
                        {
                          x: difficultyLabels,
                          y: difficultyAccuracy,
                          type: "bar",
                          text: difficultyAccuracy.map((v) => `${v}%`),
                          textposition: "auto",
                          name: "Accuracy",
                        },
                      ]}
                      layout={plotLayout("Challenge Accuracy by Difficulty", {
                        xaxis: { title: "Difficulty" },
                        yaxis: { title: "Accuracy (%)", range: [0, 100] },
                      })}
                      config={{ responsive: true, displaylogo: false }}
                      style={{ width: "100%", height: "330px" }}
                      useResizeHandler
                    />
                  </div>
                </div>
              </section>
            </>
          ) : adminPage === "reports" ? (
            <>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h3>Reports & Export</h3>
                  </div>
                  <span className="section-icon">📄</span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "20px",
                    marginTop: "20px",
                  }}
                >
                  <div className="panel" style={{ margin: 0 }}>
                    <h4>PDF Executive Report</h4>

                    <button
                      className="primary-btn"
                      onClick={() => downloadAdminReport("pdf")}
                      disabled={adminReportLoading}
                    >
                      {adminReportLoading
                        ? "Generating..."
                        : "Download PDF Report"}
                    </button>
                  </div>
                  <div className="panel" style={{ margin: 0 }}>
                    <h4>Excel Analytics Workbook</h4>

                    <button
                      className="primary-btn"
                      onClick={() => downloadAdminReport("excel")}
                      disabled={adminReportLoading}
                    >
                      {adminReportLoading
                        ? "Generating..."
                        : "Download Excel Report"}
                    </button>
                  </div>
                </div>
              </section>

              <section className="panel" style={{ marginTop: "24px" }}>
                <div className="section-heading">
                  <div>
                    <h3>Account Management</h3>
                    <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                      View registered accounts and permanently delete an account
                      when required.
                    </p>
                  </div>
                  <button
                    className="ghost-btn"
                    onClick={() => getAdminUsers(token)}
                    disabled={adminUsersLoading}
                  >
                    {adminUsersLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                <div style={{ overflowX: "auto", marginTop: "20px" }}>
                  {adminUsersLoading && adminUsers.length === 0 ? (
                    <div className="empty-state">Loading accounts...</div>
                  ) : adminUsers.length === 0 ? (
                    <div className="empty-state">No accounts found.</div>
                  ) : (
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px",
                              borderBottom: "1px solid #e2e8f0",
                            }}
                          >
                            Name
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px",
                              borderBottom: "1px solid #e2e8f0",
                            }}
                          >
                            Email
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px",
                              borderBottom: "1px solid #e2e8f0",
                            }}
                          >
                            Role
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px",
                              borderBottom: "1px solid #e2e8f0",
                            }}
                          >
                            Created
                          </th>
                          <th
                            style={{
                              textAlign: "center",
                              padding: "12px",
                              borderBottom: "1px solid #e2e8f0",
                            }}
                          >
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminUsers.map((account) => (
                          <tr key={account.user_id}>
                            <td
                              style={{
                                padding: "12px",
                                borderBottom: "1px solid #f1f5f9",
                                fontWeight: 600,
                              }}
                            >
                              {account.name}
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                borderBottom: "1px solid #f1f5f9",
                              }}
                            >
                              {account.email}
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                borderBottom: "1px solid #f1f5f9",
                              }}
                            >
                              {account.role}
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                borderBottom: "1px solid #f1f5f9",
                              }}
                            >
                              {account.created_at
                                ? new Date(account.created_at).toLocaleString()
                                : "—"}
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                borderBottom: "1px solid #f1f5f9",
                                textAlign: "center",
                              }}
                            >
                              {Number(account.user_id) === Number(userId) ? (
                                <span
                                  style={{ color: "#64748b", fontSize: "13px" }}
                                >
                                  Current account
                                </span>
                              ) : (
                                <button
                                  className="ghost-btn"
                                  style={{
                                    color: "#dc2626",
                                    borderColor: "#fecaca",
                                  }}
                                  onClick={() =>
                                    deleteAdminUser(account.user_id)
                                  }
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <section className="panel" style={{ marginTop: "24px" }}>
                <div className="section-heading">
                  <div>
                    <h3>Platform Data Snapshot</h3>
                  </div>
                  <button
                    className="ghost-btn"
                    onClick={() => getAdminAnalytics()}
                  >
                    Refresh
                  </button>
                </div>
                <div className="profile-summary" style={{ marginTop: "20px" }}>
                  <div>
                    <span>Total Users</span>
                    <strong>{analytics.total_users ?? 0}</strong>
                  </div>
                  <div>
                    <span>Total Alarms</span>
                    <strong>{analytics.total_alarms ?? 0}</strong>
                  </div>
                  <div>
                    <span>Total Challenges</span>
                    <strong>{analytics.total_challenges ?? 0}</strong>
                  </div>
                  <div>
                    <span>Recommendations</span>
                    <strong>{analytics.total_recommendations ?? 0}</strong>
                  </div>
                  <div>
                    <span>Wake-Ups Completed</span>
                    <strong>{analytics.wake_up_completed_count ?? 0}</strong>
                  </div>
                  <div>
                    <span>Snoozes</span>
                    <strong>{analytics.snooze_count ?? 0}</strong>
                  </div>
                </div>
              </section>

              <section className="panel" style={{ marginTop: "24px" }}>
                <div className="section-heading">
                  <div>
                    <h3>Recent Platform Activity</h3>
                  </div>
                  <span className="section-icon">📅</span>
                </div>
                {dailyActivity.length === 0 ? (
                  <div className="empty-state">
                    No daily activity available.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto", marginTop: "18px" }}>
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "12px" }}>
                            Date
                          </th>
                          <th style={{ padding: "12px" }}>Alarms</th>
                          <th style={{ padding: "12px" }}>Wake-Ups</th>
                          <th style={{ padding: "12px" }}>Snoozes</th>
                          <th style={{ padding: "12px" }}>Challenges</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyActivity.slice(-14).map((row) => (
                          <tr key={row.date}>
                            <td style={{ padding: "12px" }}>{row.date}</td>
                            <td
                              style={{ textAlign: "center", padding: "12px" }}
                            >
                              {row.alarm_triggered || 0}
                            </td>
                            <td
                              style={{ textAlign: "center", padding: "12px" }}
                            >
                              {row.wake_up_completed || 0}
                            </td>
                            <td
                              style={{ textAlign: "center", padding: "12px" }}
                            >
                              {row.snoozed || 0}
                            </td>
                            <td
                              style={{ textAlign: "center", padding: "12px" }}
                            >
                              {row.challenge_answered || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {adminMessage && (
                <section className="panel" style={{ marginTop: "24px" }}>
                  <h3>Admin Access</h3>
                  <p>{adminMessage}</p>
                </section>
              )}
            </>
          ) : (
            <>
              <section className="stats-grid">
                <div className="stat-card blue">
                  <span className="stat-icon">💡</span>
                  <div>
                    <small>Total Recommendations</small>
                    <strong>
                      {adminRecommendations?.total_recommendations ?? 0}
                    </strong>
                    <span>All saved recommendations</span>
                  </div>
                </div>
                <div className="stat-card purple">
                  <span className="stat-icon">📅</span>
                  <div>
                    <small>In Selected Period</small>
                    <strong>
                      {adminRecommendations?.period_recommendations ?? 0}
                    </strong>
                    <span>Recommendations in date range</span>
                  </div>
                </div>
                <div className="stat-card green">
                  <span className="stat-icon">👨‍🏫</span>
                  <div>
                    <small>Active Coaches</small>
                    <strong>{adminRecommendations?.active_coaches ?? 0}</strong>
                    <span>Coaches who recommended</span>
                  </div>
                </div>
                <div className="stat-card orange">
                  <span className="stat-icon">👥</span>
                  <div>
                    <small>Users Covered</small>
                    <strong>{adminRecommendations?.users_covered ?? 0}</strong>
                    <span>Users receiving recommendations</span>
                  </div>
                </div>
              </section>

              <section className="panel" style={{ marginTop: "24px" }}>
                <div className="section-heading">
                  <div>
                    <h3>Recommendation Activity</h3>
                  </div>
                  <button
                    className="ghost-btn"
                    onClick={() => getAdminRecommendations()}
                    disabled={adminRecommendationsLoading}
                  >
                    {adminRecommendationsLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                <Plot
                  data={[
                    {
                      x: (adminRecommendations?.daily_activity || []).map(
                        (row) => row.date,
                      ),
                      y: (adminRecommendations?.daily_activity || []).map(
                        (row) => row.count,
                      ),
                      type: "bar",
                      name: "Recommendations",
                    },
                  ]}
                  layout={plotLayout("Recommendations Over Time", {
                    xaxis: { title: "Date" },
                    yaxis: { title: "Recommendations", rangemode: "tozero" },
                  })}
                  config={{ responsive: true, displaylogo: false }}
                  style={{ width: "100%", height: "330px", marginTop: "12px" }}
                  useResizeHandler
                />
              </section>

              <section className="panel" style={{ marginTop: "24px" }}>
                <div className="section-heading">
                  <div>
                    <h3>Recent Recommendations</h3>
                  </div>
                </div>

                {(adminRecommendations?.recommendations || []).length === 0 ? (
                  <div className="empty-state" style={{ marginTop: "18px" }}>
                    No recommendations found for the selected period.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto", marginTop: "18px" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        tableLayout: "fixed",
                      }}
                    >
                      <colgroup>
                        <col style={{ width: "23%" }} />
                        <col style={{ width: "23%" }} />
                        <col style={{ width: "29%" }} />
                        <col style={{ width: "25%" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th
                            style={{ textAlign: "left", padding: "12px 16px" }}
                          >
                            User
                          </th>
                          <th
                            style={{ textAlign: "left", padding: "12px 16px" }}
                          >
                            Coach
                          </th>
                          <th
                            style={{ textAlign: "left", padding: "12px 16px" }}
                          >
                            Recommendation
                          </th>
                          <th
                            style={{ textAlign: "left", padding: "12px 16px" }}
                          >
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(adminRecommendations?.recommendations || []).map(
                          (item) => (
                            <tr key={item.recommendation_id}>
                              <td
                                style={{
                                  padding: "12px 16px",
                                  verticalAlign: "top",
                                }}
                              >
                                <strong>
                                  {item.user_name || `User #${item.user_id}`}
                                </strong>
                                <div
                                  style={{ color: "#64748b", fontSize: "12px" }}
                                >
                                  {item.user_email || ""}
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: "12px 16px",
                                  verticalAlign: "top",
                                }}
                              >
                                <strong>
                                  {item.coach_name || `Coach #${item.coach_id}`}
                                </strong>
                                <div
                                  style={{ color: "#64748b", fontSize: "12px" }}
                                >
                                  {item.coach_email || ""}
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: "12px 16px",
                                  verticalAlign: "top",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {item.recommendation}
                              </td>
                              <td
                                style={{
                                  padding: "12px 16px",
                                  verticalAlign: "top",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.created_at
                                  ? new Date(item.created_at).toLocaleString()
                                  : "—"}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {message && (
            <div className="status-message page-message">{message}</div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell auth-shell">
      <div className="panel login-card">
        <h2>Unknown Role</h2>
        <p>Your account role is: {role || "not available"}</p>
        <button className="primary-btn" onClick={logout}>
          Back to Login
        </button>
      </div>
    </div>
  );
}

function AlarmCard({
  alarm,
  formatTime,
  formatRepeat,
  toggleAlarm,
  editAlarm,
  deleteAlarm,
}) {
  return (
    <div className="alarm-card">
      <div className="alarm-clock">⏰</div>
      <div className="alarm-main">
        <strong>{formatTime(alarm.alarm_time)}</strong>
        <span>{alarm.alarm_name}</span>
        <small style={{ color: "#64748b" }}>🔁 {formatRepeat(alarm)}</small>
        <small className={alarm.is_active ? "active-text" : "inactive-text"}>
          ● {alarm.is_active ? "Active" : "Inactive"}
        </small>
      </div>

      <button
        className={`toggle ${alarm.is_active ? "on" : ""}`}
        onClick={() => toggleAlarm(alarm)}
        aria-label={alarm.is_active ? "Disable alarm" : "Enable alarm"}
      >
        <span />
      </button>

      <div className="alarm-actions">
        <button onClick={() => editAlarm(alarm)}>Edit</button>
        <button
          className="danger-text"
          onClick={() => deleteAlarm(alarm.alarm_id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default App;
