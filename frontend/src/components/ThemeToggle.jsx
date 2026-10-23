import { useEffect, useRef, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { cx } from './ui'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Adaptive (match device)', icon: Monitor },
]

export default function ThemeToggle({ className }) {
  const { mode, resolved, setMode } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const Icon = resolved === 'dark' ? Moon : Sun
  return (
    <div className={cx('relative', className)} ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Change theme" aria-expanded={open}
        className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-mute transition hover:text-ink">
        <Icon className="h-[18px] w-[18px]" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-card">
          {OPTIONS.map((o) => (
            <button key={o.value} onClick={() => { setMode(o.value); setOpen(false) }}
              className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition', mode === o.value ? 'bg-brand/10 text-brand' : 'text-ink hover:bg-surface2')}>
              <o.icon className="h-4 w-4" /><span className="flex-1">{o.label}</span>{mode === o.value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
