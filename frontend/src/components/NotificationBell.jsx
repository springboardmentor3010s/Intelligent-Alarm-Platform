import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, BedDouble, Flame, Megaphone, AlarmClock, Sparkles, Trophy } from 'lucide-react'
import client from '../api/client'
import { useAlarm } from '../context/AlarmContext'
import { fmtDateTime } from '../lib/format'
import { cx } from './ui'

export const KIND_ICON = { bedtime: BedDouble, wake: AlarmClock, habit: Flame, challenge: Sparkles, progress: Trophy, announcement: Megaphone }

export default function NotificationBell() {
  const { version } = useAlarm()
  const [data, setData] = useState({ items: [], unread: 0 })
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const load = useCallback(() => client.get('/notifications?limit=6').then((r) => setData(r.data)).catch(() => {}), [])
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load, version])
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const readAll = async () => { await client.post('/notifications/read-all'); load() }
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen((o) => !o); if (!open) load() }} aria-label={`Notifications (${data.unread} unread)`}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-mute transition hover:text-ink">
        <Bell className="h-[18px] w-[18px]" />
        {data.unread > 0 && <span className="num absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brandfg">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {data.unread > 0 && <button onClick={readAll} className="text-xs font-medium text-brand hover:underline">Mark all read</button>}
          </div>
          {data.items.length === 0 ? <p className="px-4 py-10 text-center text-sm text-mute">You're all caught up.</p> : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {data.items.map((n) => {
                const I = KIND_ICON[n.kind] || Bell
                return (
                  <li key={n.id} className={cx('flex gap-3 px-4 py-3', !n.is_read && 'bg-brand/5')}>
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface2 text-brand"><I className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="line-clamp-2 text-xs text-mute">{n.body}</p>
                      <p className="mt-1 text-[11px] text-mute/80">{fmtDateTime(n.created_at)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <Link to="/app/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-sm font-medium text-brand hover:bg-surface2">View all</Link>
        </div>
      )}
    </div>
  )
}
