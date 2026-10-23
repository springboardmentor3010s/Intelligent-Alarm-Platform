import { useState } from 'react'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import client from '../../api/client'
import { KIND_ICON } from '../../components/NotificationBell'
import { Button, Card, EmptyState, PageHeader, Segmented, Skeleton, cx, useAsync } from '../../components/ui'
import { fmtDateTime, titleCase } from '../../lib/format'

export default function Notifications() {
  const [filter, setFilter] = useState('all')
  const { data, loading, reload } = useAsync(async () => (await client.get(`/notifications?limit=100${filter === 'unread' ? '&unread_only=true' : ''}`)).data, [filter])
  const act = async (fn) => { await fn(); reload() }
  return (
    <div>
      <PageHeader title="Notifications" subtitle="Bedtime and wake-up reminders, habit alerts, progress updates and announcements."
        actions={<><Segmented id="nf" size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }]} />
          <Button size="sm" variant="secondary" icon={CheckCheck} onClick={() => act(() => client.post('/notifications/read-all'))}>Mark all read</Button></>} />
      {loading || !data ? <Skeleton className="h-80" /> : (
        <Card className="overflow-hidden">
          {data.items.length === 0 ? <EmptyState icon={Bell} title="Nothing here" body="You're all caught up." /> : (
            <ul className="divide-y divide-line">{data.items.map((n) => {
              const I = KIND_ICON[n.kind] || Bell
              return (
                <li key={n.id} className={cx('flex items-start gap-4 px-5 py-4', !n.is_read && 'bg-brand/5')}>
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface2 text-brand"><I className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{n.title}</p><span className="text-xs text-mute">{titleCase(n.kind)}</span></div><p className="mt-0.5 text-sm text-mute">{n.body}</p><p className="mt-1 text-xs text-mute/80">{fmtDateTime(n.created_at)}</p></div>
                  <div className="flex shrink-0 gap-1">
                    {!n.is_read && <button onClick={() => act(() => client.patch(`/notifications/${n.id}/read`))} aria-label="Mark as read" className="rounded-lg p-2 text-mute hover:bg-surface2 hover:text-ok"><CheckCheck className="h-4 w-4" /></button>}
                    <button onClick={() => act(() => client.delete(`/notifications/${n.id}`))} aria-label="Delete" className="rounded-lg p-2 text-mute hover:bg-bad/10 hover:text-bad"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>)
            })}</ul>
          )}
        </Card>
      )}
    </div>
  )
}
