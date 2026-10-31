import { useCallback, useEffect, useMemo, useState } from "react";
import "../App.css";
import { apiFetch, downloadFile } from "../api";
import { useAuth } from "../auth";
import { Empty, ErrorBox, Loading, pct, titleCase } from "../components/ui";
import {
  BarBlock,
  CATEGORY_LABEL,
  ChartCard,
  LineBlock,
  PieBlock,
  numeric,
} from "../components/charts";

const ROLE_LABEL = { user: "Members", coach: "Wellness Coaches", admin: "Administrators" };

// Visual platform analysis built from the /admin/dashboard-analytics payload.
function PlatformCharts({ stats }) {
  const roleData = useMemo(
    () =>
      (stats.users.role_distribution || [])
        .map((row) => ({ name: ROLE_LABEL[row.role] || titleCase(row.role), value: row.count }))
        .filter((row) => row.value > 0),
    [stats]
  );

  const accountData = useMemo(
    () =>
      (stats.users.active_vs_inactive || [])
        .map((row) => ({ name: row.status, value: row.count }))
        .filter((row) => row.value > 0),
    [stats]
  );

  const habitDistribution = useMemo(
    () =>
      (stats.habit.distribution || [])
        .map((row) => ({ name: row.band, value: row.count }))
        .filter((row) => row.value > 0),
    [stats]
  );

  const methodData = useMemo(
    () =>
      (stats.wake_up.by_method || [])
        .map((row) => ({ name: titleCase(row.name), value: row.count }))
        .filter((row) => row.value > 0),
    [stats]
  );

  const recommendationData = useMemo(() => {
    const rec = stats.recommendations;
    if (!rec || !rec.available) return [];
    return [
      { name: "Viewed", value: rec.viewed || 0 },
      { name: "Accepted", value: rec.accepted || 0 },
      { name: "Dismissed", value: rec.dismissed || 0 },
    ].filter((row) => row.value > 0);
  }, [stats]);

  const alarmTypeData = useMemo(
    () =>
      (stats.alarms.by_challenge_type || [])
        .map((row) => ({ name: titleCase(row.name), count: row.count }))
        .filter((row) => row.count > 0),
    [stats]
  );

  const challengeByType = useMemo(
    () =>
      (stats.challenges.by_type || [])
        .map((row) => ({ name: titleCase(row.name), accuracy: numeric(row.accuracy_percent) }))
        .filter((row) => row.accuracy !== null),
    [stats]
  );

  const challengeByDifficulty = useMemo(
    () =>
      (stats.challenges.by_difficulty || [])
        .map((row) => ({ name: titleCase(row.name), accuracy: numeric(row.accuracy_percent) }))
        .filter((row) => row.accuracy !== null),
    [stats]
  );

  const wakeUpTrend = useMemo(
    () =>
      (stats.wake_up.daily || []).map((row) => ({
        date: row.date.slice(5),
        rate: numeric(row.success_rate_percent),
        attempts: row.attempts,
      })),
    [stats]
  );

  const registrationTrend = useMemo(
    () => (stats.users.registration_trend || []).map((row) => ({ date: row.date.slice(5), count: row.count })),
    [stats]
  );

  const sleepTrend = useMemo(
    () =>
      (stats.sleep_trend || []).map((row) => ({
        date: row.date.slice(5),
        minutes: numeric(row.average_duration_minutes),
        onSchedule: numeric(row.on_schedule_percent),
      })),
    [stats]
  );

  const hasSleepTrend = sleepTrend.some((row) => row.minutes !== null);

  const routeLatency = useMemo(() => {
    if (!stats.system || !stats.system.available) return [];
    return (stats.system.routes || [])
      .slice(0, 8)
      .map((row) => ({ name: row.route.replace(/^\w+\s/, ""), p95: numeric(row.p95_ms) }))
      .filter((row) => row.p95 !== null);
  }, [stats]);

  const hasWakeTrend = wakeUpTrend.some((row) => row.rate !== null);
  const hasRegistrations = registrationTrend.some((row) => row.count > 0);

  return (
    <section className="alarms-card">
      <div className="card-header">
        <div>
          <h2>Platform Analytics</h2>
          <p>Visual breakdown of users, alarms, cognitive performance, recommendations and system health for the selected period.</p>
        </div>
      </div>

      <div className="wellness-chart-grid">
        <ChartCard title="User Roles" description="Distribution of accounts by role across the platform.">
          <PieBlock data={roleData} />
        </ChartCard>

        <ChartCard title="Account Status" description="Active versus deactivated accounts.">
          <PieBlock
            data={accountData}
            colorFor={(entry) => (entry.name === "Active" ? "#14b8a6" : "#ef4444")}
          />
        </ChartCard>

        <ChartCard title="Habit Score Distribution" description="Number of scored users in each habit-score band.">
          <PieBlock data={habitDistribution} donut />
        </ChartCard>

        <ChartCard title="Wake-up Verification Methods" description="How users verified wake-ups during the period.">
          <PieBlock data={methodData} />
        </ChartCard>

        <ChartCard title="Recommendation Monitoring" description="Recommendation activity: viewed, accepted and dismissed.">
          <BarBlock
            data={recommendationData}
            xKey="name"
            angle={0}
            bars={[{ key: "value", name: "Events", color: "#8b5cf6" }]}
          />
        </ChartCard>

        <ChartCard title="Alarms by Challenge Type" description="Challenge type configured across all alarms.">
          <BarBlock
            data={alarmTypeData}
            bars={[{ key: "count", name: "Alarms", color: "#06b6d4" }]}
          />
        </ChartCard>

        <ChartCard title="Challenge Accuracy by Type" description="Recorded accuracy for each cognitive challenge type.">
          <BarBlock
            data={challengeByType}
            yDomain={[0, 100]}
            yUnit="%"
            bars={[{ key: "accuracy", name: "Accuracy", color: "#f59e0b" }]}
            tooltipFormatter={(value) => [`${value}%`, "Accuracy"]}
          />
        </ChartCard>

        <ChartCard title="Challenge Accuracy by Difficulty" description="Recorded accuracy across difficulty levels.">
          <BarBlock
            data={challengeByDifficulty}
            yDomain={[0, 100]}
            yUnit="%"
            bars={[{ key: "accuracy", name: "Accuracy", color: "#6366f1" }]}
            tooltipFormatter={(value) => [`${value}%`, "Accuracy"]}
          />
        </ChartCard>

        <ChartCard title="Wake-up Success Trend" description="Daily wake-up verification success rate.">
          {hasWakeTrend ? (
            <LineBlock
              data={wakeUpTrend}
              yDomain={[0, 100]}
              yUnit="%"
              lines={[{ key: "rate", name: "Success rate", color: "#14b8a6" }]}
              tooltipFormatter={(value) => [`${value}%`, "Success rate"]}
            />
          ) : (
            <p className="muted-line">No wake-up activity recorded in this period.</p>
          )}
        </ChartCard>

        <ChartCard title="New Registrations" description="New user sign-ups per day across the platform.">
          {hasRegistrations ? (
            <LineBlock
              data={registrationTrend}
              lines={[{ key: "count", name: "New users", color: "#ec4899" }]}
            />
          ) : (
            <p className="muted-line">No new registrations in this period.</p>
          )}
        </ChartCard>

        <ChartCard title="Sleep Trend" description="Average nightly sleep duration (minutes) across all users with sleep logs.">
          {hasSleepTrend ? (
            <LineBlock
              data={sleepTrend}
              yUnit="m"
              lines={[{ key: "minutes", name: "Avg sleep (min)", color: "#06b6d4" }]}
              tooltipFormatter={(value) => [`${value} min`, "Avg sleep"]}
            />
          ) : (
            <p className="muted-line">No sleep logs recorded in this period.</p>
          )}
        </ChartCard>

        <ChartCard title="System Performance" description="Slowest API routes by 95th-percentile response time (ms).">
          {routeLatency.length ? (
            <BarBlock
              data={routeLatency}
              yUnit="ms"
              bars={[{ key: "p95", name: "p95 latency", color: "#ef4444" }]}
              tooltipFormatter={(value) => [`${value} ms`, "p95"]}
            />
          ) : (
            <p className="muted-line">No API timings recorded yet (timings reset on restart).</p>
          )}
        </ChartCard>
      </div>
    </section>
  );
}

function AdminDashboard() {
  const { user: me } = useAuth();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [announcement, setAnnouncement] = useState({ title: "", message: "" });
  const [assign, setAssign] = useState({ coach_id: "", user_id: "" });

  const load = useCallback(async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    const iso = (d) => d.toISOString().slice(0, 10);
    try {
      const [s, u, a] = await Promise.all([
        apiFetch(`/admin/dashboard-analytics?start=${iso(start)}&end=${iso(end)}`),
        apiFetch("/admin/users?limit=200"),
        apiFetch("/admin/coach-assignments"),
      ]);
      setStats(s);
      setUsers(u.items);
      setAssignments(a.items);
    } catch (err) {
      setError(err.message);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn, message) => {
    setError("");
    setNotice("");
    try {
      await fn();
      if (message) setNotice(message);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!stats) {
    return <div className="page-container">{error ? <ErrorBox message={error} /> : <Loading />}</div>;
  }

  const coaches = users.filter((u) => u.role === "coach");
  const members = users.filter((u) => u.role === "user");
  const sys = stats.system;

  return (
    <div className="page-container analytics-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Admin Dashboard</h1>
          <p className="subtitle">Users, platform analytics, recommendations and system health.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <select className="period" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          {["pdf", "xlsx", "csv"].map((kind) => (
            <button
              key={kind}
              className="primary-button"
              onClick={() => {
                const from = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
                const to = new Date().toISOString().slice(0, 10);
                downloadFile(
                  `/admin/dashboard-analytics/export.${kind}?start=${from}&end=${to}`,
                  `platform_report.${kind}`
                ).catch((err) => setError(err.message));
              }}
            >
              {kind === "xlsx" ? "Excel" : kind.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <ErrorBox message={error} />
      {notice && <div className="notice-box">{notice}</div>}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>Total users</span></div><h3>{stats.platform.total_users}</h3><p className="streak-text">{stats.platform.active_users_in_period} active in period</p></div>
        <div className="stat-card"><div className="stat-top"><span>Alarms</span></div><h3>{stats.platform.total_alarms}</h3><p className="streak-text">{stats.platform.enabled_alarms} enabled</p></div>
        <div className="stat-card"><div className="stat-top"><span>Wake-up success</span></div><h3>{pct(stats.wake_up.verification_success_rate_percent)}<span>%</span></h3><p className="streak-text">{stats.wake_up.attempts} attempts</p></div>
        <div className="stat-card"><div className="stat-top"><span>Average habit score</span></div><h3>{pct(stats.habit.average_habit_score)}</h3><p className="streak-text">{stats.habit.users_scored} users scored</p></div>
      </div>

      <PlatformCharts stats={stats} />

      <div className="two-column">
        <section className="alarms-card">
          <div className="card-header"><div><h2>Platform analytics</h2></div></div>
          <p className="muted-line">
            Challenge accuracy {pct(stats.challenges.accuracy_percent)}% over {stats.challenges.attempts} attempts ·
            {" "}{stats.users.registrations_in_period} new users in period
            {stats.habit.average_improvement != null && (
              <> · average habit-score change {stats.habit.average_improvement > 0 ? "+" : ""}{stats.habit.average_improvement}</>
            )}
          </p>
          {stats.alarms.snooze?.available && (
            <p className="muted-line">
              Snoozes: {stats.alarms.snooze.snoozes} · dismissal success {stats.alarms.snooze.dismissal_success_rate_percent ?? "–"}%
            </p>
          )}
        </section>

        <section className="alarms-card">
          <div className="card-header"><div><h2>Recommendation monitoring</h2></div></div>
          {stats.recommendations.available ? (
            <p className="muted-line">
              {stats.recommendations.viewed} viewed · {stats.recommendations.accepted} accepted ·
              {" "}{stats.recommendations.dismissed} dismissed · acceptance {stats.recommendations.acceptance_rate_percent ?? "–"}%
              {stats.recommendations.engagement_improvement_points !== null
                ? ` (${stats.recommendations.engagement_improvement_points > 0 ? "+" : ""}${stats.recommendations.engagement_improvement_points} points vs previous)`
                : ""}
            </p>
          ) : (
            <Empty title="No recommendation activity">{stats.recommendations.reason}</Empty>
          )}

          <div className="card-header" style={{ marginTop: 18 }}><div><h2>System performance</h2></div></div>
          {sys.available ? (
            <>
              <p className="muted-line">
                API average {sys.overall.avg_ms} ms · p95 {sys.overall.p95_ms} ms · {sys.overall.count} requests · {sys.overall.error_count} errors
              </p>
              {sys.challenge_generation && (
                <p className="muted-line">Challenge generation: average {sys.challenge_generation.avg_ms} ms, p95 {sys.challenge_generation.p95_ms} ms</p>
              )}
            </>
          ) : (
            <Empty title="No timings yet">{sys.reason}</Empty>
          )}
        </section>
      </div>

      <section className="alarms-card">
        <div className="card-header">
          <div>
            <h2>Recommendations</h2>
            <p>Sleep improvement, wake-up optimization, habit and productivity guidance from platform activity.</p>
          </div>
        </div>
        {(stats.guidance || []).length ? (
          <ul className="reason-list">
            {stats.guidance.map((item) => (
              <li key={item.id}>
                <span className={`badge-category badge-${item.category}`}>
                  {CATEGORY_LABEL[item.category] || "General"}
                </span>{" "}
                <strong>{item.title}</strong>
                {item.detail && <p>{item.detail}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No recommendations">Guidance appears as users record activity.</Empty>
        )}
      </section>

      <section className="alarms-card">
        <div className="card-header"><div><h2>User management</h2></div></div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={u.id === me.id}
                      onChange={(e) =>
                        act(
                          () => apiFetch(`/admin/users/${u.id}/role`, { method: "PATCH", body: { role: e.target.value } }),
                          "Role updated."
                        )
                      }
                    >
                      <option value="user">User</option>
                      <option value="coach">Wellness Coach</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </td>
                  <td>{u.is_active ? "Active" : "Deactivated"}</td>
                  <td>
                    {u.id !== me.id && (
                      <button
                        className={`small-button ${u.is_active ? "danger" : ""}`}
                        onClick={() =>
                          act(
                            () => apiFetch(`/admin/users/${u.id}/status`, { method: "PATCH", body: { is_active: !u.is_active } }),
                            u.is_active ? "User deactivated." : "User activated."
                          )
                        }
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="two-column">
        <section className="alarms-card">
          <div className="card-header"><div><h2>Coach assignments</h2></div></div>
          {assignments.length === 0 ? (
            <Empty title="No assignments yet" />
          ) : (
            <table className="data-table">
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.coach.full_name}</td>
                    <td>monitors</td>
                    <td>{a.user.full_name}</td>
                    <td>
                      <button className="small-button danger"
                        onClick={() => act(() => apiFetch(`/admin/coach-assignments/${a.id}`, { method: "DELETE" }), "Assignment removed.")}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              act(
                () => apiFetch("/admin/coach-assignments", {
                  method: "POST",
                  body: { coach_id: Number(assign.coach_id), user_id: Number(assign.user_id) },
                }),
                "Assignment created."
              );
            }}
          >
            <select value={assign.coach_id} required onChange={(e) => setAssign({ ...assign, coach_id: e.target.value })}>
              <option value="">Coach...</option>
              {coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
            <select value={assign.user_id} required onChange={(e) => setAssign({ ...assign, user_id: e.target.value })}>
              <option value="">User...</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
            <button className="small-button" type="submit">Assign</button>
          </form>
        </section>

        <section className="alarms-card">
          <div className="card-header"><div><h2>Platform announcement</h2><p>Sent as a notification to every active user.</p></div></div>
          <form
            className="settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                const result = await apiFetch("/admin/announcements", { method: "POST", body: announcement });
                setAnnouncement({ title: "", message: "" });
                setNotice(`Announcement sent to ${result.recipients} users.`);
              });
            }}
          >
            <label>Title
              <input value={announcement.title} required maxLength={160}
                onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} />
            </label>
            <label>Message
              <textarea rows={4} value={announcement.message} required maxLength={2000}
                onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })} />
            </label>
            <button className="generate-button" type="submit">Send announcement</button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default AdminDashboard;
