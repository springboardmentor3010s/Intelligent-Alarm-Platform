import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth, getDashboardPath } from '../context/AuthContext'
import OAuthButtons from '../components/OAuthButtons'

const OAUTH_ERROR_MESSAGES = {
  invalid_state: 'Login session expired, please try again.',
  provider_not_configured: 'That sign-in method is not available yet.',
  oauth_exchange_failed: 'Sign-in was cancelled or failed. Please try again.',
  no_email_from_provider: 'Your account has no public email — please use email/password login instead.',
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const successMsg = location.state?.message
  const oauthError = new URLSearchParams(location.search).get('oauth_error')

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const loggedInUser = await login(form.email, form.password)
      navigate(getDashboardPath(loggedInUser.role), { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-up">
        <Link to="/" className="flex items-center justify-center gap-2.5 font-bold text-lg mb-6 text-gray-800 dark:text-gray-100">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-[0_6px_16px_-6px_rgba(79,70,229,0.7)]">🧠</span>
          Cognitive<span className="text-gradient">Alarm</span>
        </Link>

        <div className="card p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h2>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Sign in to continue training your mind</p>
          </div>

          {successMsg && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 text-sm p-3 rounded-xl mb-4">
              ✅ {successMsg}
            </div>
          )}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl mb-4">
              ❌ {error}
            </div>
          )}
          {!error && oauthError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl mb-4">
              ❌ {OAUTH_ERROR_MESSAGES[oauthError] || 'Sign-in failed. Please try again.'}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
              <input type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com"
                className="field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
              <input type="password" required value={form.password} onChange={set('password')} placeholder="Your password"
                className="field" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full !py-2.5">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <OAuthButtons />

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            No account?{' '}
            <Link to="/register" className="text-brand-600 dark:text-brand-400 hover:underline font-semibold">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
