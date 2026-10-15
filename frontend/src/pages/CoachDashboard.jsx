import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import useAlarmScheduler from '../hooks/useAlarmScheduler'
import AlarmChallenge from '../components/AlarmChallenge'

export default function CoachDashboard() {
  const { user } = useAuth()
  const [summary, setSummary]         = useState(null)
  const [users, setUsers]             = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [note, setNote]               = useState('')
  const [noteTarget, setNoteTarget]   = useState('')
  const [noteMsg, setNoteMsg]         = useState('')
  const [savingNote, setSavingNote]   = useState(false)
  const [savedNotes, setSavedNotes]   = useState([])
  const [expandedUser, setExpandedUser] = useState(null)
  const [progressData, setProgressData] = useState({})
  const [streakData, setStreakData] = useState({})
  const [firingAlarm, setFiringAlarm] = useState(null)

  const handleAlarmFire = useCallback((alarm) => {
    setFiringAlarm(prev => prev ?? alarm)
  }, [])
  useAlarmScheduler(handleAlarmFire)

  const loadNotes = () =>
    api.get('/coach/notes').then(r => setSavedNotes(r.data)).catch(() => {})

  useEffect(() => {
    api.get('/coach/summary').then(r => setSummary(r.data)).catch(() => {})
    api.get('/coach/users').then(r => setUsers(r.data)).finally(() => setLoadingUsers(false))
    loadNotes()
  }, [])

  const toggleProgress = async (userId) => {
    if (expandedUser === userId) { setExpandedUser(null); return }
    setExpandedUser(userId)
    if (!progressData[userId]) {
      try {
        const [prog, streak] = await Promise.all([
          api.get(`/coach/users/${userId}/progress`),
          api.get(`/analytics/user/${userId}/streak`),
        ])
        setProgressData(prev => ({ ...prev, [userId]: prog.data }))
        setStreakData(prev => ({ ...prev, [userId]: streak.data }))
      } catch {
        setProgressData(prev => ({ ...prev, [userId]: null }))
      }
    }
  }

  const handleSaveNote = async () => {
    if (!note.trim()) return
    setSavingNote(true)
    setNoteMsg('')
    try {
      await api.post('/coach/notes', { message: note.trim(), target_user_id: noteTarget ? parseInt(noteTarget) : null })
      setNoteMsg('✅ Note saved successfully.')
      setNote('')
      setNoteTarget('')
      loadNotes()
    } catch {
      setNoteMsg('❌ Failed to save note. Please try again.')
    } finally {
      setSavingNote(false)
    }
  }

  const attentionUsers = users.filter(u => u.habit_count === 0)

  return (
    <>
    <div className="min-h-screen bg-emerald-50 dark:bg-gray-950">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🏋️</span>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Wellness Coach Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Wellness Coach</span>
            <span className="text-gray-400 dark:text-gray-500 text-sm">{user?.name} · {user?.email}</span>
          </div>
        </div>

        {/* Summary cards — real data from /coach/summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            icon="👥" label="Managed Users"
            value={summary ? summary.total_users : '…'}
            color="text-emerald-600 dark:text-emerald-400"
          />
          <SummaryCard
            icon="⚠️" label="Need Attention"
            value={summary ? summary.users_needing_attention : '…'}
            color="text-orange-500 dark:text-orange-400"
            note="No habits set"
          />
          <SummaryCard
            icon="✅" label="With Habits"
            value={summary ? summary.users_with_habits : '…'}
            color="text-emerald-600 dark:text-emerald-400"
          />
          <SummaryCard
            icon="🔔" label="With Active Alarms"
            value={summary ? summary.users_with_active_alarms : '…'}
            color="text-indigo-600 dark:text-indigo-400"
          />
        </div>

        {/* Users needing attention banner */}
        {attentionUsers.length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-4 mb-6 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-semibold text-orange-700 dark:text-orange-400 text-sm">
                {attentionUsers.length} user{attentionUsers.length > 1 ? 's' : ''} have no habits set
              </p>
              <p className="text-orange-600 dark:text-orange-500 text-xs mt-0.5">
                {attentionUsers.map(u => u.name).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Managed users table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm mb-6">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200">Managed Users</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">Live data from database</span>
          </div>

          {loadingUsers ? (
            <p className="p-5 text-gray-400 dark:text-gray-500 text-sm">Loading users…</p>
          ) : users.length === 0 ? (
            <p className="p-5 text-gray-400 dark:text-gray-500 text-sm">No registered users yet.</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {users.map(u => (
                <div key={u.id}>
                  <div className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 dark:text-gray-100 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{u.email}</p>
                    {u.productivity_goal && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">Goal: {u.productivity_goal}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm shrink-0 flex-wrap justify-end">
                    <div className="text-center">
                      <p className="font-bold text-indigo-600 dark:text-indigo-400">{u.habit_count}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">habits</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">{u.active_alarms}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">alarms</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="font-medium text-gray-600 dark:text-gray-300">{u.wake_up_time || '—'}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">wake-up</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className={`font-bold ${
                        u.habit_score_insufficient ? 'text-gray-400 dark:text-gray-500'
                        : u.habit_score >= 70 ? 'text-emerald-600 dark:text-emerald-400'
                        : u.habit_score >= 40 ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-500 dark:text-red-400'
                      }`}>
                        {u.habit_score_insufficient ? '—' : `${u.habit_score}/100`}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">habit score</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.habit_count === 0
                        ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400'
                        : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    }`}>
                      {u.habit_count === 0 ? 'Needs attention' : 'On track'}
                    </span>
                    <button
                      onClick={() => toggleProgress(u.id)}
                      className="text-xs px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition font-medium"
                    >
                      {expandedUser === u.id ? '▲ Hide' : '📊 Progress'}
                    </button>
                    {/* Per-user report export */}
                    <div className="flex gap-1">
                      <button
                        title="Export PDF report"
                        onClick={async () => {
                          const res = await api.get(`/reports/habit/pdf?user_id=${u.id}&days=7`, { responseType: 'blob' })
                          const url = URL.createObjectURL(res.data)
                          const a = document.createElement('a'); a.href = url
                          a.download = `report_${u.name}_7d.pdf`; a.click()
                          URL.revokeObjectURL(url)
                        }}
                        className="text-xs px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
                      >📄 PDF</button>
                      <button
                        title="Export Excel report"
                        onClick={async () => {
                          const res = await api.get(`/reports/habit/xlsx?user_id=${u.id}&days=7`, { responseType: 'blob' })
                          const url = URL.createObjectURL(res.data)
                          const a = document.createElement('a'); a.href = url
                          a.download = `report_${u.name}_7d.xlsx`; a.click()
                          URL.revokeObjectURL(url)
                        }}
                        className="text-xs px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
                      >📊 XLS</button>
                    </div>
                  </div>
                  </div>

                  {/* Expandable progress panel */}
                  {expandedUser === u.id && (
                    <div className="px-5 pb-4 bg-gray-50 dark:bg-gray-700/40 border-t border-gray-100 dark:border-gray-700">
                      {!progressData[u.id] ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 py-3">Loading progress…</p>
                      ) : (
                        <div className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {/* Habit score components */}
                          {Object.entries(progressData[u.id].habit_components).map(([key, comp]) => (
                            <div key={key} className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 leading-tight">{comp.label}</p>
                              <div className="flex items-end gap-1">
                                <p className={`text-lg font-bold ${
                                  comp.score >= 70 ? 'text-emerald-600 dark:text-emerald-400'
                                  : comp.score >= 40 ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-red-500 dark:text-red-400'
                                }`}>{comp.score}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">/100</p>
                              </div>
                              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    comp.score >= 70 ? 'bg-emerald-500'
                                    : comp.score >= 40 ? 'bg-amber-500'
                                    : 'bg-red-500'
                                  }`}
                                  style={{ width: `${comp.score}%` }}
                                />
                              </div>
                            </div>
                          ))}
                          {/* Challenge + session stats */}
                          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">🔥 Streak</p>
                              <p className="text-lg font-bold text-orange-500 dark:text-orange-400">
                                {streakData[u.id] ? `${streakData[u.id].current_streak}d` : '—'}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                best: {streakData[u.id] ? `${streakData[u.id].longest_streak}d` : '—'}
                              </p>
                            </div>
                          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">🧩 Challenges</p>
                            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                              {progressData[u.id].correct_challenges}/{progressData[u.id].total_challenges}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{progressData[u.id].challenge_success_rate}% success</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">⏰ Wake-Up Sessions</p>
                            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                              {progressData[u.id].verified_sessions}/{progressData[u.id].total_sessions}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">verified</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/alarms/create" className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition">+ Create Alarm</Link>
            <Link to="/alarms" className="px-4 py-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:border-emerald-400 transition">⏰ My Alarms</Link>
            <Link to="/habits/dashboard" className="px-4 py-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:border-emerald-400 transition">🏆 Habit Dashboard</Link>
            <Link to="/analytics" className="px-4 py-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:border-emerald-400 transition">📊 Analytics</Link>
          </div>
        </div>

        {/* Recommendation note */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-1">Recommendation / Feedback Note</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            Send a note to a specific user or save a general coaching note.
          </p>
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Send to (optional)</label>
            <select
              value={noteTarget}
              onChange={e => setNoteTarget(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">General note (not user-specific)</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          {noteMsg && (
            <div className={`text-sm p-2 rounded mb-3 ${
              noteMsg.startsWith('✅')
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            }`}>{noteMsg}</div>
          )}
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. Encourage users to set at least 3 habits and a consistent wake-up time…"
            className="w-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
          />
          <button
            onClick={handleSaveNote}
            disabled={savingNote || !note.trim()}
            className="mt-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {savingNote ? 'Saving…' : 'Save Note'}
          </button>

          {/* Saved notes history */}
          {savedNotes.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase mb-2">Previous Notes</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {savedNotes.map(n => (
                  <div key={n.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-200">{n.message}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {new Date(n.created_at).toLocaleString()}
                        {n.target_user_id && <span className="ml-2 text-emerald-500">→ user #{n.target_user_id}</span>}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await api.delete(`/coach/notes/${n.id}`).catch(() => {})
                        loadNotes()
                      }}
                      className="shrink-0 text-xs text-red-400 hover:text-red-600 transition"
                      title="Delete note"
                    >🗑</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>

      {firingAlarm && (
        <AlarmChallenge alarm={firingAlarm} onDismiss={() => setFiringAlarm(null)} />
      )}
    </>
  )
}

function SummaryCard({ icon, label, value, color, note }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
      <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">{icon} {label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {note && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{note}</p>}
    </div>
  )
}
