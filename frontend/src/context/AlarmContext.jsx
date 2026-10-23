import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import client from '../api/client'
import { useAuth } from './AuthContext'
import { audioState, startAlarmSound, stopAlarmSound, unlockAudio } from '../lib/sound'

const Ctx = createContext(null)
const POLL_MS = 2000
const BASE_TITLE = typeof document !== 'undefined' ? document.title : 'Wakeful'

const same = (a, b) =>
  a && b && a.id === b.id && a.status === b.status && a.challenge?.id === b.challenge?.id &&
  a.snooze_count === b.snooze_count && a.progress?.have === b.progress?.have && a.progress?.questions_asked === b.progress?.questions_asked

export function AlarmProvider({ children }) {
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [summary, setSummary] = useState(null)
  const [schedule, setSchedule] = useState({ next: null, upcoming: [], offsetMs: 0 })
  const [soundBlocked, setSoundBlocked] = useState(false)
  const [version, setVersion] = useState(0)
  const prevStatus = useRef(null)
  const inFlight = useRef(false)
  const titleTimer = useRef(null)
  const userRef = useRef(user)
  userRef.current = user

  const stopTitleFlash = () => { if (titleTimer.current) { clearInterval(titleTimer.current); titleTimer.current = null; document.title = BASE_TITLE } }

  const onRingStart = useCallback((s) => {
    const state = startAlarmSound(s.sound, s.volume)
    setSoundBlocked(state !== 'running')
    stopTitleFlash()
    let on = false
    titleTimer.current = setInterval(() => { on = !on; document.title = on ? `⏰ ${s.label} — WAKE UP` : BASE_TITLE }, 1000)
    const u = userRef.current
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted' && u?.profile?.browser_notifications !== false) {
      try {
        const n = new Notification(`⏰ ${s.label}`, { body: 'Time to wake up — solve the challenge to dismiss your alarm.', tag: 'wakeful-alarm', requireInteraction: true })
        n.onclick = () => { window.focus(); n.close() }
      } catch { /* ignore */ }
    }
  }, [])

  const apply = useCallback((s) => {
    const status = s?.status ?? null
    if (status === 'ringing' && prevStatus.current !== 'ringing') onRingStart(s)
    if (status !== 'ringing' && prevStatus.current === 'ringing') { stopAlarmSound(); stopTitleFlash() }
    prevStatus.current = status
    setSession((prev) => (same(prev, s) ? prev : s))
  }, [onRingStart])

  const poll = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try { const { data } = await client.get('/wake/active'); apply(data.session) }
    catch { /* offline or signed out: try again next tick */ }
    finally { inFlight.current = false }
  }, [apply])

  const refreshSchedule = useCallback(async () => {
    try {
      const { data } = await client.get('/alarms/schedule')
      setSchedule({ next: data.next, upcoming: data.upcoming, offsetMs: Date.parse(data.server_now) - Date.now() })
    } catch { /* ignore */ }
  }, [])

  // Poll from a Web Worker: its timers are not throttled when the tab is in the background.
  useEffect(() => {
    if (!user) { apply(null); setSummary(null); setSchedule({ next: null, upcoming: [], offsetMs: 0 }); return undefined }
    let worker, fallback
    try {
      const url = URL.createObjectURL(new Blob([`setInterval(function(){postMessage(1)},${POLL_MS})`], { type: 'text/javascript' }))
      worker = new Worker(url)
      worker.onmessage = () => poll()
      URL.revokeObjectURL(url)
    } catch { fallback = setInterval(poll, POLL_MS) }
    poll(); refreshSchedule()
    const sched = setInterval(refreshSchedule, 60000)
    const onVisible = () => { if (document.visibilityState === 'visible') { poll(); refreshSchedule() } }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      worker?.terminate(); if (fallback) clearInterval(fallback); clearInterval(sched)
      document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible)
      stopAlarmSound(); stopTitleFlash(); prevStatus.current = null
    }
  }, [user?.id]) // eslint-disable-line

  // Browsers only allow sound after a user gesture: unlock on the first click/key press.
  useEffect(() => {
    const unlock = () => unlockAudio().then(() => setSoundBlocked(audioState() !== 'running' && prevStatus.current === 'ringing'))
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
  }, [])

  const enableSound = useCallback(async () => {
    await unlockAudio()
    if (prevStatus.current === 'ringing' && session) setSoundBlocked(startAlarmSound(session.sound, session.volume) !== 'running')
    else setSoundBlocked(false)
  }, [session])

  const applyAnswer = useCallback((data) => {
    if (data.outcome === 'dismissed') {
      apply(null)
      setSummary({ ...data.summary, label: data.session.label, practice: data.session.is_practice })
      setVersion((v) => v + 1)
      refreshSchedule()
    } else {
      apply({ ...data.session, challenge: data.challenge })
    }
  }, [apply, refreshSchedule])

  const snooze = useCallback(async () => {
    const { data } = await client.post(`/wake/${session.id}/snooze`)
    apply(data)
  }, [session, apply])

  const startTest = useCallback(async (alarmId) => {
    await unlockAudio()
    const { data } = await client.post('/wake/test', { alarm_id: alarmId || null })
    apply(data.session)
  }, [apply])

  const cancelTest = useCallback(async () => {
    if (!session) return
    await client.post(`/wake/${session.id}/cancel`)
    apply(null)
  }, [session, apply])

  const value = useMemo(() => ({
    session, summary, schedule, soundBlocked, version, applyAnswer, snooze, startTest, cancelTest, enableSound,
    clearSummary: () => setSummary(null), refreshSchedule, poll,
  }), [session, summary, schedule, soundBlocked, version, applyAnswer, snooze, startTest, cancelTest, enableSound, refreshSchedule, poll])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAlarm = () => useContext(Ctx)

/** Re-renders every second (for live clocks / countdowns). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(t) }, [intervalMs])
  return now
}
