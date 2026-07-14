import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import api from '@/lib/api'

interface User {
  id: string
  name: string
  nameAr?: string
  email: string
  role: string
  avatar?: string
  branchId?: string
  preferredLanguage: 'AR' | 'EN'
}

interface Tenant {
  id: string
  name: string
  nameAr?: string
  slug: string
  status: string
  trialEndsAt?: string
  country: string
  currency: string
  logo?: string
}

interface Branch {
  id: string
  name: string
}

interface AuthState {
  user: User | null
  tenant: Tenant | null
  branch: Branch | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isHydrated: boolean

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
  setTenant: (tenant: Tenant) => void
  loadUser: () => Promise<void>
  setHydrated: (hydrated: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tenant: null,
      branch: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const response = await api.post('/auth/login', { email, password })
          const { user, tenant, branch, accessToken, tokens } = response.data.data

          localStorage.setItem('accessToken', accessToken)
          if (tokens?.refreshToken) {
            localStorage.setItem('refreshToken', tokens.refreshToken)
          }

          set({
            user,
            tenant,
            branch,
            accessToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: async () => {
        try {
          const refreshToken = localStorage.getItem('refreshToken')
          await api.post('/auth/logout', { refreshToken })
        } catch {}
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        set({
          user: null,
          tenant: null,
          branch: null,
          accessToken: null,
          isAuthenticated: false,
        })
        window.location.href = '/login'
      },

      setUser: (user) => set({ user }),
      setTenant: (tenant) => set({ tenant }),
      setHydrated: (hydrated) => set({ isHydrated: hydrated }),

      loadUser: async () => {
        try {
          const response = await api.get('/auth/me')
          const { user, tenant } = response.data.data || {}
          if (user && tenant) {
            set({ user, tenant, isAuthenticated: true })
          }
        } catch {
          get().logout()
        }
      },
    }),
    {
      name: 'gms-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        branch: state.branch,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    }
  )
)
