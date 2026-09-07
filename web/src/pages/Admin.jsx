import React, { useEffect, useState } from 'react';
import { Card, Grid, MetricCard } from '../styles';

async function getJSON(path) {
  const res = await fetch(`/api/v1${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

export default function Admin() {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ok | denied | error

  useEffect(() => {
    Promise.all([getJSON('/dashboard/analytics'), getJSON('/dashboard/users')])
      .then(([a, u]) => {
        if (a.status === 403 || u.status === 403) {
          setLoadState('denied');
        } else if (a.status >= 500 && u.status >= 500) {
          setLoadState('error');
        } else {
          setAnalytics(a.status === 200 ? a.body : null);
          setUsers(u.status === 200 ? u.body : null);
          setLoadState('ok');
        }
      })
      .catch(() => setLoadState('error'));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Admin</h1>
          <div className="subtitle">Platform overview & user management</div>
        </div>
      </div>

      {loadState === 'loading' && <div className="page">Loading admin data…</div>}
      {loadState === 'error' && (
        <div className="banner banner-warning">⚠️ Could not load admin data. Is the backend running?</div>
      )}
      {loadState === 'denied' && (
        <Card className="p-4">
          <div className="card-label">Access Restricted</div>
          <p className="text-sm text-muted-600 mt-2">
            This page requires Administrator or Wellness Coach privileges. If you believe this is an
            error, contact your system administrator.
          </p>
        </Card>
      )}

      {loadState === 'ok' && (
        <>
          {analytics && (
            <Grid className="mb-6">
              <MetricCard label="Total Users" value={analytics.total_users} />
              <MetricCard label="Active Today" value={analytics.active_users_today} />
              <MetricCard label="New This Week" value={analytics.new_users_this_week} />
              <MetricCard
                label="Dismissal Success Rate"
                value={`${((analytics.alarm_dismissal_success_rate || 0) * 100).toFixed(1)}%`}
              />
              <MetricCard label="Avg Habit Score" value={analytics.platform_habit_score_avg} suffix="/100" />
              <MetricCard label="System Uptime" value={`${analytics.system_uptime_percentage}%`} />
            </Grid>
          )}

          {analytics?.top_challenge_types?.length > 0 && (
            <Card className="p-4 mb-6">
              <div className="card-label mb-4">Top Challenge Types</div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Challenge Type</th><th>Attempts</th></tr>
                  </thead>
                  <tbody>
                    {analytics.top_challenge_types.map((t, i) => (
                      <tr key={i}>
                        <td>{t.challenge_type}</td>
                        <td>{t.attempt_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {users && (
            <Card className="p-4">
              <div className="card-label mb-4">Registered Users</div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th><th>Email</th><th>Role</th>
                      <th>Active</th><th>Verified</th><th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>{u.email}</td>
                        <td>{u.role || 'User'}</td>
                        <td>{u.is_active ? '✓' : '—'}</td>
                        <td>{u.is_verified ? '✓' : '—'}</td>
                        <td>{u.created_at ? String(u.created_at).slice(0, 10) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}