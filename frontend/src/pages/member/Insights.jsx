import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Brain, Lightbulb, TimerReset, TrendingDown, TrendingUp, Minus, X } from 'lucide-react'
import client from '../../api/client'
import { useTheme } from '../../context/ThemeContext'
import { Badge, Card, CardHeader, EmptyState, PageHeader, ProgressBar, Segmented, Skeleton, StatCard, useAsync } from '../../components/ui'
import { LEVELS, TYPE_LABEL, fmtDate, pct, titleCase } from '../../lib/format'

const CAT = { sleep: 'accent', wake: 'brand', habit: 'warn', productivity: 'ok', challenge: 'accent' }
const tip = (c) => ({ contentStyle: { background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 12, fontSize: 12 } })

export default function Insights() {
  const { colors } = useTheme()
  const [days, setDays] = useState(30)
  const { data, loading, setData } = useAsync(async () => {
    const [b, h, s, r] = await Promise.all([client.get(`/insights/behavior?days=${days}`), client.get(`/insights/habit-history?days=${days}`), client.get(`/insights/sleep?days=${days}`), client.get('/insights/recommendations')])
    return { b: b.data, h: h.data, p: s.data.productivity, r: r.data }
  }, [days])
  const dismiss = async (id) => { await client.post(`/insights/recommendations/${id}/dismiss`); setData((d) => ({ ...d, r: d.r.filter((x) => x.id !== id) })) }

  const header = <PageHeader title="Insights" subtitle="Behavioural analytics, learning patterns and personalised recommendations."
    actions={<Segmented id="range" value={days} onChange={setDays} options={[{ value: 14, label: '14d' }, { value: 30, label: '30d' }, { value: 90, label: '90d' }]} />} />
  if (loading || !data) return <div>{header}<div className="grid gap-5 lg:grid-cols-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72" />)}</div></div>

  const { b, h, p, r } = data
  const trend = h.map((x) => ({ d: fmtDate(x.date), Total: x.total, Wake: x.wake_consistency, Challenges: x.challenge_completion, Snooze: x.snooze_reduction, Sleep: x.sleep_adherence }))
  const TrendIcon = b.snooze.trend === 'improving' ? TrendingDown : b.snooze.trend === 'worsening' ? TrendingUp : Minus
  const byType = b.challenges.by_type.map((t) => ({ name: TYPE_LABEL[t.type], Accuracy: Math.round(t.accuracy * 100), Seconds: t.avg_seconds }))
  const byDiff = [...b.challenges.by_difficulty].sort((x, y) => LEVELS.indexOf(x.difficulty) - LEVELS.indexOf(y.difficulty))
  const learning = b.challenges.trend.map((x) => ({ d: fmtDate(x.date), Accuracy: Math.round(x.accuracy * 100) }))

  return (
    <div className="space-y-6">
      {header}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Wake-up success" value={pct(b.wake.success_rate)} hint={`${b.wake.dismissed} of ${b.wake.total} alarms`} />
        <StatCard label="On-time wake-ups" value={pct(b.wake.on_time_rate)} hint="Dismissed within 10 min" tone="ok" />
        <StatCard label="Avg. time to dismiss" value={b.wake.avg_seconds_to_dismiss != null ? `${b.wake.avg_seconds_to_dismiss}s` : '—'} icon={TimerReset} tone="accent" />
        <StatCard label="Snooze trend" value={titleCase(b.snooze.trend)} hint={b.snooze.worst_day ? `Hardest day: ${b.snooze.worst_day}` : undefined} icon={TrendIcon} tone="warn" />
      </div>

      <Card className="p-6">
        <CardHeader title="Habit score over time" subtitle="Total score and its four weighted components" />
        {trend.length < 2 ? <EmptyState title="Not enough history yet" body="Your score is recorded every day you use Wakeful." /> : (
          <div className="h-72"><ResponsiveContainer><LineChart data={trend} margin={{ left: -18, right: 8 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="d" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis domain={[0, 100]} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip {...tip(colors)} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Line dataKey="Total" stroke={colors.brand} strokeWidth={3} dot={false} />
            <Line dataKey="Wake" stroke={colors.accent} strokeWidth={1.5} dot={false} connectNulls />
            <Line dataKey="Challenges" stroke={colors.ok} strokeWidth={1.5} dot={false} connectNulls />
            <Line dataKey="Snooze" stroke={colors.warn} strokeWidth={1.5} dot={false} connectNulls />
            <Line dataKey="Sleep" stroke={colors.bad} strokeWidth={1.5} dot={false} connectNulls strokeDasharray="4 3" />
          </LineChart></ResponsiveContainer></div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <CardHeader title="Wake-ups by weekday" subtitle="Where mornings go well — and where they don't" />
          <div className="h-64"><ResponsiveContainer><BarChart data={b.wake.by_weekday} margin={{ left: -22 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip {...tip(colors)} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="sessions" name="Alarms" fill={colors.accent} radius={[4, 4, 0, 0]} />
            <Bar dataKey="snoozes" name="Snoozes" fill={colors.warn} radius={[4, 4, 0, 0]} />
            <Bar dataKey="missed" name="Missed" fill={colors.bad} radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
        </Card>

        <Card className="p-6">
          <CardHeader title="Learning patterns" icon={Brain} subtitle={b.challenges.total ? `${b.challenges.total} answers · ${pct(b.challenges.accuracy)} accurate` : undefined} />
          {b.challenges.total === 0 ? <EmptyState title="No challenge data yet" /> : (<>
            <div className="mb-5 flex flex-wrap gap-2">
              {b.challenges.best_type && <Badge tone="ok">Strongest: {TYPE_LABEL[b.challenges.best_type]}</Badge>}
              {b.challenges.weakest_type && b.challenges.weakest_type !== b.challenges.best_type && <Badge tone="warn">Needs practice: {TYPE_LABEL[b.challenges.weakest_type]}</Badge>}
            </div>
            <div className="h-44"><ResponsiveContainer><BarChart data={byType} layout="vertical" margin={{ left: 12, right: 12 }}>
              <XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" dataKey="name" width={80} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip {...tip(colors)} /><Bar dataKey="Accuracy" fill={colors.brand} radius={[0, 6, 6, 0]} />
            </BarChart></ResponsiveContainer></div>
            <div className="mt-4 space-y-2.5">{byDiff.map((d) => <ProgressBar key={d.difficulty} label={`${titleCase(d.difficulty)} · ${d.attempts} answers`} value={d.accuracy * 100} tone={d.accuracy >= 0.75 ? 'ok' : d.accuracy >= 0.5 ? 'brand' : 'bad'} right={pct(d.accuracy)} />)}</div>
          </>)}
        </Card>
      </div>

      {learning.length > 1 && (
        <Card className="p-6">
          <CardHeader title="Accuracy over time" subtitle="Are your answers getting sharper?" />
          <div className="h-56"><ResponsiveContainer><LineChart data={learning} margin={{ left: -18, right: 8 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="d" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis domain={[0, 100]} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip {...tip(colors)} /><Line dataKey="Accuracy" stroke={colors.ok} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart></ResponsiveContainer></div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <CardHeader title="Productivity correlation" subtitle={p.n ? `${p.n} rated days` : undefined} />
          {p.correlations?.length ? <ul className="space-y-3">{p.correlations.map((c) => <li key={c.factor} className="flex items-center justify-between rounded-xl bg-surface2/60 px-4 py-3 text-sm"><span>{c.factor}</span><Badge tone={c.r >= 0.3 ? 'ok' : c.r <= -0.3 ? 'bad' : 'neutral'}><span className="num">r = {c.r}</span></Badge></li>)}</ul> : <p className="text-sm text-mute">{p.note || 'Rate your productivity on the Sleep page to unlock this.'}</p>}
        </Card>
        <Card className="p-6">
          <CardHeader title="Recommendations" icon={Lightbulb} />
          {r.length === 0 ? <EmptyState title="Nothing new" body="Check back as your data grows." /> : (
            <ul className="space-y-3">{r.map((x) => (
              <li key={x.id} className="rounded-xl border border-line bg-surface2/50 p-4">
                <div className="flex items-start justify-between"><Badge tone={CAT[x.category]}>{titleCase(x.category)}</Badge><button onClick={() => dismiss(x.id)} aria-label="Dismiss" className="text-mute hover:text-ink"><X className="h-4 w-4" /></button></div>
                <p className="mt-2 text-sm font-semibold">{x.title}</p><p className="mt-1 text-xs leading-relaxed text-mute">{x.body}</p>
              </li>))}</ul>
          )}
        </Card>
      </div>
    </div>
  )
}
