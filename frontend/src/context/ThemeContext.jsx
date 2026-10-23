import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeCtx = createContext(null)
const KEY = 'wakeful-theme'

const PALETTE = {
  light: { brand: '#E2581C', accent: '#4F5BE8', ok: '#15803D', bad: '#C81E1E', warn: '#B45F06', grid: '#E2E6F1', text: '#5B6483', surface: '#FFFFFF' },
  dark: { brand: '#FF9457', accent: '#8C9EFF', ok: '#6FCF97', bad: '#FF6B6B', warn: '#FBBF24', grid: '#2A3262', text: '#98A2C7', surface: '#141A33' },
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem(KEY) || 'system')
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const resolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [resolved])

  const set = useCallback((m) => { localStorage.setItem(KEY, m); setMode(m) }, [])
  const value = useMemo(() => ({ mode, resolved, setMode: set, colors: PALETTE[resolved] }), [mode, resolved, set])
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)
