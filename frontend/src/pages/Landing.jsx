import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlarmClock, ArrowRight, BarChart3, Brain, CheckCircle2, FileText, Flame, HeartPulse, LineChart, Lock, Moon, ShieldCheck,
  Sparkles, Target, Timer, User, Users,
} from 'lucide-react'
import { Logo, cx } from '../components/ui'
import ThemeToggle from '../components/ThemeToggle'

const Reveal = ({ children, delay = 0, className }) => (
  <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55, delay }} className={className}>{children}</motion.div>
)

const FEATURES = [
  { icon: AlarmClock, t: 'Real-time alarms', d: 'Daily, weekday, weekend, one-time and smart-adaptive alarms with custom sounds, volume and repeat days.' },
  { icon: Brain, t: '7 challenge types', d: 'Math, logic, memory, word games, patterns, riddles and quick quizzes — freshly generated every time.' },
  { icon: Sparkles, t: 'Adaptive difficulty', d: 'A learning model moves you across 5 levels based on accuracy, speed and snoozes.' },
  { icon: Timer, t: 'Anti-snooze verification', d: 'Multi-step, consecutive, timed and accuracy-check methods. Snoozing makes the next puzzle harder.' },
  { icon: Target, t: 'Weighted habit score', d: 'Wake consistency 35%, challenge success 25%, snooze reduction 20%, sleep adherence 20%.' },
  { icon: Moon, t: 'Sleep & productivity', d: 'Log sleep, rate your day, and see how rest connects to how productive you feel.' },
  { icon: LineChart, t: 'Smart recommendations', d: 'Plain-language advice for sleep, wake-ups, habits, productivity and the challenges that suit you.' },
  { icon: FileText, t: 'PDF & Excel reports', d: 'Habit, wake-up, challenge, productivity and sleep reports ready to share.' },
]

const ROLES = [
  { icon: User, t: 'Member', portal: 'member', pts: ['Alarms that actually ring', 'Habit score & streaks', 'Sleep and productivity insights', 'Reports and exports'] },
  { icon: HeartPulse, t: 'Wellness Coach', portal: 'coach', pts: ['Invite members — they must consent', 'Behaviour & adherence analytics', 'Sleep trend reports', 'Send encouragement'] },
  { icon: ShieldCheck, t: 'Administrator', portal: 'admin', pts: ['User & role management', 'Coach approvals', 'Platform analytics', 'Audit log & system health'] },
]

function HeroCard() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 p-6 text-white shadow-2xl" style={{ background: 'linear-gradient(170deg,#0A0D1E,#1B2150 60%,#5A2E4A)' }}>
          <div className="absolute -bottom-10 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-[#FF9457]/40 blur-3xl" />
          <div className="relative text-center">
            <div className="relative mx-auto mb-3 grid h-14 w-14 place-items-center">
              <span className="absolute inset-0 animate-pulseRing rounded-full bg-[#FF9457]/30" />
              <AlarmClock className="h-7 w-7 animate-ring text-[#FF9457]" />
            </div>
            <p className="num text-6xl font-semibold" style={{ textShadow: '0 0 40px rgba(255,148,87,.5)' }}>06:45</p>
            <p className="mt-1 text-sm text-white/70">Morning · solve to dismiss</p>
            <div className="mx-auto my-4 flex w-fit gap-1.5">{[1, 1, 0].map((on, i) => <span key={i} className={cx('h-2 w-9 rounded-full', on ? 'bg-[#6FCF97]' : 'bg-white/20')} />)}</div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-left backdrop-blur">
              <div className="mb-2 flex justify-between text-[11px]"><span className="rounded-full bg-white/10 px-2 py-0.5">Math · medium</span><span className="num text-[#FF9457]">0:32</span></div>
              <p className="font-display text-xl">What is 13 × 7 + 4?</p>
              <div className="mt-3 flex gap-2"><div className="num flex-1 rounded-xl bg-black/25 px-3 py-2 text-center text-lg text-white/60">9<motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }}>|</motion.span></div><div className="rounded-xl bg-[#FF9457] px-4 py-2 font-semibold text-[#10152B]">Go</div></div>
            </div>
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="absolute -left-6 top-10 hidden rounded-2xl border border-line bg-surface px-4 py-3 shadow-card sm:block">
        <div className="flex items-center gap-2 text-sm font-semibold"><Flame className="h-4 w-4 text-brand" />12-day streak</div>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }} className="absolute -right-6 bottom-16 hidden rounded-2xl border border-line bg-surface px-4 py-3 shadow-card sm:block">
        <p className="text-[11px] uppercase tracking-wider text-mute">Habit score</p><p className="num text-2xl font-semibold text-ok">86</p>
      </motion.div>
    </div>
  )
}

export default function Landing() {
  return (
    <div className="overflow-x-clip">
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-medium text-mute md:flex" aria-label="Sections">
            <a href="#features" className="hover:text-ink">Features</a><a href="#how" className="hover:text-ink">How it works</a>
            <a href="#roles" className="hover:text-ink">Roles</a><a href="#security" className="hover:text-ink">Security</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link to="/login" className="hidden rounded-xl px-4 py-2.5 text-sm font-medium text-mute hover:text-ink sm:block">Sign in</Link>
            <Link to="/register" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brandfg shadow-sm transition hover:brightness-110">Get started</Link>
          </div>
        </div>
      </header>

      <section className="hero-glow relative">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-2 lg:pt-24">
          <div>
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-mute">
              <span className="h-2 w-2 animate-pulse rounded-full bg-ok" />AI-powered cognitive alarm platform
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.6 }} className="mt-6 text-5xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">
              The alarm that won't let your <span className="text-brand">mind</span> stay asleep.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.6 }} className="mt-6 max-w-xl text-lg text-mute">
              Wakeful replaces the snooze button with a short cognitive challenge, tuned to how you actually wake up — then turns your mornings into a habit you can measure.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.6 }} className="mt-9 flex flex-wrap items-center gap-4">
              <Link to="/register" className="inline-flex items-center gap-2 rounded-2xl bg-brand px-7 py-4 text-base font-semibold text-brandfg shadow-glow transition hover:brightness-110">Create your first alarm<ArrowRight className="h-5 w-5" /></Link>
              <Link to="/login" className="rounded-2xl border border-line bg-surface px-7 py-4 text-base font-medium transition hover:border-brand/50">I have an account</Link>
            </motion.div>
            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-mute">
              {['7 challenge types', '5 difficulty levels', '5 verification methods', 'Light, dark & adaptive theme'].map((t) => <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-ok" />{t}</li>)}
            </motion.ul>
          </div>
          <HeroCard />
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">Everything in one platform</p>
          <h2 className="mt-3 text-4xl font-semibold sm:text-5xl">Built to change how you wake — and keep it changed.</h2>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.t} delay={(i % 4) * 0.07}>
              <div className="group h-full rounded-2xl border border-line bg-surface p-6 shadow-card transition hover:-translate-y-1 hover:border-brand/40">
                <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-brandfg"><f.icon className="h-5 w-5" /></span>
                <h3 className="text-xl font-semibold">{f.t}</h3><p className="mt-2 text-sm leading-relaxed text-mute">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="how" className="scroll-mt-20 border-y border-line bg-surface2/60">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <Reveal className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-wider text-brand">How it works</p><h2 className="mt-3 text-4xl font-semibold sm:text-5xl">Three steps between you and a consistent morning.</h2></Reveal>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[['Set your alarm', 'Pick a time, repeat days, sound and how you want to prove you\'re awake.'], ['Solve to dismiss', 'When it rings, a puzzle appears. Wrong or too slow? A fresh one replaces it.'], ['Watch it adapt', 'Every wake-up feeds your habit score and tunes tomorrow\'s difficulty.']].map(([t, d], i) => (
              <Reveal key={t} delay={i * 0.1}>
                <div className="relative rounded-2xl border border-line bg-surface p-7 shadow-card"><span className="num absolute -top-4 left-6 grid h-9 w-9 place-items-center rounded-full bg-brand font-semibold text-brandfg">{i + 1}</span><h3 className="mt-3 text-2xl font-semibold">{t}</h3><p className="mt-2 text-mute">{d}</p></div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="roles" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-wider text-brand">One platform, three portals</p><h2 className="mt-3 text-4xl font-semibold sm:text-5xl">A dedicated space for every role.</h2></Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {ROLES.map((r, i) => (
            <Reveal key={r.t} delay={i * 0.1}>
              <div className="flex h-full flex-col rounded-3xl border border-line bg-surface p-8 shadow-card">
                <span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-accent/12 text-accent"><r.icon className="h-6 w-6" /></span>
                <h3 className="text-2xl font-semibold">{r.t}</h3>
                <ul className="mt-5 flex-1 space-y-3 text-sm">{r.pts.map((p) => <li key={p} className="flex gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" />{p}</li>)}</ul>
                <Link to={`/login?portal=${r.portal}`} className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:gap-3">Open {r.t.toLowerCase()} portal <ArrowRight className="h-4 w-4 transition-all" /></Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="security" className="border-t border-line bg-surface2/60">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2">
          <Reveal><p className="text-sm font-semibold uppercase tracking-wider text-brand">Security & privacy</p><h2 className="mt-3 text-4xl font-semibold sm:text-5xl">Your mornings are yours.</h2><p className="mt-5 max-w-lg text-mute">Security isn't an add-on. Sessions rotate, passwords are hashed, and coaches only see what you choose to share.</p></Reveal>
          <Reveal delay={0.1}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[[Lock, 'bcrypt-hashed passwords'], [ShieldCheck, 'Rotating refresh tokens'], [Users, 'Consent-based coaching'], [BarChart3, 'Audit log of admin actions'], [Timer, 'Rate limiting & lockout'], [CheckCircle2, 'Strict content security policy']].map(([I, t]) => (
                <li key={t} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm font-medium"><I className="h-5 w-5 text-brand" />{t}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-24 text-center sm:px-8">
        <Reveal>
          <h2 className="text-4xl font-semibold sm:text-6xl">Ready to actually get up?</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-mute">Set your first alarm in under a minute.</p>
          <Link to="/register" className="mt-9 inline-flex items-center gap-2 rounded-2xl bg-brand px-8 py-4 text-base font-semibold text-brandfg shadow-glow transition hover:brightness-110">Get started free<ArrowRight className="h-5 w-5" /></Link>
        </Reveal>
      </section>

      <footer className="border-t border-line"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-mute sm:px-8"><Logo size={22} /><p>Wakeful — Intelligent Cognitive Alarm Platform</p></div></footer>
    </div>
  )
}
