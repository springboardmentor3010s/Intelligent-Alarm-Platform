import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Flame, Mail, Send, UserPlus, Users } from 'lucide-react'
import client, { errorMessage } from '../../api/client'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, ScoreRing, Skeleton, StatCard, useAsync, useToast } from '../../components/ui'
import { fmtDate, pct } from '../../lib/format'

export default function CoachOverview() {
  const toast = useToast()
  const { data, loading, reload } = useAsync(async () => (await client.get('/coach/overview')).data, [])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const invite = async (e) => {
    e.preventDefault(); setBusy(true)
    try { const r = await client.post('/coach/invite', { email }); toast.success(r.data.detail); setEmail(''); reload() }
    catch (err) { toast.error(errorMessage(err)) } finally { setBusy(false) }
  }
  if (loading || !data) return <div><PageHeader title="My members" /><Skeleton className="h-96" /></div>
  const { members, pending, stats } = data
  return (
    <div className="space-y-6">
      <PageHeader title="My members" subtitle="Behaviour, habit adherence and sleep trends for members who chose to share their progress with you." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Active members" value={stats.members} icon={Users} />
        <StatCard label="Avg. habit score" value={stats.avg_habit_score ?? '—'} icon={Flame} tone="ok" />
        <StatCard label="Need attention" value={stats.needs_attention} hint="Habit score below 50" icon={AlertTriangle} tone={stats.needs_attention ? 'bad' : 'neutral'} className="col-span-2 lg:col-span-1" />
      </div>

      <Card className="p-6">
        <CardHeader title="Invite a member" icon={UserPlus} subtitle="They receive a notification and must accept before you can see any of their data." />
        <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1"><Field label="Member's email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" /></Field></div>
          <Button type="submit" icon={Send} loading={busy}>Send invitation</Button>
        </form>
        {pending.length > 0 && (
          <div className="mt-5 border-t border-line pt-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-mute">Awaiting response</p>
            <ul className="flex flex-wrap gap-2">{pending.map((p) => <li key={p.link_id}><Badge tone="warn"><Mail className="h-3 w-3" />{p.email} · {fmtDate(p.invited_at)}</Badge></li>)}</ul></div>
        )}
      </Card>

      {members.length === 0 ? <Card><EmptyState icon={Users} title="No members yet" body="Invite a member by email. Once they accept, their dashboard appears here." /></Card> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {members.map((m) => (
            <Link key={m.id} to={`/app/coach/members/${m.id}`} className="group">
              <Card className="h-full p-6 transition group-hover:-translate-y-1 group-hover:border-brand/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-lg font-semibold">{m.full_name}</p><p className="truncate text-xs text-mute">{m.email}</p>
                    {m.habit_score != null && m.habit_score < 50 && <Badge tone="bad" className="mt-2"><AlertTriangle className="h-3 w-3" />Needs attention</Badge>}</div>
                  <ScoreRing value={m.habit_score} empty={m.habit_score == null} size={84} stroke={8} label="score" />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                  <div><p className="num text-lg font-semibold">{pct(m.success_rate)}</p><p className="text-[10px] uppercase tracking-wide text-mute">Wake success</p></div>
                  <div><p className="num text-lg font-semibold">{m.avg_snoozes ?? '—'}</p><p className="text-[10px] uppercase tracking-wide text-mute">Snoozes</p></div>
                  <div><p className="num text-lg font-semibold">{m.current_streak}d</p><p className="text-[10px] uppercase tracking-wide text-mute">Streak</p></div>
                </div>
                <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand">Open report<ArrowRight className="h-4 w-4 transition-all group-hover:translate-x-1" /></p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
