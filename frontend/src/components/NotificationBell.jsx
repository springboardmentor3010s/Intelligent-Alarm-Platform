import { useEffect, useRef, useState } from 'react'
import api from '../services/api'

const TYPE_ICON = {
  BEDTIME_REMINDER: '🌙',
  WAKEUP_REMINDER: '⏰',
  HABIT_ALERT: '⚠️',
  MISSED_ALARM: '🚨',
  PROGRESS: '🎉',
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const ref = useRef(null)

  const load = async () => {
    try {
      const res = await api.get('/notifications')
      setUnreadCount(res.data.unread_count)
      setNotifications(res.data.notifications)
    } catch {
      // Silently ignore — notifications are non-critical
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000) // refresh every minute
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`)
    load()
  }

  const markAllRead = async () => {
    await api.post('/notifications/read-all')
    load()
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative px-2 py-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition text-base"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[100]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">No notifications yet</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${
                  n.is_read ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <span>{TYPE_ICON[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 dark:text-gray-200 leading-snug">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1 shrink-0" />}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
