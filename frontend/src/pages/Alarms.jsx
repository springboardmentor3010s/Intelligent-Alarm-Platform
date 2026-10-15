import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

export default function Alarms() {
  const [alarms, setAlarms] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAlarms = () => api.get('/alarms').then(r => setAlarms(r.data)).finally(() => setLoading(false))

  useEffect(() => { fetchAlarms() }, [])

  const toggleAlarm = async (alarm) => {
    await api.put(`/alarms/${alarm.id}`, { enabled: !alarm.enabled })
    fetchAlarms()
  }

  const deleteAlarm = async (id) => {
    if (!confirm('Delete this alarm?')) return
    await api.delete(`/alarms/${id}`)
    fetchAlarms()
  }

  if (loading) return <div className="p-8 text-gray-500 dark:text-gray-400">Loading alarms...</div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">My Alarms</h1>
          <Link to="/alarms/create" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">+ New Alarm</Link>
        </div>

        {alarms.length === 0
          ? <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-10 text-center text-gray-400 dark:text-gray-500">
              <p className="text-4xl mb-3">⏰</p>
              <p>No alarms yet.</p>
              <Link to="/alarms/create" className="text-indigo-500 hover:underline text-sm mt-2 inline-block">Create your first alarm →</Link>
            </div>
          : <div className="space-y-3">
              {alarms.map(alarm => (
                <div key={alarm.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex items-center justify-between border border-gray-100 dark:border-gray-700 ${!alarm.enabled ? 'opacity-50' : ''}`}>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{alarm.alarm_name}</p>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{alarm.alarm_time}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{alarm.alarm_type} {alarm.repeat_days ? `· ${alarm.repeat_days}` : ''}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        alarm.challenge_difficulty === 'BEGINNER' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                        alarm.challenge_difficulty === 'EASY'     ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                        alarm.challenge_difficulty === 'MEDIUM'   ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                        alarm.challenge_difficulty === 'HARD'     ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                                                                    'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      }`}>{alarm.challenge_difficulty || 'MEDIUM'}</span>
                      <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium capitalize">
                        {alarm.challenge_type === 'random' ? '🎲 Random' :
                         alarm.challenge_type === 'math'    ? '🔢 Math' :
                         alarm.challenge_type === 'logic'   ? '🧩 Logic' :
                         alarm.challenge_type === 'memory'  ? '🧠 Memory' :
                         alarm.challenge_type === 'word'    ? '📝 Word' :
                         alarm.challenge_type === 'pattern' ? '🔷 Pattern' :
                         alarm.challenge_type === 'riddle'  ? '🎭 Riddle' :
                         alarm.challenge_type === 'quiz'    ? '❓ Quiz' : '🎲 Random'}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">🔢 {alarm.challenge_count || 1} challenge{(alarm.challenge_count || 1) > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleAlarm(alarm)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${alarm.enabled ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                      {alarm.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <Link to={`/alarms/edit/${alarm.id}`} className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm">Edit</Link>
                    <button onClick={() => deleteAlarm(alarm.id)} className="text-red-400 hover:text-red-600 text-sm">Delete</button>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}
