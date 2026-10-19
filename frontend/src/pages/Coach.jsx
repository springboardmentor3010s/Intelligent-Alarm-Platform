import React, { useEffect, useState } from "react";
import "./Coach.css";

const API_URL = "http://localhost:8001";

const colors = {
  purple: "#7657e8",
  blue: "#3986f7",
  green: "#19a887",
  orange: "#f0a43a",
  red: "#e66b78",
  text: "#252641",
  muted: "#777b95",
  border: "#e9eaf3",
  background: "#f7f8fd",
};

const cardStyle = {
  background: "#ffffff",
  border: `1px solid ${colors.border}`,
  borderRadius: "18px",
  padding: "22px",
  boxShadow: "0 5px 20px rgba(35, 38, 80, 0.045)",
  minWidth: 0,
};

const headingStyle = {
  color: colors.text,
  fontSize: "19px",
  fontWeight: 750,
  margin: "0 0 18px",
};

function formatLabel(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  if (typeof value === "string") {
    return value.replace(/_/g, " ");
  }

  return null;
}

function findValue(source, possibleKeys) {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  const wantedKeys = possibleKeys.map((key) =>
    key.toLowerCase().replace(/[^a-z0-9]/g, "")
  );

  for (const [key, value] of Object.entries(source)) {
    const normalizedKey = key
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (wantedKeys.includes(normalizedKey) && typeof value === "number") {
      return value;
    }
  }

  for (const value of Object.values(source)) {
    if (value && typeof value === "object") {
      const result = findValue(value, possibleKeys);

      if (result !== undefined) {
        return result;
      }
    }
  }

  return undefined;
}

function MetricCard({ title, value, subtitle, color, icon }) {
  return (
    <div
      style={{
        ...cardStyle,
        borderTop: `4px solid ${color}`,
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ color: colors.muted, fontSize: "13px", fontWeight: 600 }}>
          {title}
        </span>

        <span style={{ fontSize: "23px" }}>{icon}</span>
      </div>

      <div
        style={{
          fontSize: "29px",
          fontWeight: 800,
          color,
          marginTop: "13px",
          overflowWrap: "anywhere",
        }}
      >
        {value === undefined || value === null ? "—" : value}
      </div>

      {subtitle && (
        <div style={{ color: colors.muted, fontSize: "12px", marginTop: "7px" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ label, value, color = colors.purple }) {
  const valid =
    typeof value === "number" && Number.isFinite(value) && value >= 0;

  const percent = valid ? Math.max(0, Math.min(100, value)) : 0;

  return (
    <div style={{ marginBottom: "19px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "8px",
          fontSize: "13px",
        }}
      >
        <span style={{ color: colors.text }}>{label}</span>

        <strong style={{ color: valid ? color : colors.muted }}>
          {valid ? `${value.toFixed(1)}%` : "N/A"}
        </strong>
      </div>

      <div
        style={{
          width: "100%",
          height: "9px",
          background: "#eff0f7",
          borderRadius: "20px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            background: color,
            borderRadius: "20px",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

function DonutChart({ value, color = colors.purple, label = "Accuracy" }) {
  const valid =
    typeof value === "number" && Number.isFinite(value);

  const percent = valid ? Math.max(0, Math.min(100, value)) : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "13px",
        padding: "8px",
      }}
    >
      <div
        style={{
          width: "155px",
          height: "155px",
          borderRadius: "50%",
          background: valid
            ? `conic-gradient(${color} ${percent}%, #eceef6 ${percent}% 100%)`
            : "#eceef6",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            width: "112px",
            height: "112px",
            borderRadius: "50%",
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <strong style={{ fontSize: "25px", color: colors.text }}>
            {valid ? `${value.toFixed(1)}%` : "N/A"}
          </strong>

          <span style={{ color: colors.muted, fontSize: "11px" }}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

function DataRows({ data, emptyMessage = "No data available." }) {
  if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
    return (
      <p style={{ color: colors.muted, fontSize: "13px" }}>{emptyMessage}</p>
    );
  }

  return (
    <div>
      {Object.entries(data).map(([key, value]) => {
        if (value === undefined) return null;

        const simpleValue = formatValue(value);

        return (
          <div
            key={key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              padding: "12px 0",
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <span
              style={{
                color: colors.muted,
                fontSize: "13px",
                flex: "1 1 45%",
                overflowWrap: "anywhere",
              }}
            >
              {formatLabel(key)}
            </span>

            <div
              style={{
                flex: "1 1 55%",
                textAlign: "right",
                fontSize: "13px",
                color: colors.text,
                fontWeight: 600,
                overflowWrap: "anywhere",
              }}
            >
              {simpleValue !== null ? (
                simpleValue
              ) : Array.isArray(value) ? (
                <div style={{ textAlign: "left" }}>
                  {value.map((item, index) => (
                    <div key={index} style={{ marginBottom: "8px" }}>
                      {typeof item === "object" && item !== null ? (
                        <DataRows data={item} />
                      ) : (
                        String(item)
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "left" }}>
                  <DataRows data={value} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <section style={cardStyle}>
      <h2 style={headingStyle}>{title}</h2>

      {subtitle && (
        <p
          style={{
            color: colors.muted,
            fontSize: "13px",
            marginTop: "-10px",
            marginBottom: "18px",
            lineHeight: 1.6,
          }}
        >
          {subtitle}
        </p>
      )}

      {children}
    </section>
  );
}

function getUserEmail(user) {
  if (typeof user === "string") return user;

  return (
    user?.email ||
    user?.user_email ||
    user?.username ||
    user?.id ||
    ""
  );
}

function getUserName(user) {
  if (typeof user === "string") return user;

  return (
    user?.name ||
    user?.full_name ||
    user?.username ||
    user?.email ||
    "Registered User"
  );
}

export default function Coach() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/coach/users`);

      if (!response.ok) {
        throw new Error(`Unable to load users (${response.status}).`);
      }

      const result = await response.json();

      const userList = Array.isArray(result)
        ? result
        : result.users || result.data || [];

      setUsers(userList);
    } catch (error) {
      setMessage(
        `${error.message || "Unable to load users."} Check that the backend is running on port 8001.`
      );
    } finally {
      setLoading(false);
    }
  }

  async function viewAnalytics(user) {
    const email = getUserEmail(user);

    if (!email) {
      setMessage("This user does not have an email or user ID.");
      return;
    }

    setSelectedUser(user);
    setAnalytics(null);
    setAnalyticsLoading(true);
    setMessage("");

    const endpoints = [
      ["overall", `/analytics/${encodeURIComponent(email)}`],
      ["behavioral", `/behavioral-analytics/${encodeURIComponent(email)}`],
      ["habit", `/habit-score/${encodeURIComponent(email)}`],
      ["sleep", `/sleep/analytics/${encodeURIComponent(email)}`],
      ["adaptive", `/adaptive-difficulty/${encodeURIComponent(email)}`],
      ["recommendations", `/recommendations/${encodeURIComponent(email)}`],
    ];

    try {
      const results = await Promise.all(
        endpoints.map(async ([key, path]) => {
          try {
            const response = await fetch(`${API_URL}${path}`);

            if (!response.ok) {
              return [
                key,
                {
                  _error: `Request failed (${response.status})`,
                },
              ];
            }

            return [key, await response.json()];
          } catch (error) {
            return [
              key,
              {
                _error: error.message || "Unable to load this section.",
              },
            ];
          }
        })
      );

      setAnalytics(Object.fromEntries(results));
    } catch (error) {
      setMessage(error.message || "Unable to load analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  function closeAnalytics() {
    setSelectedUser(null);
    setAnalytics(null);
    setMessage("");
  }

  const overall = analytics?.overall || {};
  const behavioral = analytics?.behavioral || {};
  const habit = analytics?.habit || {};
  const sleep = analytics?.sleep || {};
  const adaptive = analytics?.adaptive || {};
  const recommendations = analytics?.recommendations || {};

  const accuracy =
    findValue(overall, [
      "accuracy",
      "challenge_accuracy",
      "challenge_completion_accuracy",
    ]) ??
    findValue(behavioral, [
      "accuracy",
      "challenge_accuracy",
    ]);

  const challengeCount =
    findValue(overall, [
      "total_challenges",
      "total_attempts",
      "challenges_completed",
    ]) ??
    findValue(behavioral, [
      "total_challenges",
      "total_attempts",
    ]);

  const correct =
    findValue(overall, [
      "correct",
      "correct_answers",
      "correct_challenges",
      "correct_attempts",
    ]) ??
    findValue(behavioral, [
      "correct",
      "correct_answers",
      "correct_challenges",
    ]);

  const incorrect =
    findValue(overall, [
      "incorrect",
      "incorrect_answers",
      "incorrect_challenges",
      "incorrect_attempts",
    ]) ??
    findValue(behavioral, [
      "incorrect",
      "incorrect_answers",
      "incorrect_challenges",
    ]);

  const wakeSuccess =
    findValue(overall, [
      "wake_up_success_rate",
      "wake_up_success",
      "wakeup_success",
      "wake_success_rate",
    ]) ??
    findValue(behavioral, [
      "wake_up_success_rate",
      "wake_up_success",
      "wakeup_success",
      "wake_up_consistency",
      "wake_up_consistency_rate",
    ]);

  const sleepAdherence =
    findValue(sleep, [
      "sleep_adherence",
      "sleep_schedule_adherence",
      "adherence",
    ]) ??
    findValue(behavioral, [
      "sleep_schedule_adherence",
      "sleep_adherence",
    ]) ??
    findValue(habit, [
      "sleep_adherence",
      "sleep_schedule_adherence",
    ]);

  const habitScore = findValue(habit, ["habit_score"]);

  const recentAccuracy =
    findValue(adaptive, [
      "accuracy",
      "challenge_accuracy",
    ]) ??
    findValue(recommendations, [
      "challenge_accuracy",
    ]);

  const recentAttempts =
    findValue(adaptive, [
      "attempts_analyzed",
      "total_attempts",
      "attempts",
    ]);

  const adaptiveConfidence =
    findValue(adaptive, [
      "confidence",
      "ml_confidence",
      "model_confidence",
    ]) ??
    findValue(recommendations, [
      "ml_confidence",
      "confidence",
    ]);

  const recommendedDifficulty =
    adaptive.next_difficulty ||
    adaptive.recommended_difficulty ||
    recommendations.recommended_difficulty ||
    "N/A";

  const previousDifficulty = adaptive.previous_difficulty || "N/A";

  const recommendationList = Array.isArray(recommendations)
    ? recommendations
    : recommendations.recommendations ||
      recommendations.items ||
      recommendations.suggestions ||
      [];

  const correctPercent =
    typeof correct === "number" &&
    typeof challengeCount === "number" &&
    challengeCount > 0
      ? (correct / challengeCount) * 100
      : undefined;

  const incorrectPercent =
    typeof incorrect === "number" &&
    typeof challengeCount === "number" &&
    challengeCount > 0
      ? (incorrect / challengeCount) * 100
      : undefined;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.background,
        padding: "clamp(16px, 3vw, 34px)",
        color: colors.text,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "18px",
            marginBottom: "28px",
          }}
        >
          <div>
            <div
              style={{
                color: colors.purple,
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "1.8px",
                marginBottom: "8px",
              }}
            >
              COGNIA · WELLNESS MONITORING
            </div>

            <h1
              style={{
                fontSize: "clamp(25px, 4vw, 35px)",
                margin: 0,
                color: colors.text,
                fontWeight: 850,
              }}
            >
              Wellness Coach Dashboard
            </h1>

            <p
              style={{
                color: colors.muted,
                fontSize: "14px",
                lineHeight: 1.6,
                margin: "10px 0 0",
              }}
            >
              Monitor user habits, sleep, cognitive challenges, and adaptive
              recommendations.
            </p>
          </div>

          <button
            onClick={loadUsers}
            disabled={loading}
            style={{
              background: colors.purple,
              color: "#fff",
              border: "none",
              borderRadius: "11px",
              padding: "12px 19px",
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Refreshing..." : "↻ Refresh Users"}
          </button>
        </header>

        {message && (
          <div
            role="alert"
            style={{
              background: "#fff0f0",
              color: "#b52e43",
              border: "1px solid #ffd5d9",
              borderRadius: "12px",
              padding: "14px 16px",
              marginBottom: "22px",
              fontSize: "14px",
            }}
          >
            {message}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "17px",
            marginBottom: "27px",
          }}
        >
          <MetricCard
            title="Registered Users"
            value={loading ? "..." : users.length}
            subtitle="Users returned by the backend"
            color={colors.purple}
            icon="👥"
          />

          <MetricCard
            title="Challenge Accuracy"
            value={
              accuracy !== undefined ? `${accuracy.toFixed(2)}%` : "—"
            }
            subtitle="Selected user's overall analytics"
            color={colors.blue}
            icon="🎯"
          />

          <MetricCard
            title="Sleep Adherence"
            value={
              sleepAdherence !== undefined
                ? `${sleepAdherence.toFixed(1)}%`
                : "—"
            }
            subtitle="Selected user's sleep analytics"
            color={colors.green}
            icon="🌙"
          />

          <MetricCard
            title="Wake-up Success"
            value={
              wakeSuccess !== undefined
                ? `${wakeSuccess.toFixed(1)}%`
                : "—"
            }
            subtitle="Selected user's wake-up analytics"
            color={colors.orange}
            icon="⏰"
          />
        </div>

        <SectionCard
          title="👥 Registered Users"
          subtitle="Select a user to view their live wellness and cognitive analytics."
        >
          {loading ? (
            <p style={{ color: colors.muted }}>Loading registered users...</p>
          ) : users.length === 0 ? (
            <p style={{ color: colors.muted }}>
              No users were returned by the backend.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))",
                gap: "15px",
              }}
            >
              {users.map((user, index) => {
                const email = getUserEmail(user);
                const isSelected =
                  selectedUser && getUserEmail(selectedUser) === email;

                return (
                  <div
                    key={email || index}
                    style={{
                      border: `1px solid ${
                        isSelected ? colors.purple : colors.border
                      }`,
                      borderRadius: "14px",
                      padding: "17px",
                      background: isSelected ? "#f7f4ff" : "#fff",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "15px",
                      }}
                    >
                      <div
                        style={{
                          width: "43px",
                          height: "43px",
                          borderRadius: "13px",
                          display: "grid",
                          placeItems: "center",
                          background: "#eee8ff",
                          color: colors.purple,
                          fontSize: "21px",
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {getUserName(user).charAt(0).toUpperCase()}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 750,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {getUserName(user)}
                        </div>

                        {email && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: colors.muted,
                              marginTop: "5px",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {email}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => viewAnalytics(user)}
                      style={{
                        width: "100%",
                        border: "none",
                        borderRadius: "9px",
                        background: isSelected
                          ? colors.purple
                          : "#eeeaff",
                        color: isSelected ? "#fff" : colors.purple,
                        padding: "11px",
                        fontSize: "13px",
                        fontWeight: 750,
                        cursor: "pointer",
                      }}
                    >
                      View Analytics →
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {selectedUser && (
          <div style={{ marginTop: "27px" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "24px",
                    color: colors.text,
                  }}
                >
                  📊 User Analytics
                </h2>

                <p
                  style={{
                    margin: "7px 0 0",
                    color: colors.muted,
                    fontSize: "13px",
                    overflowWrap: "anywhere",
                  }}
                >
                  {getUserEmail(selectedUser)}
                </p>
              </div>

              <button
                onClick={closeAnalytics}
                style={{
                  border: `1px solid ${colors.border}`,
                  background: "#fff",
                  color: colors.text,
                  borderRadius: "10px",
                  padding: "10px 15px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ✕ Close Analytics
              </button>
            </div>

            {analyticsLoading && (
              <div style={{ ...cardStyle, marginBottom: "20px" }}>
                Loading analytics from the backend...
              </div>
            )}

            {analytics && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "20px",
                    marginBottom: "20px",
                  }}
                >
                  <SectionCard
                    title="🎯 Overall Challenge Accuracy"
                    subtitle="Based on the user's overall challenge analytics."
                  >
                    <DonutChart value={accuracy} color={colors.purple} />

                    <div style={{ marginTop: "12px" }}>
                      <DataRows
                        data={{
                          total_challenges: challengeCount,
                          correct_answers: correct,
                          incorrect_answers: incorrect,
                          accuracy_percent: accuracy,
                        }}
                      />
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="⏰ Wake-up Performance"
                    subtitle="Wake-up success and consistency reported by the backend."
                  >
                    <DonutChart value={wakeSuccess} color={colors.orange} />

                    <DataRows
                      data={{
                        wake_up_success_rate: wakeSuccess,
                        total_wakeups:
                          findValue(overall, ["total_wakeups"]) ??
                          findValue(behavioral, ["total_wakeups"]),
                        verified_wakeups: findValue(behavioral, [
                          "verified_wakeups",
                        ]),
                        snoozed_wakeups: findValue(behavioral, [
                          "snoozed_wakeups",
                          "snooze_count",
                        ]),
                      }}
                    />
                  </SectionCard>

                  <SectionCard
                    title="🌙 Sleep Adherence"
                    subtitle="Sleep schedule information from sleep and behavioral analytics."
                  >
                    <DonutChart value={sleepAdherence} color={colors.green} />

                    <DataRows
                      data={{
                        average_sleep_hours: findValue(sleep, [
                          "average_sleep_hours",
                          "avg_sleep_hours",
                        ]),
                        target_sleep_hours: findValue(sleep, [
                          "target_sleep_hours",
                        ]),
                        sleep_adherence: sleepAdherence,
                        records_analyzed: findValue(sleep, [
                          "records_analyzed",
                        ]),
                        sleep_status:
                          sleep.sleep_status ||
                          behavioral.sleep_status ||
                          habit.sleep_status,
                      }}
                    />
                  </SectionCard>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
                    gap: "20px",
                    marginBottom: "20px",
                  }}
                >
                  <SectionCard
                    title="📈 Answer Breakdown"
                    subtitle="Correct and incorrect answers are calculated as a share of the overall challenge count."
                  >
                    <ProgressBar
                      label={`Correct answers (${correct ?? "N/A"})`}
                      value={correctPercent}
                      color={colors.green}
                    />

                    <ProgressBar
                      label={`Incorrect answers (${incorrect ?? "N/A"})`}
                      value={incorrectPercent}
                      color={colors.red}
                    />

                    <DataRows
                      data={{
                        total_challenges: challengeCount,
                        correct_answers: correct,
                        incorrect_answers: incorrect,
                      }}
                    />
                  </SectionCard>

                  <SectionCard
                    title="🧠 Adaptive Difficulty"
                    subtitle="The adaptive model uses recent challenge attempts to select a difficulty level."
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: "12px",
                        marginBottom: "18px",
                      }}
                    >
                      <div
                        style={{
                          background: "#f4f1ff",
                          borderRadius: "12px",
                          padding: "15px",
                        }}
                      >
                        <div
                          style={{
                            color: colors.muted,
                            fontSize: "12px",
                            marginBottom: "8px",
                          }}
                        >
                          Previous Difficulty
                        </div>

                        <strong style={{ color: colors.purple }}>
                          {formatValue(previousDifficulty)}
                        </strong>
                      </div>

                      <div
                        style={{
                          background: "#edf8ff",
                          borderRadius: "12px",
                          padding: "15px",
                        }}
                      >
                        <div
                          style={{
                            color: colors.muted,
                            fontSize: "12px",
                            marginBottom: "8px",
                          }}
                        >
                          Next Difficulty
                        </div>

                        <strong style={{ color: colors.blue }}>
                          {formatValue(recommendedDifficulty)}
                        </strong>
                      </div>
                    </div>

                    <ProgressBar
                      label={`Recent challenge accuracy${
                        recentAttempts !== undefined
                          ? ` (${recentAttempts} attempts)`
                          : ""
                      }`}
                      value={recentAccuracy}
                      color={colors.blue}
                    />

                    <ProgressBar
                      label="Model confidence"
                      value={adaptiveConfidence}
                      color={colors.purple}
                    />

                    <DataRows
                      data={{
                        model: adaptive.model || adaptive.model_name,
                        attempts_analyzed: recentAttempts,
                        accuracy_scope:
                          adaptive.accuracy_scope ||
                          recommendations.challenge_accuracy_scope ||
                          "Scope not specified by the backend",
                        completion_rate: findValue(adaptive, [
                          "completion_rate",
                        ]),
                        wake_consistency: findValue(adaptive, [
                          "wake_consistency",
                          "wake_up_consistency",
                        ]),
                        snooze_count: findValue(adaptive, ["snooze_count"]),
                        reason: adaptive.reason,
                      }}
                    />
                  </SectionCard>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
                    gap: "20px",
                    marginBottom: "20px",
                  }}
                >
                  <SectionCard
                    title="⭐ Habit Score"
                    subtitle="Habit score and related information returned by the habit-score endpoint."
                  >
                    <DonutChart value={habitScore} color={colors.blue} />

                    <DataRows data={habit} />
                  </SectionCard>

                  <SectionCard
                    title="😴 Sleep Analytics"
                    subtitle="Detailed sleep measurements returned by the backend."
                  >
                    <DataRows data={sleep} />
                  </SectionCard>
                </div>

                <SectionCard
                  title="💡 Wellness Recommendations"
                  subtitle="Recommendations and model details returned by the recommendations endpoint."
                >
                  {recommendationList.length > 0 ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(230px, 1fr))",
                        gap: "12px",
                        marginBottom: "18px",
                      }}
                    >
                      {recommendationList.map((recommendation, index) => (
                        <div
                          key={index}
                          style={{
                            display: "flex",
                            gap: "11px",
                            alignItems: "flex-start",
                            padding: "15px",
                            borderRadius: "12px",
                            background: index % 2 === 0 ? "#f5f2ff" : "#eef9f6",
                            lineHeight: 1.6,
                            fontSize: "13px",
                          }}
                        >
                          <span style={{ fontSize: "19px" }}>✦</span>

                          <span>
                            {typeof recommendation === "string"
                              ? recommendation
                              : JSON.stringify(recommendation)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: colors.muted, fontSize: "13px" }}>
                      No recommendation list was returned. Check the details
                      below for the available response.
                    </p>
                  )}

                  <DataRows data={recommendations} />
                </SectionCard>

                <details
                  style={{
                    ...cardStyle,
                    marginTop: "20px",
                  }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      fontWeight: 750,
                      color: colors.text,
                    }}
                  >
                    🔍 View Complete API Data
                  </summary>

                  <div style={{ marginTop: "18px" }}>
                    {Object.entries(analytics).map(([key, value]) => (
                      <details
                        key={key}
                        style={{
                          borderTop: `1px solid ${colors.border}`,
                          padding: "14px 0",
                        }}
                      >
                        <summary
                          style={{
                            cursor: "pointer",
                            fontWeight: 700,
                            color: colors.purple,
                          }}
                        >
                          {formatLabel(key)}
                        </summary>

                        <pre
                          style={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                            background: "#f7f8fc",
                            padding: "14px",
                            borderRadius: "10px",
                            fontSize: "12px",
                            lineHeight: 1.6,
                            overflowX: "auto",
                          }}
                        >
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      </details>
                    ))}
                  </div>
                </details>
              </>
            )}
          </div>
        )}

        <footer
          style={{
            textAlign: "center",
            color: colors.muted,
            fontSize: "12px",
            padding: "28px 10px 8px",
          }}
        >
          COGNIA Wellness Coach · Analytics are loaded from your backend API.
        </footer>
      </div>
    </div>
  );
}
