import { useEffect, useState } from 'react'
import api from '../services/api'

const PRESET_HABITS = ['Morning Exercise', 'Reading', 'Meditation', 'Study', 'Workout', 'Journaling', 'Cold Shower']

export default function Habits() {
  const [habits, setHabits] = useState([])
  const [custom, setCustom] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get('/habits').then(r => setHabits(r.data.habits)).catch(() => {})
  }, [])

  const addHabit = async (habit) => {
    const res = await api.post('/habits', { habit })
    setHabits(res.data.habits)
    setMsg(`"${habit}" added!`)
    setTimeout(() => setMsg(''), 2000)
  }

  const removeHabit = async (habit) => {
    const res = await api.delete(`/habits/${encodeURIComponent(habit)}`)
    setHabits(res.data.habits)
  }

  const handleCustomAdd = async (e) => {
    e.preventDefault()
    if (!custom.trim()) return
    await addHabit(custom.trim())
    setCustom('')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Habit Management</h1>
        {msg && <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 p-3 rounded mb-4 text-sm">{msg}</div>}

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 mb-6 border border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Your Habits</h2>
          {habits.length === 0
            ? <p className="text-gray-400 dark:text-gray-500 text-sm">No habits yet. Add some below.</p>
            : <div className="flex flex-wrap gap-2">
                {habits.map(h => (
                  <span key={h} className="flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-sm px-3 py-1 rounded-full">
                    {h}
                    <button onClick={() => removeHabit(h)} className="ml-1 text-indigo-400 hover:text-red-500 font-bold">×</button>
                  </span>
                ))}
              </div>
          }
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 mb-6 border border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Quick Add</h2>
          <div className="flex flex-wrap gap-2">
            {PRESET_HABITS.filter(h => !habits.includes(h)).map(h => (
              <button key={h} onClick={() => addHabit(h)}
                className="bg-gray-100 dark:bg-gray-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-gray-700 dark:text-gray-300 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm px-3 py-1 rounded-full transition">
                + {h}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 border border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Add Custom Habit</h2>
          <form onSubmit={handleCustomAdd} className="flex gap-2">
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="e.g. Yoga"
              className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">Add</button>
          </form>
        </div>
      </div>
    </div>
  )
}
