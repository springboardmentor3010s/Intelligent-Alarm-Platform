import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, HeartPulse, ShieldCheck, User } from 'lucide-react'
import client, { errorMessage } from '../api/client'
import { homeFor, useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import { Button, Field, Input, Segmented } from '../components/ui'

const PORTALS = [
  { value: 'member', label: 'Member', icon: <User className="h-4 w-4" />, text: 'Manage your alarms, sleep and habit progress.' },
  { value: 'coach', label: 'Coach', icon: <HeartPulse className="h-4 w-4" />, text: 'Support the members who shared their progress with you.' },
  { value: 'admin', label: 'Admin', icon: <ShieldCheck className="h-4 w-4" />, text: 'Manage users, approvals and platform health.' },
]

export function GoogleButton() {
  return (
    <a href="/api/auth/google/login" className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium transition hover:border-brand/50">
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" /><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
      Continue with Google
    </a>
  )
}

export default function Login() {
  const { login, user } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [portal, setPortal] = useState(params.get('portal') || 'member')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(params.get('error') ? 'Google sign-in failed. Please try again.' : '')
  const [busy, setBusy] = useState(false)
  const [google, setGoogle] = useState(false)

  useEffect(() => { client.get('/auth/providers').then((r) => setGoogle(r.data.google)).catch(() => {}) }, [])
  useEffect(() => { if (user) nav(homeFor(user, portal), { replace: true }) }, []) // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try { const u = await login(email.trim(), password, portal); nav(homeFor(u, portal), { replace: true }) }
    catch (err) { setError(errorMessage(err, 'Could not sign in.')) }
    finally { setBusy(false) }
  }
  const p = PORTALS.find((x) => x.value === portal)

  return (
    <AuthLayout title="Welcome back" subtitle={p.text}
      footer={<>New to Wakeful? <Link to="/register" className="font-semibold text-brand hover:underline">Create an account</Link></>}>
      <div className="mb-6"><Segmented id="portal" options={PORTALS} value={portal} onChange={setPortal} /></div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
        <Field label="Password" htmlFor="password">
          <div className="relative">
            <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" className="pr-11" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-ink">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </Field>
        {error && <p role="alert" className="rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">{error}</p>}
        <Button type="submit" size="lg" loading={busy} className="w-full">Sign in to {p.label} portal</Button>
      </form>
      {google && portal === 'member' && (<><div className="my-5 flex items-center gap-3 text-xs text-mute"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div><GoogleButton /></>)}
    </AuthLayout>
  )
}
