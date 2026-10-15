import { useCallback, useEffect, useState } from "react";
import "../App.css";
import { apiFetch, downloadFile } from "../api";
import { useAuth } from "../auth";
import BarList from "../components/BarList";
import { Empty, ErrorBox, Loading, pct, titleCase } from "../components/ui";

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
    <div className="page-container">
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

      <div className="two-column">
        <section className="alarms-card">
          <div className="card-header"><div><h2>Platform analytics</h2></div></div>
          <p className="muted-line">
            Challenge accuracy {pct(stats.challenges.accuracy_percent)}% over {stats.challenges.attempts} attempts ·
            {" "}{stats.users.registrations_in_period} new users in period
          </p>
          <h3 className="sub-heading">Habit score distribution</h3>
          <BarList
            rows={stats.habit.distribution.map((b) => ({ label: b.band, value: b.count }))}
            suffix=""
            max={Math.max(1, ...stats.habit.distribution.map((b) => b.count))}
          />
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
