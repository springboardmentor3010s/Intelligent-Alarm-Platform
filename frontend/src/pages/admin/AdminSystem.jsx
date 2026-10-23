import { useEffect } from 'react'
import { Activity, Clock, Database, HardDrive, Server } from 'lucide-react'
import client from '../../api/client'
import { Badge, Card, CardHeader, PageHeader, Skeleton, useAsync } from '../../components/ui'
import { fmtDateTime } from '../../lib/format'

const up = (s) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m` }
const tone = (s) => (s === 'ok' ? 'ok' : s === 'not_configured' ? 'neutral' : 'bad')

export default function AdminSystem() {
  const { data, loading, reload } = useAsync(async () => (await client.get('/admin/system')).data, [])
  useEffect(() => { const t = setInterval(reload, 10000); return () => clearInterval(t) }, [reload])
  if (loading && !data) return <div><PageHeader title="System health" /><Skeleton className="h-72" /></div>
  const rows = [
    { icon: Database, t: 'PostgreSQL (primary)', v: data.database, d: 'Users, alarms, sessions, scores' },
    { icon: HardDrive, t: 'MongoDB (event log)', v: data.mongodb, d: 'Challenge interaction events' },
    { icon: Activity, t: 'Alarm scheduler', v: data.scheduler.running && !data.scheduler.last_error ? 'ok' : 'unavailable', d: data.scheduler.last_tick ? `Last tick ${fmtDateTime(data.scheduler.last_tick)} · ${data.scheduler.ticks} ticks` : 'Waiting for first tick', err: data.scheduler.last_error },
  ]
  return (
    <div className="space-y-6">
      <PageHeader title="System health" subtitle="Live status of the services behind Wakeful. Refreshes every 10 seconds." />
      <div className="grid gap-5 md:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.t} className="p-6"><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand"><r.icon className="h-5 w-5" /></span><Badge tone={tone(r.v)}>{r.v === 'ok' ? 'Operational' : r.v === 'not_configured' ? 'Not configured' : 'Down'}</Badge></div>
            <h2 className="mt-4 text-lg font-semibold">{r.t}</h2><p className="mt-1 text-sm text-mute">{r.d}</p>{r.err && <p className="mt-2 text-xs text-bad">{r.err}</p>}</Card>))}
      </div>
      <Card className="p-6"><CardHeader title="Server" icon={Server} />
        <dl className="grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-xs uppercase tracking-wide text-mute">Version</dt><dd className="num mt-1 text-lg font-semibold">{data.version}</dd></div><div><dt className="text-xs uppercase tracking-wide text-mute">Uptime</dt><dd className="num mt-1 text-lg font-semibold">{up(data.uptime_seconds)}</dd></div><div><dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-mute"><Clock className="h-3 w-3" />Server time</dt><dd className="num mt-1 text-lg font-semibold">{fmtDateTime(data.server_time)}</dd></div></dl>
      </Card>
    </div>
  )
}
