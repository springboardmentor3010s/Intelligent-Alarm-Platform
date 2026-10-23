export const to12 = (hhmm) => {
  if (!hhmm) return '—'
  const [h, m] = hhmm.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`
}
export const hhmm = (t) => (t ? String(t).slice(0, 5) : '')
export const pct = (v, digits = 0) => (v == null ? '—' : `${(v * 100).toFixed(digits)}%`)
export const mins = (m) => (m == null ? '—' : `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`)
export const titleCase = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
export const fmtDate = (d) => (d ? new Date(d.length <= 10 ? d + 'T00:00:00' : d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '')
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
export const fmtClock = (d) => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export function until(iso, nowMs = Date.now()) {
  if (!iso) return ''
  let s = Math.max(0, Math.round((new Date(iso).getTime() - nowMs) / 1000))
  const d = Math.floor(s / 86400); s -= d * 86400
  const h = Math.floor(s / 3600); s -= h * 3600
  const m = Math.floor(s / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s - m * 60}s`
  return `${s}s`
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const TYPE_LABEL = { math: 'Math', logic: 'Logic', memory: 'Memory', word: 'Word game', pattern: 'Pattern', riddle: 'Riddle', quiz: 'Quick quiz' }
export const ROLE_LABEL = { user: 'Member', wellness_coach: 'Wellness Coach', admin: 'Administrator' }
export const LEVELS = ['beginner', 'easy', 'medium', 'hard', 'expert']
