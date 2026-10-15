import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import OAuthButtons from '../components/OAuthButtons'

const PUBLIC_ROLES = [
  { value: 'USER', label: 'User' },
  { value: 'WELLNESS_COACH', label: 'Wellness Coach' },
]

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'USER' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) return setError('Passwords do not match')
    if (form.password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true)
    try {
      await api.post('/auth/register', { name: form.name, email: form.email, password: form.password, role: form.role })
      setSuccess(true)
      setTimeout(() => navigate('/login', { state: { message: 'Account created! Please log in.' } }), 1500)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Registration failed')
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create your account</h2>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Start building sharper mornings today</p>
          </div>

          {success && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 p-3 rounded-xl mb-4 text-sm text-center">
              ✅ Account created! Redirecting to login…
            </div>
          )}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[['Full Name','name','text'],['Email','email','email']].map(([label, key, type]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
                <input type={type} required value={form[key]} onChange={set(key)} className="field" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Role</label>
              <select value={form.role} onChange={set('role')} className="field">
                {PUBLIC_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Administrator accounts are provisioned separately.</p>
            </div>
            {[['Password','password'],['Confirm Password','confirm']].map(([label, key]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
                <input type="password" required value={form[key]} onChange={set(key)} className="field" />
              </div>
            ))}
            <button type="submit" disabled={loading || success} className="btn-primary w-full !py-2.5">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
          <OAuthButtons />
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 dark:text-brand-400 hover:underline font-semibold">Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
