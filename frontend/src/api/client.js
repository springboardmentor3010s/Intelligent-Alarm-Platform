import axios from 'axios'

// The short-lived access token lives ONLY in memory (never localStorage), so XSS cannot steal a long-lived credential.
// The refresh token is an HttpOnly, SameSite=Strict cookie that JavaScript cannot read.
let accessToken = null
let onAuthLost = null
export const setAccessToken = (t) => { accessToken = t }
export const setAuthLostHandler = (fn) => { onAuthLost = fn }

const client = axios.create({ baseURL: '/api', withCredentials: true, timeout: 25000 })

client.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`
  return cfg
})

let refreshing = null
export function refreshSession() {
  refreshing ||= axios
    .post('/api/auth/refresh', null, { withCredentials: true, headers: { 'X-Requested-With': 'XMLHttpRequest' } })
    .then((r) => { accessToken = r.data.access_token; return r.data })
    .finally(() => { refreshing = null })
  return refreshing
}

client.interceptors.response.use(
  (r) => r,
  async (err) => {
    const orig = err.config
    if (err.response?.status === 401 && orig && !orig._retry && !String(orig.url).startsWith('/auth/')) {
      orig._retry = true
      try {
        await refreshSession()
        orig.headers.Authorization = `Bearer ${accessToken}`
        return client(orig)
      } catch {
        accessToken = null
        onAuthLost?.()
      }
    }
    return Promise.reject(err)
  },
)

export function errorMessage(e, fallback = 'Something went wrong. Please try again.') {
  const d = e?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x) => (x.msg || '').replace(/^Value error, /, '')).filter(Boolean).join(' ') || fallback
  if (e?.code === 'ECONNABORTED' || !e?.response) return 'Can\'t reach the server. Check your connection.'
  if (e.response.status === 429) return 'Too many requests. Please wait a moment.'
  return fallback
}

export async function download(path, filename) {
  const res = await client.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default client
