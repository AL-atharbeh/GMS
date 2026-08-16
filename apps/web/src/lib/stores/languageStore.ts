import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Lang = 'ar' | 'en'

interface LanguageState {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      lang: 'ar',
      setLang: (lang) => set({ lang }),
      toggleLang: () => set({ lang: get().lang === 'ar' ? 'en' : 'ar' }),
    }),
    {
      name: 'gms-lang',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
