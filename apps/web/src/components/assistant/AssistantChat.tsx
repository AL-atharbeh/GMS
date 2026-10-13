'use client'

/**
 * The agent conversation itself — messages, composer, quota strip and the
 * confirmation gate. Shared by the full /assistant page and the floating
 * widget, so the two can never drift apart.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useLanguageStore } from '@/lib/stores/languageStore'
import { useT } from '@/lib/i18n'
import api from '@/lib/api'

export interface Quota {
  limit: number
  used: number
  remaining: number
  percentUsed: number
  exceeded: boolean
  nearLimit: boolean
}

export interface StatusPayload {
  enabled: boolean
  configured: boolean
  provider: string
  availableTools: string[]
  quota: Quota
}

export interface PendingAction {
  id: string
  toolName: string
  summary: string
  summaryAr: string | null
  input: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  text: string
  toolsUsed?: string[]
  pendingAction?: PendingAction | null
  actionOutcome?: 'EXECUTED' | 'REJECTED' | 'FAILED'
  actionError?: string
}

export interface ConversationSummary {
  id: string
  title: string | null
  lastMessageAt: string
  _count: { messages: number }
}

export const NAVY = '#03045e'
export const BLUE = '#0077b6'

const TOOL_LABELS: Record<string, { ar: string; en: string }> = {
  get_work_order: { ar: 'قراءة أمر عمل', en: 'read work order' },
  search_work_orders: { ar: 'بحث أوامر العمل', en: 'search work orders' },
  get_vehicle_history: { ar: 'تاريخ السيارة', en: 'vehicle history' },
  find_similar_faults: { ar: 'أعطال مشابهة في سجلّك', en: 'similar past faults' },
  check_part_availability: { ar: 'توفّر قطعة', en: 'part availability' },
  get_financial_summary: { ar: 'ملخّص مالي', en: 'financial summary' },
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/**
 * Everything the chat needs, lifted so both shells can drive it and the
 * widget can keep its thread while the user moves between pages.
 */
export function useAssistantChat() {
  const lang = useLanguageStore((s) => s.lang)
  const t = useT()

  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolvingAction, setResolvingAction] = useState<string | null>(null)

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

  const openConversation = useCallback(
    async (id: string) => {
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
    },
    [t]
  )

  const startNewChat = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setError(null)
  }, [])

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/ai/conversations/${id}`)
        setConversations((prev) => prev.filter((c) => c.id !== id))
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
        { message: text, ...(conversationId ? { conversationId } : {}) },
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
      if (data.quota) setStatus((s) => (s ? { ...s, quota: data.quota } : s))
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

  return {
    status,
    conversations,
    conversationId,
    messages,
    input,
    sending,
    error,
    resolvingAction,
    setInput,
    setError,
    loadStatus,
    loadConversations,
    openConversation,
    startNewChat,
    deleteConversation,
    send,
    resolveAction,
  }
}

export type AssistantChatState = ReturnType<typeof useAssistantChat>

/** The message thread and composer. `compact` tightens it for the widget. */
export function AssistantChatBody({
  chat,
  compact = false,
  showQuota = true,
}: {
  chat: AssistantChatState
  compact?: boolean
  showQuota?: boolean
}) {
  const lang = useLanguageStore((s) => s.lang)
  const t = useT()
  const isAr = lang === 'ar'
  const { user } = useAuthStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    status,
    messages,
    input,
    sending,
    error,
    resolvingAction,
    setInput,
    send,
    resolveAction,
  } = chat

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

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
    <>
      {showQuota && quota && (
        <div
          style={{
            padding: compact ? '7px 12px' : '9px 16px',
            borderBottom: '1px solid #eef0f5',
            background: quota.exceeded
              ? '#fff1f1'
              : quota.nearLimit
                ? '#fff8e8'
                : '#fafbff',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            fontSize: compact ? 11 : 12,
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#6b7390', fontWeight: 600 }}>
            {formatTokens(quota.used)} / {formatTokens(quota.limit)}
          </span>
          <div
            style={{
              flex: 1,
              minWidth: 60,
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
              color: quota.exceeded ? '#c92a2a' : quota.nearLimit ? '#b37400' : NAVY,
            }}
          >
            {quota.percentUsed}%
          </span>
        </div>
      )}

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: compact ? 13 : 18,
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? 11 : 14,
          minHeight: 0,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              maxWidth: 420,
              padding: compact ? 12 : 20,
            }}
          >
            <div style={{ fontSize: compact ? 27 : 34, marginBottom: 10 }}>🔧</div>
            <div
              style={{
                fontSize: compact ? 14 : 16,
                fontWeight: 800,
                color: NAVY,
                marginBottom: 7,
              }}
            >
              {t('ai.emptyTitle')}
            </div>
            <div
              style={{
                fontSize: compact ? 12 : 13,
                color: '#7b839c',
                lineHeight: 1.75,
              }}
            >
              {t('ai.emptyBody')}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                alignSelf: m.role === 'USER' ? 'flex-start' : 'flex-end',
                maxWidth: '86%',
                background: m.role === 'USER' ? '#eef4ff' : '#f7f8fc',
                border: `1px solid ${m.role === 'USER' ? '#d9e6ff' : '#e9ebf2'}`,
                borderRadius: 13,
                padding: compact ? '9px 12px' : '11px 14px',
                fontSize: compact ? 12.5 : 13.5,
                lineHeight: 1.8,
                color: '#2b3147',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                unicodeBidi: 'plaintext',
                textAlign: 'start',
              }}
            >
              {m.text}
            </div>

            {m.toolsUsed && m.toolsUsed.length > 0 && (
              <div
                style={{
                  alignSelf: 'flex-end',
                  marginTop: 5,
                  display: 'flex',
                  gap: 5,
                  flexWrap: 'wrap',
                  maxWidth: '86%',
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

            {m.pendingAction && (
              <div
                style={{
                  alignSelf: 'flex-end',
                  marginTop: 9,
                  maxWidth: '92%',
                  background: '#fffdf5',
                  border: '1.5px solid #ffe08a',
                  borderRadius: 13,
                  padding: compact ? 11 : 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 800,
                    color: '#8a6100',
                    marginBottom: 4,
                  }}
                >
                  ⚠︎ {t('ai.confirmTitle')}
                </div>
                <div
                  style={{
                    fontSize: compact ? 12.5 : 13.5,
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
                <div style={{ fontSize: 11, color: '#9a8450', marginBottom: 10 }}>
                  {t('ai.confirmBody')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    disabled={resolvingAction === m.pendingAction.id}
                    onClick={() => resolveAction(m.id, m.pendingAction!.id, true)}
                    style={{
                      background: '#2f9e44',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '7px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: resolvingAction === m.pendingAction.id ? 0.6 : 1,
                    }}
                  >
                    ✓ {t('ai.approve')}
                  </button>
                  <button
                    disabled={resolvingAction === m.pendingAction.id}
                    onClick={() => resolveAction(m.id, m.pendingAction!.id, false)}
                    style={{
                      background: '#fff',
                      color: '#c92a2a',
                      border: '1px solid #ffc9c9',
                      borderRadius: 8,
                      padding: '7px 14px',
                      fontSize: 12,
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

            {m.actionOutcome && (
              <div
                style={{
                  alignSelf: 'flex-end',
                  marginTop: 7,
                  fontSize: 11.5,
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
              fontSize: 12.5,
              color: '#9aa1b5',
              fontWeight: 600,
              padding: '8px 12px',
            }}
          >
            {t('ai.thinking')}
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: '1px solid #eef0f5',
          padding: compact ? 10 : 13,
          flexShrink: 0,
        }}
      >
        {(error || blockReason) && (
          <div
            style={{
              background: '#fff1f1',
              border: '1px solid #ffc9c9',
              color: '#c92a2a',
              borderRadius: 9,
              padding: '8px 11px',
              fontSize: 12,
              marginBottom: 9,
              fontWeight: 600,
              lineHeight: 1.6,
            }}
          >
            {error || blockReason}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            disabled={blocked || sending}
            rows={compact ? 1 : 2}
            placeholder={t('ai.placeholder')}
            style={{
              flex: 1,
              resize: 'none',
              border: '1px solid #dfe3ec',
              borderRadius: 11,
              padding: compact ? '9px 11px' : '11px 13px',
              fontSize: compact ? 12.5 : 13.5,
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
              padding: compact ? '10px 15px' : '13px 22px',
              fontSize: compact ? 12.5 : 13.5,
              fontWeight: 700,
              cursor: blocked || sending || !input.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {sending ? '…' : t('ai.send')}
          </button>
        </div>

        {!compact && status && (
          <div style={{ marginTop: 8, fontSize: 10.5, color: '#aab1c4' }}>
            {user?.role && `${t(`role.${user.role}` as never)} · `}
            {status.availableTools.length} {isAr ? 'أداة متاحة' : 'tools available'}
          </div>
        )}
      </div>
    </>
  )
}
