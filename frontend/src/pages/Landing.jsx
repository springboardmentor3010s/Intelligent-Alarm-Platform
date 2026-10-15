import { Link } from 'react-router-dom'

const features = [
  {
    icon: '⏰',
    title: 'Smart Alarms',
    desc: 'Schedule alarms by day, time, and repeat pattern. Enable or disable them instantly.',
    accent: 'from-indigo-500/10 to-indigo-500/0',
  },
  {
    icon: '🧩',
    title: 'Cognitive Challenges',
    desc: 'Solve math, logic, or memory puzzles before dismissing your alarm. Keeps your mind sharp.',
    accent: 'from-violet-500/10 to-violet-500/0',
  },
  {
    icon: '📋',
    title: 'Habit Tracking',
    desc: 'Build and track daily habits like exercise, reading, and meditation alongside your alarms.',
    accent: 'from-fuchsia-500/10 to-fuchsia-500/0',
  },
  {
    icon: '📈',
    title: 'Adaptive Difficulty',
    desc: 'Challenge difficulty adapts to your performance with an ML engine. Always the right level.',
    accent: 'from-sky-500/10 to-sky-500/0',
  },
]

const steps = [
  { step: '01', title: 'Create an Account', desc: 'Register in seconds. Choose your role and set your preferences.' },
  { step: '02', title: 'Schedule Your Alarm', desc: 'Set wake-up times, repeat days, and alarm type.' },
  { step: '03', title: 'Solve & Wake Up', desc: 'Dismiss your alarm only after completing a cognitive challenge.' },
]

const stats = [
  { value: '7', label: 'Challenge types' },
  { value: '5', label: 'Difficulty levels' },
  { value: 'ML', label: 'Adaptive engine' },
  { value: '100%', label: 'Open source' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-100">

      {/* Nav */}
      <header className="glass-nav sticky top-0 z-30 flex items-center justify-between px-6 sm:px-10 py-4">
        <div className="flex items-center gap-2.5 font-bold text-lg">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-[0_6px_16px_-6px_rgba(79,70,229,0.7)]">🧠</span>
          <span className="tracking-tight">Cognitive<span className="text-gradient">Alarm</span></span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="btn-ghost text-sm">Login</Link>
          <Link to="/register" className="btn-primary text-sm !px-5 !py-2">Get Started</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mesh-bg relative overflow-hidden px-6 sm:px-10 py-24 sm:py-28 text-center">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[38rem] h-[38rem] rounded-full bg-brand-400/20 blur-3xl animate-float pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <span className="chip bg-white/70 dark:bg-white/10 text-brand-700 dark:text-brand-300 ring-1 ring-brand-200/60 dark:ring-white/10 mb-6 animate-fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Train your brain every morning
          </span>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 dark:text-white mb-5 leading-[1.05] animate-fade-up" style={{ animationDelay: '60ms' }}>
            Wake up. Think.<br />
            <span className="text-gradient">Build better habits.</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg max-w-xl mx-auto mb-9 animate-fade-up" style={{ animationDelay: '120ms' }}>
            An intelligent alarm platform where you solve personalized cognitive challenges
            before dismissing your alarm — sharpening your mind the moment you wake.
          </p>
          <div className="flex justify-center gap-3 flex-wrap animate-fade-up" style={{ animationDelay: '180ms' }}>
            <Link to="/register" className="btn-primary">
              Get Started — It's Free
              <span aria-hidden>→</span>
            </Link>
            <Link to="/login" className="btn-outline">Sign In</Link>
          </div>

          {/* Stat band */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: '240ms' }}>
            {stats.map(s => (
              <div key={s.label} className="rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur border border-white/60 dark:border-white/10 py-4">
                <div className="text-2xl font-extrabold text-gradient font-display">{s.value}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 sm:px-10 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="chip bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300 mb-3">Features</span>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Everything you need to wake up smarter</h2>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Thoughtfully designed, end-to-end and fully functional.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map(f => (
            <div key={f.title} className="group card-interactive relative overflow-hidden p-6">
              <div className={`absolute inset-0 bg-gradient-to-b ${f.accent} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <div className="grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-50 to-violet-100 dark:from-brand-500/20 dark:to-violet-500/10 text-2xl mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1.5">{f.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 sm:px-10 py-20 bg-gray-50 dark:bg-gray-900/40">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="chip bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-300 mb-3">How it works</span>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Three steps to a sharper morning</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
            <div className="hidden sm:block absolute top-6 left-[16%] right-[16%] h-px bg-gradient-to-r from-brand-200 via-violet-300 to-fuchsia-200 dark:from-brand-500/30 dark:via-violet-500/30 dark:to-fuchsia-500/30" />
            {steps.map(s => (
              <div key={s.step} className="relative text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-violet-600 text-white rounded-2xl flex items-center justify-center font-bold text-lg mx-auto mb-4 shadow-[0_8px_20px_-8px_rgba(79,70,229,0.7)] ring-4 ring-gray-50 dark:ring-gray-900/40">
                  {s.step}
                </div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{s.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 sm:px-10 py-8">
        <div className="relative overflow-hidden max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-brand-600 via-violet-600 to-fuchsia-600 px-8 py-16 text-center text-white shadow-[0_30px_60px_-24px_rgba(79,70,229,0.6)]">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full bg-fuchsia-300/20 blur-2xl" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Ready to wake up smarter?</h2>
            <p className="text-white/80 mb-8">Create your account and set your first alarm in under 2 minutes.</p>
            <Link to="/register" className="btn inline-flex bg-white text-brand-700 px-8 py-3.5 hover:-translate-y-0.5 hover:shadow-xl">
              Create Free Account
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-gray-400 dark:text-gray-600 text-xs py-8 mt-8 border-t border-gray-100 dark:border-gray-800">
        <span className="font-semibold text-gray-500 dark:text-gray-400">CognitiveAlarm</span> — Intelligent Cognitive Alarm Platform &nbsp;·&nbsp; Built with FastAPI + React
      </footer>
    </div>
  )
}
