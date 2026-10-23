import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BedDouble, Clock, Moon, Star, Trash2, TrendingUp } from 'lucide-react'
import client, { errorMessage } from '../../api/client'
import { useTheme } from '../../context/ThemeContext'
import { Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Skeleton, StatCard, cx, useAsync, useToast } from '../../components/ui'
import { fmtDate, mins, to12 } from '../../lib/format'

export function Rating({ value, onChange, icons, label }) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 5`} onClick={() => onChange(value === n ? null : n)}
          className={cx('grid h-11 w-11 place-items-center rounded-xl border text-lg transition', value >= n ? 'border-brand bg-brand/10' : 'border-line opacity-60 hover:opacity-100')}>
          {icons ? icons[n - 1] : <Star className={cx('h-5 w-5', value >= n ? 'fill-brand text-brand' : 'text-mute')} />}
        </button>
      ))}
    </div>
  )
}

const strength = (r) => { const a = Math.abs(r); return a >= 0.6 ? 'strong' : a >= 0.3 ? 'moderate' : 'weak' }

export default function Sleep() {
  const { colors } = useTheme()
  const toast = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({ log_date: today, bedtime: '23:00', wake_time: '07:00', quality: null, productivity: null })
  const [busy, setBusy] = useState(false)
  const { data, loading, reload } = useAsync(async () => {
    const [i, l] = await Promise.all([client.get('/insights/sleep?days=30'), client.get('/sleep?days=60')])
    return { i: i.data, logs: l.data }
  }, [])

  const save = async (e) => {
    e.preventDefault(); setBusy(true)
    try { await client.put('/sleep', { ...f, bedtime: `${f.bedtime}:00`, wake_time: `${f.wake_time}:00` }); toast.success('Sleep log saved'); reload() }
    catch (err) { toast.error(errorMessage(err)) } finally { setBusy(false) }
  }
  const remove = async (id) => { await client.delete(`/sleep/${id}`); reload() }

  if (loading || !data) return <div className="space-y-5"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>
  const s = data.i.sleep, p = data.i.productivity
  const series = (s.series || []).map((x) => ({ d: fmtDate(x.date), hours: +(x.duration / 60).toFixed(2), quality: x.quality, productivity: x.productivity }))

  return (
    <div className="space-y-6">
      <PageHeader title="Sleep & mood" subtitle="Log how you slept and how productive your day felt. Wakeful uses this for sleep analytics, your habit score and productivity insights." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <CardHeader title="Log a night" icon={BedDouble} />
          <form onSubmit={save} className="space-y-4">
            <Field label="Morning of" hint="The date you woke up."><Input type="date" value={f.log_date} max={today} onChange={(e) => setF({ ...f, log_date: e.target.value })} required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Went to bed"><Input type="time" className="num" value={f.bedtime} onChange={(e) => setF({ ...f, bedtime: e.target.value })} required /></Field>
              <Field label="Woke up"><Input type="time" className="num" value={f.wake_time} onChange={(e) => setF({ ...f, wake_time: e.target.value })} required /></Field>
            </div>
            <Field label="Sleep quality"><Rating label="Sleep quality" value={f.quality} onChange={(v) => setF({ ...f, quality: v })} /></Field>
            <Field label="Productivity that day" hint="Rate at the end of the day."><Rating label="Productivity" icons={['😴', '😐', '🙂', '😀', '🚀']} value={f.productivity} onChange={(v) => setF({ ...f, productivity: v })} /></Field>
            <Button type="submit" loading={busy} className="w-full">Save log</Button>
          </form>
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatCard label="Avg. sleep" value={s.n ? mins(s.avg_duration_minutes) : '—'} hint={`Target ${mins(s.target_minutes)}`} icon={Moon} tone="accent" />
          <StatCard label="Avg. bedtime" value={s.n ? to12(s.avg_bedtime).replace(' ', '') : '—'} hint={s.n > 1 ? `Varies ±${s.bedtime_regularity_minutes} min` : 'Log 2+ nights'} icon={Clock} />
          <StatCard label="Sleep debt (30d)" value={s.n ? mins(s.sleep_debt_minutes) : '—'} hint="Total shortfall vs. target" icon={TrendingUp} tone="warn" />
          <StatCard label="Avg. quality" value={s.avg_quality ?? '—'} hint="Out of 5" icon={Star} tone="ok" />
          <Card className="col-span-2 p-5">
            <CardHeader title="Does sleep drive your productivity?" subtitle={p.n >= 5 ? `Based on ${p.n} days` : undefined} />
            {p.correlations?.length ? (
              <ul className="space-y-4">{p.correlations.map((c) => (
                <li key={c.factor}>
                  <div className="mb-1.5 flex justify-between text-xs"><span className="font-medium">{c.factor}</span><span className="text-mute">r = <span className="num">{c.r}</span> · {strength(c.r)} {c.r >= 0 ? 'positive' : 'negative'}</span></div>
                  <div className="relative h-2 rounded-full bg-surface2"><span className="absolute left-1/2 top-[-3px] h-[14px] w-px bg-mute/50" />
                    <span className={cx('absolute top-0 h-2 rounded-full', c.r >= 0 ? 'bg-ok' : 'bg-bad')} style={{ left: c.r >= 0 ? '50%' : `${50 + c.r * 50}%`, width: `${Math.abs(c.r) * 50}%` }} /></div>
                </li>))}</ul>
            ) : <p className="text-sm text-mute">{p.note || 'Log sleep with a productivity rating for 5+ days to see how rest affects your output.'}</p>}
          </Card>
        </div>
      </div>

      <Card className="p-6">
        <CardHeader title="Sleep duration" subtitle="Hours slept per night vs. your target" />
        {series.length < 2 ? <EmptyState icon={Moon} title="Log a few nights to see your chart" /> : (
          <div className="h-72"><ResponsiveContainer>
            <ComposedChart data={series} margin={{ left: -18, right: 8 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="d" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 12]} />
              <Tooltip contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 12, fontSize: 12 }} />
              <ReferenceLine y={s.target_minutes / 60} stroke={colors.ok} strokeDasharray="5 4" label={{ value: 'Target', fill: colors.ok, fontSize: 11, position: 'insideTopRight' }} />
              <Bar dataKey="hours" name="Hours" fill={colors.accent} radius={[6, 6, 0, 0]} />
              <Line dataKey="productivity" name="Productivity (1-5)" stroke={colors.brand} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer></div>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader title="Recent logs" />
        {data.logs.length === 0 ? <p className="text-sm text-mute">Nothing logged yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mute"><th className="pb-3 pr-4">Date</th><th className="pb-3 pr-4">Bed → wake</th><th className="pb-3 pr-4">Duration</th><th className="pb-3 pr-4">Quality</th><th className="pb-3 pr-4">Productivity</th><th /></tr></thead>
            <tbody className="divide-y divide-line">{data.logs.slice(0, 14).map((l) => (
              <tr key={l.id}><td className="py-3 pr-4 font-medium">{fmtDate(l.log_date)}</td><td className="num py-3 pr-4">{l.bedtime} → {l.wake_time}</td><td className="num py-3 pr-4">{mins(l.duration_minutes)}</td><td className="py-3 pr-4">{l.quality ? '★'.repeat(l.quality) : '—'}</td><td className="py-3 pr-4">{l.productivity ? ['😴', '😐', '🙂', '😀', '🚀'][l.productivity - 1] : '—'}</td>
                <td className="py-3 text-right"><button onClick={() => remove(l.id)} aria-label="Delete log" className="text-mute hover:text-bad"><Trash2 className="h-4 w-4" /></button></td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
    </div>
  )
}
