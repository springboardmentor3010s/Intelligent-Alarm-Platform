import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log 422 details to console so they are visible during development
    if (error.response?.status === 422) {
      console.error('422 Validation Error:', JSON.stringify(error.response.data, null, 2))
    }
    return Promise.reject(error)
  }
)

export default api
