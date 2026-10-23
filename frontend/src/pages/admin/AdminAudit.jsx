import { useState } from 'react'
import { ScrollText } from 'lucide-react'
import client from '../../api/client'
import { Badge, Button, Card, EmptyState, PageHeader, Select, Skeleton, useAsync } from '../../components/ui'
import { fmtDateTime, titleCase } from '../../lib/format'

const PAGE = 30
const ACTIONS = ['login', 'login_failed', 'login_wrong_portal', 'login_oauth_google', 'register', 'role_changed', 'account_deactivated', 'account_activated', 'account_unlocked', 'account_deleted', 'password_changed', 'refresh_token_reuse', 'coach_approve', 'coach_reject', 'coach_assigned', 'coach_message', 'announcement']
const tone = (a) => (a.includes('failed') || a.includes('reuse') || a.includes('wrong') || a.includes('deactivated') || a.includes('deleted') ? 'bad' : a.startsWith('login') || a === 'register' ? 'ok' : 'accent')

export default function AdminAudit() {
  const [action, setAction] = useState('')
  const [page, setPage] = useState(0)
  const { data, loading } = useAsync(async () => (await client.get(`/admin/audit?limit=${PAGE}&offset=${page * PAGE}&action=${action}`)).data, [action, page])
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Security-relevant events: sign-ins, failed attempts, role changes and other administrative actions."
        actions={<div className="w-56"><Select value={action} onChange={(e) => { setAction(e.target.value); setPage(0) }} aria-label="Filter by action"><option value="">All events</option>{ACTIONS.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}</Select></div>} />
      <Card className="overflow-hidden">
        {loading && !data ? <Skeleton className="h-96" /> : data.items.length === 0 ? <EmptyState icon={ScrollText} title="No events" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-surface2/50 text-left text-xs uppercase tracking-wide text-mute"><th className="px-5 py-3">When</th><th className="px-3 py-3">Event</th><th className="px-3 py-3">Actor</th><th className="px-3 py-3">Target</th><th className="px-3 py-3">Detail</th><th className="px-5 py-3">IP</th></tr></thead>
            <tbody className="divide-y divide-line">{data.items.map((a) => (
              <tr key={a.id}><td className="whitespace-nowrap px-5 py-3 text-xs text-mute">{fmtDateTime(a.created_at)}</td><td className="px-3 py-3"><Badge tone={tone(a.action)}>{titleCase(a.action)}</Badge></td><td className="px-3 py-3">{a.actor || '—'}</td><td className="max-w-[220px] truncate px-3 py-3 text-mute">{a.target || '—'}</td><td className="px-3 py-3 text-mute">{a.detail || '—'}</td><td className="num px-5 py-3 text-xs text-mute">{a.ip || '—'}</td></tr>))}</tbody></table></div>
        )}
        {data && <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-mute"><span>{data.total} events</span><div className="flex items-center gap-2"><Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span className="num">{page + 1} / {pages}</span><Button size="sm" variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
      </Card>
    </div>
  )
}
