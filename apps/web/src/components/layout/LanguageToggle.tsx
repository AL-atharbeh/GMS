'use client'

import { useLanguageStore } from '@/lib/stores/languageStore'

export default function LanguageToggle({ style }: { style?: React.CSSProperties }) {
  const { lang, toggleLang } = useLanguageStore()

  return (
    <button
      type="button"
      onClick={toggleLang}
      title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 9999,
        border: '1px solid rgba(3, 4, 94, 0.15)',
        background: 'rgba(255, 255, 255, 0.7)',
        color: '#03045E',
        fontSize: 11,
        fontWeight: 800,
        cursor: 'pointer',
        outline: 'none',
        ...style,
      }}
    >
      <span>🌐</span>
      <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  )
}
