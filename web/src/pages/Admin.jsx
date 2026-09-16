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
} from '../components/ui';
import { formatDate } from '../utils/timeFormat';
import { apiFetch } from '../utils/api';

async function getJSON(path) {
  const res = await apiFetch(`/api/v1${path}`);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

const ROLE_TONE = { Administrator: 'brand', 'Wellness Coach': 'warm' };

export default function Admin() {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState(null);
  const [loadState, setLoadState] = useState('loading');

  const load = () => {
    setLoadState('loading');
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
  };

  useEffect(load, []);

  return (
    <div className="page">
      <SectionHeader
        title="Admin"
        subtitle="Platform oversight, algorithmic telemetry & user role management"
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

      {loadState === 'ok' && (
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