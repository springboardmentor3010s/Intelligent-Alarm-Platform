import { useEffect, useState } from 'react'
import api from '../services/api'

const PRIORITY_STYLE = {
  HIGH:   'border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20',
  MEDIUM: 'border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  LOW:    'border-l-4 border-green-400 bg-green-50 dark:bg-green-900/20',
}
const PRIORITY_BADGE = {
  HIGH:   'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  MEDIUM: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  LOW:    'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
}

const COMPONENT_COLOR = {
  wakeup_consistency:   'bg-indigo-500',
  challenge_completion: 'bg-emerald-500',
  snooze_reduction:     'bg-amber-500',
  sleep_adherence:      'bg-purple-500',
}

const DAYS_OPTIONS = [7, 14, 30]

export default function HabitDashboard() {
  const [days, setDays]               = useState(7)
  const [habitData, setHabitData]     = useState(null)
  const [recs, setRecs]               = useState(null)
  const [behavioral, setBehavioral]   = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    setHabitData(null)
    setRecs(null)
    setBehavioral(null)
    Promise.all([
      api.get(`/analytics/habit-score?days=${days}`),
      api.get(`/analytics/recommendations?days=${days}`),
      api.get(`/analytics/behavioral?days=${days}`),
    ])
      .then(([h, r, b]) => {
        setHabitData(h.data)
        setRecs(r.data)
        setBehavioral(b.data)
      })
      .catch(() => setError('Failed to load habit dashboard.'))
      .finally(() => setLoading(false))
  }, [days])

  if (loading) return <div className="p-8 text-gray-400 dark:text-gray-500">Loading habit dashboard...</div>
  if (error)   return <div className="p-8 text-red-500">{error}</div>

  const score = habitData?.habit_score ?? 0
  const components = habitData?.components ?? {}

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header + window selector */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Habit Dashboard</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Rule-based adaptive scoring — not machine learning
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {DAYS_OPTIONS.map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  days === d
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-400'
                }`}>
                {d}d
              </button>
            ))}
            <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
            <button
              onClick={async () => {
                const res = await api.get(`/reports/habit/pdf?days=${days}`, { responseType: 'blob' })
                const url = URL.createObjectURL(res.data)
                const a = document.createElement('a')
                a.href = url
                a.download = `habit_report_${days}d.pdf`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 transition"
            >
              📄 Export PDF
            </button>
            <button
              onClick={async () => {
                const res = await api.get(`/reports/habit/xlsx?days=${days}`, { responseType: 'blob' })
                const url = URL.createObjectURL(res.data)
                const a = document.createElement('a')
                a.href = url
                a.download = `habit_report_${days}d.xlsx`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 transition"
            >
              📊 Export Excel
            </button>
          </div>
        </div>

        {/* Habit Score ring */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none"
                  stroke={score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="3"
                  strokeDasharray={`${score} ${100 - score}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{score}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">/100</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">
                Overall Habit Score
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                Last {days} days · {habitData?.insufficient_data ? '⚠️ Insufficient data for some components' : '✅ All components calculated'}
              </p>
              <code className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded block truncate">
                {habitData?.formula}
              </code>
            </div>
          </div>
        </div>

        {/* Component breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Score Breakdown</h2>
          <div className="space-y-4">
            {Object.entries(components).map(([key, comp]) => (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{comp.label}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {comp.score}/100 → contributes {comp.contribution} pts
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className={`${COMPONENT_COLOR[key] || 'bg-indigo-500'} h-2.5 rounded-full transition-all`}
                    style={{ width: `${comp.score}%` }}
                  />
                </div>
                {comp.detail?.insufficient_data && (
                  <p className="text-xs text-amber-500 dark:text-amber-400 mt-0.5">
                    ⚠️ Insufficient data — complete more sessions to improve accuracy
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Behavioral detail cards */}
        {behavioral && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <BehavioralCard
              label="Wake-Up Sessions"
              value={behavioral.wakeup_consistency?.total_sessions ?? '—'}
              sub={`${behavioral.wakeup_consistency?.verified_sessions ?? 0} verified`}
              icon="⏰"
            />
            <BehavioralCard
              label="Challenges Done"
              value={behavioral.challenge_completion?.total ?? '—'}
              sub={`${behavioral.challenge_completion?.correct ?? 0} correct`}
              icon="🧩"
            />
            <BehavioralCard
              label="Avg Response"
              value={behavioral.challenge_completion?.avg_response_seconds > 0
                ? `${behavioral.challenge_completion.avg_response_seconds}s` : '0s'}
              sub="per challenge"
              icon="⚡"
            />
            <BehavioralCard
              label="Clean Sessions"
              value={behavioral.snooze_reduction?.clean_sessions ?? '—'}
              sub="no failed attempts"
              icon="✅"
            />
          </div>
        )}

        {/* Recommendations */}
        {recs && recs.recommendations.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
              Recommendations
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">
                ({recs.total} · rule-based, not AI)
              </span>
            </h2>
            <div className="space-y-3">
              {recs.recommendations.map((rec, i) => (
                <div key={i} className={`p-3 rounded-xl ${PRIORITY_STYLE[rec.priority]}`}>
                  <div className="flex items-start gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${PRIORITY_BADGE[rec.priority]}`}>
                      {rec.priority}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{rec.title}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{rec.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recs && recs.recommendations.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500">
            <p className="text-3xl mb-2">🎯</p>
            <p>No recommendations yet. Complete some alarm challenges to generate insights.</p>
          </div>
        )}

      </div>
    </div>
  )
}

function BehavioralCard({ label, value, sub, icon }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
      <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">{icon} {label}</p>
      <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{value}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
    </div>
  )
}
