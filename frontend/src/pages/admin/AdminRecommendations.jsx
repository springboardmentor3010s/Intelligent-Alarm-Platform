import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Lightbulb } from 'lucide-react'
import client from '../../api/client'
import { useTheme } from '../../context/ThemeContext'
import { Badge, Card, CardHeader, EmptyState, PageHeader, Skeleton, StatCard, useAsync } from '../../components/ui'
import { fmtDateTime, pct, titleCase } from '../../lib/format'

const CAT = { sleep: 'accent', wake: 'brand', habit: 'warn', productivity: 'ok', challenge: 'accent' }

export default function AdminRecommendations() {
  const { colors } = useTheme()
  const { data, loading } = useAsync(async () => (await client.get('/admin/recommendations')).data, [])
  if (loading || !data) return <div><PageHeader title="Recommendation monitoring" /><Skeleton className="h-96" /></div>
  const dismissed = data.by_category.reduce((a, c) => a + c.dismissed, 0)
  const chart = data.by_category.map((c) => ({ name: titleCase(c.category), Generated: c.count, Dismissed: c.dismissed }))
  return (
    <div className="space-y-6">
      <PageHeader title="Recommendation monitoring" subtitle="What the recommendation engine is telling users — and how often they dismiss it." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Generated" value={data.total} icon={Lightbulb} />
        <StatCard label="Dismissed" value={dismissed} tone="warn" />
        <StatCard label="Dismiss rate" value={data.total ? pct(dismissed / data.total) : '—'} hint="Lower usually means more relevant" tone="accent" className="col-span-2 lg:col-span-1" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6"><CardHeader title="By category" />
          {chart.length === 0 ? <EmptyState title="No recommendations yet" /> : <div className="h-64"><ResponsiveContainer><BarChart data={chart} margin={{ left: -22 }}><CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: colors.surface, border: `1px solid ${colors.grid}`, borderRadius: 12, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="Generated" fill={colors.brand} radius={[4, 4, 0, 0]} /><Bar dataKey="Dismissed" fill={colors.mute || colors.text} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}
        </Card>
        <Card className="p-6"><CardHeader title="Most recent" />
          {data.recent.length === 0 ? <EmptyState title="Nothing yet" /> : <ul className="divide-y divide-line">{data.recent.map((r) => (
            <li key={r.id} className="py-3"><div className="flex items-center justify-between gap-2"><Badge tone={CAT[r.category]}>{titleCase(r.category)}</Badge><span className="text-xs text-mute">{fmtDateTime(r.created_at)}</span></div><p className="mt-1.5 text-sm font-medium">{r.title}</p><p className="text-xs text-mute">for {r.user}{r.dismissed && ' · dismissed'}</p></li>))}</ul>}
        </Card>
      </div>
    </div>
  )
}
