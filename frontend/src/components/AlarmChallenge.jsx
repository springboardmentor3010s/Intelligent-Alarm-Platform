import { useEffect, useRef, useState, useCallback } from 'react'
import api from '../services/api'

const DIFF_COLOR = {
  BEGINNER: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  EASY:     'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  MEDIUM:   'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  HARD:     'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  EXPERT:   'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
}

// ── Shared AudioContext (singleton) ───────────────────────────────────────────
// Browsers require a user gesture before AudioContext can produce sound.
// We create it lazily on the first user interaction anywhere on the page,
// then reuse it for all alarm sounds.
let _sharedCtx = null

function getAudioContext() {
  if (!_sharedCtx) {
    try {
      _sharedCtx = new (window.AudioContext || window.webkitAudioContext)()
    } catch (_) {
      return null
    }
  }
  return _sharedCtx
}

// Resume the context if it was suspended (autoplay policy)
async function resumeAudioContext() {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') {
    try { await ctx.resume() } catch (_) {}
  }
  return ctx
}

// Unlock on any user interaction — called once globally
function unlockAudio() {
  resumeAudioContext()
  document.removeEventListener('click',     unlockAudio)
  document.removeEventListener('keydown',   unlockAudio)
  document.removeEventListener('touchstart', unlockAudio)
}
document.addEventListener('click',      unlockAudio, { once: true })
document.addEventListener('keydown',    unlockAudio, { once: true })
document.addEventListener('touchstart', unlockAudio, { once: true })

// ── Vibration helper ─────────────────────────────────────────────────────────
function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern) } catch (_) {}
}

// ── Beep helper ───────────────────────────────────────────────────────────────
function beep(ctx, freq = 880, duration = 0.4, volume = 0.35) {
  if (!ctx || ctx.state === 'closed') return
  try {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch (_) {}
}

const TYPE_LABEL = {
  math:    { icon: '🔢', label: 'Math Challenge' },
  logic:   { icon: '🧩', label: 'Logic Challenge' },
  memory:  { icon: '🧠', label: 'Memory Challenge' },
  word:    { icon: '📝', label: 'Word Challenge' },
  pattern: { icon: '🔷', label: 'Pattern Challenge' },
  riddle:  { icon: '🎭', label: 'Riddle Challenge' },
  quiz:    { icon: '❓', label: 'Quiz Challenge' },
  random:  { icon: '🎲', label: 'Cognitive Challenge' },
}

export default function AlarmChallenge({ alarm, onDismiss }) {
  const total      = alarm.challenge_count || 1
  const difficulty = alarm.challenge_difficulty || 'MEDIUM'
  const alarmChallengeType = alarm.challenge_type || 'random'
  const maxFails   = alarm.max_failed_attempts || 5

  const [step, setStep]             = useState(1)
  const [challenge, setChallenge]   = useState(null)
  const [answer, setAnswer]         = useState('')
  const [feedback, setFeedback]     = useState(null)
  const [loading, setLoading]       = useState(false)
  const [generating, setGenerating] = useState(true)
  const [attempts, setAttempts]     = useState(0)
  const [sessionWrong, setSessionWrong] = useState(0)
  const [elapsed, setElapsed]             = useState(0)
  const [challengeElapsed, setChallengeElapsed] = useState(0)
  const [allDone, setAllDone]             = useState(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  const beepIntervalRef        = useRef(null)
  const elapsedRef             = useRef(null)
  const challengeElapsedRef    = useRef(null)
  const activeRef              = useRef(true)

  // ── Start beeping ──────────────────────────────────────────────────────────
  const startBeeping = useCallback(async () => {
    const ctx = await resumeAudioContext()
    if (!ctx) return
    setAudioUnlocked(ctx.state === 'running')
    // Vibrate alarm pattern: 3 long pulses
    vibrate([500, 200, 500, 200, 500])
    beep(ctx, 880, 0.4)
    beepIntervalRef.current = setInterval(async () => {
      if (!activeRef.current) return
      const c = await resumeAudioContext()
      if (c) beep(c, 880, 0.4)
      vibrate([300, 100, 300])
    }, 1200)
  }, [])

  const stopBeeping = useCallback(() => {
    activeRef.current = false
    clearInterval(beepIntervalRef.current)
  }, [])

  // ── Mount: start audio + elapsed timer ────────────────────────────────────
  useEffect(() => {
    activeRef.current = true
    startBeeping()
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => {
      stopBeeping()
      clearInterval(elapsedRef.current)
      clearInterval(challengeElapsedRef.current)
    }
  }, [startBeeping, stopBeeping])

  // ── Manual unlock button handler ──────────────────────────────────────────
  const handleUnlock = async () => {
    const ctx = await resumeAudioContext()
    if (ctx) {
      beep(ctx, 880, 0.4)
      setAudioUnlocked(true)
      // Restart beeping loop now that context is running
      clearInterval(beepIntervalRef.current)
      beepIntervalRef.current = setInterval(async () => {
        if (!activeRef.current) return
        const c = await resumeAudioContext()
        if (c) beep(c, 880, 0.4)
      }, 1200)
    }
  }

  // ── Load challenge ─────────────────────────────────────────────────────────
  const loadChallenge = useCallback(() => {
    setGenerating(true)
    setFeedback(null)
    setAnswer('')
    setAttempts(0)
    setChallengeElapsed(0)
    clearInterval(challengeElapsedRef.current)
    challengeElapsedRef.current = setInterval(() => setChallengeElapsed(s => s + 1), 1000)
    api.post('/challenges/generate', {
      alarm_id: alarm.id,
      challenge_type: alarmChallengeType === 'random' ? undefined : alarmChallengeType,
      difficulty,
    })
      .then(r => setChallenge(r.data))
      .catch(() => setFeedback({ correct: false, message: 'Failed to load challenge. Please refresh.' }))
      .finally(() => setGenerating(false))
  }, [alarm.id, difficulty])

  useEffect(() => { loadChallenge() }, [loadChallenge])

  // ── Submit answer ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!challenge || !answer.trim()) return
    setLoading(true)
    setFeedback(null)

    // Every submit is a user gesture — use it to unlock audio
    const ctx = await resumeAudioContext()
    if (ctx && ctx.state === 'running') setAudioUnlocked(true)

    try {
      const res = await api.post(`/challenges/${challenge.id}/verify`, {
        user_answer: answer.trim(),
        response_time_seconds: challengeElapsed,
      })
      setAttempts(res.data.attempts)

      if (res.data.correct) {
        setFeedback({ correct: true, message: res.data.message })
        if (step >= total) {
          clearInterval(elapsedRef.current)
          clearInterval(challengeElapsedRef.current)
          setAllDone(true)
          stopBeeping()
          // Auto-disable one-time alarms after successful dismissal
          if (alarm.alarm_type === 'One-Time') {
            api.put(`/alarms/${alarm.id}`, { enabled: false }).catch(() => {})
          }
          setTimeout(() => onDismiss(), 2000)
        } else {
          setTimeout(() => {
            setStep(s => s + 1)
            loadChallenge()
          }, 1200)
        }
      } else {
        // Wrong answer — alarm keeps ringing
        setFeedback({ correct: false, message: res.data.message })
        setAnswer('')
        setSessionWrong(w => w + 1)
        if (ctx) beep(ctx, 440, 0.3, 0.4)
        vibrate([100, 50, 100, 50, 100])
      }
    } catch {
      setFeedback({ correct: false, message: 'Verification failed. Try again.' })
    } finally {
      setLoading(false)
    }
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">

        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-5xl mb-2 animate-bounce">⏰</div>
          <h2 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">Cognitive Wake-Up Challenge</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{alarm.alarm_name}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1 uppercase tracking-wide">
            Solve all {total} challenge{total > 1 ? 's' : ''} to dismiss
          </p>
        </div>

        {/* Audio unlock banner — shown if browser blocked autoplay */}
        {!audioUnlocked && !allDone && (
          <button
            onClick={handleUnlock}
            className="w-full mb-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-sm transition animate-pulse"
          >
            🔔 Tap here to enable alarm sound
          </button>
        )}

        {/* Progress bar */}
        {total > 1 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
              <span>Challenge {step} of {total}</span>
              <span>{step - 1} completed</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((step - 1) / total) * 100}%` }}
              />
            </div>
            <div className="flex gap-1 mt-2">
              {Array.from({ length: total }).map((_, i) => (
                <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${
                  i < step - 1 ? 'bg-green-500' : i === step - 1 ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'
                }`} />
              ))}
            </div>
          </div>
        )}

        {generating && (
          <p className="text-center text-gray-400 dark:text-gray-500 py-6">Generating challenge {step}...</p>
        )}

        {!generating && challenge && !allDone && (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {(TYPE_LABEL[challenge.challenge_type] || TYPE_LABEL.random).icon}{' '}
                {(TYPE_LABEL[challenge.challenge_type] || TYPE_LABEL.random).label}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DIFF_COLOR[challenge.difficulty] || ''}`}>
                  {challenge.difficulty}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono" title="This challenge">
                  ⏱ {fmt(challengeElapsed)}
                </span>
                <span className="text-xs text-gray-300 dark:text-gray-600 font-mono" title="Total time">
                  ({fmt(elapsed)} total)
                </span>
              </div>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-700 rounded-xl p-4 mb-4">
              <p className="text-gray-800 dark:text-gray-100 font-medium whitespace-pre-line leading-relaxed text-lg text-center">
                {challenge.question}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Enter your answer..."
                autoFocus
                disabled={loading}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm text-center text-lg"
              />
              <button
                type="submit"
                disabled={loading || !answer.trim()}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-50 transition"
              >
                {loading ? 'Checking...' : 'Submit Answer'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-3">
              Attempts this challenge: {attempts}
              {sessionWrong > 0 && (
                <span className="ml-3 text-red-400 dark:text-red-500">
                  ❌ {sessionWrong} wrong answer{sessionWrong !== 1 ? 's' : ''} this session
                </span>
              )}
              {sessionWrong >= maxFails - 1 && sessionWrong < maxFails && (
                <span className="ml-2 text-orange-500 font-semibold"> ⚠️ 1 more wrong = difficulty escalates!</span>
              )}
              {sessionWrong >= maxFails && (
                <span className="ml-2 text-red-500 font-semibold"> 🔺 Difficulty escalated!</span>
              )}
            </p>
          </>
        )}

        {feedback && !allDone && (
          <div className={`mt-3 p-3 rounded-lg text-sm font-medium text-center ${
            feedback.correct
              ? 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400'
          }`}>
            {feedback.correct ? '✅ ' : '❌ '}{feedback.message}
            {feedback.correct && step < total && (
              <p className="text-xs mt-1 opacity-75">Loading challenge {step + 1}...</p>
            )}
          </div>
        )}

        {allDone && (
          <div className="text-center py-4">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-green-600 dark:text-green-400 font-bold text-lg">All {total} challenges completed!</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Total time: {fmt(elapsed)}</p>
            {sessionWrong > 0 && (
              <p className="text-red-400 dark:text-red-500 text-xs">❌ {sessionWrong} wrong answer{sessionWrong !== 1 ? 's' : ''} this session</p>
            )}
            <p className="text-gray-400 dark:text-gray-500 text-xs">Dismissing alarm...</p>
          </div>
        )}
      </div>
    </div>
  )
}
