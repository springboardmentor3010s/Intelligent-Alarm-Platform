import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { homeFor, useAuth } from '../context/AuthContext'
import { FullPageLoader } from '../components/ui'

export default function AuthCallback() {
  const { loginWithSession } = useAuth()
  const nav = useNavigate()
  useEffect(() => {
    loginWithSession().then((u) => nav(homeFor(u), { replace: true })).catch(() => nav('/login?error=oauth', { replace: true }))
  }, []) // eslint-disable-line
  return <FullPageLoader />
}
