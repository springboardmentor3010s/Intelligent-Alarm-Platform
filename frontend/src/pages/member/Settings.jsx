import { useEffect, useState } from 'react'
import { Check, KeyRound, Monitor, Moon, ShieldAlert, Sun, UserRound, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import client, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Badge, Button, Card, CardHeader, ChipGroup, ConfirmDialog, EmptyState, Field, Input, PageHeader, Segmented, Select, Skeleton, Toggle, cx, useAsync, useToast } from '../../components/ui'
import { LEVELS, ROLE_LABEL, TYPE_LABEL, fmtDate, titleCase } from '../../lib/format'

const hm = (t) => (t ? t.slice(0, 5) : '')

function ProfileTab({ meta }) {
  const { user, setUser, refreshUser } = useAuth()
  const toast = useToast()
  const p = user.profile
  const [name, setName] = useState(user.full_name)
  const [f, setF] = useState({ wake: hm(p.preferred_wake_time), bed: hm(p.bedtime), hours: p.sleep_duration_minutes / 60, tz: p.timezone, goal: p.productivity_goal || '', streak: p.wake_goal_streak })
  const [busy, setBusy] = useState(false)
  const save = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      if (name.trim() !== user.full_name) await client.patch('/users/me/name', { full_name: name.trim() })
      await client.put('/users/me/profile', {
        preferred_wake_time: f.wake ? `${f.wake}:00` : null, bedtime: f.bed ? `${f.bed}:00` : null, sleep_duration_minutes: Math.round(f.hours * 60), timezone: f.tz,
        productivity_goal: f.goal || null, wake_goal_streak: Number(f.streak), difficulty_preference: p.difficulty_preference,
        preferred_challenge_types: p.preferred_challenge_types, bedtime_reminders: p.bedtime_reminders, browser_notifications: p.browser_notifications,
      })
      await refreshUser(); toast.success('Profile saved')
    } catch (err) { toast.error(errorMessage(err)) } finally { setBusy(false) }
  }
  return (
    <Card className="p-6"><CardHeader title="Profile & sleep schedule" icon={UserRound} />
      <form onSubmit={save} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required /></Field>
          <Field label="Email"><Input value={user.email} disabled /></Field>
          <Field label="Preferred wake-up time"><Input type="time" className="num" value={f.wake} onChange={(e) => setF({ ...f, wake: e.target.value })} /></Field>
          <Field label="Usual bedtime"><Input type="time" className="num" value={f.bed} onChange={(e) => setF({ ...f, bed: e.target.value })} /></Field>
          <Field label={`Sleep target — ${f.hours} h`}><input type="range" min="4" max="12" step="0.5" value={f.hours} onChange={(e) => setF({ ...f, hours: Number(e.target.value) })} className="mt-3 w-full accent-[rgb(var(--c-brand))]" /></Field>
          <Field label="Time zone"><Select value={f.tz} onChange={(e) => setF({ ...f, tz: e.target.value })}>{(meta.timezones.includes(f.tz) ? meta.timezones : [f.tz, ...meta.timezones]).map((z) => <option key={z}>{z}</option>)}</Select></Field>
          <Field label="Productivity goal"><Input value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} maxLength={200} placeholder="What should your mornings unlock?" /></Field>
          <Field label={`Wake-up goal — ${f.streak} days in a row`}><input type="range" min="3" max="90" value={f.streak} onChange={(e) => setF({ ...f, streak: e.target.value })} className="mt-3 w-full accent-[rgb(var(--c-brand))]" /></Field>
        </div>
        <Button type="submit" loading={busy}>Save profile</Button>
      </form>
    </Card>
  )
}

function PrefsTab({ meta }) {
  const { user, refreshUser } = useAuth()
  const { mode, setMode } = useTheme()
  const toast = useToast()
  const p = user.profile
  const [f, setF] = useState({ diff: p.difficulty_preference, types: p.preferred_challenge_types, bed: p.bedtime_reminders, browser: p.browser_notifications })
  const [busy, setBusy] = useState(false)
  const perm = 'Notification' in window ? Notification.permission : 'unsupported'
  const [permission, setPermission] = useState(perm)
  const save = async () => {
    setBusy(true)
    try {
      await client.put('/users/me/profile', {
        preferred_wake_time: p.preferred_wake_time, bedtime: p.bedtime, sleep_duration_minutes: p.sleep_duration_minutes, timezone: p.timezone, productivity_goal: p.productivity_goal,
        wake_goal_streak: p.wake_goal_streak, difficulty_preference: f.diff, preferred_challenge_types: f.types, bedtime_reminders: f.bed, browser_notifications: f.browser,
      })
      await refreshUser(); toast.success('Preferences saved')
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }
  const askPerm = async () => setPermission(await Notification.requestPermission())
  return (
    <div className="space-y-6">
      <Card className="p-6"><CardHeader title="Appearance" subtitle="Adaptive follows your device and switches automatically at sunset." />
        <Segmented id="theme" value={mode} onChange={setMode} options={[{ value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> }, { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> }, { value: 'system', label: 'Adaptive', icon: <Monitor className="h-4 w-4" /> }]} />
      </Card>
      <Card className="p-6"><CardHeader title="Challenges" />
        <div className="space-y-5">
          <Field label="Difficulty" hint="Auto adapts across 5 levels from your accuracy, speed and snoozes."><Select value={f.diff} onChange={(e) => setF({ ...f, diff: e.target.value })}><option value="auto">Auto (adaptive)</option>{LEVELS.map((l) => <option key={l} value={l}>{titleCase(l)}</option>)}</Select></Field>
          <Field label="Preferred challenge types"><ChipGroup min={1} value={f.types} onChange={(v) => setF({ ...f, types: v })} options={meta.challenge_types.map((v) => ({ value: v, label: TYPE_LABEL[v] }))} /></Field>
        </div>
      </Card>
      <Card className="p-6"><CardHeader title="Notifications" />
        <div className="space-y-5">
          <Toggle checked={f.bed} onChange={(v) => setF({ ...f, bed: v })} label="Bedtime reminders" hint="30 minutes before your bedtime." />
          <Toggle checked={f.browser} onChange={(v) => setF({ ...f, browser: v })} label="Browser notifications" hint="Alert me when an alarm rings while this tab is in the background." />
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface2/60 p-4 text-sm">
            <span>Browser permission:</span>
            <Badge tone={permission === 'granted' ? 'ok' : permission === 'denied' ? 'bad' : 'warn'}>{permission === 'unsupported' ? 'Not supported' : titleCase(permission)}</Badge>
            {permission === 'default' && <Button size="sm" onClick={askPerm}>Allow</Button>}
            {permission === 'denied' && <span className="text-xs text-mute">Re-enable it in your browser's site settings.</span>}
          </div>
        </div>
      </Card>
      <Button onClick={save} loading={busy}>Save preferences</Button>
    </div>
  )
}

function CoachingTab() {
  const { user } = useAuth()
  const toast = useToast()
  const { data, loading, reload } = useAsync(async () => (await client.get('/users/me/coach-links')).data, [])
  const respond = async (id, accept) => { await client.post(`/users/me/coach-links/${id}/respond`, { accept }); toast.success(accept ? 'Coach can now see your progress' : 'Invitation declined'); reload() }
  const revoke = async (id) => { await client.delete(`/users/me/coach-links/${id}`); toast.success('Access removed'); reload() }
  return (
    <Card className="p-6"><CardHeader title="Coaching & data sharing" subtitle="A coach can only see your progress after you accept their invitation. You can revoke access at any time." />
      {user.coach_requested && <p className="mb-4 rounded-xl bg-accent/10 p-3 text-sm text-accent">Your Wellness Coach application is awaiting administrator approval.</p>}
      {loading ? <Skeleton className="h-24" /> : data.length === 0 ? <EmptyState title="No coaches" body="When a coach invites you, the invitation appears here." /> : (
        <ul className="space-y-3">{data.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
            <div><p className="font-medium">{l.coach_name}</p><p className="text-xs text-mute">{l.coach_email} · invited {fmtDate(l.created_at)} {l.invited_by === 'admin' && '(suggested by an administrator)'}</p></div>
            {l.status === 'pending' ? <div className="flex gap-2"><Button size="sm" icon={Check} onClick={() => respond(l.id, true)}>Accept</Button><Button size="sm" variant="secondary" icon={X} onClick={() => respond(l.id, false)}>Decline</Button></div>
              : <div className="flex items-center gap-3"><Badge tone="ok">Sharing</Badge><Button size="sm" variant="danger" onClick={() => revoke(l.id)}>Stop sharing</Button></div>}
          </li>))}</ul>
      )}
    </Card>
  )
}

function SecurityTab() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [pw, setPw] = useState({ current_password: '', new_password: '' })
  const [busy, setBusy] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [delPw, setDelPw] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [delErr, setDelErr] = useState('')
  const change = async (e) => {
    e.preventDefault(); setBusy(true)
    try { await client.post('/users/me/password', pw); setPw({ current_password: '', new_password: '' }); toast.success('Password changed. Other devices were signed out.') }
    catch (err) { toast.error(errorMessage(err)) } finally { setBusy(false) }
  }
  const out = async () => { await client.post('/auth/logout-all'); await logout(); nav('/login') }
  const remove = async () => {
    setDelBusy(true); setDelErr('')
    try { await client.request({ method: 'DELETE', url: '/users/me', data: { password: delPw } }); await logout(); nav('/') }
    catch (e) { setDelErr(errorMessage(e)); setDelBusy(false) }
  }
  return (
    <div className="space-y-6">
      <Card className="p-6"><CardHeader title="Change password" icon={KeyRound} subtitle={user.has_password ? undefined : `You signed in with ${titleCase(user.oauth_provider)}. Set a password to also sign in with email.`} />
        <form onSubmit={change} className="max-w-md space-y-4">
          {user.has_password && <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required /></Field>}
          <Field label="New password" hint="At least 10 characters with a letter and a number."><Input type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} minLength={10} required /></Field>
          <Button type="submit" loading={busy}>Update password</Button>
        </form>
      </Card>
      <Card className="p-6"><CardHeader title="Sessions" subtitle="Sign out of every device where you're logged in." /><Button variant="secondary" onClick={out}>Sign out everywhere</Button></Card>
      <Card className="border-bad/30 p-6"><CardHeader title="Delete account" icon={ShieldAlert} subtitle="Permanently deletes your profile, alarms, history, sleep logs and coach links. This cannot be undone." /><Button variant="danger" onClick={() => setDelOpen(true)}>Delete my account</Button></Card>
      <ConfirmDialog open={delOpen} danger title="Delete your account?" confirmLabel="Delete forever" loading={delBusy} onConfirm={remove} onClose={() => setDelOpen(false)}
        body={<span className="block space-y-3"><span className="block">This permanently removes all of your data.</span>{user.has_password && <Input type="password" placeholder="Confirm your password" value={delPw} onChange={(e) => setDelPw(e.target.value)} />}{delErr && <span className="block text-bad">{delErr}</span>}</span>} />
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const [tab, setTab] = useState('profile')
  const { data: meta } = useAsync(async () => (await client.get('/alarms/meta')).data, [])
  return (
    <div>
      <PageHeader title="Settings" subtitle={`${user.email} · ${ROLE_LABEL[user.role]}`} />
      <div className="mb-6 overflow-x-auto"><Segmented id="st" value={tab} onChange={setTab} options={[{ value: 'profile', label: 'Profile' }, { value: 'prefs', label: 'Preferences' }, { value: 'coaching', label: 'Coaching' }, { value: 'security', label: 'Security' }]} /></div>
      {!meta ? <Skeleton className="h-96" /> : <div className="max-w-3xl">{tab === 'profile' && <ProfileTab meta={meta} />}{tab === 'prefs' && <PrefsTab meta={meta} />}{tab === 'coaching' && <CoachingTab />}{tab === 'security' && <SecurityTab />}</div>}
    </div>
  )
}
