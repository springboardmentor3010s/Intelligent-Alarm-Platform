import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlarmClock, Brain, Flame, FileSpreadsheet, FileText, Megaphone, Send, UserCheck, Users, Zap } from 'lucide-react'
import client, { download, errorMessage } from '../../api/client'
import { useTheme } from '../../context/ThemeContext'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Skeleton, StatCard, Textarea, useAsync, useToast } from '../../components/ui'
import { LEVELS, ROLE_LABEL, fmtDate, pct, titleCase } from '../../lib/format'

export default function AdminOverview() {
  const { colors } = useTheme()
  const toast = useToast()
  const { data: o, loading } = useAsync(async () => (await client.get('/admin/overview')).data, [])
  const [a, setA] = useState({ title: '', body: '' })
  const [busy, setBusy] = useState(false)
  const tip = { contentStyle: { background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 12, fontSize: 12 } }
  const announce = async (e) => {
    e.preventDefault(); setBusy(true)
    try { const r = await client.post('/admin/announcements', a); toast.success(`Sent to ${r.data.sent_to} users`); setA({ title: '', body: '' }) } catch (err) { toast.error(errorMessage(err)) } finally { setBusy(false) }
  }
  const dl = async (fmt) => { try { await download(`/reports/system?format=${fmt}`, `wakeful_system_report.${fmt === 'excel' ? 'xlsx' : 'pdf'}`) } catch (e) { toast.error(errorMessage(e)) } }
  if (loading || !o) return <div><PageHeader title="Administration" /><div className="grid gap-5 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}</div></div>

  const roles = Object.entries(o.users.by_role).map(([k, v]) => ({ name: ROLE_LABEL[k] || k, value: v }))
  const pal = [colors.brand, colors.accent, colors.ok]
  const diff = [...o.challenges.by_difficulty].sort((x, y) => LEVELS.indexOf(x.difficulty) - LEVELS.indexOf(y.difficulty)).map((d) => ({ name: titleCase(d.difficulty), Accuracy: Math.round(d.accuracy * 100) }))
  const signups = o.signups.map((s) => ({ d: fmtDate(s.date), Signups: s.count }))

  return (
    <div className="space-y-6">
      <PageHeader title="Administration" subtitle="Platform analytics at a glance."
        actions={<><Button size="sm" variant="secondary" icon={FileText} onClick={() => dl('pdf')}>System report (PDF)</Button><Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={() => dl('excel')}>Excel</Button></>} />
      {o.users.pending_coaches > 0 && (
        <Link to="/app/admin/approvals" className="flex items-center justify-between rounded-2xl border border-brand/40 bg-brand/10 px-5 py-4 text-sm transition hover:bg-brand/15">
          <span className="flex items-center gap-3"><UserCheck className="h-5 w-5 text-brand" /><b>{o.users.pending_coaches}</b> coach application{o.users.pending_coaches > 1 ? 's' : ''} waiting for review</span><span className="font-semibold text-brand">Review →</span>
        </Link>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total users" value={o.users.total} hint={`${o.users.active_7d} active in 7 days`} icon={Users} />
        <StatCard label="Active alarms" value={o.alarms.active} hint={`${o.alarms.total} created`} icon={AlarmClock} tone="accent" />
        <StatCard label="Wake success (30d)" value={pct(o.wake.success_rate)} hint={`${o.wake.sessions_30d} alarm sessions`} icon={Zap} tone="ok" />
        <StatCard label="Challenge accuracy" value={pct(o.challenges.accuracy)} hint={`${o.challenges.attempts_30d} answers`} icon={Brain} tone="warn" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6"><CardHeader title="Users by role" />
          <div className="h-52"><ResponsiveContainer><PieChart><Pie data={roles} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>{roles.map((_, i) => <Cell key={i} fill={pal[i % 3]} />)}</Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer></div>
          <ul className="mt-2 space-y-1.5 text-sm">{roles.map((r, i) => <li key={r.name} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: pal[i % 3] }} />{r.name}</span><span className="num font-medium">{r.value}</span></li>)}</ul>
        </Card>
        <Card className="p-6 lg:col-span-2"><CardHeader title="Sign-ups" subtitle="Last 30 days" action={<Badge tone="brand"><Flame className="h-3 w-3" />Avg. habit score {o.avg_habit_score ?? '—'}</Badge>} />
          {signups.length < 1 ? <EmptyState title="No sign-ups yet" /> : <div className="h-56"><ResponsiveContainer><LineChart data={signups} margin={{ left: -22 }}><CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="d" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip {...tip} /><Line dataKey="Signups" stroke={colors.brand} strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>}
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6"><CardHeader title="Challenge accuracy by difficulty" subtitle="Is the adaptive engine calibrated?" />
          {diff.length === 0 ? <EmptyState title="No challenge data yet" /> : <div className="h-56"><ResponsiveContainer><BarChart data={diff} margin={{ left: -22 }}><CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip {...tip} /><Bar dataKey="Accuracy" fill={colors.accent} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>}
        </Card>
        <Card className="p-6"><CardHeader title="Platform announcement" icon={Megaphone} subtitle="Delivered as a notification to every active user." />
          <form onSubmit={announce} className="space-y-3"><Field label="Title"><Input value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} required minLength={2} maxLength={120} /></Field><Field label="Message"><Textarea value={a.body} onChange={(e) => setA({ ...a, body: e.target.value })} required minLength={2} maxLength={600} /></Field><Button type="submit" icon={Send} loading={busy}>Send to everyone</Button></form>
        </Card>
      </div>
    </div>
  )
}
