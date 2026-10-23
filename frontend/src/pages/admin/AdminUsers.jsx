import { useEffect, useState } from 'react'
import { Link2, Lock, Search, UserCheck, UserX } from 'lucide-react'
import client, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Select, Skeleton, useAsync, useToast } from '../../components/ui'
import { ROLE_LABEL, fmtDateTime } from '../../lib/format'

const PAGE = 20

function AssignModal({ open, onClose }) {
  const toast = useToast()
  const [coaches, setCoaches] = useState([])
  const [members, setMembers] = useState([])
  const [coach, setCoach] = useState('')
  const [member, setMember] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    Promise.all([client.get('/admin/users?role=wellness_coach&limit=100'), client.get('/admin/users?role=user&limit=100')]).then(([c, m]) => {
      setCoaches(c.data.items); setMembers(m.data.items); setCoach(c.data.items[0]?.id || ''); setMember(m.data.items[0]?.id || '')
    })
  }, [open])
  const go = async () => {
    setBusy(true)
    try { await client.post('/admin/assign', { coach_id: coach, member_id: member }); toast.success('Invitation sent — the member must accept before the coach can see any data.'); onClose() }
    catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Suggest a coach for a member" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={go} disabled={!coach || !member}>Send invitation</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-mute">The member receives an invitation and must accept it. Their data stays private until they do.</p>
        <Field label="Coach"><Select value={coach} onChange={(e) => setCoach(e.target.value)}>{coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name} — {c.email}</option>)}</Select></Field>
        <Field label="Member"><Select value={member} onChange={(e) => setMember(e.target.value)}>{members.map((c) => <option key={c.id} value={c.id}>{c.full_name} — {c.email}</option>)}</Select></Field>
        {coaches.length === 0 && <p className="text-sm text-warn">There are no approved coaches yet.</p>}
      </div>
    </Modal>
  )
}

export default function AdminUsers() {
  const { user: me } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(0)
  const [assign, setAssign] = useState(false)
  useEffect(() => { const t = setTimeout(() => { setDebounced(q); setPage(0) }, 300); return () => clearTimeout(t) }, [q])
  const { data, loading, reload } = useAsync(async () => (await client.get(`/admin/users?q=${encodeURIComponent(debounced)}&role=${role}&limit=${PAGE}&offset=${page * PAGE}`)).data, [debounced, role, page])

  const run = async (fn, ok) => { try { await fn(); toast.success(ok); reload() } catch (e) { toast.error(errorMessage(e)) } }
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1
  return (
    <div>
      <PageHeader title="Users" subtitle="Search, change roles, deactivate accounts and unlock users. Every action is written to the audit log."
        actions={<Button variant="secondary" icon={Link2} onClick={() => setAssign(true)}>Assign coach</Button>} />
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-[260px] flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" /><input className="input pl-10" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" /></div>
        <div className="w-52"><Select value={role} onChange={(e) => { setRole(e.target.value); setPage(0) }} aria-label="Filter by role"><option value="">All roles</option><option value="user">Members</option><option value="wellness_coach">Coaches</option><option value="admin">Administrators</option></Select></div>
      </div>
      <Card className="overflow-hidden">
        {loading && !data ? <Skeleton className="h-96" /> : data.items.length === 0 ? <EmptyState title="No users found" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-line bg-surface2/50 text-left text-xs uppercase tracking-wide text-mute"><th className="px-5 py-3">User</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Last sign-in</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-line">{data.items.map((u) => {
              const self = u.id === me.id
              return (
                <tr key={u.id} className="transition hover:bg-surface2/40">
                  <td className="px-5 py-3.5"><p className="font-medium">{u.full_name}{self && <span className="ml-2 text-xs text-mute">(you)</span>}</p><p className="text-xs text-mute">{u.email}{u.oauth_provider && ` · ${u.oauth_provider}`}</p></td>
                  <td className="px-3 py-3.5"><Select className="!w-44 !py-1.5 text-xs" value={u.role} disabled={self} aria-label={`Role of ${u.full_name}`} onChange={(e) => run(() => client.patch(`/admin/users/${u.id}/role`, { role: e.target.value }), 'Role updated')}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>{u.coach_requested && <Badge tone="warn" className="mt-1.5">Coach applicant</Badge>}</td>
                  <td className="px-3 py-3.5">{!u.is_active ? <Badge tone="bad">Deactivated</Badge> : u.locked ? <Badge tone="warn"><Lock className="h-3 w-3" />Locked</Badge> : <Badge tone="ok">Active</Badge>}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-xs text-mute">{u.last_login_at ? fmtDateTime(u.last_login_at) : 'Never'}</td>
                  <td className="px-5 py-3.5"><div className="flex justify-end gap-2">
                    {u.locked && <Button size="sm" variant="secondary" onClick={() => run(() => client.post(`/admin/users/${u.id}/unlock`), 'Account unlocked')}>Unlock</Button>}
                    {!self && <Button size="sm" variant={u.is_active ? 'danger' : 'secondary'} icon={u.is_active ? UserX : UserCheck} onClick={() => run(() => client.patch(`/admin/users/${u.id}/active`), u.is_active ? 'Account deactivated' : 'Account activated')}>{u.is_active ? 'Deactivate' : 'Activate'}</Button>}
                  </div></td>
                </tr>)
            })}</tbody></table></div>
        )}
        {data && <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-mute"><span>{data.total} user{data.total === 1 ? '' : 's'}</span><div className="flex items-center gap-2"><Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span className="num">{page + 1} / {pages}</span><Button size="sm" variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
      </Card>
      <AssignModal open={assign} onClose={() => setAssign(false)} />
    </div>
  )
}
