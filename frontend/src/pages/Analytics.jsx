import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

const DIFF_COLOR = {
  BEGINNER: 'bg-green-400', EASY: 'bg-blue-400',
  MEDIUM: 'bg-yellow-400', HARD: 'bg-orange-400', EXPERT: 'bg-red-400',
}

const STATUS_BADGE = {
  WAKE_UP_VERIFIED:   'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  PARTIALLY_VERIFIED: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  NOT_VERIFIED:       'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
}

export default function Analytics() {
  const [data, setData]           = useState(null)
  const [mlStatus, setMlStatus]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/challenges/analytics'),
      api.get('/ml/status').catch(() => ({ data: null })),
    ])
      .then(([analytics, ml]) => {
        setData(analytics.data)
        setMlStatus(ml.data)
      })
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setLoading(false))
  }, [])

  const difficultyLabel = mlStatus?.is_ready
    ? `XGBoost ML (${(mlStatus.accuracy * 100).toFixed(1)}% accuracy)`
    : mlStatus
      ? `Rule-based (ML needs ${mlStatus.min_samples_required - mlStatus.n_training_samples} more samples)`
      : 'Adaptive'

  if (loading) return <div className="p-8 text-gray-400 dark:text-gray-500">Loading analytics...</div>
  if (error)   return <div className="p-8 text-red-500">{error}</div>

  const typeEntries = Object.entries(data.by_type || {})
  const diffEntries = Object.entries(data.by_difficulty || {})

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Challenge Analytics</h1>
          <Link to="/challenges/history" className="text-sm text-indigo-500 hover:underline">View History →</Link>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Challenges" value={data.total}            icon="🧩" />
          <StatCard label="Completed"         value={data.completed}       icon="✅" />
          <StatCard label="Success Rate"      value={`${data.success_rate}%`} icon="🎯" />
          <StatCard label="Avg Score"         value={data.avg_score}       icon="⭐" />
        </div>

        {/* Wake-up stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Wake-Up Sessions"   value={data.total_wakeup_sessions}    icon="⏰" color="text-indigo-600 dark:text-indigo-400" />
          <StatCard label="Verified Wake-Ups"  value={data.verified_wakeup_sessions} icon="✔️" color="text-green-600 dark:text-green-400" />
          <StatCard label="Verification Rate"  value={`${data.wakeup_verification_rate}%`} icon="🔒" color="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Wrong Answers"       value={data.total_failed_attempts}    icon="❌" color="text-red-500 dark:text-red-400" />
        </div>

        {/* Adaptive difficulty + consecutive */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">Current Difficulty</p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{data.current_difficulty}</p>
            <p className={`text-xs mt-1 font-medium ${
              mlStatus?.is_ready
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}>
              {mlStatus?.is_ready ? '🤖' : '📐'} {difficultyLabel}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">Consecutive Correct</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{data.consecutive_correct}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Current streak</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">Avg Response Time</p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {data.avg_completion_seconds > 0 ? `${data.avg_completion_seconds}s` : '0s'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Per challenge</p>
          </div>
        </div>

        {data.total === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500">
            <p className="text-4xl mb-3">📊</p>
            <p>No challenges yet. Enable an alarm and solve a challenge to see stats here.</p>
          </div>
        )}

        {/* By type */}
        {typeEntries.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mb-4">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Performance by Challenge Type</h2>
            <div className="space-y-3">
              {typeEntries.map(([type, stats]) => {
                const pct = stats.total ? Math.round(stats.correct / stats.total * 100) : 0
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize font-medium text-gray-700 dark:text-gray-300">{type}</span>
                      <span className="text-gray-500 dark:text-gray-400">{stats.correct}/{stats.total} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* By difficulty */}
        {diffEntries.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Performance by Difficulty</h2>
            <div className="space-y-3">
              {diffEntries.map(([diff, stats]) => {
                const pct = stats.total ? Math.round(stats.correct / stats.total * 100) : 0
                return (
                  <div key={diff}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{diff}</span>
                      <span className="text-gray-500 dark:text-gray-400">{stats.correct}/{stats.total} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div className={`${DIFF_COLOR[diff] || 'bg-gray-400'} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color = 'text-indigo-600 dark:text-indigo-400' }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
      <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">{icon} {label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
