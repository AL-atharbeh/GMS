'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useLanguageStore } from '@/lib/stores/languageStore'
import { useT } from '@/lib/i18n'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

interface Quota {
  limit: number
  used: number
  remaining: number
  percentUsed: number
  exceeded: boolean
  nearLimit: boolean
}

interface StatusPayload {
  enabled: boolean
  configured: boolean
  provider: string
  availableTools: string[]
  quota: Quota
}

interface PendingAction {
  id: string
  toolName: string
  summary: string
  summaryAr: string | null
  input: Record<string, unknown>
}

interface ChatMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  text: string
  toolsUsed?: string[]
  pendingAction?: PendingAction | null
  /** Set once the user has resolved the attached pending action. */
  actionOutcome?: 'EXECUTED' | 'REJECTED' | 'FAILED'
  actionError?: string
}

interface ConversationSummary {
  id: string
  title: string | null
  lastMessageAt: string
  _count: { messages: number }
}

const NAVY = '#03045e'
const BLUE = '#0077b6'

/** Tool names as the user should read them, not as the model names them. */
const TOOL_LABELS: Record<string, { ar: string; en: string }> = {
  get_work_order: { ar: 'قراءة أمر عمل', en: 'read work order' },
  search_work_orders: { ar: 'بحث أوامر العمل', en: 'search work orders' },
  get_vehicle_history: { ar: 'تاريخ السيارة', en: 'vehicle history' },
  find_similar_faults: { ar: 'أعطال مشابهة في سجلّك', en: 'similar past faults' },
  check_part_availability: { ar: 'توفّر قطعة', en: 'part availability' },
  get_financial_summary: { ar: 'ملخّص مالي', en: 'financial summary' },
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

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
  const { user } = useAuthStore()
  const lang = useLanguageStore((s) => s.lang)
  const t = useT()
  const isAr = lang === 'ar'
  const isNarrow = useIsNarrow()

  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolvingAction, setResolvingAction] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get('/ai/status')
      setStatus(res.data.data)
    } catch {
      setStatus(null)
    }
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get('/ai/conversations')
      setConversations(res.data.data ?? [])
    } catch {
      setConversations([])
    }
  }, [])

  useEffect(() => {
    loadStatus()
    loadConversations()
  }, [loadStatus, loadConversations])

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  const openConversation = useCallback(async (id: string) => {
    setError(null)
    try {
      const res = await api.get(`/ai/conversations/${id}`)
      const data = res.data.data
      const pending: PendingAction[] = data.pendingActions ?? []

      const loaded: ChatMessage[] = (data.messages ?? []).map(
        (m: { id: string; role: 'USER' | 'ASSISTANT'; text: string }) => ({
          id: m.id,
          role: m.role,
          text: m.text,
        })
      )

      // A still-open confirmation belongs with the last assistant turn.
      if (pending.length) {
        for (let i = loaded.length - 1; i >= 0; i -= 1) {
          if (loaded[i].role === 'ASSISTANT') {
            loaded[i] = { ...loaded[i], pendingAction: pending[0] }
            break
          }
        }
      }

      setMessages(loaded)
      setConversationId(id)
    } catch {
      setError(t('ai.error'))
    }
  }, [t])

  const startNewChat = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setError(null)
    inputRef.current?.focus()
  }, [])

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/ai/conversations/${id}`)
        setConversations((prev) => prev.filter((c) => c.id !== id))
        // Clear the thread only if the one on screen is the one removed.
        if (id === conversationId) {
          setConversationId(null)
          setMessages([])
        }
      } catch {
        setError(t('ai.error'))
      }
    },
    [conversationId, t]
  )

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    setError(null)
    setInput('')
    setSending(true)

    const localId = `local-${Date.now()}`
    setMessages((prev) => [...prev, { id: localId, role: 'USER', text }])

    try {
      const res = await api.post(
        '/ai/chat',
        {
          message: text,
          ...(conversationId ? { conversationId } : {}),
        },
        // Tell the agent which language the interface is in — the browser's
        // own accept-language says nothing about the toggle the user picked.
        { headers: { 'X-App-Language': lang } }
      )
      const data = res.data.data

      setConversationId(data.conversationId)
      setMessages((prev) => [
        ...prev,
        {
          id: `reply-${Date.now()}`,
          role: 'ASSISTANT',
          text: data.reply,
          toolsUsed: data.toolsUsed ?? [],
          pendingAction: data.pendingAction ?? null,
        },
      ])
      if (data.quota) {
        setStatus((s) => (s ? { ...s, quota: data.quota } : s))
      }
      loadConversations()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { code?: string; message?: string } } }
      const code = e.response?.data?.code
      setError(
        code === 'AI_QUOTA_EXCEEDED'
          ? t('ai.quotaExceeded')
          : code === 'AI_NOT_CONFIGURED'
            ? t('ai.notConfigured')
            : e.response?.data?.message || t('ai.error')
      )
      // Put the text back so a failed send is not lost.
      setInput(text)
      setMessages((prev) => prev.filter((m) => m.id !== localId))
    } finally {
      setSending(false)
    }
  }, [input, sending, conversationId, loadConversations, t, lang])

  const resolveAction = useCallback(
    async (messageId: string, actionId: string, approve: boolean) => {
      setResolvingAction(actionId)
      setError(null)
      try {
        const res = await api.post(`/ai/actions/${actionId}/confirm`, { approve })
        const outcome = res.data.data
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  pendingAction: null,
                  actionOutcome: outcome.status,
                  actionError: outcome.error,
                }
              : m
          )
        )
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } } }
        setError(e.response?.data?.message || t('ai.error'))
      } finally {
        setResolvingAction(null)
      }
    },
    [t]
  )

  const quota = status?.quota
  const blocked = Boolean(
    status && (!status.enabled || !status.configured || quota?.exceeded)
  )
  const blockReason = !status
    ? null
    : !status.enabled
      ? t('ai.disabled')
      : !status.configured
        ? t('ai.notConfigured')
        : quota?.exceeded
          ? t('ai.quotaExceeded')
          : null

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

          {/* Chat column */}
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
            {/* Quota strip */}
            {quota && (
              <div
                style={{
                  padding: '9px 16px',
                  borderBottom: '1px solid #eef0f5',
                  background: quota.exceeded
                    ? '#fff1f1'
                    : quota.nearLimit
                      ? '#fff8e8'
                      : '#fafbff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  fontSize: 12,
                }}
              >
                <span style={{ color: '#6b7390', fontWeight: 600 }}>
                  {t('usage.quotaUsed')}: {formatTokens(quota.used)} /{' '}
                  {formatTokens(quota.limit)} {t('usage.tokens')}
                </span>
                <div
                  style={{
                    flex: 1,
                    minWidth: 120,
                    height: 5,
                    background: '#e8eaf0',
                    borderRadius: 99,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(quota.percentUsed, 100)}%`,
                      height: '100%',
                      background: quota.exceeded
                        ? '#e03131'
                        : quota.nearLimit
                          ? '#f59f00'
                          : BLUE,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontWeight: 800,
                    color: quota.exceeded
                      ? '#c92a2a'
                      : quota.nearLimit
                        ? '#b37400'
                        : NAVY,
                  }}
                >
                  {quota.percentUsed}%
                </span>
              </div>
            )}

            {/* Messages */}
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {messages.length === 0 && (
                <div
                  style={{
                    margin: 'auto',
                    textAlign: 'center',
                    maxWidth: 420,
                    padding: 20,
                  }}
                >
                  <div style={{ fontSize: 34, marginBottom: 10 }}>🔧</div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: NAVY,
                      marginBottom: 7,
                    }}
                  >
                    {t('ai.emptyTitle')}
                  </div>
                  <div style={{ fontSize: 13, color: '#7b839c', lineHeight: 1.75 }}>
                    {t('ai.emptyBody')}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div
                    style={{
                      alignSelf: m.role === 'USER' ? 'flex-start' : 'flex-end',
                      maxWidth: '82%',
                      background: m.role === 'USER' ? '#eef4ff' : '#f7f8fc',
                      border: `1px solid ${m.role === 'USER' ? '#d9e6ff' : '#e9ebf2'}`,
                      borderRadius: 13,
                      padding: '11px 14px',
                      fontSize: 13.5,
                      lineHeight: 1.85,
                      color: '#2b3147',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      // Let each paragraph take its direction from its own
                      // first strong character, so an English answer inside an
                      // RTL page doesn't push its punctuation to the wrong end.
                      unicodeBidi: 'plaintext',
                      textAlign: 'start',
                    }}
                  >
                    {m.text}
                  </div>

                  {/* Which tools the answer was grounded in */}
                  {m.toolsUsed && m.toolsUsed.length > 0 && (
                    <div
                      style={{
                        alignSelf: 'flex-end',
                        marginTop: 5,
                        display: 'flex',
                        gap: 5,
                        flexWrap: 'wrap',
                        maxWidth: '82%',
                      }}
                    >
                      <span style={{ fontSize: 10.5, color: '#9aa1b5', fontWeight: 600 }}>
                        {t('ai.toolsUsed')}:
                      </span>
                      {m.toolsUsed.map((tool) => (
                        <span
                          key={tool}
                          style={{
                            fontSize: 10.5,
                            background: '#edf0f7',
                            color: '#5c6480',
                            borderRadius: 99,
                            padding: '2px 8px',
                            fontWeight: 600,
                          }}
                        >
                          {TOOL_LABELS[tool]
                            ? isAr
                              ? TOOL_LABELS[tool].ar
                              : TOOL_LABELS[tool].en
                            : tool}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Confirmation gate */}
                  {m.pendingAction && (
                    <div
                      style={{
                        alignSelf: 'flex-end',
                        marginTop: 9,
                        maxWidth: '82%',
                        background: '#fffdf5',
                        border: '1.5px solid #ffe08a',
                        borderRadius: 13,
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#8a6100',
                          marginBottom: 4,
                        }}
                      >
                        ⚠︎ {t('ai.confirmTitle')}
                      </div>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: '#2b3147',
                          marginBottom: 3,
                          lineHeight: 1.6,
                        }}
                      >
                        {isAr
                          ? m.pendingAction.summaryAr || m.pendingAction.summary
                          : m.pendingAction.summary}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#9a8450', marginBottom: 11 }}>
                        {t('ai.confirmBody')}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          disabled={resolvingAction === m.pendingAction.id}
                          onClick={() =>
                            resolveAction(m.id, m.pendingAction!.id, true)
                          }
                          style={{
                            background: '#2f9e44',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 16px',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            opacity: resolvingAction === m.pendingAction.id ? 0.6 : 1,
                          }}
                        >
                          ✓ {t('ai.approve')}
                        </button>
                        <button
                          disabled={resolvingAction === m.pendingAction.id}
                          onClick={() =>
                            resolveAction(m.id, m.pendingAction!.id, false)
                          }
                          style={{
                            background: '#fff',
                            color: '#c92a2a',
                            border: '1px solid #ffc9c9',
                            borderRadius: 8,
                            padding: '8px 16px',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            opacity: resolvingAction === m.pendingAction.id ? 0.6 : 1,
                          }}
                        >
                          ✕ {t('ai.reject')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Outcome of a resolved action */}
                  {m.actionOutcome && (
                    <div
                      style={{
                        alignSelf: 'flex-end',
                        marginTop: 7,
                        fontSize: 12,
                        fontWeight: 700,
                        color:
                          m.actionOutcome === 'EXECUTED'
                            ? '#2f9e44'
                            : m.actionOutcome === 'REJECTED'
                              ? '#868e96'
                              : '#c92a2a',
                      }}
                    >
                      {m.actionOutcome === 'EXECUTED'
                        ? `✓ ${t('ai.executed')}`
                        : m.actionOutcome === 'REJECTED'
                          ? `✕ ${t('ai.rejected')}`
                          : `✕ ${t('ai.failed')}${m.actionError ? `: ${m.actionError}` : ''}`}
                    </div>
                  )}
                </div>
              ))}

              {sending && (
                <div
                  style={{
                    alignSelf: 'flex-end',
                    fontSize: 13,
                    color: '#9aa1b5',
                    fontWeight: 600,
                    padding: '9px 14px',
                  }}
                >
                  {t('ai.thinking')}
                </div>
              )}
            </div>

            {/* Composer */}
            <div style={{ borderTop: '1px solid #eef0f5', padding: 13 }}>
              {(error || blockReason) && (
                <div
                  style={{
                    background: '#fff1f1',
                    border: '1px solid #ffc9c9',
                    color: '#c92a2a',
                    borderRadius: 9,
                    padding: '9px 12px',
                    fontSize: 12.5,
                    marginBottom: 10,
                    fontWeight: 600,
                    lineHeight: 1.6,
                  }}
                >
                  {error || blockReason}
                </div>
              )}

              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end' }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter sends; Shift+Enter makes a new line.
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  disabled={blocked || sending}
                  rows={2}
                  placeholder={t('ai.placeholder')}
                  style={{
                    flex: 1,
                    resize: 'none',
                    border: '1px solid #dfe3ec',
                    borderRadius: 11,
                    padding: '11px 13px',
                    fontSize: 13.5,
                    lineHeight: 1.7,
                    fontFamily: 'inherit',
                    color: '#2b3147',
                    outline: 'none',
                    direction: isAr ? 'rtl' : 'ltr',
                    background: blocked ? '#f5f6fa' : '#fff',
                  }}
                />
                <button
                  onClick={send}
                  disabled={blocked || sending || !input.trim()}
                  style={{
                    background:
                      blocked || sending || !input.trim()
                        ? '#c9cedb'
                        : `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 11,
                    padding: '13px 22px',
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor:
                      blocked || sending || !input.trim() ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sending ? '…' : t('ai.send')}
                </button>
              </div>

              {status && (
                <div style={{ marginTop: 8, fontSize: 10.5, color: '#aab1c4' }}>
                  {user?.role && `${t(`role.${user.role}` as never)} · `}
                  {status.availableTools.length} {isAr ? 'أداة متاحة' : 'tools available'}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
