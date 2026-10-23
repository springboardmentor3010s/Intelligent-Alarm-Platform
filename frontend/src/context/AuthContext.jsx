import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import client, { refreshSession, setAccessToken, setAuthLostHandler } from '../api/client'

const AuthCtx = createContext(null)

export const homeFor = (user, portal) => {
  if (!user) return '/login'
  if (portal === 'admin' && user.role === 'admin') return '/app/admin'
  if (portal === 'coach' && user.role === 'wellness_coach') return '/app/coach'
  if (user.profile && !user.profile.onboarded) return '/onboarding'
  return '/app/dashboard'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const clear = useCallback(() => { setAccessToken(null); setUser(null) }, [])

  useEffect(() => {
    setAuthLostHandler(clear)
    refreshSession().then((d) => setUser(d.user)).catch(() => {}).finally(() => setLoading(false))
  }, [clear])

  const accept = (data) => { setAccessToken(data.access_token); setUser(data.user); return data.user }

  const login = async (email, password, portal) => accept((await client.post('/auth/login', { email, password, portal })).data)
  const register = async (full_name, email, password, account_type) =>
    accept((await client.post('/auth/register', { full_name, email, password, account_type })).data)
  const loginWithSession = async () => accept(await refreshSession())
  const logout = async () => { try { await client.post('/auth/logout') } catch { /* ignore */ } clear() }
  const refreshUser = useCallback(async () => { const { data } = await client.get('/users/me'); setUser(data); return data }, [])

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshUser, loginWithSession, setUser }), [user, loading, refreshUser]) // eslint-disable-line
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
