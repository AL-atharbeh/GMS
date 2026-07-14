import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor — add auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    let token = localStorage.getItem('accessToken')
    
    // Proactively prevent session collisions: if requesting from super-admin pages,
    // always use the original admin token if impersonating.
    const isOnSuperAdminPage = window.location.pathname.startsWith('/super-admin')
    const originalAdminToken = localStorage.getItem('originalAdminToken')
    
    if (isOnSuperAdminPage && originalAdminToken) {
      token = originalAdminToken
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const isLoginRequest = originalRequest?.url?.includes('/auth/login')

    if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest) {
      originalRequest._retry = true

      // If this is a Super Admin session, don't try to refresh — just clear and stay on /super-admin
      const isSuperAdmin = typeof window !== 'undefined' && localStorage.getItem('isSuperAdmin') === 'true'
      const isOnSuperAdminPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/super-admin')

      if (isSuperAdmin || isOnSuperAdminPage) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('isSuperAdmin')
        // Stay on super-admin page — the page itself handles the login screen
        return Promise.reject(error)
      }

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        const refreshResponse = await axios.post(
          `${API_URL}/api/auth/refresh`,
          { refreshToken },
          { withCredentials: true }
        )
        const { accessToken } = refreshResponse.data.data
        localStorage.setItem('accessToken', accessToken)
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
