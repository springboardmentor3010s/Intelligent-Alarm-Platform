import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getSessionHistory } from "../services/api";


// =========================================================
// DATE / TIME HELPERS
// =========================================================

function parseDate(dateString) {
  if (!dateString) {
    return null;
  }

  const value = String(dateString).trim();

  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}


// =========================================================
// FORMAT DATE - INDIA
// =========================================================

function formatDate(dateString) {
  const date = parseDate(dateString);

  if (!date) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}


// =========================================================
// FORMAT TIME - INDIA
// =========================================================

function formatTime(dateString) {
  const date = parseDate(dateString);

  if (!date) {
    return "—";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}


// =========================================================
// CALCULATE DURATION
// =========================================================

function calculateDuration(startedAt, completedAt) {
  const start = parseDate(startedAt);
  const end = parseDate(completedAt);

  if (!start || !end) {
    return "—";
  }

  const seconds = Math.floor(
    (end.getTime() - start.getTime()) / 1000
  );

  if (seconds < 0) {
    return "—";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}


// =========================================================
// FORMAT DISMISSAL STATUS (MILESTONE 3)
// =========================================================

function formatDismissalStatus(status) {
  const map = {
    dismissed: "Dismissed",
    failed: "Failed",
    expired: "Expired",
    snoozed: "Snoozed",
    active: "Active",
  };

  return map[String(status || "dismissed").toLowerCase()] || (status || "—");
}


// =========================================================
// COMPONENT
// =========================================================

export default function SessionHistory() {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  // =======================================================
  // LOAD SESSION HISTORY
  // =======================================================

  useEffect(() => {
    let mounted = true;

    async function loadHistory() {
      try {
        setLoading(true);
        setError("");

        const data = await getSessionHistory();

        if (!mounted) {
          return;
        }

        if (
          data &&
          Array.isArray(data.sessions)
        ) {
          setSessions(data.sessions);
        } else if (Array.isArray(data)) {
          setSessions(data);
        } else {
          setSessions([]);
        }
      } catch (err) {
        if (!mounted) {
          return;
        }

        console.error(
          "Session history error:",
          err
        );

        setError(
          err?.message ||
            "Failed to load session history."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      mounted = false;
    };
  }, []);


  // =========================================================
  // STATISTICS
  // =========================================================

  const totalSessions = sessions.length;

  const completedSessions =
    sessions.filter(
      (session) =>
        session.session_status ===
        "completed"
    ).length;

  const correctSessions =
    sessions.filter(
      (session) =>
        session.is_correct === true
    ).length;


  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="history-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="history-header">

        <div>

          <p className="history-label">
            PERFORMANCE
          </p>

          <h1>
            Session History
          </h1>

          <p className="history-subtitle">
            Review your previous cognitive
            alarm sessions.
          </p>

        </div>


        <button
          type="button"
          className="history-back-button"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          ← Back to Dashboard
        </button>

      </header>


      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="history-error">
          {error}
        </div>
      )}


      {/* =================================================
          STATISTICS
      ================================================= */}

      {!loading && (
        <div className="history-stats">

          <div className="history-stat-card">

            <span className="stat-icon">
              📊
            </span>

            <div>

              <span>
                Total Sessions
              </span>

              <strong>
                {totalSessions}
              </strong>

            </div>

          </div>


          <div className="history-stat-card">

            <span className="stat-icon">
              ✓
            </span>

            <div>

              <span>
                Completed
              </span>

              <strong>
                {completedSessions}
              </strong>

            </div>

          </div>


          <div className="history-stat-card">

            <span className="stat-icon">
              🧠
            </span>

            <div>

              <span>
                Correct Answers
              </span>

              <strong>
                {correctSessions}
              </strong>

            </div>

          </div>

        </div>
      )}


      {/* =================================================
          SESSION LIST
      ================================================= */}

      <section className="history-section">

        <div className="history-section-header">

          <div>

            <p className="history-label">
              ACTIVITY
            </p>

            <h2>
              Previous Sessions
            </h2>

          </div>


          <span className="session-count">

            {sessions.length}{" "}

            {sessions.length === 1
              ? "session"
              : "sessions"}

          </span>

        </div>


        {/* =================================================
            LOADING
        ================================================= */}

        {loading && (

          <div className="history-empty">

            <div className="history-loading-icon">
              ⏳
            </div>

            <h3>
              Loading history...
            </h3>

          </div>

        )}


        {/* =================================================
            EMPTY
        ================================================= */}

        {!loading &&
          sessions.length === 0 && (

            <div className="history-empty">

              <div className="history-empty-icon">
                🧠
              </div>

              <h3>
                No sessions yet
              </h3>

              <p>
                Complete a cognitive alarm
                session and it will appear here.
              </p>

            </div>

          )}


        {/* =================================================
            SESSION CARDS
        ================================================= */}

        {!loading &&
          sessions.length > 0 && (

            <div className="history-list">

              {sessions.map(
                (session, index) => {

                  const isCompleted =
                    session.session_status ===
                    "completed";

                  const isExpired =
                    session.session_status ===
                    "expired";

                  const isStarted =
                    session.session_status ===
                    "started";

                  return (

                    <article
                      className="history-card"
                      key={session.id}
                    >

                      {/* CARD HEADER */}

                      <div className="history-card-main">

                        <div className="history-session-icon">
                          🧠
                        </div>


                        <div className="history-session-info">

                          <h3>
                            {session.alarm_name ||
                              "Alarm"}
                          </h3>

                          <p>
                            Session #
                            {sessions.length - index}
                          </p>

                        </div>


                        {/* STATUS */}

                        <span
                          className={
                            isCompleted
                              ? "history-status completed"
                              : isExpired
                              ? "history-status expired"
                              : isStarted
                              ? "history-status started"
                              : "history-status started"
                          }
                        >

                          {isCompleted
                            ? "Completed"
                            : isExpired
                            ? "Timed Out"
                            : isStarted
                            ? "In Progress"
                            : "Unknown"}

                        </span>

                      </div>


                      {/* DETAILS */}

                      <div className="history-details">

                        {/* DATE */}

                        <div className="history-detail">

                          <span>
                            Date
                          </span>

                          <strong>
                            {formatDate(
                              session.started_at
                            )}
                          </strong>

                        </div>


                        {/* STARTED */}

                        <div className="history-detail">

                          <span>
                            Started
                          </span>

                          <strong>
                            {formatTime(
                              session.started_at
                            )}
                          </strong>

                        </div>


                        {/* DURATION */}

                        <div className="history-detail">

                          <span>
                            Duration
                          </span>

                          <strong>
                            {calculateDuration(
                              session.started_at,
                              session.completed_at
                            )}
                          </strong>

                        </div>


                        {/* RESULT */}

                        <div className="history-detail">

                          <span>
                            Result
                          </span>

                          <strong
                            className={
                              session.is_correct === true
                                ? "result-correct"
                                : session.is_correct === false
                                ? "result-incorrect"
                                : isExpired
                                ? "result-incorrect"
                                : "result-pending"
                            }
                          >

                            {session.is_correct === true
                              ? "Correct"
                              : session.is_correct === false
                              ? "Incorrect"
                              : isExpired
                              ? "Timed Out"
                              : "Pending"}

                          </strong>

                        </div>


                        {/* RESPONSE TIME (MILESTONE 3) */}

                        <div className="history-detail">

                          <span>
                            Response Time
                          </span>

                          <strong>
                            {session.response_time_seconds !== null &&
                            session.response_time_seconds !== undefined
                              ? `${session.response_time_seconds} sec`
                              : "—"}
                          </strong>

                        </div>


                        {/* SNOOZE COUNT (MILESTONE 3) */}

                        <div className="history-detail">

                          <span>
                            Snoozes
                          </span>

                          <strong>
                            {session.snooze_count ?? 0}
                          </strong>

                        </div>


                        {/* DISMISSAL STATUS (MILESTONE 3) */}

                        <div className="history-detail">

                          <span>
                            Dismissal
                          </span>

                          <span
                            className={`dismissal-badge dismissal-${String(
                              session.dismissal_status || "dismissed"
                            ).toLowerCase()}`}
                          >
                            {formatDismissalStatus(
                              session.dismissal_status
                            )}
                          </span>

                        </div>

                      </div>


                      {/* USER ANSWER */}

                      {session.user_answer !== null &&
                        session.user_answer !== undefined &&
                        session.user_answer !== "" && (

                          <div className="history-answer">

                            <span>
                              Your Answer
                            </span>

                            <strong>
                              {session.user_answer}
                            </strong>

                          </div>

                        )}

                    </article>
                  );
                }
              )}

            </div>
          )}

      </section>

    </div>
  );
}