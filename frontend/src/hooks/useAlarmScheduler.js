import { useEffect, useRef, useCallback } from 'react'
import api from '../services/api'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function shouldFireToday(alarm) {
  if (!alarm.enabled) return false
  const today = DAY_NAMES[new Date().getDay()]
  if (alarm.alarm_type === 'One-Time') return true
  if (alarm.alarm_type === 'Weekday') return !['Saturday', 'Sunday'].includes(today)
  if (alarm.alarm_type === 'Weekend') return ['Saturday', 'Sunday'].includes(today)
  if (alarm.alarm_type === 'Daily') return true
  if (alarm.repeat_days) {
    const days = alarm.repeat_days.split(',').map(d => d.trim())
    return days.includes(today)
  }
  return true
}

/**
 * useAlarmScheduler
 *
 * Polls /alarms every 10 seconds directly from the API so newly created
 * alarms are always picked up without a page refresh.
 * Fires onAlarmFire(alarm) once per alarm per minute per day.
 */
export default function useAlarmScheduler(onAlarmFire) {
  const firedRef    = useRef(new Set())
  const callbackRef = useRef(onAlarmFire)

  // Keep callback ref current without restarting the interval
  useEffect(() => { callbackRef.current = onAlarmFire }, [onAlarmFire])

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      if (cancelled) return
      try {
        const res = await api.get('/alarms')
        if (cancelled) return
        const alarms = res.data

        const now  = new Date()
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

        for (const alarm of alarms) {
          if (!shouldFireToday(alarm)) continue
          if (alarm.alarm_time !== hhmm) continue

          const key = `${alarm.id}-${hhmm}-${now.toDateString()}`
          if (firedRef.current.has(key)) continue

          firedRef.current.add(key)
          callbackRef.current(alarm)
          break // one alarm at a time
        }
      } catch (_) {
        // Network error — silently skip this tick
      }
    }

    check() // immediate check on mount
    const interval = setInterval(check, 10_000) // every 10 seconds
    return () => { cancelled = true; clearInterval(interval) }
  }, []) // stable — never restarts
}
