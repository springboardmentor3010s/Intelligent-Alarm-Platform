import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import useAlarmScheduler from '../hooks/useAlarmScheduler'
import AlarmChallenge from '../components/AlarmChallenge'

const ROLE_BADGE = {
  USER: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  WELLNESS_COACH: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  ADMINISTRATOR: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [statsError, setStatsError] = useState('')
  const [modelStatus, setModelStatus] = useState(null)
  const [modelError, setModelError] = useState('')
  const [training, setTraining] = useState(false)
  const [trainMessage, setTrainMessage] = useState('')
  const [roleChanging, setRoleChanging] = useState({})
  const [roleMsg, setRoleMsg] = useState({})
  const [expandedRec, setExpandedRec] = useState(null)
  const [recData, setRecData] = useState({})
  const [streakData, setStreakData] = useState({})
  const [firingAlarm, setFiringAlarm] = useState(null)

  const handleAlarmFire = useCallback((alarm) => {
    setFiringAlarm(prev => prev ?? alarm)
  }, [])
  useAlarmScheduler(handleAlarmFire)

  const loadModelStatus = () => {
    api.get('/ml/status')
      .then(r => setModelStatus(r.data))
      .catch(() => setModelError('Could not load ML model status'))
  }

  useEffect(() => {
    api.get('/admin/stats')
      .then(r => setStats(r.data))
      .catch(() => setStatsError('Could not load stats'))
    api.get('/admin/users')
      .then(r => {
        setUsers(r.data)
        // fetch streak for every user in background
        r.data.forEach(u => {
          api.get(`/analytics/user/${u.id}/streak`)
            .then(s => setStreakData(prev => ({ ...prev, [u.id]: s.data })))
            .catch(() => {})
        })
      })
      .finally(() => setLoadingUsers(false))
    loadModelStatus()
  }, [])

  const toggleRec = async (uid) => {
    if (expandedRec === uid) { setExpandedRec(null); return }
    setExpandedRec(uid)
    if (!recData[uid]) {
      try {
        const r = await api.get(`/analytics/user/${uid}/recommendations?days=7`)
        setRecData(prev => ({ ...prev, [uid]: r.data }))
      } catch {
        setRecData(prev => ({ ...prev, [uid]: null }))
      }
    }
  }

  const handleTrain = async (demo) => {
    setTraining(true)
    setTrainMessage('')
    try {
      const r = await api.post(`/ml/train?demo=${demo}`)
      setTrainMessage(r.data.message)
      // Give the background task a moment before refreshing status
      setTimeout(loadModelStatus, 3000)
    } catch {
      setTrainMessage('Failed to start training.')
    } finally {
      setTraining(false)
    }
  }

  const handleRoleChange = async (uid, newRole) => {
    setRoleChanging(r => ({ ...r, [uid]: true }))
    setRoleMsg(m => ({ ...m, [uid]: '' }))
    try {
      const res = await api.patch(`/admin/users/${uid}/role`, { role: newRole })
      setUsers(us => us.map(u => u.id === uid ? { ...u, role: res.data.role } : u))
      setRoleMsg(m => ({ ...m, [uid]: '✅' }))
      setTimeout(() => setRoleMsg(m => ({ ...m, [uid]: '' })), 2000)
    } catch (e) {
      setRoleMsg(m => ({ ...m, [uid]: '❌ ' + (e.response?.data?.detail || 'Failed') }))
    } finally {
      setRoleChanging(r => ({ ...r, [uid]: false }))
    }
  }

  const roleOrder = ['USER', 'WELLNESS_COACH', 'ADMINISTRATOR']

  return (
    <>
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">⚙️</span>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Administrator Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">Administrator</span>
            <span className="text-gray-400 dark:text-gray-500 text-sm">{user?.name} · {user?.email}</span>
          </div>
        </div>

        {/* System stats */}
        {statsError ? (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-6 text-sm">{statsError}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard icon="👥" label="Total Users" value={stats ? stats.total_users : '…'} color="text-slate-700 dark:text-slate-300" />
            <StatCard icon="🔔" label="Total Alarms" value={stats ? stats.total_alarms : '…'} color="text-indigo-600 dark:text-indigo-400" />
            <StatCard icon="🧩" label="Total Challenges" value={stats ? stats.total_challenges : '…'} color="text-purple-600 dark:text-purple-400" />
            <StatCard icon="✅" label="Verified Wake-Ups" value={stats ? stats.verified_sessions : '…'} color="text-emerald-600 dark:text-emerald-400" />
          </div>
        )}

        {/* Role breakdown */}
        {stats && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 mb-6">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Users by Role</h2>
            <div className="flex flex-wrap gap-3">
              {roleOrder.map(role => (
                <div key={role} className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-transparent text-sm font-medium ${ROLE_BADGE[role]}`}>
                  <span>{role.replace('_', ' ')}</span>
                  <span className="font-bold">{stats.users_by_role[role] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Adaptive difficulty ML model */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200">🧩 Adaptive Difficulty ML Model</h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleTrain(false)}
                disabled={training}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition"
              >
                {training ? 'Starting…' : 'Retrain on live data'}
              </button>
              <button
                onClick={() => handleTrain(true)}
                disabled={training}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-600 dark:text-gray-300 transition"
              >
                Train on demo data
              </button>
            </div>
          </div>

          <ModelStatusPanel modelError={modelError} modelStatus={modelStatus} trainMessage={trainMessage} />
        </div>

        {/* User management table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm mb-6">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200">User Management</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">Live data · {users.length} registered</span>
          </div>

          {loadingUsers ? (
            <p className="p-5 text-gray-400 dark:text-gray-500 text-sm">Loading users…</p>
          ) : users.length === 0 ? (
            <p className="p-5 text-gray-400 dark:text-gray-500 text-sm">No users registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 dark:text-gray-500 uppercase border-b border-gray-50 dark:border-gray-700">
                    <th className="px-5 py-3 text-left font-semibold">Name</th>
                    <th className="px-5 py-3 text-left font-semibold">Email</th>
                    <th className="px-5 py-3 text-left font-semibold">Role</th>
                    <th className="px-5 py-3 text-left font-semibold">Change Role</th>
                    <th className="px-5 py-3 text-left font-semibold">Alarms</th>
                    <th className="px-5 py-3 text-left font-semibold">Streak</th>
                    <th className="px-5 py-3 text-left font-semibold">Joined</th>
                    <th className="px-5 py-3 text-left font-semibold">Recs</th>
                    <th className="px-5 py-3 text-left font-semibold">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {users.map(u => (
                    <>
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{u.name}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {u.id === user?.id ? (
                          <span className="text-xs text-gray-400 dark:text-gray-500">— (you)</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              value={u.role}
                              disabled={roleChanging[u.id]}
                              onChange={e => handleRoleChange(u.id, e.target.value)}
                              className="text-xs border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                            >
                              <option value="USER">USER</option>
                              <option value="WELLNESS_COACH">WELLNESS COACH</option>
                              <option value="ADMINISTRATOR">ADMINISTRATOR</option>
                            </select>
                            {roleMsg[u.id] && <span className="text-xs">{roleMsg[u.id]}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{u.alarm_count}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold text-orange-500 dark:text-orange-400">
                          {streakData[u.id] ? `🔥 ${streakData[u.id].current_streak}d` : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-400 dark:text-gray-500 text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => toggleRec(u.id)}
                          className="text-xs px-2 py-1 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 transition font-medium"
                        >
                          {expandedRec === u.id ? '▲' : '📋 Recs'}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={async () => {
                              const res = await api.get(`/reports/habit/pdf?user_id=${u.id}&days=7`, { responseType: 'blob' })
                              const url = URL.createObjectURL(res.data)
                              const a = document.createElement('a'); a.href = url
                              a.download = `report_${u.name}_7d.pdf`; a.click()
                              URL.revokeObjectURL(url)
                            }}
                            className="text-xs px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition"
                          >📄 PDF</button>
                          <button
                            onClick={async () => {
                              const res = await api.get(`/reports/habit/xlsx?user_id=${u.id}&days=7`, { responseType: 'blob' })
                              const url = URL.createObjectURL(res.data)
                              const a = document.createElement('a'); a.href = url
                              a.download = `report_${u.name}_7d.xlsx`; a.click()
                              URL.revokeObjectURL(url)
                            }}
                            className="text-xs px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition"
                          >📊 XLS</button>
                        </div>
                      </td>
                    </tr>
                    {expandedRec === u.id && (
                      <tr key={`rec-${u.id}`}>
                        <td colSpan={9} className="px-5 pb-4 bg-purple-50 dark:bg-purple-900/10 border-t border-purple-100 dark:border-purple-800">
                          {!recData[u.id] ? (
                            <p className="text-xs text-gray-400 py-2">Loading recommendations…</p>
                          ) : recData[u.id].recommendations.length === 0 ? (
                            <p className="text-xs text-gray-400 py-2">No recommendations for this user yet.</p>
                          ) : (
                            <div className="pt-3 space-y-2">
                              <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">
                                Habit Score: {recData[u.id].habit_score}/100 · {recData[u.id].total} recommendation{recData[u.id].total !== 1 ? 's' : ''}
                              </p>
                              {recData[u.id].recommendations.map((rec, i) => (
                                <div key={i} className={`px-3 py-2 rounded-lg text-xs flex gap-2 items-start ${
                                  rec.priority === 'HIGH' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                  : rec.priority === 'MEDIUM' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                }`}>
                                  <span className="font-bold shrink-0">{rec.priority}</span>
                                  <span><span className="font-semibold">{rec.title}</span> — {rec.message}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/alarms/create" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition">+ Create Alarm</Link>
            <Link to="/alarms" className="px-4 py-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:border-indigo-400 transition">⏰ My Alarms</Link>
            <Link to="/habits/dashboard" className="px-4 py-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:border-indigo-400 transition">🏆 Habit Dashboard</Link>
            <Link to="/analytics" className="px-4 py-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:border-indigo-400 transition">📊 Analytics</Link>
          </div>
        </div>

        {/* System info */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">System Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              ['Backend', 'FastAPI + SQLAlchemy'],
              ['Database', 'PostgreSQL 16'],
              ['Auth', 'JWT + Argon2 password hashing'],
              ['Frontend', 'React 18 + Vite + Tailwind CSS'],
              ['Milestone', 'M4 — Analytics, Testing & Deployment'],
              ['Cognitive Engine', '7 challenge types · Rule-based + XGBoost adaptive difficulty'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-400 dark:text-gray-500 w-28 shrink-0">{k}</span>
                <span className="text-gray-700 dark:text-gray-300 font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>

      {firingAlarm && (
        <AlarmChallenge alarm={firingAlarm} onDismiss={() => setFiringAlarm(null)} />
      )}
    </>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
      <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">{icon} {label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function ModelStatusPanel({ modelError, modelStatus, trainMessage }) {
  if (modelError) {
    return <p className="text-sm text-red-500">{modelError}</p>
  }
  if (!modelStatus) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Loading model status…</p>
  }
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-2">
        <div>
          <p className="text-gray-400 dark:text-gray-500 text-xs uppercase">Status</p>
          <p className={`font-bold ${modelStatus.is_ready ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {modelStatus.is_ready ? 'Active (ML predictions)' : 'Rule-based fallback'}
          </p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-gray-500 text-xs uppercase">Training samples</p>
          <p className="font-bold text-gray-700 dark:text-gray-200">{modelStatus.n_training_samples} / {modelStatus.min_samples_required} min</p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-gray-500 text-xs uppercase">Accuracy</p>
          <p className="font-bold text-gray-700 dark:text-gray-200">{modelStatus.accuracy != null ? `${(modelStatus.accuracy * 100).toFixed(1)}%` : '—'}</p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-gray-500 text-xs uppercase">Trained at</p>
          <p className="font-bold text-gray-700 dark:text-gray-200">{modelStatus.trained_at ? new Date(modelStatus.trained_at).toLocaleString() : 'Never'}</p>
        </div>
      </div>
      {!modelStatus.is_ready && modelStatus.fallback_reason && (
        <p className="text-xs text-amber-600 dark:text-amber-400">⚠️ {modelStatus.fallback_reason}</p>
      )}
      {trainMessage && (
        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">{trainMessage}</p>
      )}
    </>
  )
}
