import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Bell, Brain, Moon, Target } from 'lucide-react'
import client, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Button, ChipGroup, Field, Input, Logo, Select, Segmented, cx } from '../../components/ui'
import ThemeToggle from '../../components/ThemeToggle'
import { LEVELS, TYPE_LABEL, titleCase } from '../../lib/format'

const STEPS = [{ icon: Moon, t: 'Your sleep' }, { icon: Target, t: 'Your goals' }, { icon: Brain, t: 'Challenges' }, { icon: Bell, t: 'Alerts' }]

export default function Onboarding() {
  const { user, setUser, refreshUser } = useAuth()
  const nav = useNavigate()
  const [meta, setMeta] = useState({ timezones: [], challenge_types: [] })
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [createAlarm, setCreateAlarm] = useState(true)
  const [f, setF] = useState({
    preferred_wake_time: '07:00', bedtime: '23:00', sleep_hours: 7.5,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    productivity_goal: '', wake_goal_streak: 21, difficulty_preference: 'auto',
    preferred_challenge_types: ['math', 'logic', 'memory', 'word', 'pattern', 'riddle', 'quiz'],
    bedtime_reminders: true, browser_notifications: true,
  })
  useEffect(() => { client.get('/alarms/meta').then((r) => setMeta(r.data)) }, [])
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  const finish = async () => {
    setBusy(true); setError('')
    try {
      await client.put('/users/me/profile', {
        preferred_wake_time: `${f.preferred_wake_time}:00`, bedtime: `${f.bedtime}:00`, sleep_duration_minutes: Math.round(f.sleep_hours * 60),
        timezone: f.timezone, productivity_goal: f.productivity_goal || null, wake_goal_streak: Number(f.wake_goal_streak),
        difficulty_preference: f.difficulty_preference, preferred_challenge_types: f.preferred_challenge_types,
        bedtime_reminders: f.bedtime_reminders, browser_notifications: f.browser_notifications,
      })
      if (createAlarm) {
        const existing = (await client.get('/alarms')).data
        if (!existing.length) await client.post('/alarms', { label: 'Morning', time: `${f.preferred_wake_time}:00`, alarm_type: 'daily' })
      }
      if (f.browser_notifications && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
      await refreshUser()
      nav('/app/dashboard', { replace: true })
    } catch (e) { setError(errorMessage(e)); setBusy(false) }
  }

  const tzs = meta.timezones.includes(f.timezone) ? meta.timezones : [f.timezone, ...meta.timezones]
  return (
    <div className="hero-glow min-h-screen">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
        <div className="mb-10 flex items-center justify-between"><Logo /><ThemeToggle /></div>
        <p className="text-sm font-semibold text-brand">Welcome, {user.full_name.split(' ')[0]} 👋</p>
        <h1 className="mt-1 text-4xl font-semibold">Let's set up your mornings</h1>
        <ol className="mt-8 flex items-center gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex flex-1 items-center gap-2">
              <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm transition', i <= step ? 'border-brand bg-brand text-brandfg' : 'border-line text-mute')}><s.icon className="h-4 w-4" /></span>
              <span className={cx('hidden text-sm font-medium sm:block', i === step ? 'text-ink' : 'text-mute')}>{s.t}</span>
              {i < STEPS.length - 1 && <span className={cx('h-px flex-1', i < step ? 'bg-brand' : 'bg-line')} />}
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }} className="space-y-5">
              {step === 0 && (<>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Preferred wake-up time"><Input type="time" value={f.preferred_wake_time} onChange={(e) => set('preferred_wake_time', e.target.value)} className="num" /></Field>
                  <Field label="Usual bedtime"><Input type="time" value={f.bedtime} onChange={(e) => set('bedtime', e.target.value)} className="num" /></Field>
                </div>
                <Field label={`Sleep you aim for — ${f.sleep_hours} hours`}>
                  <input type="range" min="4" max="12" step="0.5" value={f.sleep_hours} onChange={(e) => set('sleep_hours', Number(e.target.value))} className="w-full accent-[rgb(var(--c-brand))]" />
                </Field>
                <Field label="Time zone" hint="Alarms ring in this time zone."><Select value={f.timezone} onChange={(e) => set('timezone', e.target.value)}>{tzs.map((z) => <option key={z}>{z}</option>)}</Select></Field>
              </>)}
              {step === 1 && (<>
                <Field label="Productivity goal (optional)" hint="What do you want your mornings to unlock?"><Input value={f.productivity_goal} onChange={(e) => set('productivity_goal', e.target.value)} placeholder="e.g. A deep-work block before 9am" maxLength={200} /></Field>
                <Field label={`Wake-up goal — ${f.wake_goal_streak} days in a row`}><input type="range" min="3" max="90" value={f.wake_goal_streak} onChange={(e) => set('wake_goal_streak', e.target.value)} className="w-full accent-[rgb(var(--c-brand))]" /></Field>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-4"><input type="checkbox" checked={createAlarm} onChange={(e) => setCreateAlarm(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--c-brand))]" /><span className="text-sm"><b>Create a daily alarm</b> at {f.preferred_wake_time} to get started</span></label>
              </>)}
              {step === 2 && (<>
                <Field label="Challenge types you'd like"><ChipGroup min={1} value={f.preferred_challenge_types} onChange={(v) => set('preferred_challenge_types', v)} options={meta.challenge_types.map((v) => ({ value: v, label: TYPE_LABEL[v] }))} /></Field>
                <Field label="Difficulty" hint="Auto lets Wakeful adapt to you across 5 levels.">
                  <Select value={f.difficulty_preference} onChange={(e) => set('difficulty_preference', e.target.value)}><option value="auto">Auto (recommended)</option>{LEVELS.map((l) => <option key={l} value={l}>{titleCase(l)}</option>)}</Select>
                </Field>
              </>)}
              {step === 3 && (<>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4"><input type="checkbox" checked={f.bedtime_reminders} onChange={(e) => set('bedtime_reminders', e.target.checked)} className="mt-1 h-4 w-4 accent-[rgb(var(--c-brand))]" /><span className="text-sm"><b>Bedtime reminders</b><br /><span className="text-mute">A nudge 30 minutes before your bedtime.</span></span></label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4"><input type="checkbox" checked={f.browser_notifications} onChange={(e) => set('browser_notifications', e.target.checked)} className="mt-1 h-4 w-4 accent-[rgb(var(--c-brand))]" /><span className="text-sm"><b>Browser notifications</b><br /><span className="text-mute">Alerts you when an alarm rings while this tab is in the background.</span></span></label>
                <p className="rounded-xl bg-accent/10 p-4 text-xs leading-relaxed text-accent">Keep Wakeful open in a browser tab (it can be in the background) so your alarm can ring. A phone app is the next step for locked-screen alarms.</p>
              </>)}
              {error && <p role="alert" className="rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">{error}</p>}
            </motion.div>
          </AnimatePresence>
          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep((s) => s - 1)} disabled={step === 0}>Back</Button>
            {step < STEPS.length - 1 ? <Button onClick={() => setStep((s) => s + 1)}>Continue<ArrowRight className="h-4 w-4" /></Button> : <Button loading={busy} onClick={finish}>Finish setup</Button>}
          </div>
        </div>
      </div>
    </div>
  )
}
