import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlarmClock, Brain, Calendar, Pencil, Play, Plus, Trash2, Volume2 } from 'lucide-react'
import client, { errorMessage } from '../../api/client'
import { useAlarm, useNow } from '../../context/AlarmContext'
import { previewSound } from '../../lib/sound'
import { Badge, Button, Card, ChipGroup, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, Select, Skeleton, Toggle, cx, useAsync, useToast } from '../../components/ui'
import { DAYS, LEVELS, TYPE_LABEL, fmtClock, titleCase, to12, until } from '../../lib/format'

const TYPE_OPTS = [['daily', 'Every day'], ['weekday', 'Weekdays'], ['weekend', 'Weekends'], ['one_time', 'One time'], ['smart_adaptive', 'Smart adaptive']]
const PRESETS = { daily: [0, 1, 2, 3, 4, 5, 6], weekday: [0, 1, 2, 3, 4], weekend: [5, 6], smart_adaptive: [0, 1, 2, 3, 4, 5, 6] }
const BLANK = {
  label: 'Morning', time: '07:00', alarm_type: 'daily', repeat_days: PRESETS.daily, one_time_date: '', sound: 'classic', volume: 80,
  challenge_types: [], difficulty_override: '', verification_method: 'puzzle', max_snoozes: 2, snooze_minutes: 5, smart_window_minutes: 20, is_active: true,
}

function Editor({ open, onClose, alarm, meta, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState(BLANK)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    setError('')
    setF(alarm ? { ...BLANK, ...alarm, time: alarm.time.slice(0, 5), one_time_date: alarm.one_time_date || '', challenge_types: alarm.challenge_types || [], difficulty_override: alarm.difficulty_override || '' } : BLANK)
  }, [open, alarm])
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const setType = (t) => setF((s) => ({ ...s, alarm_type: t, repeat_days: PRESETS[t] || s.repeat_days }))
  const toggleDay = (d) => set('repeat_days', f.repeat_days.includes(d) ? f.repeat_days.filter((x) => x !== d) : [...f.repeat_days, d].sort())

  const save = async () => {
    setBusy(true); setError('')
    const body = {
      label: f.label, time: `${f.time}:00`, alarm_type: f.alarm_type, repeat_days: f.alarm_type === 'one_time' ? null : f.repeat_days,
      one_time_date: f.alarm_type === 'one_time' && f.one_time_date ? f.one_time_date : null, is_active: f.is_active, sound: f.sound, volume: Number(f.volume),
      challenge_types: f.challenge_types.length ? f.challenge_types : null, difficulty_override: f.difficulty_override || null,
      verification_method: f.verification_method, max_snoozes: Number(f.max_snoozes), snooze_minutes: Number(f.snooze_minutes), smart_window_minutes: Number(f.smart_window_minutes),
    }
    if (f.alarm_type !== 'one_time' && f.repeat_days.length === 0) { setBusy(false); return setError('Pick at least one day.') }
    try {
      if (alarm) await client.put(`/alarms/${alarm.id}`, body); else await client.post('/alarms', body)
      toast.success(alarm ? 'Alarm updated' : 'Alarm created')
      onSaved(); onClose()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} wide title={alarm ? 'Edit alarm' : 'New alarm'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>{alarm ? 'Save changes' : 'Create alarm'}</Button></>}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Label"><Input value={f.label} onChange={(e) => set('label', e.target.value)} maxLength={60} /></Field>
          <Field label="Time"><Input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} className="num text-lg" /></Field>
        </div>

        <Field label="Repeat">
          <div className="flex flex-wrap gap-2">{TYPE_OPTS.map(([v, l]) => <button key={v} type="button" onClick={() => setType(v)} className={cx('rounded-full border px-3.5 py-1.5 text-sm font-medium transition', f.alarm_type === v ? 'border-brand bg-brand/10 text-brand' : 'border-line text-mute hover:text-ink')}>{l}</button>)}</div>
        </Field>
        {f.alarm_type === 'one_time' ? (
          <Field label="Date" hint="Leave empty to ring at the next occurrence of this time."><Input type="date" value={f.one_time_date} onChange={(e) => set('one_time_date', e.target.value)} /></Field>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Days">{DAYS.map((d, i) => <button key={d} type="button" aria-pressed={f.repeat_days.includes(i)} onClick={() => toggleDay(i)} className={cx('h-10 w-12 rounded-xl border text-sm font-semibold transition', f.repeat_days.includes(i) ? 'border-brand bg-brand text-brandfg' : 'border-line text-mute hover:border-brand/40')}>{d}</button>)}</div>
        )}
        {f.alarm_type === 'smart_adaptive' && (
          <div className="rounded-2xl bg-accent/10 p-4">
            <p className="text-sm font-medium text-accent">Smart adaptive</p>
            <p className="mt-1 text-xs text-mute">Rings at the end of one of your sleep cycles (about 90 min each), based on your usual bedtime, within this window before your target time.</p>
            <Field label={`Window: up to ${f.smart_window_minutes} minutes early`}><input type="range" min="5" max="45" step="5" value={f.smart_window_minutes} onChange={(e) => set('smart_window_minutes', e.target.value)} className="mt-2 w-full accent-[rgb(var(--c-accent))]" /></Field>
          </div>
        )}

        <div>
          <p className="label">How do you prove you're awake?</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {meta.verification_methods.map((m) => (
              <button key={m.id} type="button" onClick={() => set('verification_method', m.id)} aria-pressed={f.verification_method === m.id}
                className={cx('rounded-xl border p-3.5 text-left transition', f.verification_method === m.id ? 'border-brand bg-brand/10' : 'border-line hover:border-brand/40')}>
                <p className="text-sm font-semibold">{titleCase(m.id)}</p><p className="mt-0.5 text-xs text-mute">{m.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sound"><div className="flex gap-2"><Select value={f.sound} onChange={(e) => set('sound', e.target.value)}>{meta.sounds.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select><Button variant="secondary" icon={Volume2} aria-label="Preview sound" onClick={() => previewSound(f.sound, f.volume)} /></div></Field>
          <Field label={`Volume — ${f.volume}%`}><input type="range" min="10" max="100" step="5" value={f.volume} onChange={(e) => set('volume', e.target.value)} className="mt-3 w-full accent-[rgb(var(--c-brand))]" /></Field>
          <Field label="Max snoozes" hint="0 disables snooze."><Select value={f.max_snoozes} onChange={(e) => set('max_snoozes', e.target.value)}>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
          <Field label="Snooze length"><Select value={f.snooze_minutes} onChange={(e) => set('snooze_minutes', e.target.value)}>{[1, 3, 5, 10, 15].map((n) => <option key={n} value={n}>{n} minutes</option>)}</Select></Field>
          <Field label="Difficulty"><Select value={f.difficulty_override} onChange={(e) => set('difficulty_override', e.target.value)}><option value="">Auto (adaptive)</option>{meta.levels.map((l) => <option key={l} value={l}>{titleCase(l)}</option>)}</Select></Field>
          <div className="self-end pb-2"><Toggle checked={f.is_active} onChange={(v) => set('is_active', v)} label="Alarm enabled" /></div>
        </div>
        <Field label="Challenge types for this alarm" hint="None selected = use your preferences from Settings."><ChipGroup value={f.challenge_types} onChange={(v) => set('challenge_types', v)} options={meta.challenge_types.map((v) => ({ value: v, label: TYPE_LABEL[v] }))} /></Field>
        {error && <p role="alert" className="rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">{error}</p>}
      </div>
    </Modal>
  )
}

export default function Alarms() {
  const toast = useToast()
  const { startTest, refreshSchedule, schedule } = useAlarm()
  useNow(30000)
  const { data, loading, reload } = useAsync(async () => {
    const [a, m] = await Promise.all([client.get('/alarms'), client.get('/alarms/meta')])
    return { alarms: a.data, meta: m.data }
  }, [])
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [del, setDel] = useState(null)

  const changed = () => { reload(); refreshSchedule() }
  const toggle = async (a) => { try { await client.post(`/alarms/${a.id}/toggle`); changed() } catch (e) { toast.error(errorMessage(e)) } }
  const remove = async () => { await client.delete(`/alarms/${del.id}`); setDel(null); toast.success('Alarm deleted'); changed() }
  const test = async (a) => { try { await startTest(a.id) } catch (e) { toast.error(errorMessage(e)) } }
  const openNew = () => { setEditing(null); setOpen(true) }
  const openEdit = (a) => { setEditing(a); setOpen(true) }

  return (
    <div>
      <PageHeader title="Alarms" subtitle="Create, edit and fine-tune every alarm. Test any alarm to feel exactly how it will ring."
        actions={<><Button variant="secondary" icon={Play} onClick={() => startTest()}>Test ring</Button><Button icon={Plus} onClick={openNew}>New alarm</Button></>} />
      {loading || !data ? <div className="grid gap-4 md:grid-cols-2">{[1, 2].map((i) => <Skeleton key={i} className="h-52" />)}</div> : data.alarms.length === 0 ? (
        <Card><EmptyState icon={AlarmClock} title="No alarms yet" body="Create your first alarm — it will ring right here, in real time, and won't stop until you solve the challenge." action={<Button icon={Plus} onClick={openNew}>Create alarm</Button>} /></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {data.alarms.map((a) => (
              <motion.div layout key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                <Card className={cx('flex h-full flex-col p-6 transition', !a.is_active && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="num text-5xl font-semibold tracking-tight">{to12(a.effective_time).replace(' ', '')}</p>
                      {a.alarm_type === 'smart_adaptive' && a.effective_time !== a.time.slice(0, 5) && <p className="mt-1 text-xs text-accent">Smart: rings early from your {to12(a.time.slice(0, 5))} target</p>}
                      <p className="mt-2 font-medium">{a.label}</p>
                    </div>
                    <Toggle checked={a.is_active} onChange={() => toggle(a)} label={<span className="sr-only">Enable {a.label}</span>} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Badge tone="brand">{titleCase(a.alarm_type)}</Badge>
                    <Badge tone="accent"><Brain className="h-3 w-3" />{titleCase(a.verification_method)}</Badge>
                    <Badge>{a.max_snoozes ? `${a.max_snoozes} snooze${a.max_snoozes > 1 ? 's' : ''}` : 'No snooze'}</Badge>
                    <Badge>{a.difficulty_override ? titleCase(a.difficulty_override) : 'Adaptive'}</Badge>
                  </div>
                  <div className="mt-4 flex gap-1" aria-label="Repeat days">
                    {a.one_time_date ? <span className="inline-flex items-center gap-1.5 text-xs text-mute"><Calendar className="h-3.5 w-3.5" />{new Date(a.one_time_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      : DAYS.map((d, i) => <span key={d} className={cx('grid h-7 w-8 place-items-center rounded-lg text-[11px] font-semibold', a.repeat_days.includes(i) ? 'bg-brand/15 text-brand' : 'bg-surface2 text-mute/50')}>{d[0]}</span>)}
                  </div>
                  <p className="mt-4 text-xs text-mute">{a.is_active && a.next_ring_at ? <>Next: {new Date(a.next_ring_at).toLocaleDateString(undefined, { weekday: 'short' })} {fmtClock(a.next_ring_at)} · in <span className="num">{until(a.next_ring_at, Date.now() + schedule.offsetMs)}</span></> : a.is_active ? 'No upcoming ring' : 'Paused'}</p>
                  <div className="mt-auto flex gap-2 pt-5">
                    <Button size="sm" variant="secondary" icon={Play} onClick={() => test(a)}>Test</Button>
                    <Button size="sm" variant="secondary" icon={Pencil} onClick={() => openEdit(a)}>Edit</Button>
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDel(a)} className="ml-auto text-bad hover:bg-bad/10 hover:text-bad" aria-label={`Delete ${a.label}`} />
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {data && <Editor open={open} onClose={() => setOpen(false)} alarm={editing} meta={data.meta} onSaved={changed} />}
      <ConfirmDialog open={!!del} danger title="Delete alarm?" body={`"${del?.label}" will be permanently removed. Past wake-up history is kept.`} confirmLabel="Delete" onConfirm={remove} onClose={() => setDel(null)} />
    </div>
  )
}
