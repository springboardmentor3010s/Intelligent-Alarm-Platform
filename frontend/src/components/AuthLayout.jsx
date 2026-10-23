import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlarmClock, BarChart3, ShieldCheck, Sparkles } from 'lucide-react'
import { Logo } from './ui'
import ThemeToggle from './ThemeToggle'

const POINTS = [
  { icon: AlarmClock, t: 'Rings in real time', d: 'Solve a puzzle to silence it — no mindless snoozing.' },
  { icon: Sparkles, t: 'Adapts to you', d: 'Difficulty rises and falls with how you actually wake.' },
  { icon: BarChart3, t: 'Builds the habit', d: 'Habit score, streaks, sleep and productivity insights.' },
  { icon: ShieldCheck, t: 'Private by design', d: 'Encrypted passwords, rotating sessions, consent-based coaching.' },
]

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block" style={{ background: 'linear-gradient(160deg,#0A0D1E 0%,#161C40 55%,#4A2A4A 100%)' }}>
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#FF9457]/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#8C9EFF]/20 blur-3xl" />
        <svg className="absolute inset-x-0 bottom-0 w-full opacity-70" viewBox="0 0 600 260" fill="none" aria-hidden="true">
          <motion.path d="M20 250a280 280 0 0 1 560 0" stroke="url(#g)" strokeWidth="2.5" strokeDasharray="3 9" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.4 }} />
          <motion.circle r="12" fill="#FF9457" initial={{ cx: 20, cy: 250 }} animate={{ cx: [20, 140, 300, 460, 580], cy: [250, 120, 20, 120, 250] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} style={{ filter: 'drop-shadow(0 0 18px rgba(255,148,87,.9))' }} />
          <defs><linearGradient id="g" x1="0" x2="1"><stop stopColor="#8C9EFF" stopOpacity=".5" /><stop offset="1" stopColor="#FF9457" /></linearGradient></defs>
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link to="/" aria-label="Wakeful home"><Logo className="text-white [&_.fill-ink]:fill-white/10" /></Link>
          <div>
            <h2 className="max-w-md font-display text-4xl leading-tight">The alarm that won't let your mind stay asleep.</h2>
            <ul className="mt-8 space-y-4">
              {POINTS.map((p, i) => (
                <motion.li key={p.t} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.12 }} className="flex gap-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"><p.icon className="h-5 w-5 text-[#FF9457]" /></span>
                  <div><p className="font-medium">{p.t}</p><p className="text-sm text-white/65">{p.d}</p></div>
                </motion.li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/45">© Wakeful — Intelligent Cognitive Alarm Platform</p>
        </div>
      </aside>

      <main className="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="absolute right-5 top-5 flex items-center gap-3"><ThemeToggle /></div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-block lg:hidden"><Logo /></Link>
          <h1 className="text-4xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-2 text-mute">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <p className="mt-8 text-center text-sm text-mute">{footer}</p>}
        </motion.div>
      </main>
    </div>
  )
}
