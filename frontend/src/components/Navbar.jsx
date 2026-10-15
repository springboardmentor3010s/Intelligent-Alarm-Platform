import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import NotificationBell from './NotificationBell'

const ROLE_CONFIG = {
  USER: {
    home: '/dashboard/user',
    badge: 'bg-blue-500',
    label: 'User',
    links: [
      { to: '/dashboard/user', label: 'Dashboard' },
      { to: '/alarms', label: 'My Alarms' },
      { to: '/habits', label: 'My Habits' },
      { to: '/habits/dashboard', label: 'Habit Insights' },
      { to: '/analytics', label: 'Analytics' },
      { to: '/profile', label: 'My Profile' },
    ],
  },
  WELLNESS_COACH: {
    home: '/dashboard/coach',
    badge: 'bg-emerald-500',
    label: 'Coach',
    links: [
      { to: '/dashboard/coach', label: 'Coach Dashboard' },
      { to: '/alarms', label: 'My Alarms' },
      { to: '/habits/dashboard', label: 'Habit Insights' },
      { to: '/analytics', label: 'Analytics' },
      { to: '/profile', label: 'My Profile' },
    ],
  },
  ADMINISTRATOR: {
    home: '/dashboard/admin',
    badge: 'bg-red-500',
    label: 'Admin',
    links: [
      { to: '/dashboard/admin', label: 'Admin Dashboard' },
      { to: '/alarms', label: 'My Alarms' },
      { to: '/habits/dashboard', label: 'Habit Insights' },
      { to: '/analytics', label: 'Analytics' },
      { to: '/profile', label: 'My Profile' },
    ],
  },
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => { logout(); navigate('/') }
  const config = user ? (ROLE_CONFIG[user.role] || ROLE_CONFIG.USER) : null

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/')
      ? 'text-white font-semibold bg-white/20 shadow-sm'
      : 'text-indigo-100/80 hover:text-white hover:bg-white/10'

  return (
    <nav className="sticky top-0 z-40 bg-gradient-to-r from-indigo-700 via-indigo-700 to-violet-700 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 text-white px-5 sm:px-6 py-2.5 flex items-center justify-between shadow-[0_8px_24px_-12px_rgba(49,46,129,0.8)] border-b border-white/10 overflow-visible">
      <Link
        to={config?.home || '/'}
        className="flex items-center gap-2.5 font-bold text-base tracking-tight shrink-0"
      >
        <span className="grid place-items-center w-8 h-8 rounded-xl bg-white/15 backdrop-blur text-lg">🧠</span>
        <span className="hidden sm:inline">CognitiveAlarm</span>
      </Link>

      <div className="flex items-center gap-1 text-sm">
        {user && config && (
          <div className="flex items-center gap-1 overflow-x-auto">
            {config.links.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 text-sm rounded-lg transition-all whitespace-nowrap ${isActive(link.to)}`}
              >
                {link.label}
              </Link>
            ))}
            <span className="mx-2 text-white/20 shrink-0">|</span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full text-white shrink-0 shadow-sm ${config.badge}`}>
              {config.label}
            </span>
            <span className="text-xs text-indigo-200/80 mx-2 hidden md:inline shrink-0">{user.name}</span>
          </div>
        )}

        {user && <NotificationBell />}

        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="px-2 py-1.5 rounded-lg text-indigo-100 hover:text-white hover:bg-white/15 transition text-base shrink-0"
        >
          {dark ? '☀️' : '🌙'}
        </button>

        {user && (
          <button
            onClick={handleLogout}
            className="bg-white/15 hover:bg-white/25 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ml-1"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  )
}
