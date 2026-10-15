import { useEffect, useState } from 'react'
import api from '../services/api'

const PROVIDER_CONFIG = {
  google: { label: 'Continue with Google', icon: '🔵' },
  github: { label: 'Continue with GitHub', icon: '⚫' },
}

export default function OAuthButtons() {
  const [available, setAvailable] = useState({})

  useEffect(() => {
    api.get('/auth/oauth/providers')
      .then((res) => setAvailable(res.data))
      .catch(() => setAvailable({}))
  }, [])

  const enabledProviders = Object.keys(PROVIDER_CONFIG).filter((p) => available[p])
  if (enabledProviders.length === 0) return null

  const startOAuth = (provider) => {
    window.location.href = `${api.defaults.baseURL}/auth/oauth/${provider}/login`
  }

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="space-y-2">
        {enabledProviders.map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() => startOAuth(provider)}
            className="w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <span>{PROVIDER_CONFIG[provider].icon}</span>
            {PROVIDER_CONFIG[provider].label}
          </button>
        ))}
      </div>
    </div>
  )
}
