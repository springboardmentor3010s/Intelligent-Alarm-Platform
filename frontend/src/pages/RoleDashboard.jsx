import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  assignCoachClient,
  assignUnassignedClients,
  deleteAdminUser,
  downloadAdminReport,
  getAdminAnalytics,
  getAdminUserDetails,
  getAdminUsers,
  getAdminRecommendations,
  getCoachClientBehavior,
  getCoachOverview,
  getSystemHealth,
  sendCoachRecommendation,
  unassignCoachClient,
  updateAdminUserRole,
} from "../services/api";
import { Card, EmptyState, PageShell, StatCard } from "../components/ChartKit";
import { COLORS, axisTick, gridStroke, pieColors, statGrid, tooltipStyle } from "../components/chartTokens";

const PAGE_SIZE = 25;
const roleOptions = ["user", "wellness_coach", "admin"];

function messageOf(error, fallback) {
  return typeof error === "string" ? error : fallback;
}

function metric(value, suffix = "") {
  return value == null ? "Not enough data yet" : `${value}${suffix}`;
}

function dateString(date) {
  return date.toISOString().slice(0, 10);
}

function defaultPeriod() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { startDate: dateString(start), endDate: dateString(end) };
}

function DateRange({ value, onChange, onApply }) {
  return (
    <form
      className="role-filter-row"
      onSubmit={(event) => { event.preventDefault(); onApply(); }}
      aria-label="Reporting date range"
    >
      <label className="form-label">
        From
        <input
          className="form-input"
          type="date"
          value={value.startDate}
          max={value.endDate}
          onChange={(event) => onChange({ ...value, startDate: event.target.value })}
        />
      </label>
      <label className="form-label">
        To
        <input
          className="form-input"
          type="date"
          value={value.endDate}
          min={value.startDate}
          onChange={(event) => onChange({ ...value, endDate: event.target.value })}
        />
      </label>
      <button className="btn btn-secondary btn-sm" type="submit">Apply range</button>
    </form>
  );
}

function AdminDashboard({ onBack }) {
  const [period, setPeriod] = useState(defaultPeriod);
  const [appliedPeriod, setAppliedPeriod] = useState(defaultPeriod);
  const [analytics, setAnalytics] = useState(null);
  const [usersPage, setUsersPage] = useState({ items: [], total: 0, pages: 0 });
  const [recommendations, setRecommendations] = useState([]);
  const [health, setHealth] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [coachOptions, setCoachOptions] = useState([]);
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [assignedCoachIds, setAssignedCoachIds] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [metrics, userResult, recommendationList, healthResult, coachResult] = await Promise.all([
        getAdminAnalytics(appliedPeriod),
        getAdminUsers({ q: query, role: roleFilter, page, pageSize: PAGE_SIZE }),
        getAdminRecommendations(appliedPeriod),
        getSystemHealth(),
        getAdminUsers({ role: "wellness_coach", page: 1, pageSize: 100 }),
      ]);
      setAnalytics(metrics);
      setUsersPage(userResult);
      setRecommendations(recommendationList);
      setHealth(healthResult);
      setCoachOptions(coachResult.items || []);
      setError("");
    } catch (loadError) {
      setError(messageOf(loadError, "Unable to load platform administration data."));
    } finally {
      setLoading(false);
    }
  }, [appliedPeriod, page, query, roleFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboard(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  async function openUser(userId) {
    setBusy(true);
    setError("");
    try {
      const details = await getAdminUserDetails(userId);
      setSelectedUser(details);
      setAssignedCoachIds(details.assigned_coaches.map((coach) => coach.id));
      setSelectedCoachId("");
    } catch (loadError) {
      setError(messageOf(loadError, "Unable to load this account's details."));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(user, role) {
    if (!window.confirm(`Change ${user.name}'s role to ${role.replace("_", " ")}?`)) return;
    setBusy(true);
    try {
      await updateAdminUserRole(user.id, role);
      if (selectedUser?.user.id === user.id) setSelectedUser(null);
      await loadDashboard();
    } catch (updateError) {
      setError(messageOf(updateError, "Unable to update the account role."));
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(user) {
    if (!window.confirm(`Permanently delete ${user.name} and their platform data? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteAdminUser(user.id);
      setSelectedUser(null);
      await loadDashboard();
    } catch (deleteError) {
      setError(messageOf(deleteError, "Unable to delete this account."));
    } finally {
      setBusy(false);
    }
  }

  async function changeCoachAssignment(assigned, coachSelection = selectedCoachId) {
    if (!selectedUser || !coachSelection) return;
    const coachId = Number(coachSelection);
    const clientId = selectedUser.user.id;
    setBusy(true);
    try {
      if (assigned) await assignCoachClient(coachId, clientId);
      else await unassignCoachClient(coachId, clientId);
      await openUser(clientId);
    } catch (assignmentError) {
      setError(messageOf(assignmentError, "Unable to update coach access."));
    } finally {
      setBusy(false);
    }
  }

  async function exportReport(format) {
    setBusy(true);
    try {
      await downloadAdminReport(format, appliedPeriod);
      setError("");
    } catch (reportError) {
      setError(messageOf(reportError, "Unable to generate the platform report."));
    } finally {
      setBusy(false);
    }
  }

  async function assignAllUnassigned() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await assignUnassignedClients();
      setNotice(result.assigned_count
        ? `${result.assigned_count} user(s) assigned to a Wellness Coach.`
        : "No unassigned users need a coach, or no Wellness Coach accounts exist yet.");
      await loadDashboard();
    } catch (assignmentError) {
      setError(messageOf(assignmentError, "Unable to assign users to coaches."));
    } finally {
      setBusy(false);
    }
  }

  const difficultyData = analytics?.difficulty_distribution || [];
  return (
    <PageShell
      eyebrow="Platform Administration"
      title="Administrator dashboard"
      subtitle="Platform-wide operational and behavioral reporting, derived from recorded account activity."
      onBack={onBack}
      action={
        <div className="role-action-row">
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => exportReport("pdf")}>Export PDF</button>
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => exportReport("excel")}>Export Excel</button>
        </div>
      }
    >
      <DateRange value={period} onChange={setPeriod} onApply={() => setAppliedPeriod(period)} />
      {error && <div className="alert-box alert-error" role="alert">{error}</div>}
      {notice && <div className="alert-box alert-info" role="status">{notice}</div>}
      {loading && <p className="role-status" role="status">Loading platform analytics…</p>}
      <div style={statGrid}>
        <StatCard icon="👥" label="Registered users" value={analytics?.total_users ?? "—"} subtitle="All accounts" />
        <StatCard icon="🟢" label="Active users" value={analytics?.active_users ?? "—"} subtitle="Signed in, triggered an alarm, or generated a challenge in the selected period" accent={COLORS.emerald} />
        <StatCard icon="🔐" label="Successful logins" value={analytics?.successful_logins ?? "—"} subtitle={`${analytics?.users_logged_in ?? 0} distinct users signed in during selected period`} accent={COLORS.cyan} />
        <StatCard icon="🩺" label="Users without a coach" value={analytics?.users_without_coach ?? "—"} subtitle="Automatically assigned when a coach is available" accent={COLORS.amber} />
        <StatCard icon="⏰" label="Active alarms" value={analytics ? `${analytics.active_alarms}/${analytics.total_alarms}` : "—"} subtitle="Current active / all alarms" accent={COLORS.cyan} />
        <StatCard icon="🧠" label="Completed challenges" value={analytics?.completed_challenges ?? "—"} subtitle={`Completion rate ${metric(analytics?.challenge_completion_rate, "%")}`} accent={COLORS.violet} />
        <StatCard icon="🎯" label="Challenge accuracy" value={metric(analytics?.platform_accuracy, "%")} subtitle="Correct recorded answers / all recorded answers" accent={COLORS.amber} />
        <StatCard icon="🌱" label="Average habit score" value={metric(analytics?.platform_avg_habit_score)} subtitle={`${analytics?.habit_score_sample_size ?? 0} accounts with recorded behavior`} />
        <StatCard icon="📅" label="Wake consistency" value={metric(analytics?.wake_consistency_pct, "%")} subtitle={`${analytics?.wake_consistency_sample_size ?? 0} behavioral scores; current 7-day measure`} accent={COLORS.cyan} />
        <StatCard icon="😴" label="Snooze events" value={analytics?.activity_summary?.total_snoozes ?? "—"} subtitle={`${analytics?.activity_summary?.engagement_events ?? 0} recorded activity events in period`} accent={COLORS.rose} />
      </div>

      <div className="role-chart-grid">
        <Card title="Successful sign-ins" subtitle="Only sign-ins recorded since login history was enabled are included.">
          {(analytics?.login_trend || []).length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.login_trend}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={axisTick} />
                <YAxis tick={axisTick} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="logins" name="Successful logins" fill={COLORS.cyan} />
                <Bar dataKey="users" name="Distinct users" fill={COLORS.violet} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No sign-ins in this period" description="Successful sign-ins will be counted from the time login tracking is deployed." />}
        </Card>
        <Card title="Platform activity" subtitle="Recorded trigger, completion, and snooze events by day.">
          {(analytics?.activity_trend || []).length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.activity_trend}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={axisTick} />
                <YAxis tick={axisTick} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="triggers" fill={COLORS.primary} />
                <Bar dataKey="completions" fill={COLORS.emerald} />
                <Bar dataKey="snoozes" fill={COLORS.rose} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No activity in this period" description="Recorded user activity will appear here." />}
        </Card>
        <Card title="Challenge performance" subtitle="Daily accuracy uses recorded submitted answers; generated questions are shown separately.">
          {(analytics?.challenge_trend || []).some((item) => item.answered > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={analytics.challenge_trend}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={axisTick} />
                <YAxis tick={axisTick} domain={[0, 100]} unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line dataKey="accuracy" name="Answer accuracy" stroke={COLORS.cyan} connectNulls />
                <Line dataKey="generated" name="Questions generated" stroke={COLORS.violet} yAxisId={0} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No challenge answers yet" description="Challenge performance needs recorded answers." />}
        </Card>
        <Card title="Challenge difficulty" subtitle="Difficulty levels of challenge questions created in the selected period.">
          {difficultyData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={difficultyData} dataKey="count" nameKey="difficulty" outerRadius={90} label>
                  {difficultyData.map((item, index) => <Cell key={item.difficulty} fill={pieColors[index % pieColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No challenge difficulty data" />}
        </Card>
        <Card title="Recommendation outcomes" subtitle="Stored recommendations created in the selected period.">
          {analytics?.recommendation_activity?.generated ? (
            <div style={statGrid}>
              <StatCard icon="💡" label="Generated" value={analytics.recommendation_activity.generated} />
              <StatCard icon="✅" label="Acted upon" value={analytics.recommendation_activity.acted_upon} accent={COLORS.emerald} />
              <StatCard icon="Dismissed" label="Dismissed" value={analytics.recommendation_activity.dismissed} accent={COLORS.amber} />
            </div>
          ) : <EmptyState title="No recommendations in this period" />}
        </Card>
      </div>

      <Card title="System health" subtitle="Status from the existing backend health endpoint. Error-event history is not currently persisted.">
        <div className="role-health-grid">
          <span>Backend: <strong>{health?.status || "Unavailable"}</strong></span>
          <span>Database: <strong>{health?.database || "Unavailable"}</strong></span>
          <span>ML model: <strong>{health?.ml_model || "Unavailable"}</strong></span>
          <span>Application error history: <strong>Not recorded</strong></span>
        </div>
        <p className="role-muted">{analytics?.unavailable_metrics?.habit_score_trend}</p>
      </Card>

      <Card
        title="User management"
        subtitle={`${usersPage.total || 0} matching account(s). Login history is recorded from this feature's deployment onward; prior logins cannot be reconstructed.`}
        action={<button className="btn btn-secondary btn-sm" disabled={busy || !analytics?.users_without_coach} onClick={assignAllUnassigned}>Assign users without a coach</button>}
      >
        <form className="role-filter-row" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(searchInput.trim()); }}>
          <label className="form-label">
            Search name or email
            <input className="form-input" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          </label>
          <label className="form-label">
            Role
            <select className="form-input" value={roleFilter} onChange={(event) => { setPage(1); setRoleFilter(event.target.value); }}>
              <option value="">All roles</option>
              {roleOptions.map((role) => <option key={role} value={role}>{role.replace("_", " ")}</option>)}
            </select>
          </label>
          <button className="btn btn-secondary btn-sm" type="submit">Search</button>
        </form>
        {usersPage.items.length ? (
          <>
            <div className="role-table-wrap">
              <table className="data-table">
                <thead><tr><th>Account</th><th>Role</th><th>Coach</th><th>Successful logins</th><th>Last login</th><th>Alarms</th><th>Recorded performances</th><th>Last performance</th><th>Last recorded activity</th><th>Actions</th></tr></thead>
                <tbody>
                  {usersPage.items.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}<br /><small>{user.email}</small></td>
                      <td>
                        <select
                          className="form-input role-select"
                          aria-label={`Role for ${user.name}`}
                          value={user.role}
                          disabled={busy}
                          onChange={(event) => changeRole(user, event.target.value)}
                        >
                          {roleOptions.map((role) => <option key={role} value={role}>{role.replace("_", " ")}</option>)}
                        </select>
                      </td>
                      <td>{user.role === "user" ? (user.coach_coverage?.coach_name || "Waiting for coach") : "—"}</td>
                      <td>{user.successful_logins}</td>
                      <td>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "No login history recorded"}</td>
                      <td>{user.active_alarms}/{user.total_alarms}</td>
                      <td>{user.recorded_performances ?? 0}</td>
                      <td>{user.last_performance_at ? new Date(user.last_performance_at).toLocaleString() : "—"}</td>
                      <td>{user.last_active_at ? new Date(user.last_active_at).toLocaleString() : "No activity recorded"}</td>
                      <td className="role-action-row">
                        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => openUser(user.id)}>View</button>
                        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => removeUser(user)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="role-pagination">
              <span>Page {usersPage.page} of {usersPage.pages || 1}</span>
              <div className="role-action-row">
                <button className="btn btn-secondary btn-sm" disabled={page <= 1 || busy} onClick={() => setPage((value) => value - 1)}>Previous</button>
                <button className="btn btn-secondary btn-sm" disabled={page >= usersPage.pages || busy} onClick={() => setPage((value) => value + 1)}>Next</button>
              </div>
            </div>
          </>
        ) : <EmptyState title="No matching accounts" description="Try a different search or role filter." />}
      </Card>

      {selectedUser && (
        <Card
          title={`Account details: ${selectedUser.user.name}`}
          subtitle="Only administrative profile information and aggregated progress are shown. Authentication secrets are never returned."
          action={<button className="btn btn-secondary btn-sm" onClick={() => setSelectedUser(null)}>Close</button>}
        >
          <div style={statGrid}>
            <StatCard icon="🌱" label="Habit score" value={metric(selectedUser.metrics.habit_score)} />
            <StatCard icon="📅" label="Wake consistency" value={metric(selectedUser.metrics.wake_consistency_pct, "%")} />
            <StatCard icon="🧠" label="Challenge accuracy" value={metric(selectedUser.metrics.challenge_accuracy, "%")} />
            <StatCard icon="😴" label="Recorded snoozes" value={selectedUser.metrics.snooze_count ?? 0} />
            <StatCard icon="🔐" label="Successful logins" value={selectedUser.login_summary.successful_logins} />
            <StatCard icon="🧩" label="Challenge answers" value={selectedUser.metrics.answered_questions ?? 0} />
            <StatCard icon="✅" label="Completed sessions" value={selectedUser.metrics.completed_challenges ?? 0} />
            <StatCard icon="⏰" label="Alarm completions" value={selectedUser.metrics.alarm_completions ?? 0} />
          </div>
          <p className="role-muted">Configured wake target: {selectedUser.user.preferred_wake_time || "Not set"} · Current difficulty: {selectedUser.metrics.current_difficulty || "Not enough data yet"}</p>
          <p className="role-muted">
            Account created: {selectedUser.user.created_at ? new Date(selectedUser.user.created_at).toLocaleString() : "—"}
            {" · "}Last login: {selectedUser.login_summary.last_login_at ? new Date(selectedUser.login_summary.last_login_at).toLocaleString() : "No login history recorded"}
            {" · "}Wellness Coach: {selectedUser.coach_coverage?.coach_name || "Waiting for an available coach"}
          </p>
          <p className="role-muted">
            Sleep target: {selectedUser.user.sleep_duration_target_hours ?? "Not set"} hours
            {" · "}Timezone: {selectedUser.user.timezone || "Not set"}
            {" · "}Goal: {selectedUser.user.productivity_goal || "Not set"}
          </p>
          {selectedUser.user.role === "user" && (
            <div className="role-assignment">
              {selectedUser.coach_coverage?.coverage === "admin_all_users" && (
                <p className="role-muted">
                  {selectedUser.coach_coverage.coach_name} provides system-wide coaching access.
                </p>
              )}
              {coachOptions.length > 0 && (
                <>
              <label className="form-label">
                Coach assignment
                <select className="form-input" value={selectedCoachId} onChange={(event) => setSelectedCoachId(event.target.value)}>
                  <option value="">Select a coach</option>
                  {coachOptions.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
                </select>
              </label>
              <button className="btn btn-primary btn-sm" disabled={!selectedCoachId || busy} onClick={() => changeCoachAssignment(true)}>Assign</button>
              {assignedCoachIds.map((coachId) => {
                const coach = coachOptions.find((item) => item.id === coachId);
                return (
                  <button key={coachId} className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { setSelectedCoachId(String(coachId)); void changeCoachAssignment(false, String(coachId)); }}>
                    Remove {coach?.name || "coach"} access
                  </button>
                );
              })}
                </>
              )}
            </div>
          )}
          <h3 className="saas-card-title">Recent recorded activity</h3>
          {(selectedUser.recent_activities || []).length ? (
            <ul className="role-activity-list">
              {selectedUser.recent_activities.map((item) => <li key={item.id}><span>{item.activity_type}</span><time>{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</time></li>)}
            </ul>
          ) : <EmptyState title="No activity history" />}
          <h3 className="saas-card-title">Recent successful logins</h3>
          {selectedUser.login_summary.recent_logins.length ? (
            <ul className="role-activity-list">
              {selectedUser.login_summary.recent_logins.map((item) => <li key={item.id}><span>Successful login</span><time>{new Date(item.logged_at).toLocaleString()}</time></li>)}
            </ul>
          ) : <EmptyState title="No successful login recorded" />}
          <h3 className="saas-card-title">Alarm participation</h3>
          {selectedUser.alarms.length ? (
            <div className="role-table-wrap">
              <table className="data-table">
                <thead><tr><th>Alarm</th><th>Time</th><th>Status</th><th>Difficulty</th><th>Challenges</th><th>Completions</th><th>Snoozes</th></tr></thead>
                <tbody>{selectedUser.alarms.map((alarm) => (
                  <tr key={alarm.id}>
                    <td>{alarm.title}</td>
                    <td>{alarm.alarm_time}</td>
                    <td>{alarm.is_active ? "Active" : "Inactive"}</td>
                    <td>{alarm.difficulty}</td>
                    <td>{alarm.challenge_type}</td>
                    <td>{alarm.completed_count}</td>
                    <td>{alarm.snooze_count}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState title="No alarms configured" />}
          <h3 className="saas-card-title">Recent challenge participation</h3>
          {selectedUser.challenge_history.length ? (
            <div className="role-table-wrap">
              <table className="data-table">
                <thead><tr><th>Submitted</th><th>Challenge</th><th>Difficulty</th><th>Answer</th><th>Result</th><th>Response time</th></tr></thead>
                <tbody>{selectedUser.challenge_history.map((attempt) => (
                  <tr key={`${attempt.source}-${attempt.id}`}>
                    <td>{attempt.created_at ? new Date(attempt.created_at).toLocaleString() : "—"}</td>
                    <td>{attempt.challenge_type}</td>
                    <td>{attempt.difficulty}</td>
                    <td>{attempt.user_answer}</td>
                    <td>{attempt.is_correct ? "Correct" : "Incorrect"}</td>
                    <td>{attempt.response_time_seconds}s</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState title="No challenge answers recorded" />}
          <h3 className="saas-card-title">Completed alarm performance and recommendations</h3>
          {selectedUser.performance_history?.length ? (
            <div className="role-table-wrap">
              <table className="data-table">
                <thead><tr><th>Completed</th><th>Alarm</th><th>Accuracy</th><th>Average response</th><th>Snoozes</th><th>Recommendation</th><th>Suggested action</th></tr></thead>
                <tbody>{selectedUser.performance_history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.completed_at ? new Date(item.completed_at).toLocaleString() : "—"}</td>
                    <td>{item.alarm_title}<br /><small>{item.difficulty || "No challenge"} {item.challenge_type || ""}</small></td>
                    <td>{item.accuracy_pct == null ? "Not measured" : `${item.accuracy_pct}% (${item.correct_answers}/${item.total_questions})`}</td>
                    <td>{item.average_response_time_seconds == null ? "Not measured" : `${item.average_response_time_seconds}s`}</td>
                    <td>{item.snoozes_before_completion == null ? "Not available" : item.snoozes_before_completion}</td>
                    <td>{item.recommendation_reason}</td>
                    <td>{item.suggested_action}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState title="No completed alarm performance recorded" description="Completed alarm sessions and their measured recommendations will appear here." />}
        </Card>
      )}

      <Card title="Recent platform activity" subtitle="Latest events within the selected reporting period.">
        {(analytics?.recent_activities || []).length ? (
          <ul className="role-activity-list">
            {analytics.recent_activities.map((item) => <li key={item.id}><span>{item.user_name} · {item.activity_type}</span><time>{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</time></li>)}
          </ul>
        ) : <EmptyState title="No activity recorded" />}
      </Card>
      <Card title="Recommendation monitoring" subtitle="Stored personalized recommendation outcome state.">
        {recommendations.length ? (
          <div className="role-table-wrap">
            <table className="data-table">
              <thead><tr><th>User</th><th>Recommendation</th><th>Category</th><th>Priority</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>{recommendations.map((item) => (
                <tr key={item.id}>
                  <td>{item.user_name}</td>
                  <td>{item.title}<br /><small>{item.suggested_action}</small></td>
                  <td>{item.category}</td><td>{item.priority}</td>
                  <td>{item.is_dismissed ? "Dismissed" : item.is_acted_upon ? "Acted upon" : "Pending"}</td>
                  <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="No recommendations yet" />}
      </Card>
    </PageShell>
  );
}

function CoachDashboard({ onBack, isAdminCoach = false }) {
  const [overview, setOverview] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [behavior, setBehavior] = useState(null);
  const [clientSearch, setClientSearch] = useState("");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [suggestedAction, setSuggestedAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getCoachOverview()
      .then((data) => { setOverview(data); setError(""); })
      .catch((loadError) => setError(messageOf(loadError, "Unable to load your assigned client analytics.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedClientId) return;
    getCoachClientBehavior(selectedClientId)
      .then((data) => { setBehavior(data); setError(""); })
      .catch((loadError) => setError(messageOf(loadError, "Unable to load this assigned client's behavior.")));
  }, [selectedClientId]);

  const clients = useMemo(() => overview?.clients || [], [overview]);
  const filteredClients = useMemo(
    () => clients.filter((client) => `${client.name} ${client.email}`.toLowerCase().includes(clientSearch.toLowerCase())),
    [clients, clientSearch],
  );
  const selectedSummary = clients.find((client) => String(client.id) === selectedClientId);

  async function submitGuidance(event) {
    event.preventDefault();
    if (!selectedClientId) return;
    setSending(true);
    try {
      const result = await sendCoachRecommendation(selectedClientId, {
        title,
        reason,
        suggested_action: suggestedAction,
      });
      setMessage(result.message);
      setTitle("");
      setReason("");
      setSuggestedAction("");
      const updated = await getCoachClientBehavior(selectedClientId);
      setBehavior(updated);
      setError("");
    } catch (sendError) {
      setError(messageOf(sendError, "Unable to send coach guidance."));
    } finally {
      setSending(false);
    }
  }

  return (
    <PageShell
      eyebrow="Wellness Coach"
      title={isAdminCoach ? "Admin Wellness Coach dashboard" : "Client progress"}
      subtitle={isAdminCoach
        ? "Review every user's behavioral summary, then send individual coaching follow-ups. Use Coach Recommendations to review the platform-wide recommendation feed."
        : "Review assigned users' recorded wake-up and challenge behavior. This is not a clinical or sleep-measurement tool."}
      onBack={onBack}
    >
      {error && <div className="alert-box alert-error" role="alert">{error}</div>}
      {message && <div className="alert-box alert-info" role="status">{message}</div>}
      {loading && <p className="role-status" role="status">{isAdminCoach ? "Loading platform user data…" : "Loading assigned client data…"}</p>}
      <div style={statGrid}>
        <StatCard icon="👥" label={isAdminCoach ? "Platform users" : "Assigned users"} value={overview?.accessible_users ?? "—"} />
        <StatCard icon="⚑" label="Need attention" value={overview?.users_needing_attention ?? "—"} accent={COLORS.amber} subtitle="Based on the defined behavioral flags below" />
        <StatCard icon="🌱" label="Average habit score" value={metric(overview?.average_habit_score)} />
        <StatCard icon="📅" label="Wake consistency" value={metric(overview?.average_wake_consistency_pct, "%")} accent={COLORS.cyan} />
        <StatCard icon="🧠" label="Challenge accuracy" value={metric(overview?.average_challenge_accuracy, "%")} accent={COLORS.violet} />
        <StatCard icon="😴" label="Snooze events (30d)" value={overview?.snooze_events_30d ?? "—"} accent={COLORS.rose} />
      </div>
      <Card title="Coaching scope and attention rules" subtitle={overview?.attention_rule_note}>
        <p className="role-muted">{overview?.sleep_measurement_note}</p>
      </Card>
      <div className="role-chart-grid">
        <Card
          title={isAdminCoach ? "Platform user wake activity" : "Assigned-user wake activity"}
          subtitle={isAdminCoach
            ? "Events over the last 30 days across registered user accounts."
            : "Events over the last 30 days; only assigned clients are included."}
        >
          {(overview?.activity_trend_30d || []).length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={overview.activity_trend_30d}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={axisTick} />
                <YAxis tick={axisTick} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="completions" fill={COLORS.emerald} />
                <Bar dataKey="snoozes" fill={COLORS.rose} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No recent client activity" description="Completion and snooze events will appear here when recorded." />}
        </Card>
        <Card title="Habit score history" subtitle="Daily score snapshots are not stored by the current data model.">
          <EmptyState title="Historical scores unavailable" description={overview?.habit_history_note || "Only current habit scores and the analytics service's recent behavioral change are available."} />
        </Card>
      </div>
      <Card title={isAdminCoach ? "All platform users" : "Assigned client roster"} subtitle={isAdminCoach
        ? "Select a user to review their behavior and send a tailored follow-up."
        : "Search clients explicitly assigned by an administrator."}>
        <label className="form-label role-search">
          {isAdminCoach ? "Search platform users" : "Search assigned users"}
          <input className="form-input" value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Name or email" />
        </label>
        {filteredClients.length ? (
          <div className="role-table-wrap">
            <table className="data-table">
              <thead><tr><th>{isAdminCoach ? "User" : "Client"}</th><th>Wake target</th><th>Current difficulty</th><th>Habit score</th><th>Consistency</th><th>Challenge accuracy</th><th>Attention</th></tr></thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client.id} className={String(client.id) === selectedClientId ? "selected-row" : ""}>
                    <td><button className="text-button" onClick={() => { setSelectedClientId(String(client.id)); setBehavior(null); setMessage(""); }}>{client.name}</button><br /><small>{client.email}</small></td>
                    <td>{client.preferred_wake_time || "—"}</td>
                    <td>{client.current_difficulty || "—"}</td>
                    <td>{metric(client.habit_score)}</td>
                    <td>{metric(client.wake_consistency_pct, "%")}</td>
                    <td>{metric(client.challenge_accuracy, "%")}</td>
                    <td>{client.attention_reasons.length ? client.attention_reasons.join("; ") : "No current flag"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={isAdminCoach ? "No platform users found" : "No assigned clients"}
            description={isAdminCoach
              ? "Registered user accounts will appear here."
              : "An administrator must assign user accounts to this coach before their records become visible."}
          />
        )}
      </Card>

      {behavior && selectedSummary && String(behavior.client.id) === selectedClientId && (
        <>
          <div className="role-chart-grid">
            <Card title={`${behavior.client.name}: current behavior`}>
              <div style={statGrid}>
                <StatCard icon="🌱" label="Habit score" value={metric(behavior.dashboard.habit_score)} />
                <StatCard icon="📅" label="7-day consistency" value={metric(behavior.dashboard.wake_consistency_pct, "%")} accent={COLORS.cyan} />
                <StatCard icon="🧠" label="Challenge accuracy" value={metric(behavior.dashboard.challenge_accuracy, "%")} accent={COLORS.violet} />
                <StatCard icon="⚡" label="Avg. response" value={metric(behavior.dashboard.average_challenge_time, "s")} accent={COLORS.amber} />
                <StatCard icon="😴" label="Snoozes (7d)" value={behavior.behavior.snooze_7d ?? 0} accent={COLORS.rose} />
                <StatCard icon="🧩" label="Adaptive difficulty" value={behavior.dashboard.current_difficulty || "—"} />
              </div>
              <p className="role-muted">{behavior.habit_history_note}</p>
              <p className="role-muted">{behavior.sleep_measurement_note}</p>
              <p className="role-muted">Recent accuracy change: {metric(behavior.behavior.accuracy_trend_pct, " percentage points")} · Habit score change: {metric(behavior.behavior.habit_score_trend)}</p>
            </Card>
            <Card title="Recent challenge attempts" subtitle="Answer text and challenge prompts are not exposed in this coach view.">
              {behavior.challenge_history.length ? (
                <div className="role-table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Date</th><th>Type</th><th>Difficulty</th><th>Result</th><th>Response time</th></tr></thead>
                    <tbody>{behavior.challenge_history.slice(0, 10).map((item) => (
                      <tr key={`${item.source}-${item.id}`}>
                        <td>{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</td>
                        <td>{item.challenge_type}</td><td>{item.difficulty}</td>
                        <td>{item.is_correct ? "Correct" : "Incorrect"}</td>
                        <td>{item.response_time_seconds == null ? "—" : `${item.response_time_seconds}s`}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <EmptyState title="No attempt history" description="Challenge attempts will be listed after the user submits answers." />}
            </Card>
          </div>
          <Card title="Completed alarm performance and coaching" subtitle="Session-level measurements and the recommendation generated from each completed alarm.">
            {behavior.performance_history.length ? (
              <div className="role-table-wrap">
                <table className="data-table">
                  <thead><tr><th>Completed</th><th>Alarm</th><th>Accuracy</th><th>Average response</th><th>Snoozes</th><th>Recommendation</th><th>Suggested action</th></tr></thead>
                  <tbody>{behavior.performance_history.map((item) => (
                    <tr key={item.id}>
                      <td>{item.completed_at ? new Date(item.completed_at).toLocaleString() : "—"}</td>
                      <td>{item.alarm_title}<br /><small>{item.difficulty || "No challenge"} {item.challenge_type || ""}</small></td>
                      <td>{item.accuracy_pct == null ? "Not measured" : `${item.accuracy_pct}% (${item.correct_answers}/${item.total_questions})`}</td>
                      <td>{item.average_response_time_seconds == null ? "Not measured" : `${item.average_response_time_seconds}s`}</td>
                      <td>{item.snoozes_before_completion == null ? "Not available" : item.snoozes_before_completion}</td>
                      <td>{item.recommendation_reason}</td>
                      <td>{item.suggested_action}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <EmptyState title="No completed alarm performance recorded" description="Completed sessions and their coaching recommendations will appear here." />}
          </Card>
          <div className="role-chart-grid">
            <Card title="Existing personalized recommendations" subtitle="Generated using the existing behavior-based recommendation service.">
              {behavior.recommendations.length ? (
                <ul className="role-activity-list">
                  {behavior.recommendations.map((item) => (
                    <li key={item.id}>
                      <span><strong>{item.title}</strong> · {item.reason}<br /><small>{item.supporting_metric || "Supporting metric not stored"}</small><br />Action: {item.suggested_action}</span>
                      <span className={`role-priority priority-${item.priority}`}>{item.priority}</span>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="No recommendations yet" description="More recorded behavior may be needed before the recommendation engine can generate suggestions." />}
            </Card>
            <Card title="Send coaching follow-up" subtitle="Guidance is saved as a recommendation and in-app notification for this assigned user.">
              <form onSubmit={submitGuidance} className="role-guidance-form">
                <label className="form-label">Recommendation title<input className="form-input" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} /></label>
                <label className="form-label">Reason<input className="form-input" value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} /></label>
                <label className="form-label">Suggested action<textarea className="form-input" value={suggestedAction} maxLength={500} onChange={(event) => setSuggestedAction(event.target.value)} rows={3} required /></label>
                <button className="btn btn-primary" type="submit" disabled={sending}>{sending ? "Sending…" : "Send follow-up"}</button>
              </form>
            </Card>
          </div>
          <Card title="Recent wake-up activity">
            {behavior.recent_activities.length ? (
              <ul className="role-activity-list">
                {behavior.recent_activities.map((item) => <li key={item.id}><span>{item.activity_type}{item.alarm_id ? ` · Alarm ${item.alarm_id}` : ""}</span><time>{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</time></li>)}
              </ul>
            ) : <EmptyState title="No alarm activity recorded" />}
          </Card>
        </>
      )}
    </PageShell>
  );
}

export function RoleDashboard({ role, user, onBack }) {
  return role === "admin"
    ? <AdminDashboard onBack={onBack} />
    : <CoachDashboard onBack={onBack} isAdminCoach={user?.role === "admin"} />;
}
