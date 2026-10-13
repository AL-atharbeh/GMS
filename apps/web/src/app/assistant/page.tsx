'use client'

import { useEffect, useState } from 'react'
import { useLanguageStore } from '@/lib/stores/languageStore'
import { useT } from '@/lib/i18n'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import {
  AssistantChatBody,
  NAVY,
  BLUE,
  useAssistantChat,
} from '@/components/assistant/AssistantChat'

/**
 * The layout is driven by inline styles, which outrank a stylesheet media
 * query, so the breakpoint is tracked in state instead.
 */
function useIsNarrow(breakpoint = 900): boolean {
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [breakpoint])

  return narrow
}

export default function AssistantPage() {
  const lang = useLanguageStore((s) => s.lang)
  const t = useT()
  const isAr = lang === 'ar'
  const isNarrow = useIsNarrow()

  const chat = useAssistantChat()
  const {
    conversations,
    conversationId,
    loadStatus,
    loadConversations,
    openConversation,
    startNewChat,
    deleteConversation,
  } = chat

  useEffect(() => {
    loadStatus()
    loadConversations()
  }, [loadStatus, loadConversations])

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#f5f6fa',
        direction: isAr ? 'rtl' : 'ltr',
      }}
    >
      <Sidebar />
      <div
        className="page-wrapper"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
      >
        <TopBar
          title={t('ai.title')}
          subtitle={t('ai.subtitle')}
          actions={
            <button
              onClick={startNewChat}
              style={{
                background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(3, 4, 94, 0.15)',
              }}
            >
              + {t('ai.newChat')}
            </button>
          }
        />

        <main
          style={{
            flex: 1,
            display: 'flex',
            gap: 16,
            padding: isNarrow ? 12 : 20,
            minHeight: 0,
            alignItems: 'stretch',
          }}
        >
          {/* Conversation list — dropped on narrow screens so the thread owns
              the width; "+ New chat" in the TopBar still starts a fresh one. */}
          {!isNarrow && (
            <aside
              style={{
                width: 240,
                flexShrink: 0,
                background: '#fff',
                borderRadius: 14,
                border: '1px solid #e8eaf0',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                overflowY: 'auto',
                maxHeight: 'calc(100vh - 160px)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#8b92a8',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  padding: '4px 6px 8px',
                }}
              >
                {t('ai.conversations')}
              </div>

              {conversations.length === 0 && (
                <div style={{ fontSize: 12.5, color: '#9aa1b5', padding: '6px' }}>
                  {t('ai.noConversations')}
                </div>
              )}

              {conversations.map((c) => {
                const active = c.id === conversationId
                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      background: active ? '#eef4ff' : 'transparent',
                      border: active ? '1px solid #cfe0ff' : '1px solid transparent',
                      borderRadius: 9,
                    }}
                  >
                    <button
                      onClick={() => openConversation(c.id)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: isAr ? 'right' : 'left',
                        background: 'transparent',
                        border: 'none',
                        padding: '9px 10px',
                        cursor: 'pointer',
                        fontSize: 12.5,
                        fontWeight: active ? 700 : 500,
                        color: active ? NAVY : '#4a5168',
                        lineHeight: 1.45,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        direction: isAr ? 'rtl' : 'ltr',
                      }}
                      title={c.title ?? ''}
                    >
                      {c.title || t('ai.newChat')}
                    </button>
                    <button
                      onClick={() => deleteConversation(c.id)}
                      aria-label={t('ai.deleteChat')}
                      title={t('ai.deleteChat')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#b4bace',
                        fontSize: 15,
                        lineHeight: 1,
                        padding: '7px 8px',
                        borderRadius: 7,
                        flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </aside>
          )}

          <section
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #e8eaf0',
              overflow: 'hidden',
              maxHeight: isNarrow ? 'calc(100vh - 120px)' : 'calc(100vh - 160px)',
              minHeight: 380,
            }}
          >
            <AssistantChatBody chat={chat} />
          </section>
        </main>
      </div>
    </div>
  )
}
