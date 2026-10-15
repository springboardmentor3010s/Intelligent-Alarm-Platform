import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

const DIFF_COLOR = {
  BEGINNER: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  EASY:     'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  MEDIUM:   'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  HARD:     'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  EXPERT:   'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
}

const TYPE_ICON = {
  math: '🔢', logic: '🧠', memory: '💾', word: '📝',
  pattern: '🔷', riddle: '🎭', quiz: '❓',
}

export default function ChallengeHistory() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    api.get('/challenges/history?limit=50')
      .then(r => setItems(r.data))
      .catch(() => setError('Failed to load history.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-400 dark:text-gray-500">Loading history...</div>
  if (error)   return <div className="p-8 text-red-500">{error}</div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Challenge History</h1>
          <Link to="/analytics" className="text-sm text-indigo-500 hover:underline">← Analytics</Link>
        </div>

        {items.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500">
            <p className="text-4xl mb-3">📋</p>
            <p>No challenges yet. Solve an alarm challenge to see history here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {TYPE_ICON[item.challenge_type] || '🧩'} {item.challenge_type.charAt(0).toUpperCase() + item.challenge_type.slice(1)}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DIFF_COLOR[item.difficulty] || ''}`}>
                        {item.difficulty}
                      </span>
                      {item.is_correct === true && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">✅ Correct</span>
                      )}
                      {item.is_correct === false && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">❌ Wrong</span>
                      )}
                      {item.is_correct === null && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">— Unanswered</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{item.question}</p>
                    {item.user_answer && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Your answer: <span className="font-medium">{item.user_answer}</span></p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{item.score > 0 ? item.score : '—'}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">score</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{item.attempts} attempt{item.attempts !== 1 ? 's' : ''}</p>
                    {item.completion_duration_seconds && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">{item.completion_duration_seconds}s</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-300 dark:text-gray-600 mt-2">
                  {new Date(item.started_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
