import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, Send, UserMinus } from 'lucide-react'
import client, { errorMessage } from '../../api/client'
import { useTheme } from '../../context/ThemeContext'
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, PageHeader, ProgressBar, ScoreRing, Skeleton, StatCard, Textarea, useAsync, useToast } from '../../components/ui'
import { TYPE_LABEL, fmtDate, mins, pct, titleCase, to12 } from '../../lib/format'

export default function MemberDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { colors } = useTheme()
  const { data, loading, error } = useAsync(async () => (await client.get(`/coach/members/${id}`)).data, [id])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const tip = { contentStyle: { background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 12, fontSize: 12 } }

  const send = async (e) => {
    e.preventDefault(); setBusy(true)
    try { await client.post(`/coach/members/${id}/message`, { message: msg }); toast.success('Message sent'); setMsg('') } catch (err) { toast.error(errorMessage(err)) } finally { setBusy(false) }
  }
  const unlink = async () => {
    const ov = (await client.get('/coach/overview')).data
    const link = ov.members.find((m) => m.id === id)
    if (link) await client.delete(`/coach/links/${link.link_id}`)
    nav('/app/coach')
  }

  if (error) return <Card><EmptyState title="Member unavailable" body="This member hasn't shared their data with you, or has stopped sharing." action={<Link to="/app/coach"><Button>Back to members</Button></Link>} /></Card>
  if (loading || !data) return <div className="space-y-5"><Skeleton className="h-24" /><Skeleton className="h-80" /></div>
  const { member: m, habit: hb, history, wake, snooze, challenges: ch, sleep, productivity: pr, recommendations } = data
  const sleepSeries = (sleep.series || []).map((x) => ({ d: fmtDate(x.date), Hours: +(x.duration / 60).toFixed(1) }))
  const hist = history.map((x) => ({ d: fmtDate(x.date), Score: x.total }))

  return (
    <div className="space-y-6">
      <Link to="/app/coach" className="inline-flex items-center gap-1.5 text-sm font-medium text-mute hover:text-ink"><ArrowLeft className="h-4 w-4" />All members</Link>
      <PageHeader title={m.full_name} subtitle={`${m.email} · ${m.timezone || ''} · wake ${m.wake_time ? to12(m.wake_time.slice(0, 5)) : '—'} · bedtime ${m.bedtime ? to12(m.bedtime.slice(0, 5)) : '—'}`}
        actions={<Button variant="danger" size="sm" icon={UserMinus} onClick={() => setConfirm(true)}>Stop coaching</Button>} />
      {m.goal && <p className="-mt-3 text-sm text-mute">🎯 Goal: {m.goal}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6"><CardHeader title="Habit score" />
          <div className="flex justify-center"><ScoreRing value={hb.total} empty={!hb.has_data} size={150} /></div>
          <div className="mt-5 space-y-3">
            <ProgressBar label="Wake consistency · 35%" value={hb.wake_consistency} tone="brand" /><ProgressBar label="Challenge success · 25%" value={hb.challenge_completion} tone="accent" />
            <ProgressBar label="Snooze reduction · 20%" value={hb.snooze_reduction} tone="ok" /><ProgressBar label="Sleep adherence · 20%" value={hb.sleep_adherence} tone="warn" />
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatCard label="Wake success (28d)" value={pct(wake.success_rate)} hint={`${wake.dismissed}/${wake.total} alarms`} />
          <StatCard label="Streak" value={`${wake.current_streak}d`} hint={`Best ${wake.best_streak}d`} tone="ok" />
          <StatCard label="Avg. snoozes" value={wake.avg_snoozes ?? '—'} hint={`Trend: ${titleCase(snooze.trend)}`} tone="warn" />
          <StatCard label="Avg. sleep" value={sleep.n ? mins(sleep.avg_duration_minutes) : '—'} hint={sleep.n > 1 ? `Bedtime ±${sleep.bedtime_regularity_minutes} min` : undefined} tone="accent" />
          <Card className="col-span-2 p-5"><CardHeader title="Send encouragement" />
            <form onSubmit={send} className="flex gap-3"><div className="flex-1"><Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Great consistency this week — keep it up!" maxLength={400} required className="min-h-[56px]" /></div><Button type="submit" icon={Send} loading={busy} className="self-end">Send</Button></form>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6"><CardHeader title="Habit score trend" subtitle="Last 30 days" />
          {hist.length < 2 ? <EmptyState title="Not enough history" /> : <div className="h-60"><ResponsiveContainer><AreaChart data={hist} margin={{ left: -18 }}><defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors.brand} stopOpacity={0.4} /><stop offset="100%" stopColor={colors.brand} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="d" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} /><YAxis domain={[0, 100]} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip {...tip} />
            <Area dataKey="Score" stroke={colors.brand} strokeWidth={2.5} fill="url(#mg)" /></AreaChart></ResponsiveContainer></div>}
        </Card>
        <Card className="p-6"><CardHeader title="Sleep trend" subtitle={`Target ${mins(sleep.target_minutes)}`} />
          {sleepSeries.length < 2 ? <EmptyState title="No sleep logs yet" /> : <div className="h-60"><ResponsiveContainer><BarChart data={sleepSeries} margin={{ left: -18 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="d" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={20} /><YAxis tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip {...tip} />
            <Bar dataKey="Hours" fill={colors.accent} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}
        </Card>
        <Card className="p-6"><CardHeader title="Wake-ups by weekday" />
          <div className="h-60"><ResponsiveContainer><BarChart data={wake.by_weekday} margin={{ left: -22 }}><CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="sessions" name="Alarms" fill={colors.accent} radius={[4, 4, 0, 0]} /><Bar dataKey="snoozes" name="Snoozes" fill={colors.warn} radius={[4, 4, 0, 0]} /><Bar dataKey="missed" name="Missed" fill={colors.bad} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Card>
        <Card className="p-6"><CardHeader title="Challenge performance" subtitle={ch.total ? `${ch.total} answers · ${pct(ch.accuracy)}` : undefined} />
          {ch.by_type.length === 0 ? <EmptyState title="No challenges yet" /> : <ul className="space-y-3">{ch.by_type.map((t) => <li key={t.type}><ProgressBar label={`${TYPE_LABEL[t.type]} · ${t.attempts} tries`} value={t.accuracy * 100} right={pct(t.accuracy)} tone={t.accuracy >= 0.75 ? 'ok' : t.accuracy >= 0.5 ? 'brand' : 'bad'} /></li>)}</ul>}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6"><CardHeader title="Productivity correlation" />
          {pr.correlations?.length ? <ul className="space-y-2.5">{pr.correlations.map((c) => <li key={c.factor} className="flex justify-between rounded-xl bg-surface2/60 px-4 py-3 text-sm"><span>{c.factor}</span><span className="num font-medium">r = {c.r}</span></li>)}</ul> : <p className="text-sm text-mute">{pr.note || 'Not enough rated days.'}</p>}
        </Card>
        <Card className="p-6"><CardHeader title="Member's recommendations" />
          {recommendations.length === 0 ? <p className="text-sm text-mute">No active recommendations.</p> : <ul className="space-y-3">{recommendations.map((r) => <li key={r.id} className="rounded-xl border border-line p-3.5"><Badge tone="accent">{titleCase(r.category)}</Badge><p className="mt-1.5 text-sm font-medium">{r.title}</p><p className="mt-0.5 text-xs text-mute">{r.body}</p></li>)}</ul>}
        </Card>
      </div>
      <ConfirmDialog open={confirm} danger title="Stop coaching this member?" body="You'll lose access to their data. They can invite you again later." confirmLabel="Stop coaching" onConfirm={unlink} onClose={() => setConfirm(false)} />
    </div>
  )
}
