'use client'

/**
 * Floating agent button, available on every signed-in page.
 *
 * Clicking the bubble opens a chat panel without leaving the page the user is
 * on — the same agent and the same conversations as /assistant, just reachable
 * from wherever they happen to be working.
 */
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useLanguageStore } from '@/lib/stores/languageStore'
import { useT } from '@/lib/i18n'
import {
  AssistantChatBody,
  NAVY,
  BLUE,
  useAssistantChat,
} from './AssistantChat'

/**
 * Routes that get no bubble: the signed-out pages, the public tracking link,
 * the platform console (its own auth and theme), and the assistant page
 * itself, where a floating copy of the same chat would be redundant.
 */
const HIDDEN_PREFIXES = [
  '/login',
  '/register',
  '/reset-password',
  '/track',
  '/super-admin',
  '/assistant',
]

export default function AssistantWidget() {
  const pathname = usePathname()
  const { isAuthenticated, isHydrated } = useAuthStore()
  const lang = useLanguageStore((s) => s.lang)
  const t = useT()
  const isAr = lang === 'ar'

  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const chat = useAssistantChat()
  const { loadStatus, loadConversations, startNewChat, status } = chat

  // Only talk to the API once the panel has actually been opened, so the
  // bubble costs nothing on pages where nobody uses it.
  useEffect(() => {
    if (open && !loaded) {
      loadStatus()
      loadConversations()
      setLoaded(true)
    }
  }, [open, loaded, loadStatus, loadConversations])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const hidden =
    !isHydrated ||
    !isAuthenticated ||
    HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))

  if (hidden) return null

  // Anchor to the side the language reads from.
  const side = isAr ? { left: 24 } : { right: 24 }

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('ai.title')}
          style={{
            position: 'fixed',
            bottom: 92,
            ...side,
            zIndex: 1000,
            width: 'min(390px, calc(100vw - 32px))',
            height: 'min(560px, calc(100vh - 140px))',
            background: '#fff',
            borderRadius: 16,
            border: '1px solid #e3e6ef',
            boxShadow: '0 18px 50px rgba(3, 4, 94, 0.18)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            direction: isAr ? 'rtl' : 'ltr',
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`,
              color: '#fff',
              padding: '13px 15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>{t('ai.title')}</div>
              <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 1 }}>
                {status
                  ? `${status.availableTools.length} ${isAr ? 'أداة متاحة' : 'tools available'}`
                  : t('ai.thinking')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onClick={startNewChat}
                title={t('ai.newChat')}
                aria-label={t('ai.newChat')}
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 8,
                  width: 28,
                  height: 28,
                  fontSize: 17,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                +
              </button>
              <button
                onClick={() => setOpen(false)}
                title={t('ai.close')}
                aria-label={t('ai.close')}
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 8,
                  width: 28,
                  height: 28,
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          </div>

          <AssistantChatBody chat={chat} compact />
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t('ai.title')}
        title={t('ai.title')}
        style={{
          position: 'fixed',
          bottom: 24,
          ...side,
          zIndex: 1000,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`,
          color: '#fff',
          boxShadow: '0 8px 24px rgba(3, 4, 94, 0.32)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.06)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 1 3 3v1h1a4 4 0 0 1 4 4v1a3 3 0 0 1 0 6v1a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-1a3 3 0 0 1 0-6V10a4 4 0 0 1 4-4h1V5a3 3 0 0 1 3-3z" />
            <circle cx="9.5" cy="13" r="1.3" fill="currentColor" stroke="none" />
            <circle cx="14.5" cy="13" r="1.3" fill="currentColor" stroke="none" />
          </svg>
        )}
      </button>
    </>
  )
}
