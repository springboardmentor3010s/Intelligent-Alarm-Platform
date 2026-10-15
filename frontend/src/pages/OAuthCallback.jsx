import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'

const ROLE_OPTIONS = [
  { value: 'USER', label: 'User — wake up & build habits' },
  { value: 'WELLNESS_COACH', label: 'Wellness Coach — guide other users' },
]

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return {}
  }
}

export default function OAuthCallback() {
  const [params] = useSearchParams()
  const [signup, setSignup] = useState(null) // { token, name, email, provider }
  const [role, setRole] = useState('USER')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = params.get('token')
    const signupToken = params.get('signup_token')
    const oauthError = params.get('error')

    if (token) {
      localStorage.setItem('token', token)
      // Full navigation (not react-router) so AuthContext re-initializes and picks up the new token
      window.location.href = '/dashboard'
    } else if (signupToken) {
      const payload = decodeJwtPayload(signupToken)
      setSignup({ token: signupToken, name: payload.name, email: payload.email, provider: payload.provider })
    } else {
      window.location.href = `/login?oauth_error=${encodeURIComponent(oauthError || 'oauth_failed')}`
    }
  }, [params])

  const handleComplete = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const r = await api.post('/auth/oauth/complete-registration', { signup_token: signup.token, role })
      localStorage.setItem('token', r.data.access_token)
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not complete registration. Please try again.')
      setSubmitting(false)
    }
  }

  if (signup) {
    const providerLabel = signup.provider === 'google' ? 'Google' : 'GitHub'
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center px-4 py-10">
        <div className="card p-8 w-full max-w-md animate-fade-up">
          <div className="text-center mb-6">
            <span className="grid place-items-center w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white text-2xl shadow-[0_8px_20px_-8px_rgba(79,70,229,0.7)]">🧠</span>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-3">Almost there{signup.name ? `, ${signup.name}` : ''}!</h2>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              Signing up with {providerLabel}{signup.email ? ` as ${signup.email}` : ''}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl mb-4">
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleComplete} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">I'm signing up as a…</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="field">
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Administrator accounts are provisioned separately.</p>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full !py-2.5">
              {submitting ? 'Creating your account…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center">
      <p className="text-gray-500 dark:text-gray-400 text-sm">Signing you in…</p>
    </div>
  )
}
