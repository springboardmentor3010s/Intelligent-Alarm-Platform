import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlarmClock, ArrowRight, Flame, Lightbulb, Moon, Play, Plus, Target, TimerReset, X, Zap } from 'lucide-react'
import client from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useAlarm, useNow } from '../../context/AlarmContext'
import { useTheme } from '../../context/ThemeContext'
import { Badge, Button, Card, CardHeader, EmptyState, ProgressBar, ScoreRing, Skeleton, StatCard, useAsync, useToast } from '../../components/ui'
import { TYPE_LABEL, fmtClock, fmtDate, pct, titleCase, until } from '../../lib/format'

const CAT = { sleep: 'accent', wake: 'brand', habit: 'warn', productivity: 'ok', challenge: 'accent' }

function Greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const { user } = useAuth()
  const { schedule, startTest, version } = useAlarm()
  const { colors } = useTheme()
  const toast = useToast()
  useNow()
  const { data, loading, setData } = useAsync(async () => {
    const [s, h, r] = await Promise.all([client.get('/insights/summary'), client.get('/insights/habit-history?days=30'), client.get('/insights/recommendations')])
    return { s: s.data, h: h.data, r: r.data }
  }, [version])

  const dismiss = async (id) => { await client.post(`/insights/recommendations/${id}/dismiss`); setData((d) => ({ ...d, r: d.r.filter((x) => x.id !== id) })) }
  const test = async () => { try { await startTest() } catch { toast.error('Could not start a test alarm.') } }
  const nextMs = schedule.next ? new Date(schedule.next.ring_at).getTime() : null

  if (loading || !data) return <div className="grid gap-5 lg:grid-cols-3"><Skeleton className="h-52 lg:col-span-3" /><Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
  const { s, h, r } = data
  const hab = s.habit
  const cmp = [['Wake consistency', hab.wake_consistency, 'brand', '35%'], ['Challenge success', hab.challenge_completion, 'accent', '25%'], ['Snooze reduction', hab.snooze_reduction, 'ok', '20%'], ['Sleep adherence', hab.sleep_adherence, 'warn', '20%']]
  const goal = s.goal
  const chart = h.map((x) => ({ d: fmtDate(x.date), score: x.total }))

  return (
    <div className="space-y-6">
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl p-7 text-white sm:p-9" style={{ background: 'linear-gradient(135deg,#0F1430 0%,#1E2455 55%,#6A3550 100%)' }}>
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[#FF9457]/30 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm text-white/70">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <h1 className="mt-1 text-3xl font-semibold sm:text-4xl"><Greeting />, {user.full_name.split(' ')[0]}.</h1>
            {schedule.next ? (
              <p className="mt-4 flex items-center gap-2 text-white/85"><AlarmClock className="h-5 w-5 text-[#FF9457]" />
                <b>{schedule.next.label}</b> rings at <span className="num">{fmtClock(schedule.next.ring_at)}</span> — in <span className="num font-semibold text-[#FFB98A]">{until(schedule.next.ring_at, Date.now() + schedule.offsetMs)}</span></p>
            ) : <p className="mt-4 text-white/80">No alarm set. Create one to start building your streak.</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" icon={Play} onClick={test} className="border-white/20 bg-white/10 text-white hover:bg-white/20">Test ring</Button>
            <Link to="/app/alarms"><Button icon={Plus}>Manage alarms</Button></Link>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:row-span-1">
          <CardHeader title="Habit score" subtitle="Last 14 days" icon={Target} />
          <div className="flex justify-center py-2"><ScoreRing value={hab.total} empty={!hab.has_data} size={170} /></div>
          {hab.has_data ? (
            <div className="mt-5 space-y-3.5">{cmp.map(([l, v, t, w]) => <ProgressBar key={l} label={`${l} · ${w}`} value={v} tone={t} />)}</div>
          ) : <p className="mt-4 text-center text-sm text-mute">Dismiss a few alarms to unlock your score.</p>}
          {hab.missing.includes('sleep_adherence') && hab.has_data && <p className="mt-4 rounded-xl bg-accent/10 p-3 text-xs text-accent">Sleep adherence needs sleep logs — <Link to="/app/sleep" className="font-semibold underline">log last night</Link>.</p>}
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-2">
          <StatCard label="Current streak" value={`${s.wake.current_streak}d`} hint={`Best ${s.wake.best_streak}d`} icon={Flame} />
          <StatCard label="Wake-up success" value={pct(s.wake.success_rate)} hint={`${s.wake.dismissed}/${s.wake.total} alarms`} icon={Zap} tone="ok" />
          <StatCard label="Avg. snoozes" value={s.wake.avg_snoozes ?? '—'} hint={`Trend: ${titleCase(s.snooze.trend)}`} icon={TimerReset} tone="warn" />
          <StatCard label="Alertness" value={s.wake.avg_alertness ?? '—'} hint="Average wake-up alertness /100" icon={Moon} tone="accent" />
          <Card className="col-span-2 p-5">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">Wake-up goal</p><Badge tone="brand"><span className="num">{goal.current_streak}/{goal.target_streak}</span> days</Badge></div>
            <div className="mt-3"><ProgressBar value={(goal.current_streak / goal.target_streak) * 100} right={`${Math.round((goal.current_streak / goal.target_streak) * 100)}%`} /></div>
            {goal.productivity_goal && <p className="mt-3 text-sm text-mute">🎯 {goal.productivity_goal}</p>}
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <CardHeader title="Habit score trend" subtitle="Last 30 days" action={<Link to="/app/insights" className="text-sm font-medium text-brand hover:underline">All insights</Link>} />
          {chart.length < 2 ? <EmptyState title="Your trend appears here" body="A new point is added every day you open the dashboard." /> : (
            <div className="h-64"><ResponsiveContainer>
              <AreaChart data={chart} margin={{ left: -18, right: 8, top: 8 }}>
                <defs><linearGradient id="hs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors.brand} stopOpacity={0.4} /><stop offset="100%" stopColor={colors.brand} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="d" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis domain={[0, 100]} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="score" name="Habit score" stroke={colors.brand} strokeWidth={2.5} fill="url(#hs)" />
              </AreaChart>
            </ResponsiveContainer></div>
          )}
        </Card>

        <Card className="p-6 lg:col-span-2">
          <CardHeader title="Recommended for you" icon={Lightbulb} />
          {r.length === 0 ? <EmptyState title="All caught up" body="New advice appears as your data grows." /> : (
            <ul className="space-y-3">
              {r.slice(0, 4).map((x) => (
                <motion.li key={x.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-line bg-surface2/50 p-4">
                  <div className="flex items-start justify-between gap-2"><Badge tone={CAT[x.category]}>{titleCase(x.category)}</Badge><button onClick={() => dismiss(x.id)} aria-label="Dismiss" className="text-mute hover:text-ink"><X className="h-4 w-4" /></button></div>
                  <p className="mt-2 text-sm font-semibold">{x.title}</p><p className="mt-1 text-xs leading-relaxed text-mute">{x.body}</p>
                </motion.li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <CardHeader title="Challenge performance" subtitle={s.challenges.total ? `${s.challenges.total} answers · ${pct(s.challenges.accuracy)} accurate` : 'Last 30 days'} />
          {s.challenges.by_type.length === 0 ? <EmptyState title="No challenges yet" body="Try a test ring to see how it works." action={<Button size="sm" icon={Play} onClick={test}>Test ring</Button>} /> : (
            <ul className="space-y-3.5">{s.challenges.by_type.map((t) => <li key={t.type}><ProgressBar label={`${TYPE_LABEL[t.type]} · ${t.attempts} tries · ${t.avg_seconds}s`} value={t.accuracy * 100} tone={t.accuracy >= 0.75 ? 'ok' : t.accuracy >= 0.5 ? 'brand' : 'bad'} right={pct(t.accuracy)} /></li>)}</ul>
          )}
        </Card>
        <Card className="p-6">
          <CardHeader title="Coming up" action={<Link to="/app/alarms" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Alarms<ArrowRight className="h-3.5 w-3.5" /></Link>} />
          {schedule.upcoming.length === 0 ? <EmptyState icon={AlarmClock} title="No upcoming alarms" action={<Link to="/app/alarms"><Button size="sm" icon={Plus}>New alarm</Button></Link>} /> : (
            <ul className="divide-y divide-line">{schedule.upcoming.map((u) => (
              <li key={u.alarm_id} className="flex items-center justify-between py-3"><div><p className="font-medium">{u.label}</p><p className="text-xs text-mute">{new Date(u.ring_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p></div><span className="num text-xl font-semibold">{fmtClock(u.ring_at)}</span></li>
            ))}</ul>
          )}
        </Card>
      </div>
    </div>
  )
}
