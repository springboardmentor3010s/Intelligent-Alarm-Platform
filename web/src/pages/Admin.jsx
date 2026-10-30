// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Grid } from '../styles';
import {
  CardSkeleton,
  ErrorState,
  ProgressBar,
  Badge,
  ShieldIcon,
  SectionHeader,
  ActivityIcon,
  UserIcon,
} from '../components/ui';
import { formatDate } from '../utils/timeFormat';
import { apiFetch } from '../utils/api';

async function getJSON(path) {
  const res = await apiFetch(`/api/v1${path}`);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

const ROLE_TONE = { Administrator: 'brand', 'Wellness Coach': 'warm' };

export default function Admin({ mode } = {}) {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState(null);
  const [roster, setRoster] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailState, setDetailState] = useState('idle');
  const [assignments, setAssignments] = useState(null);
  const [assignCoach, setAssignCoach] = useState('');
  const [assignUser, setAssignUser] = useState('');
  const [assignMsg, setAssignMsg] = useState(null);
  const [announcements, setAnnouncements] = useState(null);
  const [annForm, setAnnForm] = useState({ title: '', body: '', priority: 0 });
  const [annMsg, setAnnMsg] = useState(null);

  // Admin-only side data (assignments + announcements) — loaded after the main payload.
  async function loadAdminExtras() {
    const [asg, ann] = await Promise.all([
      getJSON('/dashboard/coach/assignments'),
      getJSON('/announcements'),
    ]);
    if (asg.status === 200) setAssignments(asg.body);
    if (ann.status === 200) setAnnouncements(ann.body);
  }

  const changeRole = async (userId, role) => {
    const res = await apiFetch(`/api/v1/dashboard/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setUsers(prev => (prev || []).map(u => (u.id === userId ? { ...u, role } : u)));
    } else {
      const b = await res.json().catch(() => null);
      setAssignMsg({ tone: 'error', text: b?.detail || 'Could not change role' });
    }
  };

  const submitAssignment = async (action) => {
    const coachId = Number(assignCoach);
    const userId = Number(assignUser);
    if (!coachId || !userId) {
      setAssignMsg({ tone: 'error', text: 'Choose both a coach and a user.' });
      return;
    }
    const res = action === 'assign'
      ? await apiFetch('/api/v1/dashboard/coach/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coach_id: coachId, user_id: userId }),
        })
      : await apiFetch(
          `/api/v1/dashboard/coach/assignments?coach_id=${coachId}&user_id=${userId}`,
          { method: 'DELETE' },
        );
    const body = await res.json().catch(() => null);
    if (res.ok) {
      setAssignMsg({
        tone: 'success',
        text: action === 'assign' ? 'User added to the coach\u2019s cohort.' : 'User removed from the cohort.',
      });
      loadAdminExtras();
    } else {
      setAssignMsg({ tone: 'error', text: body?.detail || 'Assignment failed' });
    }
  };

  const createAnnouncement = async () => {
    if (!annForm.title.trim() || !annForm.body.trim()) {
      setAnnMsg({ tone: 'error', text: 'Title and body are required.' });
      return;
    }
    const res = await apiFetch('/api/v1/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...annForm, priority: Number(annForm.priority) || 0 }),
    });
    if (res.ok) {
      setAnnForm({ title: '', body: '', priority: 0 });
      setAnnMsg({ tone: 'success', text: 'Announcement published.' });
      loadAdminExtras();
    } else {
      const b = await res.json().catch(() => null);
      setAnnMsg({ tone: 'error', text: b?.detail || 'Could not publish announcement' });
    }
  };

  const toggleAnnouncement = async (a) => {
    const res = await apiFetch(`/api/v1/announcements/${a.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !a.is_active }),
    });
    if (res.ok) loadAdminExtras();
    else setAnnMsg({ tone: 'error', text: 'Could not update announcement' });
  };

  const deleteAnnouncement = async (id) => {
    const res = await apiFetch(`/api/v1/announcements/${id}`, { method: 'DELETE' });
    if (res.ok) loadAdminExtras();
    else setAnnMsg({ tone: 'error', text: 'Could not delete announcement' });
  };

  const load = () => {
    setLoadState('loading');
    setDetail(null);
    setSelectedId(null);
    // Coach route (/coach): skip the admin-only calls and load the cohort directly.
    if (mode === 'coach') {
      getJSON('/dashboard/coach/users')
        .then(({ status, body }) => {
          if (status === 200) { setRoster(body); setLoadState('coach'); }
          else if (status === 403) setLoadState('denied');
          else setLoadState('error');
        })
        .catch(() => setLoadState('error'));
      return;
    }
    Promise.all([getJSON('/dashboard/analytics'), getJSON('/dashboard/users')])
      .then(async ([a, u]) => {
        if (u.status === 403) {
          setLoadState('denied');
        } else if (a.status === 200 && u.status === 200) {
          setAnalytics(a.body);
          setUsers(u.body);
          setLoadState('admin');
          loadAdminExtras();
        } else if (a.status === 403 && u.status === 200) {
          // Wellness Coach: platform telemetry is admin-only, but the
          // cohort roster is served scoped by the backend.
          const r = await getJSON('/dashboard/coach/users');
          setRoster(r.status === 200 ? r.body : []);
          setLoadState('coach');
        } else {
          setLoadState('error');
        }
      })
      .catch(() => setLoadState('error'));
  };

  useEffect(load, []);

  const selectUser = (id) => {
    setSelectedId(id);
    setDetail(null);
    if (id == null) {
      setDetailState('idle');
      return;
    }
    setDetailState('loading');
    getJSON(`/dashboard/coach/users/${id}`)
      .then(({ status, body }) => {
        if (status === 200) {
          setDetail(body);
          setDetailState('ok');
        } else if (status === 403) {
          setDetailState('denied');
        } else {
          setDetailState('error');
        }
      })
      .catch(() => setDetailState('error'));
  };

  return (
    <div className="page">
      <SectionHeader
        title={loadState === 'coach' ? 'Coaching Cohort' : 'Admin'}
        subtitle={
          loadState === 'coach'
            ? 'Assigned users · adherence · sleep trends · challenge performance'
            : 'Platform oversight, algorithmic telemetry & user role management'
        }
      />

      {loadState === 'loading' && (
        <div className="grid-cards grid-cards--metrics">
          {Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {loadState === 'error' && (
        <ErrorState
          description="Could not load administrative telemetry. Verify backend connectivity."
          onRetry={load}
        />
      )}

      {loadState === 'denied' && (
        <Card className="p-6 text-center" style={{ maxWidth: '520px', margin: '2rem auto' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: 'var(--c-rose-soft)', color: 'var(--c-rose)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <ShieldIcon size={24} />
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>
            Access Restricted
          </div>
          <p className="text-sm text-muted-600 mb-6" style={{ lineHeight: 1.5 }}>
            This command center requires Administrator or Wellness Coach privileges. If you need elevated access, contact your administrator.
          </p>
          <div>
            <Link className="btn btn-primary" to="/">Return to Dashboard</Link>
          </div>
        </Card>
      )}

      {loadState === 'admin' && (
        <>
          {/* Key Administrative Telemetry Strip */}
          {analytics && (
            <Grid className="mb-6 grid-cards--metrics">
              <Metric label="Total Users" value={analytics.total_users} />
              <Metric label="Active Today" value={analytics.active_users_today} />
              <Metric label="New This Week" value={analytics.new_users_this_week} />
              <Metric
                label="Dismissal Success Rate"
                value={((analytics.alarm_dismissal_success_rate || 0) * 100).toFixed(1) + '%'}
                progress={Math.round((analytics.alarm_dismissal_success_rate || 0) * 100)}
                tone="success"
                max={100}
              />
              <Metric
                label="Platform Avg Habit Score"
                value={`${analytics.platform_habit_score_avg}`}
                suffix="/100"
                progress={Math.round(analytics.platform_habit_score_avg || 0)}
                tone="brand"
                max={100}
              />
              <Metric label="System Uptime" value={`${analytics.system_uptime_percentage}%`} />
            </Grid>
          )}

          {/* Top Challenge Types Breakdown */}
          {analytics?.top_challenge_types?.length > 0 && (
            <Card className="p-4 mb-6">
              <div className="card-label mb-3"><span className="sys-label">Top Cognitive Challenge Types</span></div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Challenge Type</th><th>Attempt Count</th><th>Distribution</th></tr>
                  </thead>
                  <tbody>
                    {analytics.top_challenge_types.map((t, i) => (
                      <tr key={i}>
                        <td><strong>{t.challenge_type}</strong></td>
                        <td className="tabular">{t.attempt_count}</td>
                        <td style={{ width: '40%' }}>
                          <ProgressBar
                            value={t.attempt_count}
                            max={Math.max(...analytics.top_challenge_types.map(x => x.attempt_count || 1))}
                            tone="brand"
                            label={t.challenge_type}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* User Directory Table */}
          {users && (
            <Card className="p-4">
              <div className="card-label mb-3"><span className="sys-label">Registered Users Directory</span></div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Verification</th>
                      <th>Joined</th>
                      <th>Manage role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td className="tabular">{u.id}</td>
                        <td>{u.email}</td>
                        <td>
                          <Badge tone={ROLE_TONE[u.role] || 'subtle'}>{u.role || 'User'}</Badge>
                        </td>
                        <td>
                          <span className={`pill ${u.is_active ? 'pill-success' : 'pill-neutral'}`}>
                            <span className="led led--on" style={{ marginRight: '0.2rem' }} />
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          {u.is_verified ? (
                            <span className="text-xs" style={{ color: 'var(--c-emerald)', fontWeight: 600 }}>✓ Verified</span>
                          ) : (
                            <span className="text-xs text-muted-600">Pending</span>
                          )}
                        </td>
                        <td className="tabular text-muted-600">{u.created_at ? formatDate(u.created_at) : '-'}</td>
                        <td>
                          <select
                            className="form-control form-control--select"
                            aria-label={`Role for ${u.email}`}
                            value={u.role || 'User'}
                            onChange={(e) => changeRole(u.id, e.target.value)}
                          >
                            <option>User</option>
                            <option>Wellness Coach</option>
                            <option>Administrator</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {/* Cohort assignment — assign users to a Wellness Coach */}
          <Card className="p-4 mt-6">
            <div className="card-label mb-3"><span className="sys-label">Coach Cohort Assignment</span></div>
            <p className="text-sm text-muted-600 mb-4" style={{ lineHeight: 1.5 }}>
              Place a user in a Wellness Coach&rsquo;s cohort. Coaches only ever see the users assigned here.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
              <label className="text-xs text-muted-600" style={{ display: 'grid', gap: '0.25rem' }}>
                Wellness Coach
                <select
                  className="form-control form-control--select"
                  aria-label="Select coach"
                  value={assignCoach}
                  onChange={(e) => setAssignCoach(e.target.value)}
                >
                  <option value="">Select coach…</option>
                  {(users || []).filter(u => u.role === 'Wellness Coach')
                    .map(c => <option key={c.id} value={c.id}>{c.email}</option>)}
                </select>
              </label>
              <label className="text-xs text-muted-600" style={{ display: 'grid', gap: '0.25rem' }}>
                User
                <select
                  className="form-control form-control--select"
                  aria-label="Select user"
                  value={assignUser}
                  onChange={(e) => setAssignUser(e.target.value)}
                >
                  <option value="">Select user…</option>
                  {(users || []).filter(u => u.role === 'User')
                    .map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                </select>
              </label>
              <button className="btn btn-primary" onClick={() => submitAssignment('assign')}>Assign</button>
              <button className="btn btn-secondary" onClick={() => submitAssignment('remove')}>Remove</button>
            </div>
            {assignMsg && (
              <div className={`banner ${assignMsg.tone === 'error' ? 'banner-error' : ''}`} role="status" style={{ marginTop: '0.75rem' }}>
                {assignMsg.text}
              </div>
            )}
            <div className="mt-4">
              <div className="card-label mb-2">Current assignments</div>
              {assignments == null ? (
                <p className="text-sm text-muted-600">Loading…</p>
              ) : assignments.length === 0 ? (
                <p className="text-sm text-muted-600">No users are assigned to any coach yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Coach</th><th>User</th><th /></tr></thead>
                    <tbody>
                      {assignments.map(a => (
                        <tr key={a.id}>
                          <td>{(users || []).find(u => u.id === a.coach_id)?.email || a.coach_id}</td>
                          <td>{(users || []).find(u => u.id === a.user_id)?.email || a.user_id}</td>
                          <td>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setAssignCoach(String(a.coach_id));
                                setAssignUser(String(a.user_id));
                                submitAssignment('remove');
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          {/* Announcements — admin CRUD feeding the user-facing /public feed */}
          <Card className="p-4 mt-6">
            <div className="card-label mb-3"><span className="sys-label">Platform Announcements</span></div>
            <div style={{ display: 'grid', gap: '0.5rem', maxWidth: '640px' }}>
              <input
                className="form-control" placeholder="Title" aria-label="Announcement title"
                value={annForm.title} onChange={(e) => setAnnForm(f => ({ ...f, title: e.target.value }))}
              />
              <textarea
                className="form-control" placeholder="Body" aria-label="Announcement body" rows={3}
                value={annForm.body} onChange={(e) => setAnnForm(f => ({ ...f, body: e.target.value }))}
              />
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  className="form-control" type="number" style={{ width: '110px' }} aria-label="Priority"
                  value={annForm.priority} onChange={(e) => setAnnForm(f => ({ ...f, priority: e.target.value }))}
                />
                <button className="btn btn-primary" onClick={createAnnouncement}>Publish</button>
              </div>
            </div>
            {annMsg && (
              <div className={`banner ${annMsg.tone === 'error' ? 'banner-error' : ''}`} role="status" style={{ marginTop: '0.75rem' }}>
                {annMsg.text}
              </div>
            )}
            <div className="mt-4">
              {announcements == null ? (
                <p className="text-sm text-muted-600">Loading…</p>
              ) : announcements.length === 0 ? (
                <p className="text-sm text-muted-600">No announcements yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Title</th><th>Priority</th><th>Status</th><th /></tr></thead>
                    <tbody>
                      {announcements.map(a => (
                        <tr key={a.id}>
                          <td>{a.title}</td>
                          <td className="tabular">{a.priority}</td>
                          <td>
                            <span className={`pill ${a.is_active ? 'pill-success' : 'pill-neutral'}`}>
                              {a.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button className="btn btn-secondary" onClick={() => toggleAnnouncement(a)}>
                                {a.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button className="btn btn-secondary" onClick={() => deleteAnnouncement(a.id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {loadState === 'coach' && (
        <>
          {roster && roster.length === 0 ? (
            <Card className="p-6 text-center" style={{ maxWidth: '560px', margin: '2rem auto' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: 'var(--c-violet-soft)', color: 'var(--c-violet)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <UserIcon size={24} />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>
                No assigned users yet
              </div>
              <p className="text-sm text-muted-600 mb-6" style={{ lineHeight: 1.5 }}>
                Your coaching cohort is empty. Ask an administrator to assign users to you —
                they will appear here with adherence, sleep, and performance detail.
              </p>
              <div>
                <button className="btn btn-secondary" onClick={load}>Refresh cohort</button>
              </div>
            </Card>
          ) : (
            <div className="grid-cards grid-cards--metrics mb-6">
              {(roster || []).map(u => (
                <Card key={u.id} className="p-4">
                  <div className="card-label">{u.email}</div>
                  <div className="mb-3" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <Badge tone={ROLE_TONE[u.role] || 'subtle'}>{u.role || 'User'}</Badge>
                    <span className={`pill ${u.is_active ? 'pill-success' : 'pill-neutral'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => selectUser(selectedId === u.id ? null : u.id)}
                    aria-expanded={selectedId === u.id}
                  >
                    {selectedId === u.id ? 'Hide detail' : 'View detail'}
                  </button>
                </Card>
              ))}
            </div>
          )}

          {detailState === 'loading' && (
            <div className="grid-cards grid-cards--metrics">
              <CardSkeleton /><CardSkeleton />
            </div>
          )}
          {detailState === 'denied' && (
            <div className="banner banner-error" role="status">
              This user is outside your assigned cohort.
            </div>
          )}
          {detailState === 'error' && (
            <ErrorState description="Could not load user detail." onRetry={() => selectUser(selectedId)} />
          )}
          {detailState === 'ok' && detail && (
            <CohortDetail detail={detail} />
          )}
        </>
      )}
    </div>
  );
}

function CohortDetail({ detail }) {
  const { user, habit_score, habit_history, analytics, sleep_trend, wake_up_trend,
    challenge_performance, progress, wake_up_consistency_trend } = detail;
  const scored = (habit_history || []).filter(h => h.overall_score !== null);
  const perfEntries = Object.entries(challenge_performance || {});

  return (
    <div>
      <Card className="p-4 mb-6">
        <div className="card-label mb-3"><span className="sys-label">User Profile Summary</span></div>
        <div className="telemetry-grid">
          <div className="telemetry-item">
            <span className="text-xs text-muted-600">Email</span>
            <span className="metric-value" style={{ fontSize: '1rem' }}>{user.email}</span>
          </div>
          <div className="telemetry-item">
            <span className="text-xs text-muted-600">Role</span>
            <span><Badge tone={ROLE_TONE[user.role] || 'subtle'}>{user.role || 'User'}</Badge></span>
          </div>
          <div className="telemetry-item">
            <span className="text-xs text-muted-600">Status</span>
            <span className="text-sm">{user.is_active ? 'Active' : 'Inactive'} · {user.is_verified ? 'Verified' : 'Unverified'}</span>
          </div>
          <div className="telemetry-item">
            <span className="text-xs text-muted-600">Joined</span>
            <span className="text-sm tabular">{user.created_at ? formatDate(user.created_at) : '-'}</span>
          </div>
        </div>
      </Card>

      <Grid className="mb-6 grid-cards--metrics">
        <Metric label="Overall Habit Score" value={habit_score?.overall_score ?? '-'} suffix="/100"
          progress={habit_score?.overall_score ?? 0} tone="brand" max={100} />
        <Metric label="Wake-up Consistency" value={habit_score?.wake_up_consistency ?? '-'} suffix="/100"
          progress={habit_score?.wake_up_consistency ?? 0} tone="success" max={100} />
        <Metric label="Challenge Completion" value={habit_score?.challenge_completion ?? '-'} suffix="/100"
          progress={habit_score?.challenge_completion ?? 0} tone="warm" max={100} />
        <Metric label="Snooze Reduction" value={habit_score?.snooze_reduction ?? '-'} suffix="/100"
          progress={habit_score?.snooze_reduction ?? 0} tone="brand" max={100} />
      </Grid>

      <Card className="p-4 mb-6">
        <div className="card-label mb-3"><span className="sys-label">Alarm Consistency</span></div>
        <div className="telemetry-grid">
          <div className="telemetry-item">
            <span className="text-xs text-muted-600">Total Alarms</span>
            <span className="metric-value">{analytics?.total_alarms ?? '-'}</span>
          </div>
          <div className="telemetry-item">
            <span className="text-xs text-muted-600">Successful Dismissals</span>
            <span className="metric-value">{analytics?.total_dismissals ?? '-'}</span>
          </div>
          <div className="telemetry-item">
            <span className="text-xs text-muted-600">Avg Snooze Count</span>
            <span className="metric-value">{analytics?.average_snooze_count?.toFixed?.(1) ?? '-'}</span>
          </div>
          <div className="telemetry-item">
            <span className="text-xs text-muted-600">Consistency Trend</span>
            <span><Badge tone="brand">{wake_up_consistency_trend || analytics?.wake_up_consistency_trend || '-'}</Badge></span>
          </div>
        </div>
      </Card>

      <Card className="p-4 mb-6">
        <div className="card-label mb-3"><span className="sys-label">Challenge Performance</span></div>
        {perfEntries.length === 0 ? (
          <p className="text-sm text-muted-600">No submitted challenge attempts yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Type</th><th>Attempts</th><th>Accuracy</th><th>Avg Solve Time</th></tr>
              </thead>
              <tbody>
                {perfEntries.map(([ctype, stats]) => (
                  <tr key={ctype}>
                    <td><strong>{ctype}</strong></td>
                    <td className="tabular">{stats.attempts}</td>
                    <td className="tabular">{((stats.accuracy || 0) * 100).toFixed(0)}%</td>
                    <td className="tabular">{stats.avg_solve_time_seconds ?? '-'}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4 mb-6">
        <div className="card-label mb-3"><span className="sys-label">Sleep Trend (7 days, adherence /100)</span></div>
        {(sleep_trend || []).every(v => v == null) ? (
          <p className="text-sm text-muted-600">No scored days yet — sleep adherence will plot here.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Overall</th><th>Sleep Adherence</th><th>Wake-up</th></tr>
              </thead>
              <tbody>
                {(habit_history || []).map((h, i) => (
                  <tr key={h.date}>
                    <td className="tabular">{h.date}</td>
                    <td className="tabular">{h.overall_score ?? '-'}</td>
                    <td className="tabular">{(sleep_trend || [])[i] ?? '-'}</td>
                    <td className="tabular">{(wake_up_trend || [])[i] ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4 mb-6">
        <div className="card-label mb-3"><span className="sys-label">Progress History</span></div>
        {progress ? (
          <p className="text-sm" style={{ lineHeight: 1.6 }}>
            <ActivityIcon size={13} /> Overall score moved from{' '}
            <strong className="tabular">{progress.oldest_score}</strong> to{' '}
            <strong className="tabular">{progress.latest_score}</strong>{' '}
            (<Badge tone={progress.direction === 'improving' ? 'success' : progress.direction === 'declining' ? 'danger' : 'subtle'}>
              {progress.direction} ({progress.delta >= 0 ? '+' : ''}{progress.delta})
            </Badge>) across {scored.length} scored days.
          </p>
        ) : (
          <p className="text-sm text-muted-600">
            Not enough scored history for a progress reading yet (needs 2+ scored days).
          </p>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value, suffix, progress, tone, max }) {
  return (
    <Card className="p-4">
      <div className="card-label">{label}</div>
      <div className="metric-row" style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
        <span className="metric-value">{value}</span>
        {suffix && <span className="metric-denom">{suffix}</span>}
      </div>
      {typeof progress === 'number' && (
        <div className="mt-3"><ProgressBar value={progress} max={max || 100} tone={tone} label={label} /></div>
      )}
    </Card>
  );
}
