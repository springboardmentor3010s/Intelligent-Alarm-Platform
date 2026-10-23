import { useState } from 'react'
import { BarChart3, Brain, Download, FileSpreadsheet, FileText, Flame, Moon, TrendingUp } from 'lucide-react'
import { download, errorMessage } from '../../api/client'
import { Button, Card, PageHeader, Segmented, useToast } from '../../components/ui'

const REPORTS = [
  { kind: 'habit', icon: Flame, t: 'Habit report', d: 'Your weighted habit score and its four components, day by day.' },
  { kind: 'wake', icon: BarChart3, t: 'Wake-up report', d: 'Every alarm, status, snoozes, alertness and a weekday breakdown.' },
  { kind: 'challenge', icon: Brain, t: 'Challenge performance', d: 'Accuracy and speed by type and difficulty, plus the full attempt log.' },
  { kind: 'productivity', icon: TrendingUp, t: 'Productivity report', d: 'Daily productivity ratings and how they correlate with sleep and wake-ups.' },
  { kind: 'sleep', icon: Moon, t: 'Sleep analytics', d: 'Sleep duration, bedtime regularity, sleep debt and quality.' },
]

export default function Reports() {
  const toast = useToast()
  const [days, setDays] = useState(30)
  const [busy, setBusy] = useState(null)
  const get = async (kind, fmt) => {
    setBusy(`${kind}-${fmt}`)
    try { await download(`/reports/${kind}?format=${fmt}&days=${days}`, `wakeful_${kind}_report.${fmt === 'excel' ? 'xlsx' : 'pdf'}`); toast.success('Report downloaded') }
    catch (e) { toast.error(errorMessage(e, 'Could not generate the report.')) } finally { setBusy(null) }
  }
  return (
    <div>
      <PageHeader title="Reports" subtitle="Export your data as a polished PDF or an Excel workbook."
        actions={<Segmented id="rd" value={days} onChange={setDays} options={[{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }, { value: 365, label: '1 year' }]} />} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.kind} className="flex flex-col p-6">
            <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand"><r.icon className="h-5 w-5" /></span>
            <h2 className="text-xl font-semibold">{r.t}</h2><p className="mt-1.5 flex-1 text-sm text-mute">{r.d}</p>
            <div className="mt-5 flex gap-2.5">
              <Button size="sm" icon={FileText} loading={busy === `${r.kind}-pdf`} onClick={() => get(r.kind, 'pdf')}>PDF</Button>
              <Button size="sm" variant="secondary" icon={FileSpreadsheet} loading={busy === `${r.kind}-excel`} onClick={() => get(r.kind, 'excel')}>Excel</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
