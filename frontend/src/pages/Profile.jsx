import { useEffect, useState } from 'react'
import api from '../services/api'

const GOALS = ['Study', 'Fitness', 'Work', 'Meditation', 'Reading', 'Other']
const DIFFICULTIES = ['Easy', 'Medium', 'Hard']
const TIMEZONES = ['Asia/Kolkata', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney']

export default function Profile() {
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/profile').then(r => setForm(r.data)).catch(() => setError('Failed to load profile'))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setMsg(''); setError('')
    try {
      await api.put('/profile', form)
      setMsg('Profile updated successfully!')
    } catch (err) {
      setError(err.response?.data?.detail || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading profile...</div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">My Profile</h1>
        {msg && <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 p-3 rounded mb-4 text-sm">{msg}</div>}
        {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
            <Field label="Email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
            <Field label="Preferred Wake-up Time" type="time" value={form.preferred_wake_up_time} onChange={v => setForm({ ...form, preferred_wake_up_time: v })} />
            <Field label="Sleep Duration (hours)" type="number" value={form.sleep_duration} onChange={v => setForm({ ...form, sleep_duration: parseInt(v) })} min={1} max={12} />
          </div>
          <SelectField label="Time Zone" value={form.timezone} options={TIMEZONES} onChange={v => setForm({ ...form, timezone: v })} />
          <SelectField label="Productivity Goal" value={form.productivity_goal} options={GOALS} onChange={v => setForm({ ...form, productivity_goal: v })} />
          <SelectField label="Difficulty Preference" value={form.difficulty_preference} options={DIFFICULTIES} onChange={v => setForm({ ...form, difficulty_preference: v })} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
            <input value={form.role} disabled className="w-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 text-gray-400 dark:text-gray-500 text-sm" />
          </div>
          <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm" {...rest} />
    </div>
  )
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <select value={value ?? ''} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm">
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
