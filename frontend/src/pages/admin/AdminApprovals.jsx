import { Check, ClipboardCheck, X } from 'lucide-react'
import client, { errorMessage } from '../../api/client'
import { Button, Card, EmptyState, PageHeader, Skeleton, useAsync, useToast } from '../../components/ui'
import { fmtDateTime } from '../../lib/format'

export default function AdminApprovals() {
  const toast = useToast()
  const { data, loading, reload } = useAsync(async () => (await client.get('/admin/coach-requests')).data, [])
  const decide = async (id, d) => {
    try { await client.post(`/admin/coach-requests/${id}/${d}`); toast.success(d === 'approve' ? 'Coach approved' : 'Application declined'); reload() } catch (e) { toast.error(errorMessage(e)) }
  }
  return (
    <div>
      <PageHeader title="Coach approvals" subtitle="People who signed up as Wellness Coaches stay regular members until you approve them." />
      {loading || !data ? <Skeleton className="h-64" /> : data.length === 0 ? <Card><EmptyState icon={ClipboardCheck} title="No pending applications" body="New coach applications will appear here." /></Card> : (
        <div className="space-y-3">{data.map((u) => (
          <Card key={u.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div><p className="font-semibold">{u.full_name}</p><p className="text-sm text-mute">{u.email} · applied {fmtDateTime(u.created_at)}</p></div>
            <div className="flex gap-2"><Button icon={Check} onClick={() => decide(u.id, 'approve')}>Approve</Button><Button variant="danger" icon={X} onClick={() => decide(u.id, 'reject')}>Decline</Button></div>
          </Card>))}</div>
      )}
    </div>
  )
}
