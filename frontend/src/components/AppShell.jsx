import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlarmClock, BarChart3, BellRing, ClipboardCheck, FileText, History, LayoutDashboard, LogOut, Menu, Moon, ScrollText,
  Server, Settings, ShieldCheck, Sparkles, Users, UserCog, X, Lightbulb,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAlarm, useNow } from '../context/AlarmContext'
import { ROLE_LABEL, until } from '../lib/format'
import { Badge, Logo, cx } from './ui'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'

const MEMBER = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/alarms', label: 'Alarms', icon: AlarmClock },
  { to: '/app/sleep', label: 'Sleep & mood', icon: Moon },
  { to: '/app/insights', label: 'Insights', icon: BarChart3 },
  { to: '/app/history', label: 'History', icon: History },
  { to: '/app/reports', label: 'Reports', icon: FileText },
]
const COACH = [{ to: '/app/coach', label: 'My members', icon: Users, end: true }]
const ADMIN = [
  { to: '/app/admin', label: 'Overview', icon: ShieldCheck, end: true },
  { to: '/app/admin/users', label: 'Users', icon: UserCog },
  { to: '/app/admin/approvals', label: 'Coach approvals', icon: ClipboardCheck },
  { to: '/app/admin/recommendations', label: 'Recommendations', icon: Lightbulb },
  { to: '/app/admin/audit', label: 'Audit log', icon: ScrollText },
  { to: '/app/admin/system', label: 'System', icon: Server },
]

function Item({ it, onClick }) {
  return (
    <NavLink to={it.to} end={it.end} onClick={onClick}
      className={({ isActive }) => cx('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-brand/10 text-brand' : 'text-mute hover:bg-surface2 hover:text-ink')}>
      {({ isActive }) => (<>
        {isActive && <motion.span layoutId="nav-active" className="absolute left-0 top-2 h-[calc(100%-16px)] w-1 rounded-full bg-brand" />}
        <it.icon className="h-[18px] w-[18px]" />{it.label}
      </>)}
    </NavLink>
  )
}

function Sidebar({ onNavigate }) {
  const { user } = useAuth()
  const groups = []
  if (user.role === 'admin') groups.push(['Administration', ADMIN])
  if (user.role === 'wellness_coach') groups.push(['Coaching', COACH])
  groups.push([user.role === 'user' ? 'Wake-up' : 'My wake-up', MEMBER])
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-6"><Logo /></div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4" aria-label="Main">
        {groups.map(([title, items]) => (
          <div key={title}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-mute/80">{title}</p>
            <div className="space-y-1">{items.map((it) => <Item key={it.to} it={it} onClick={onNavigate} />)}</div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3"><Item it={{ to: '/app/settings', label: 'Settings', icon: Settings }} onClick={onNavigate} /></div>
    </div>
  )
}

function SnoozeBanner() {
  const { session } = useAlarm()
  useNow()
  if (session?.status !== 'snoozed') return null
  return (
    <div className="border-b border-brand/30 bg-brand/10 px-4 py-2 text-center text-sm font-medium text-brand">
      <Moon className="mr-2 inline h-4 w-4" />{session.label} is snoozed — rings again in <span className="num">{until(session.snoozed_until)}</span>
    </div>
  )
}

function NotifyNudge() {
  const { user } = useAuth()
  const [hide, setHide] = useState(() => sessionStorage.getItem('nudge') === '1')
  if (hide || !('Notification' in window) || Notification.permission !== 'default' || user.profile?.browser_notifications === false) return null
  const ask = async () => { await Notification.requestPermission(); setHide(true) }
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b border-line bg-accent/10 px-4 py-2 text-sm">
      <BellRing className="h-4 w-4 text-accent" />
      <span>Allow notifications so alarms can alert you even when this tab is in the background.</span>
      <button onClick={ask} className="font-semibold text-accent hover:underline">Enable</button>
      <button onClick={() => { sessionStorage.setItem('nudge', '1'); setHide(true) }} aria-label="Dismiss" className="text-mute hover:text-ink"><X className="h-4 w-4" /></button>
    </div>
  )
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const { schedule } = useAlarm()
  const nav = useNavigate()
  const loc = useLocation()
  const [drawer, setDrawer] = useState(false)
  const [menu, setMenu] = useState(false)
  useEffect(() => { setDrawer(false); setMenu(false); window.scrollTo(0, 0) }, [loc.pathname])
  const initials = user.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block"><Sidebar /></aside>

      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}>
              <Sidebar onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <header className="glass sticky top-0 z-20 border-b border-line">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-8">
          <button onClick={() => setDrawer(true)} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface lg:hidden"><Menu className="h-5 w-5" /></button>
          <div className="hidden min-w-0 items-center gap-2 text-sm text-mute sm:flex">
            <AlarmClock className="h-4 w-4 text-brand" />
            {schedule.next ? <span>Next alarm: <b className="text-ink">{schedule.next.label}</b> in <span className="num font-medium text-ink">{until(schedule.next.ring_at, Date.now() + schedule.offsetMs)}</span></span> : <span>No upcoming alarms</span>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <div className="relative">
              <button onClick={() => setMenu((m) => !m)} aria-label="Account menu" className="flex items-center gap-2 rounded-xl border border-line bg-surface py-1 pl-1 pr-3 transition hover:border-brand/50">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 text-xs font-bold text-brand">{initials}</span>
                <span className="hidden max-w-[120px] truncate text-sm font-medium sm:block">{user.full_name.split(' ')[0]}</span>
              </button>
              {menu && (
                <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-card">
                  <div className="px-3 py-2.5"><p className="truncate font-semibold">{user.full_name}</p><p className="truncate text-xs text-mute">{user.email}</p><Badge tone="brand" className="mt-2">{ROLE_LABEL[user.role]}</Badge></div>
                  <button onClick={() => nav('/app/settings')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm hover:bg-surface2"><Settings className="h-4 w-4" />Settings</button>
                  <button onClick={async () => { await logout(); nav('/login') }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-bad hover:bg-bad/10"><LogOut className="h-4 w-4" />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <SnoozeBanner />
        <NotifyNudge />
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
        <AnimatePresence mode="wait">
          <motion.div key={loc.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
