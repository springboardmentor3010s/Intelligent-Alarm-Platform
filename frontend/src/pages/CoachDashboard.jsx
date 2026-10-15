import { useCallback, useEffect, useMemo, useState } from "react";
import "../App.css";
import { apiFetch, downloadFile } from "../api";
import BarList from "../components/BarList";
import {
  Empty,
  ErrorBox,
  Loading,
  formatDateTime,
  minutesLabel,
  pct,
  titleCase,
} from "../components/ui";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const CHART_COLORS = [
  "#6366f1",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

function numeric(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function ChartCard({ title, description, children }) {
  return (
    <section className="alarms-card wellness-chart-card">
      <div className="card-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function NoChartData({ message = "Not enough recorded data to display this chart." }) {
  return (
    <div
      style={{
        minHeight: 190,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: 24,
        color: "var(--muted, #64748b)",
      }}
    >
      {message}
    </div>
  );
}

function WellnessCharts({ data }) {
  const users = data.users || [];

  const habitScores = useMemo(
    () =>
      users
        .map((user) => ({
          name: user.full_name,
          score: numeric(user.habit_score),
        }))
        .filter((user) => user.score !== null),
    [users]
  );

  const wakeUpData = useMemo(
    () =>
      users
        .map((user) => ({
          name: user.full_name,
          success: numeric(user.wake_up_success_rate_percent),
        }))
        .filter((user) => user.success !== null),
    [users]
  );

  const cognitiveData = useMemo(
    () =>
      users
        .map((user) => ({
          name: user.full_name,
          accuracy: numeric(user.challenge_accuracy_percent),
        }))
        .filter((user) => user.accuracy !== null),
    [users]
  );

  const riskData = useMemo(() => {
    const atRisk = users.filter((user) => user.at_risk).length;
    const onTrack = users.length - atRisk;

    return [
      { name: "At risk", value: atRisk },
      { name: "On track", value: onTrack },
    ].filter((item) => item.value > 0);
  }, [users]);

  const habitDistribution = useMemo(() => {
    const groups = [
      { name: "0–39", min: 0, max: 40, value: 0 },
      { name: "40–59", min: 40, max: 60, value: 0 },
      { name: "60–79", min: 60, max: 80, value: 0 },
      { name: "80–100", min: 80, max: 101, value: 0 },
    ];

    habitScores.forEach(({ score }) => {
      const group = groups.find(
        (item) => score >= item.min && score < item.max
      );

      if (group) group.value += 1;
    });

    return groups.filter((group) => group.value > 0);
  }, [habitScores]);

  const sleepAdherence = numeric(
    data.sleep?.available
      ? data.sleep.average_adherence_percent
      : null
  );

  const responseTimeData = useMemo(
    () =>
      users
        .map((user) => ({
          name: user.full_name,
          seconds: numeric(user.average_response_seconds),
        }))
        .filter((user) => user.seconds !== null),
    [users]
  );

  const chartHeight = 280;

  return (
    <>
      <div className="wellness-chart-grid">
        <ChartCard
          title="Habit Score Distribution"
          description="Number of monitored users in each recorded score range."
        >
          {habitDistribution.length ? (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <PieChart>
                <Pie
                  data={habitDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={85}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {habitDistribution.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <NoChartData message="Habit scores are not available for this period." />
          )}
        </ChartCard>

        <ChartCard
          title="User Risk Distribution"
          description="Users flagged by the existing wellness risk rules."
        >
          {riskData.length ? (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <PieChart>
                <Pie
                  data={riskData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={85}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {riskData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.name === "At risk"
                          ? "#ef4444"
                          : "#14b8a6"
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <NoChartData message="No users are assigned to this coach." />
          )}
        </ChartCard>

        <ChartCard
          title="Habit Scores by User"
          description="Recorded habit score out of 100. Missing scores are excluded."
        >
          {habitScores.length ? (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={habitScores}
                margin={{ top: 12, right: 12, left: 0, bottom: 55 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  height={75}
                  tick={{ fontSize: 11 }}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar
                  dataKey="score"
                  name="Habit score"
                  fill="#6366f1"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoChartData message="No habit scores are available." />
          )}
        </ChartCard>

        <ChartCard
          title="Wake-up Success by User"
          description="Recorded wake-up success rate for the selected period."
        >
          {wakeUpData.length ? (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={wakeUpData}
                margin={{ top: 12, right: 12, left: 0, bottom: 55 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  height={75}
                  tick={{ fontSize: 11 }}
                />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(value) => [`${value}%`, "Success rate"]} />
                <Bar
                  dataKey="success"
                  name="Success rate"
                  fill="#14b8a6"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoChartData message="No wake-up success rates are available." />
          )}
        </ChartCard>

        <ChartCard
          title="Cognitive Challenge Accuracy"
          description="Recorded challenge accuracy for each user."
        >
          {cognitiveData.length ? (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={cognitiveData}
                margin={{ top: 12, right: 12, left: 0, bottom: 55 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  height={75}
                  tick={{ fontSize: 11 }}
                />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Accuracy"]}
                />
                <Bar
                  dataKey="accuracy"
                  name="Accuracy"
                  fill="#f59e0b"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoChartData message="No challenge accuracy data is available." />
          )}
        </ChartCard>

        <ChartCard
          title="Average Challenge Response Time"
          description="Time taken to respond to cognitive challenges, in seconds."
        >
          {responseTimeData.length ? (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={responseTimeData}
                margin={{ top: 12, right: 12, left: 0, bottom: 55 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  height={75}
                  tick={{ fontSize: 11 }}
                />
                <YAxis unit="s" />
                <Tooltip
                  formatter={(value) => [`${value} seconds`, "Response time"]}
                />
                <Bar
                  dataKey="seconds"
                  name="Response time"
                  fill="#8b5cf6"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoChartData message="No challenge response-time data is available." />
          )}
        </ChartCard>

        <ChartCard
          title="Sleep Schedule Adherence"
          description="Average adherence among users with recorded sleep logs."
        >
          {sleepAdherence !== null && data.sleep?.available ? (
            <>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  data={[
                    {
                      name: "Sleep adherence",
                      adherence: sleepAdherence,
                      remaining: Math.max(0, 100 - sleepAdherence),
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip
                    formatter={(value) => [`${value}%`]}
                  />
                  <Legend />
                  <Bar
                    dataKey="adherence"
                    name="Adherence"
                    stackId="sleep"
                    fill="#14b8a6"
                  />
                  <Bar
                    dataKey="remaining"
                    name="Remaining"
                    stackId="sleep"
                    fill="#cbd5e1"
                  />
                </BarChart>
              </ResponsiveContainer>
              <p className="muted-line">
                Based on {data.sleep.users_with_sleep_logs} users with
                recorded sleep logs.
              </p>
            </>
          ) : (
            <NoChartData message="Sleep charts will appear when sleep logs are recorded." />
          )}
        </ChartCard>
      </div>
    </>
  );
}

function CoachDashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const range = useCallback(() => {
    const end = new Date();
    const start = new Date();

    start.setDate(end.getDate() - (days - 1));

    const iso = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    return `start=${iso(start)}&end=${iso(end)}`;
  }, [days]);

  useEffect(() => {
    let cancelled = false;

    setData(null);
    setDetail(null);
    setError("");

    apiFetch(`/coach/dashboard?${range()}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [days, range]);

  const openUser = async (id) => {
    setError("");

    try {
      const result = await apiFetch(`/coach/users/${id}?${range()}`);
      setDetail(result);
    } catch (err) {
      setError(err.message);
    }
  };

  const exportCsv = async () => {
    setBusy("csv");
    setError("");

    try {
      await downloadFile(
        `/coach/reports/export.csv?${range()}`,
        "wellness_coach_report.csv"
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const exportPdf = async () => {
    setBusy("pdf");
    setError("");

    try {
      await downloadFile(
        `/coach/reports/export.pdf?${range()}`,
        `detailed_wellness_report_${days}_days.pdf`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  if (!data) {
    return (
      <div className="page-container">
        {error ? <ErrorBox message={error} /> : <Loading />}
      </div>
    );
  }

  const overview = data.overview || {};

  return (
    <div className="page-container wellness-coach-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">WELLNESS COACH</p>
          <h1>Coach Dashboard</h1>
          <p className="subtitle">
            Progress, habit adherence, cognitive performance, and
            wellness insights for the people you support.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <select
            className="period"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            aria-label="Select reporting period"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>

          <button
            className="primary-button"
            onClick={exportPdf}
            disabled={Boolean(busy)}
          >
            {busy === "pdf" ? "Preparing PDF..." : "Download Detailed PDF"}
          </button>

          <button
            className="small-button"
            onClick={exportCsv}
            disabled={Boolean(busy)}
          >
            {busy === "csv" ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      <ErrorBox message={error} />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>Users monitored</span>
          </div>
          <h3>{overview.users_monitored ?? 0}</h3>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Average habit score</span>
          </div>
          <h3>
            {overview.average_habit_score == null
              ? "—"
              : pct(overview.average_habit_score)}
          </h3>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Wake-up success</span>
          </div>
          <h3>
            {overview.average_wake_up_success_percent == null
              ? "—"
              : `${overview.average_wake_up_success_percent}%`}
          </h3>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>At risk</span>
          </div>
          <h3>{overview.at_risk_count ?? 0}</h3>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Challenge accuracy</span>
          </div>
          <h3>
            {overview.average_challenge_accuracy_percent == null
              ? "—"
              : `${overview.average_challenge_accuracy_percent}%`}
          </h3>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Challenge completion</span>
          </div>
          <h3>
            {overview.average_challenge_completion_percent == null
              ? "—"
              : `${overview.average_challenge_completion_percent}%`}
          </h3>
        </div>
      </div>

      {data.sleep?.available && (
        <p className="muted-line">
          Sleep adherence: {data.sleep.average_adherence_percent}% on
          average across {data.sleep.users_with_sleep_logs} users with
          recorded sleep logs.
        </p>
      )}

      <section className="alarms-card">
        <div className="card-header">
          <div>
            <h2>Wellness Analytics</h2>
            <p>
              Visual analysis of recorded activity for the selected
              reporting period.
            </p>
          </div>
        </div>

        <WellnessCharts data={data} />
      </section>

      <section className="alarms-card">
        <div className="card-header">
          <div>
            <h2>People</h2>
            <p>{data.habit_adherence_note}</p>
          </div>
        </div>

        {data.users.length === 0 ? (
          <Empty title="No users assigned yet">
            An administrator assigns users to you.
          </Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Habit</th>
                  <th>Change</th>
                  <th>Wake-ups</th>
                  <th>Consistency</th>
                  <th>Accuracy</th>
                  <th>Last activity</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {data.users.map((user) => (
                  <tr key={user.user_id}>
                    <td>{user.full_name}</td>
                    <td>
                      {user.habit_score == null
                        ? "—"
                        : pct(user.habit_score)}
                    </td>
                    <td>
                      {user.habit_improvement == null
                        ? "—"
                        : `${
                            user.habit_improvement > 0 ? "+" : ""
                          }${user.habit_improvement}`}
                    </td>
                    <td>{user.wake_up_attempts}</td>
                    <td>
                      {user.consistency_percent == null
                        ? "—"
                        : `${user.consistency_percent}%`}
                    </td>
                    <td>
                      {user.challenge_accuracy_percent == null
                        ? "—"
                        : `${user.challenge_accuracy_percent}%`}
                    </td>
                    <td>
                      {user.last_activity
                        ? formatDateTime(user.last_activity)
                        : "—"}
                    </td>
                    <td>
                      {user.at_risk ? (
                        <span className="badge-risk">At risk</span>
                      ) : (
                        <span className="badge-ok">On track</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="small-button"
                        onClick={() => openUser(user.user_id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.at_risk.length > 0 && (
        <section className="alarms-card">
          <div className="card-header">
            <div>
              <h2>Needs Attention</h2>
              <p>
                Users flagged by the existing wellness monitoring rules.
              </p>
            </div>
          </div>

          {data.at_risk.map((user) => (
            <div key={user.user_id} className="risk-item">
              <strong>{user.full_name}</strong>

              <ul className="reason-list">
                {user.risk_reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>

              {user.interventions.length > 0 && (
                <p className="muted-line">
                  Suggested: {user.interventions.join(" ")}
                </p>
              )}

              <button
                className="small-button"
                onClick={() => openUser(user.user_id)}
              >
                View Detailed Progress
              </button>
            </div>
          ))}
        </section>
      )}

      {detail && (
        <section className="alarms-card">
          <div className="card-header">
            <div>
              <h2>{detail.user.full_name}</h2>
              <p>
                Habit score{" "}
                {detail.habit.score == null
                  ? "—"
                  : pct(detail.habit.score)}{" "}
                · {detail.wake_up.attempts} wake-up attempts
              </p>
            </div>

            <button
              className="small-button"
              onClick={() => setDetail(null)}
            >
              Close
            </button>
          </div>

          <div className="two-column">
            <div>
              <h3 className="sub-heading">Habit Score Components</h3>

              <BarList
                rows={Object.entries(detail.habit.components)
                  .filter(([, value]) => value !== null)
                  .map(([key, value]) => ({
                    label: titleCase(key),
                    value,
                  }))}
              />

              <h3 className="sub-heading">Wake-up Progress</h3>

              <BarList
                rows={detail.trends.weekly
                  .slice(-8)
                  .filter(
                    (week) =>
                      week.wake_success_rate_percent !== null &&
                      week.wake_success_rate_percent !== undefined
                  )
                  .map((week) => ({
                    label:
                      week.week_start || week.date || week.period,
                    value: week.wake_success_rate_percent,
                  }))}
              />
            </div>

            <div>
              <h3 className="sub-heading">Sleep</h3>

              {detail.sleep.available ? (
                <p className="muted-line">
                  Average{" "}
                  {minutesLabel(
                    detail.sleep.average_duration_minutes
                  )}{" "}
                  of {minutesLabel(detail.sleep.goal_minutes)} goal ·
                  on schedule{" "}
                  {detail.sleep.adherence_percent ?? "—"}%
                </p>
              ) : (
                <p className="muted-line">{detail.sleep.reason}</p>
              )}

              <h3 className="sub-heading">Snoozing</h3>

              <p className="muted-line">
                {detail.snooze.available
                  ? `${detail.snooze.snoozes} snoozes over ${detail.snooze.alarms_triggered} alarms.`
                  : detail.snooze.reason}
              </p>

              <h3 className="sub-heading">Recommendations</h3>

              {detail.recommendations.length ? (
                <ul className="reason-list">
                  {detail.recommendations.map((recommendation) => (
                    <li key={recommendation.id}>
                      <strong>{recommendation.title}</strong>
                      {recommendation.detail && (
                        <p>{recommendation.detail}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted-line">
                  No recommendations are available for this period.
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default CoachDashboard;