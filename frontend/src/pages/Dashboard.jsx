import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { apiFetch } from "../api";
import { useAuth } from "../auth";
import {
  CHALLENGE_LABELS,
  ErrorBox,
  Loading,
  formatClock,
  pct,
} from "../components/ui";

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [nextAlarm, setNextAlarm] = useState(null);
  const [error, setError] = useState("");
  const [days, setDays] = useState(7);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setData(null);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    const iso = (d) => d.toISOString().slice(0, 10);

    Promise.all([
      apiFetch(`/dashboards/user/${user.id}?start=${iso(start)}&end=${iso(end)}`),
      apiFetch(`/alarms/next/${user.id}`),
    ])
      .then(([dashboard, next]) => {
        setData(dashboard);
        setNextAlarm(next);
        // Create today's habit and challenge nudges (once a day each).
        apiFetch(`/notifications/generate/${user.id}`, { method: "POST" }).catch(() => {});
      })
      .catch((err) => setError(err.message));
  }, [days, user.id]);

  const recommendation = data?.recommendations?.[0];

  const track = (action) => {
    if (!recommendation) return;
    apiFetch("/tracking/recommendation-events", {
      method: "POST",
      body: { recommendation_id: recommendation.id, action, source: "dashboard" },
    }).catch(() => {});
  };

  // Count a recommendation as viewed once it is on screen.
  useEffect(() => {
    if (recommendation) track("viewed");
  }, [recommendation?.id]);

  if (error) {
    return <div className="content"><ErrorBox message={error} /></div>;
  }
  if (!data) {
    return <div className="content"><Loading /></div>;
  }

  const habit = data.habit;
  const wake = data.wake_up;
  const challenges = data.challenges;
  const alarm = nextAlarm?.alarm;
  const clock = formatClock(alarm?.alarm_time);
  const nextWhen = nextAlarm?.next_trigger ? new Date(nextAlarm.next_trigger) : null;
  const daily = data.trends.daily.slice(-7);
  const today = new Date();

  return (
    <section className="content">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">
            {today.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}
          </p>
          <h1>
            Hello, {user.full_name.split(" ")[0]} <span>👋</span>
          </h1>
          <p className="subtitle">Start your day with focus and consistency.</p>
        </div>

        <button className="primary-button" onClick={() => navigate("/alarms")}>
          <span>+</span> Create Alarm
        </button>
      </div>

      {/* Next Alarm */}
      <section className="next-alarm">
        <div className="alarm-left">
          <div className="alarm-icon">⏰</div>
          <div>
            <span className="card-label">YOUR NEXT ALARM</span>
            {alarm ? (
              <>
                <div className="alarm-time">
                  {clock.time} <small>{clock.period}</small>
                </div>
                <p>
                  {nextWhen &&
                    nextWhen.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
                </p>
              </>
            ) : (
              <>
                <div className="alarm-time">No alarm</div>
                <p>Create an alarm to start your routine.</p>
              </>
            )}
          </div>
        </div>

        <div className="alarm-challenge">
          <span className="challenge-label">WAKE-UP CHALLENGE</span>
          {alarm ? (
            <>
              <div className="challenge-type">
                <span>🧠</span>
                {CHALLENGE_LABELS[alarm.challenge_type] || alarm.challenge_type} challenge
              </div>
              <p>
                Adaptive difficulty · {alarm.snooze_limit} snoozes allowed
              </p>
            </>
          ) : (
            <p>No challenge scheduled.</p>
          )}
        </div>

        <button className="edit-button" onClick={() => navigate("/alarms")}>
          {alarm ? "Edit Alarm" : "Add Alarm"}
        </button>
      </section>

      <div className="section-heading">
        <div>
          <h2>Your Progress</h2>
          <p>Keep building your wake-up consistency.</p>
        </div>
        <select
          className="period"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>This week</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>Habit Score</span>
            <div className="stat-icon purple">✦</div>
          </div>
          <h3>
            {pct(habit.score)}
            <span>{habit.score !== null ? "%" : ""}</span>
          </h3>
          <div className="progress">
            <div style={{ width: `${habit.score || 0}%` }}></div>
          </div>
          {habit.improvement !== null && habit.improvement !== undefined ? (
            <p className={habit.improvement >= 0 ? "positive" : "negative-text"}>
              {habit.improvement >= 0 ? "↑" : "↓"} {Math.abs(habit.improvement)}{" "}
              <span>vs previous period</span>
            </p>
          ) : (
            <p className="streak-text">Not enough data to compare yet.</p>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Challenge Accuracy</span>
            <div className="stat-icon blue">✓</div>
          </div>
          <h3>
            {pct(challenges.accuracy_percent)}
            <span>{challenges.accuracy_percent !== null ? "%" : ""}</span>
          </h3>
          <div className="progress blue-progress">
            <div style={{ width: `${challenges.accuracy_percent || 0}%` }}></div>
          </div>
          <p className="streak-text">{challenges.attempts} attempts in this period</p>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Wake-up Success</span>
            <div className="stat-icon orange">🔥</div>
          </div>
          <h3>
            {pct(wake.success_rate_percent)}
            <small>{wake.success_rate_percent !== null ? "%" : ""}</small>
          </h3>
          <p className="streak-text">
            {wake.successful} of {wake.attempts} wake-ups verified
          </p>
          {wake.consistency_percent !== null && wake.consistency_percent !== undefined && (
            <p className="positive">{Math.round(wake.consistency_percent)}% on time</p>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Avg. Response</span>
            <div className="stat-icon green">◷</div>
          </div>
          <h3>
            {challenges.average_response_seconds !== null
              ? Math.round(challenges.average_response_seconds)
              : "–"}
            <span>{challenges.average_response_seconds !== null ? "s" : ""}</span>
          </h3>
          <p className="streak-text">Average challenge time</p>
          {data.snooze?.available && (
            <p className="positive">{data.snooze.snoozes} snoozes this period</p>
          )}
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="chart-card">
          <div className="card-header">
            <div>
              <h2>Weekly Performance</h2>
              <p>Your challenge accuracy over the last 7 days.</p>
            </div>
            <button className="view-button" onClick={() => navigate("/analytics")}>
              View Analytics →
            </button>
          </div>

          <div className="chart">
            <div className="y-labels">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>

            <div className="chart-area">
              <div className="grid-line line-1"></div>
              <div className="grid-line line-2"></div>
              <div className="grid-line line-3"></div>
              <div className="grid-line line-4"></div>

              <div className="bars">
                {daily.map((day, index) => {
                  const label = new Date(`${day.date}T00:00:00`).toLocaleDateString([], {
                    weekday: "short",
                  });
                  const value = day.challenge_accuracy_percent;
                  return (
                    <div className="bar-wrap" key={day.date}>
                      <div
                        className={`bar ${index === daily.length - 1 ? "today" : ""}`}
                        style={{ height: `${value || 0}%` }}
                        title={value === null ? "No attempts" : `${Math.round(value)}%`}
                      ></div>
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="recommendation-card">
          <div className="recommendation-icon">✦</div>
          <span className="card-label">SMART INSIGHT</span>

          {recommendation && !dismissed ? (
            <>
              <h2>{recommendation.title}</h2>
              <p>{recommendation.detail}</p>
              <p className="rec-basis">{recommendation.basis}</p>
              <div className="recommendation-footer">
                <span>Personal recommendation</span>
                <button
                  onClick={() => {
                    track("accepted");
                    navigate("/analytics");
                  }}
                >
                  Act on it →
                </button>
                <button
                  onClick={() => {
                    track("dismissed");
                    setDismissed(true);
                  }}
                >
                  Dismiss
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>All caught up</h2>
              <p>No new recommendations right now. Keep your routine steady.</p>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

export default Dashboard;
