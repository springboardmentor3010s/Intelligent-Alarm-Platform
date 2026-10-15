import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import useAlarmScheduler from '../hooks/useAlarmScheduler'
import AlarmChallenge from '../components/AlarmChallenge'

export default function UserDashboard() {
  const { user } = useAuth()
  const [profile, setProfile]               = useState(null)
  const [alarms, setAlarms]                 = useState([])
  const [habitScore, setHabitScore]         = useState(null)
  const [streak, setStreak]                 = useState(null)
  const [sleepDebt, setSleepDebt]           = useState(null)
  const [coachMessages, setCoachMessages]   = useState([])
  const [firingAlarm, setFiringAlarm]       = useState(null)

  const fetchData = useCallback(() => {
    api.get('/profile').then(r => setProfile(r.data)).catch(() => {})
    api.get('/alarms').then(r => setAlarms(r.data)).catch(() => {})
    api.get('/analytics/habit-score?days=7').then(r => setHabitScore(r.data)).catch(() => {})
    api.get('/analytics/streak').then(r => setStreak(r.data)).catch(() => {})
    api.get('/analytics/sleep-debt?days=7').then(r => setSleepDebt(r.data)).catch(() => {})
    api.get('/coach/my-messages').then(r => setCoachMessages(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const activeAlarms = alarms.filter(a => a.enabled)
  const nextAlarm    = [...activeAlarms].sort((a, b) => a.alarm_time.localeCompare(b.alarm_time))[0]
  const habits       = profile?.habit_preferences
    ? profile.habit_preferences.split(',').map(h => h.trim()).filter(Boolean)
    : []
  const displayScore = habitScore?.habit_score ?? null

  const handleAlarmFire = useCallback((alarm) => {
    setFiringAlarm(prev => prev ?? alarm)
  }, [])
  useAlarmScheduler(handleAlarmFire)

  const handleTestAlarm = () => {
    if (firingAlarm) return
    if (activeAlarms.length > 0) setFiringAlarm(activeAlarms[0])
    else if (alarms.length > 0) setFiringAlarm(alarms[0])
    else alert('Create at least one alarm first, then use Test Alarm.')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Welcome, {user?.name} 👋</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">User</span>
            <span className="text-gray-400 dark:text-gray-500 text-sm">{user?.email}</span>
          </div>
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard icon="⏰" label="Wake-up Time"   value={profile?.preferred_wake_up_time || '—'} />
          <StatCard icon="🔔" label="Active Alarms"  value={activeAlarms.length} />
          <StatCard icon="🔥" label="Current Streak" value={streak ? `${streak.current_streak}d` : '0d'} />
          <StatCard icon="😴" label="Sleep Goal"     value={profile?.sleep_duration ? `${profile.sleep_duration}h` : '—'} />
        </div>

        {/* Next Alarm + Habit Score */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-2">Next Alarm</p>
            {nextAlarm ? (
              <>
                <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{nextAlarm.alarm_time}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{nextAlarm.alarm_name} · {nextAlarm.alarm_type}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {nextAlarm.challenge_count} challenge{nextAlarm.challenge_count !== 1 ? 's' : ''} · {nextAlarm.challenge_difficulty}
                </p>
              </>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                No active alarms.{' '}
                <Link to="/alarms/create" className="text-indigo-500 hover:underline">Create one →</Link>
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold">Habit Score</p>
              <Link to="/habits/dashboard" className="text-xs text-indigo-500 hover:underline">Details →</Link>
            </div>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              {displayScore !== null ? displayScore : '—'}
              <span className="text-base font-normal text-gray-400 dark:text-gray-500">/100</span>
            </p>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mt-2">
              <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${displayScore ?? 0}%` }} />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {displayScore !== null ? 'Wake-up × 35% + Challenge × 25% + Snooze × 20% + Sleep × 20%' : 'Complete alarm challenges to calculate score'}
            </p>
          </div>
        </div>

        {/* Streak + Sleep Debt + Habits count */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-2">🔥 Wake-Up Streak</p>
            <p className="text-3xl font-bold text-orange-500 dark:text-orange-400">
              {streak ? streak.current_streak : 0}
              <span className="text-base font-normal text-gray-400"> days</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Longest: {streak ? streak.longest_streak : 0}d
              {streak?.last_verified_date ? ` · Last: ${streak.last_verified_date}` : ''}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-2">💤 Sleep Debt (7d)</p>
            <p className={`text-3xl font-bold ${sleepDebt && sleepDebt.avg_late_minutes_per_day > 15 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {sleepDebt && sleepDebt.avg_late_minutes_per_day > 0 ? `+${sleepDebt.avg_late_minutes_per_day}m` : '0m'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              avg late vs target {sleepDebt?.target_wake_time || '—'}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-2">📋 Habits</p>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{habits.length}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {habits.length === 0 ? 'No habits yet' : habits.slice(0, 2).join(', ')}
            </p>
          </div>
        </div>

        {/* Coach messages */}
        {coachMessages.length > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-2xl p-5 mb-6">
            <h2 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-3">💬 Messages from your Coach</h2>
            <div className="space-y-2">
              {coachMessages.slice(0, 3).map(m => (
                <div key={m.id} className="bg-white dark:bg-gray-800 rounded-xl px-4 py-3 border border-emerald-100 dark:border-emerald-800">
                  <p className="text-sm text-gray-700 dark:text-gray-200">{m.message}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(m.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Habits */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200">My Habits</h2>
            <Link to="/habits" className="text-xs text-indigo-500 hover:underline">Manage →</Link>
          </div>
          {habits.length === 0
            ? <p className="text-gray-400 dark:text-gray-500 text-sm">No habits yet. <Link to="/habits" className="text-indigo-500 hover:underline">Add habits →</Link></p>
            : <div className="flex flex-wrap gap-2">
                {habits.map(h => (
                  <span key={h} className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-sm px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-700">{h}</span>
                ))}
              </div>
          }
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <QuickBtn to="/alarms/create"       label="+ Create Alarm"      primary />
          <QuickBtn to="/alarms"              label="⏰ My Alarms" />
          <QuickBtn to="/habits"              label="📋 My Habits" />
          <QuickBtn to="/profile"             label="👤 My Profile" />
          <QuickBtn to="/analytics"           label="📊 Analytics" />
          <QuickBtn to="/challenges/history"  label="📋 Challenge History" />
          <QuickBtn to="/habits/dashboard"    label="🏆 Habit Dashboard" />
        </div>

        {/* Test Alarm */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">🧪 Test Alarm</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Instantly trigger the alarm challenge without waiting for scheduled time.
                {alarms.length === 0 && ' Create an alarm first.'}
              </p>
            </div>
            <button
              onClick={handleTestAlarm}
              disabled={!!firingAlarm || alarms.length === 0}
              className="shrink-0 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-xl text-sm transition"
            >
              Test Alarm
            </button>
          </div>
        </div>

      </div>

      {firingAlarm && (
        <AlarmChallenge alarm={firingAlarm} onDismiss={() => setFiringAlarm(null)} />
      )}
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
      <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold mb-1">{icon} {label}</p>
      <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{value}</p>
    </div>
  )
}

function QuickBtn({ to, label, primary }) {
  return (
    <Link to={to} className={`text-center py-3 px-4 rounded-xl font-medium text-sm transition ${
      primary
        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'
    }`}>
      {label}
    </Link>
  )
}
