import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../services/api'

const ALARM_TYPES = ['Daily', 'Weekday', 'Weekend', 'One-Time']
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const CHALLENGE_TYPES = [
  { value: 'random',  label: 'Random',  icon: '🎲', desc: 'Rotates through all 7 types automatically' },
  { value: 'math',    label: 'Math',    icon: '🔢', desc: 'Arithmetic, algebra & equations' },
  { value: 'logic',   label: 'Logic',   icon: '🧩', desc: 'Deductive reasoning & syllogisms' },
  { value: 'memory',  label: 'Memory',  icon: '🧠', desc: 'Memorise and recall digit sequences' },
  { value: 'word',    label: 'Word',    icon: '📝', desc: 'Unscramble, opposites & wordplay' },
  { value: 'pattern', label: 'Pattern', icon: '🔷', desc: 'Number sequences & series' },
  { value: 'riddle',  label: 'Riddle',  icon: '🎭', desc: 'Classic lateral-thinking riddles' },
  { value: 'quiz',    label: 'Quiz',    icon: '❓', desc: 'General knowledge questions' },
]

const DIFFICULTIES = [
  { value: 'BEGINNER', label: 'Beginner', desc: 'Simple addition & subtraction', color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700' },
  { value: 'EASY',     label: 'Easy',     desc: 'Two-digit arithmetic & division', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700' },
  { value: 'MEDIUM',   label: 'Medium',   desc: 'Multi-step & percentages', color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700' },
  { value: 'HARD',     label: 'Hard',     desc: 'Brackets, algebra & ratios', color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700' },
  { value: 'EXPERT',   label: 'Expert',   desc: 'Multi-step algebra & equations', color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700' },
]

export default function AlarmForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    alarm_name: '', alarm_time: '07:00', alarm_type: 'Daily',
    repeat_days: '', enabled: true,
    challenge_difficulty: 'MEDIUM', challenge_count: 1, challenge_type: 'random',
    max_failed_attempts: 5,
  })
  const [selectedDays, setSelectedDays] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit) {
      api.get(`/alarms/${id}`).then(r => {
        setForm(r.data)
        setSelectedDays(r.data.repeat_days ? r.data.repeat_days.split(',').map(d => d.trim()) : [])
      }).catch(() => setError('Failed to load alarm'))
    }
  }, [id])

  const toggleDay = (day) => {
    const updated = selectedDays.includes(day) ? selectedDays.filter(d => d !== day) : [...selectedDays, day]
    setSelectedDays(updated)
    setForm({ ...form, repeat_days: updated.join(', ') })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      if (isEdit) await api.put(`/alarms/${id}`, form)
      else await api.post('/alarms', form)
      navigate('/alarms')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save alarm')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">{isEdit ? 'Edit Alarm' : 'Create Alarm'}</h1>
        {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 space-y-5">

          {/* Alarm Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alarm Name</label>
            <input required value={form.alarm_name} onChange={e => setForm({ ...form, alarm_name: e.target.value })}
              placeholder="e.g. Morning Study"
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
          </div>

          {/* Alarm Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alarm Time</label>
            <input type="time" required value={form.alarm_time} onChange={e => setForm({ ...form, alarm_time: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
          </div>

          {/* Alarm Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alarm Type</label>
            <select value={form.alarm_type} onChange={e => setForm({ ...form, alarm_type: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm">
              {ALARM_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Repeat Days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Repeat Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <button type="button" key={day} onClick={() => toggleDay(day)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${selectedDays.includes(day) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400'}`}>
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Cognitive Challenge Settings ── */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">🧠 Cognitive Challenge Settings</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Choose the type and difficulty of challenges required to dismiss this alarm.</p>

            {/* Challenge Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Challenge Type</label>
              <div className="grid grid-cols-4 gap-2">
                {CHALLENGE_TYPES.map(ct => (
                  <button
                    type="button"
                    key={ct.value}
                    onClick={() => setForm({ ...form, challenge_type: ct.value })}
                    className={`flex flex-col items-center py-2 px-1 rounded-xl border-2 text-xs font-semibold transition ${
                      form.challenge_type === ct.value
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-400 dark:border-indigo-500 scale-105 shadow-sm'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 hover:border-indigo-300'
                    }`}
                  >
                    <span className="text-base mb-0.5">{ct.icon}</span>
                    {ct.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {CHALLENGE_TYPES.find(ct => ct.value === form.challenge_type)?.desc}
              </p>
            </div>

            {/* Difficulty Level */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initial Difficulty Preference</label>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-2">
                🤖 The system will automatically adjust difficulty after each session based on your performance.
              </p>
              <div className="grid grid-cols-5 gap-2">
                {DIFFICULTIES.map(d => (
                  <button
                    type="button"
                    key={d.value}
                    onClick={() => setForm({ ...form, challenge_difficulty: d.value })}
                    className={`flex flex-col items-center py-2 px-1 rounded-xl border-2 text-xs font-semibold transition ${
                      form.challenge_difficulty === d.value
                        ? d.color + ' border-current scale-105 shadow-sm'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 hover:border-indigo-300'
                    }`}
                  >
                    <span className="text-base mb-0.5">
                      {d.value === 'BEGINNER' ? '🟢' : d.value === 'EASY' ? '🔵' : d.value === 'MEDIUM' ? '🟡' : d.value === 'HARD' ? '🟠' : '🔴'}
                    </span>
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Starting point only — {DIFFICULTIES.find(d => d.value === form.challenge_difficulty)?.desc?.toLowerCase()}.
              </p>
            </div>

            {/* Number of Challenges */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Challenges to Solve
                <span className="ml-2 text-indigo-600 dark:text-indigo-400 font-bold">{form.challenge_count}</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setForm({ ...form, challenge_count: n })}
                    className={`w-10 h-10 rounded-xl border-2 text-sm font-bold transition ${
                      form.challenge_count === n
                        ? 'bg-indigo-600 text-white border-indigo-600 scale-110 shadow-sm'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Solve {form.challenge_count} challenge{form.challenge_count > 1 ? 's' : ''} in a row to dismiss the alarm.
              </p>
            </div>
          </div>

            {/* Snooze Limit */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Snooze Limit (wrong answers before difficulty escalates)
                <span className="ml-2 text-indigo-600 dark:text-indigo-400 font-bold">{form.max_failed_attempts}</span>
              </label>
              <div className="flex gap-2">
                {[3, 5, 7, 10].map(n => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setForm({ ...form, max_failed_attempts: n })}
                    className={`w-12 h-10 rounded-xl border-2 text-sm font-bold transition ${
                      form.max_failed_attempts === n
                        ? 'bg-red-500 text-white border-red-500 scale-110 shadow-sm'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-red-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                After {form.max_failed_attempts} wrong answers, difficulty escalates one level automatically.
              </p>
            </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="enabled" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 accent-indigo-600" />
            <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">Enable this alarm</label>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-50">
              {saving ? 'Saving...' : isEdit ? 'Update Alarm' : 'Create Alarm'}
            </button>
            <button type="button" onClick={() => navigate('/alarms')} className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
