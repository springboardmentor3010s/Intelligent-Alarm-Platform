import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react'

export const cx = (...a) => a.filter(Boolean).join(' ')

/* ------------------------------ Logo ------------------------------ */
export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" className="fill-ink" />
      <path d="M10 42a22 22 0 0 1 44 0" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-brand" />
      <circle cx="32" cy="22" r="7" className="fill-brand" />
      <path d="M12 48h40" strokeWidth="4" strokeLinecap="round" className="stroke-accent" />
    </svg>
  )
}
export function Logo({ size = 28, className }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <span className="font-display text-xl font-semibold tracking-tight">Wakeful</span>
    </span>
  )
}

/* ------------------------------ Button ------------------------------ */
const BTN = {
  primary: 'bg-brand text-brandfg hover:brightness-110 shadow-sm',
  secondary: 'bg-surface2 text-ink border border-line hover:border-brand/50',
  ghost: 'text-mute hover:bg-surface2 hover:text-ink',
  danger: 'bg-bad/10 text-bad border border-bad/30 hover:bg-bad/20',
  outline: 'border border-line text-ink hover:border-brand/60 hover:text-brand',
}
const BTN_SIZE = { sm: 'px-3 py-1.5 text-xs gap-1.5', md: 'px-4 py-2.5 text-sm gap-2', lg: 'px-6 py-3.5 text-base gap-2.5' }

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      disabled={loading || rest.disabled}
      className={cx('inline-flex items-center justify-center rounded-xl font-medium transition-all active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-55', BTN[variant], BTN_SIZE[size], className)}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      {children}
    </button>
  )
}

/* ------------------------------ Surfaces ------------------------------ */
export const Card = ({ className, children, ...r }) => (
  <div className={cx('rounded-2xl border border-line bg-surface shadow-card', className)} {...r}>{children}</div>
)
export function CardHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {Icon && <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><Icon className="h-4 w-4" /></span>}
        <div>
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-mute">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-mute">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const TONES = {
  neutral: 'bg-surface2 text-mute', brand: 'bg-brand/12 text-brand', ok: 'bg-ok/12 text-ok',
  bad: 'bg-bad/12 text-bad', warn: 'bg-warn/15 text-warn', accent: 'bg-accent/12 text-accent',
}
export const Badge = ({ tone = 'neutral', className, children }) => (
  <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', TONES[tone], className)}>{children}</span>
)

export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', className }) {
  return (
    <Card className={cx('p-5', className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-mute">{label}</p>
        {Icon && <span className={cx('grid h-8 w-8 place-items-center rounded-lg', TONES[tone])}><Icon className="h-4 w-4" /></span>}
      </div>
      <p className="num mt-3 text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
    </Card>
  )
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand"><Icon className="h-7 w-7" /></span>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm text-mute">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export const Skeleton = ({ className }) => <div className={cx('animate-pulse rounded-xl bg-surface2', className)} />
export const Spinner = ({ className }) => <Loader2 className={cx('h-5 w-5 animate-spin text-brand', className)} />
export const FullPageLoader = () => (
  <div className="grid min-h-screen place-items-center"><div className="flex flex-col items-center gap-3"><LogoMark size={44} /><Spinner /></div></div>
)

/* ------------------------------ Form controls ------------------------------ */
export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div>
      {label && <label className="label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <p className="mt-1.5 text-xs text-bad">{error}</p> : hint ? <p className="mt-1.5 text-xs text-mute">{hint}</p> : null}
    </div>
  )
}
export const Input = ({ className, ...r }) => <input className={cx('input', className)} {...r} />
export const Select = ({ className, children, ...r }) => <select className={cx('input appearance-none pr-8', className)} {...r}>{children}</select>
export const Textarea = ({ className, ...r }) => <textarea className={cx('input min-h-[88px] resize-y', className)} {...r} />

export function Toggle({ checked, onChange, label, hint, disabled }) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-mute">{hint}</span>}
      </label>
      <button
        id={id} role="switch" aria-checked={checked} disabled={disabled} type="button" onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-brand' : 'bg-line')}
      >
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  )
}

export function Segmented({ options, value, onChange, id = 'seg', size = 'md' }) {
  return (
    <div role="tablist" className="inline-flex rounded-xl border border-line bg-surface2 p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button key={o.value} role="tab" aria-selected={active} type="button" onClick={() => onChange(o.value)}
            className={cx('relative rounded-lg font-medium transition-colors', size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm', active ? 'text-ink' : 'text-mute hover:text-ink')}>
            {active && <motion.span layoutId={`${id}-pill`} className="absolute inset-0 rounded-lg bg-surface shadow-sm" transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }} />}
            <span className="relative z-10 inline-flex items-center gap-1.5">{o.icon}{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ChipGroup({ options, value, onChange, min = 0 }) {
  const toggle = (v) => {
    if (value.includes(v)) { if (value.length > min) onChange(value.filter((x) => x !== v)) } else onChange([...value, v])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => toggle(o.value)}
            className={cx('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all', on ? 'border-brand bg-brand/10 text-brand' : 'border-line text-mute hover:border-brand/40 hover:text-ink')}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------ Modal ------------------------------ */
export function Modal({ open, onClose, title, children, footer, wide }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center">
          <motion.div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.1 }}
            className={cx('relative flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-line bg-surface shadow-2xl outline-none sm:rounded-3xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="text-xl font-semibold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-mute hover:bg-surface2 hover:text-ink"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onClose, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <p className="text-sm text-mute">{body}</p>
    </Modal>
  )
}

/* ------------------------------ Score ring ------------------------------ */
export function ScoreRing({ value, size = 160, stroke = 12, label = 'Habit score', empty }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value || 0))
  const tone = v >= 75 ? 'stroke-ok' : v >= 50 ? 'stroke-brand' : 'stroke-bad'
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />
        {!empty && (
          <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className={tone}
            strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v / 100) }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        )}
      </svg>
      <div className="absolute text-center">
        <div className="num text-4xl font-semibold">{empty ? '—' : Math.round(v)}</div>
        <div className="text-[11px] uppercase tracking-wider text-mute">{label}</div>
      </div>
    </div>
  )
}

export function ProgressBar({ value, tone = 'brand', label, right }) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div>
      {(label || right) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-mute">{label}</span>
          <span className="num font-medium">{value == null ? '—' : right ?? Math.round(v)}</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-surface2">
        <motion.div className={cx('h-full rounded-full', { brand: 'bg-brand', accent: 'bg-accent', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }[tone])}
          initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} />
      </div>
    </div>
  )
}

/* ------------------------------ Toasts ------------------------------ */
const ToastCtx = createContext(null)
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((kind, text) => {
    const id = Math.random().toString(36).slice(2)
    setItems((l) => [...l, { id, kind, text }])
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4500)
  }, [])
  const api = useRef({ success: (t) => push('ok', t), error: (t) => push('bad', t), info: (t) => push('info', t) })
  api.current = { success: (t) => push('ok', t), error: (t) => push('bad', t), info: (t) => push('info', t) }
  const icons = { ok: CheckCircle2, bad: AlertTriangle, info: Info }
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => {
            const I = icons[t.kind]
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }}
                className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
                <I className={cx('mt-0.5 h-5 w-5 shrink-0', t.kind === 'ok' ? 'text-ok' : t.kind === 'bad' ? 'text-bad' : 'text-accent')} />
                <p className="text-sm">{t.text}</p>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx).current

/* ------------------------------ misc hooks ------------------------------ */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try { setState({ data: await fn(), loading: false, error: null }) }
    catch (e) { setState({ data: null, loading: false, error: e }) }
  }, deps) // eslint-disable-line
  useEffect(() => { run() }, [run])
  return { ...state, reload: run, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) }
}
