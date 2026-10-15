import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const ROLE_BADGE = {
  USER: 'bg-blue-100 text-blue-700',
  WELLNESS_COACH: 'bg-green-100 text-green-700',
  ADMINISTRATOR: 'bg-red-100 text-red-700',
}

const ROLE_LABEL = {
  USER: 'User',
  WELLNESS_COACH: 'Wellness Coach',
  ADMINISTRATOR: 'Administrator',
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [alarms, setAlarms] = useState([])

  useEffect(() => {
    api.get('/profile').then(r => setProfile(r.data)).catch(() => {})
    api.get('/alarms').then(r => setAlarms(r.data)).catch(() => {})
  }, [])

  const activeAlarms = alarms.filter(a => a.enabled)
  const nextAlarm = [...activeAlarms].sort((a, b) => a.alarm_time.localeCompare(b.alarm_time))[0]
  const habits = profile?.habit_preferences
    ? profile.habit_preferences.split(',').map(h => h.trim()).filter(Boolean)
    : []

  // Prototype habit score — clearly labelled as demo
  const habitScore = habits.length > 0 ? Math.min(100, habits.length * 15 + (activeAlarms.length > 0 ? 25 : 0)) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Welcome, {user?.name} 👋</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ROLE_BADGE[user?.role] || 'bg-gray-100 text-gray-600'}`}>
                {ROLE_LABEL[user?.role] || user?.role}
              </span>
              <span className="text-gray-400 text-sm">·</span>
              <span className="text-gray-400 text-sm">{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Wake-up Time" value={profile?.preferred_wake_up_time || '—'} icon="⏰" />
          <StatCard label="Active Alarms" value={activeAlarms.length} icon="🔔" />
          <StatCard label="Habits Tracked" value={habits.length} icon="📋" />
          <StatCard label="Sleep Goal" value={profile?.sleep_duration ? `${profile.sleep_duration}h` : '—'} icon="😴" />
        </div>

        {/* Next Alarm + Habit Score */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Next Alarm</p>
            {nextAlarm ? (
              <>
                <p className="text-2xl font-bold text-indigo-600">{nextAlarm.alarm_time}</p>
                <p className="text-gray-600 text-sm mt-1">{nextAlarm.alarm_name} · {nextAlarm.alarm_type}</p>
              </>
            ) : (
              <p className="text-gray-400 text-sm mt-1">No active alarms. <Link to="/alarms/create" className="text-indigo-500 hover:underline">Create one →</Link></p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 uppercase font-semibold">Habit Score</p>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Demo</span>
            </div>
            <p className="text-2xl font-bold text-indigo-600">{habitScore}<span className="text-base font-normal text-gray-400">/100</span></p>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
              <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${habitScore}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">Based on habits + alarms set. Full scoring in M2.</p>
          </div>
        </div>

        {/* Habits */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700">Your Habits</h2>
            <Link to="/habits" className="text-xs text-indigo-500 hover:underline">Manage →</Link>
          </div>
          {habits.length === 0
            ? <p className="text-gray-400 text-sm">No habits yet. <Link to="/habits" className="text-indigo-500 hover:underline">Add habits →</Link></p>
            : <div className="flex flex-wrap gap-2">
                {habits.map(h => (
                  <span key={h} className="bg-indigo-50 text-indigo-700 text-sm px-3 py-1 rounded-full border border-indigo-100">{h}</span>
                ))}
              </div>
          }
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <ActionBtn to="/alarms/create" label="+ Create Alarm" primary />
          <ActionBtn to="/alarms" label="⏰ Manage Alarms" />
          <ActionBtn to="/profile" label="👤 Update Profile" />
          <ActionBtn to="/habits" label="📋 Habits" />
          {user?.role === 'WELLNESS_COACH' && (
            <ActionBtn to="/coach" label="🏋️ Coach Panel" />
          )}
          {user?.role === 'ADMINISTRATOR' && (
            <ActionBtn to="/admin" label="⚙️ Admin Panel" />
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs text-gray-400 uppercase font-semibold mb-1">{icon} {label}</p>
      <p className="text-xl font-bold text-indigo-600">{value}</p>
    </div>
  )
}

function ActionBtn({ to, label, primary }) {
  return (
    <Link to={to}
      className={`text-center py-3 px-4 rounded-xl font-medium text-sm transition ${
        primary
          ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
          : 'bg-white text-gray-700 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
      }`}>
      {label}
    </Link>
  )
}
