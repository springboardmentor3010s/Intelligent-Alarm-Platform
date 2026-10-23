import { useState } from 'react'
import { CheckCircle2, History as HistoryIcon, XCircle } from 'lucide-react'
import client from '../../api/client'
import { Badge, Card, EmptyState, PageHeader, Segmented, Skeleton, StatCard, useAsync } from '../../components/ui'
import { fmtDateTime, pct, titleCase } from '../../lib/format'
import { useAlarm } from '../../context/AlarmContext'

export default function History() {
  const { version } = useAlarm()
  const [days, setDays] = useState(30)
  const [filter, setFilter] = useState('all')
  const { data, loading } = useAsync(async () => (await client.get(`/wake/history?days=${days}`)).data, [days, version])
  const rows = (data || []).filter((r) => filter === 'all' || r.status === filter)
  const ok = (data || []).filter((r) => r.status === 'dismissed')
  return (
    <div>
      <PageHeader title="Alarm history" subtitle="Every alarm that rang, how you handled it and how alert you were."
        actions={<><Segmented id="hf" size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'dismissed', label: 'Dismissed' }, { value: 'missed', label: 'Missed' }]} />
          <Segmented id="hd" size="sm" value={days} onChange={setDays} options={[{ value: 7, label: '7d' }, { value: 30, label: '30d' }, { value: 90, label: '90d' }]} /></>} />
      {loading ? <Skeleton className="h-96" /> : (<>
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Alarms" value={data.length} />
          <StatCard label="Dismissed" value={ok.length} tone="ok" />
          <StatCard label="Success rate" value={data.length ? pct(ok.length / data.length) : '—'} tone="accent" />
          <StatCard label="Avg. snoozes" value={data.length ? (data.reduce((a, r) => a + r.snoozes, 0) / data.length).toFixed(1) : '—'} tone="warn" />
        </div>
        <Card className="overflow-hidden">
          {rows.length === 0 ? <EmptyState icon={HistoryIcon} title="No alarms in this view" body="Once your alarms ring, they'll be listed here." /> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-surface2/50 text-left text-xs uppercase tracking-wide text-mute"><th className="px-5 py-3">When</th><th className="px-3 py-3">Alarm</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Snoozes</th><th className="px-3 py-3">Wrong</th><th className="px-3 py-3">Method</th><th className="px-3 py-3">Alertness</th><th className="px-5 py-3">Time to dismiss</th></tr></thead>
              <tbody className="divide-y divide-line">{rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-surface2/40">
                  <td className="whitespace-nowrap px-5 py-3.5 font-medium">{fmtDateTime(r.scheduled_at)}</td><td className="px-3 py-3.5">{r.label}</td>
                  <td className="px-3 py-3.5">{r.status === 'dismissed' ? <Badge tone="ok"><CheckCircle2 className="h-3 w-3" />Dismissed</Badge> : <Badge tone="bad"><XCircle className="h-3 w-3" />Missed</Badge>}</td>
                  <td className="num px-3 py-3.5">{r.snoozes}</td><td className="num px-3 py-3.5">{r.wrong_answers}</td><td className="px-3 py-3.5 text-mute">{titleCase(r.method)}</td>
                  <td className="num px-3 py-3.5">{r.alertness ?? '—'}</td><td className="num px-5 py-3.5">{r.seconds_to_dismiss != null ? `${r.seconds_to_dismiss}s` : '—'}</td>
                </tr>))}</tbody></table></div>
          )}
        </Card>
      </>)}
    </div>
  )
}
