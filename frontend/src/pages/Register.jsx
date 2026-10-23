import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, HeartPulse, User } from 'lucide-react'
import client, { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import { GoogleButton } from './Login'
import { Button, Field, Input, cx } from '../components/ui'

function strength(pw) {
  let s = 0
  if (pw.length >= 10) s++
  if (pw.length >= 14) s++
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) s++
  return s
}

export default function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ full_name: '', email: '', password: '', account_type: 'member' })
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [google, setGoogle] = useState(false)
  useEffect(() => { client.get('/auth/providers').then((r) => setGoogle(r.data.google)).catch(() => {}) }, [])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const sc = useMemo(() => strength(f.password), [f.password])
  const ok = f.password.length >= 10 && /[A-Za-z]/.test(f.password) && /\d/.test(f.password)

  const submit = async (e) => {
    e.preventDefault()
    if (!ok) return setError('Use at least 10 characters including a letter and a number.')
    setError(''); setBusy(true)
    try { await register(f.full_name.trim(), f.email.trim(), f.password, f.account_type); nav('/onboarding', { replace: true }) }
    catch (err) { setError(errorMessage(err, 'Could not create your account.')) }
    finally { setBusy(false) }
  }

  const types = [
    { v: 'member', icon: User, t: 'Member', d: 'Wake up better' },
    { v: 'coach', icon: HeartPulse, t: 'Wellness Coach', d: 'Needs admin approval' },
  ]
  return (
    <AuthLayout title="Build the habit" subtitle="Create your account in under a minute."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-brand hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
          {types.map((t) => (
            <button key={t.v} type="button" role="radio" aria-checked={f.account_type === t.v} onClick={() => setF({ ...f, account_type: t.v })}
              className={cx('rounded-2xl border p-4 text-left transition', f.account_type === t.v ? 'border-brand bg-brand/10' : 'border-line hover:border-brand/40')}>
              <t.icon className={cx('mb-2 h-5 w-5', f.account_type === t.v ? 'text-brand' : 'text-mute')} />
              <p className="text-sm font-semibold">{t.t}</p><p className="text-xs text-mute">{t.d}</p>
            </button>
          ))}
        </div>
        <Field label="Full name" htmlFor="name"><Input id="name" required autoComplete="name" value={f.full_name} onChange={set('full_name')} placeholder="Ashish Sharma" maxLength={120} /></Field>
        <Field label="Email" htmlFor="email"><Input id="email" type="email" required autoComplete="email" value={f.email} onChange={set('email')} placeholder="you@example.com" /></Field>
        <Field label="Password" htmlFor="pw" hint="At least 10 characters with a letter and a number.">
          <div className="relative">
            <Input id="pw" type={show ? 'text' : 'password'} required autoComplete="new-password" value={f.password} onChange={set('password')} className="pr-11" maxLength={128} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          <div className="mt-2 flex gap-1.5" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className={cx('h-1.5 flex-1 rounded-full transition-colors', i < sc ? (sc <= 1 ? 'bg-bad' : sc <= 2 ? 'bg-warn' : 'bg-ok') : 'bg-line')} />)}</div>
        </Field>
        {f.account_type === 'coach' && <p className="rounded-xl bg-accent/10 px-3.5 py-2.5 text-xs text-accent">You'll start as a member. An administrator reviews coach applications — you'll be notified when approved.</p>}
        {error && <p role="alert" className="rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">{error}</p>}
        <Button type="submit" size="lg" loading={busy} className="w-full">Create account</Button>
      </form>
      {google && (<><div className="my-5 flex items-center gap-3 text-xs text-mute"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div><GoogleButton /></>)}
    </AuthLayout>
  )
}
