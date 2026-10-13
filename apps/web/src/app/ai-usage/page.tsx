'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
  periodStart: string
  periodEnd: string
}

interface UserUsage {
  userId: string
  name: string
  nameAr: string | null
  email: string | null
  role: string | null
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: string | number
}

interface TrendPoint {
  day: string
  totalTokens: number
  costUsd: string | number
  requests: number
}

const NAVY = '#03045e'
const BLUE = '#0077b6'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatUsd(v: string | number): string {
  return `$${Number(v || 0).toFixed(4)}`
}

export default function AiUsagePage() {
  const lang = useLanguageStore((s) => s.lang)
  const t = useT()
  const isAr = lang === 'ar'

  const [periodDays, setPeriodDays] = useState(30)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [byUser, setByUser] = useState<UserUsage[]>([])
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/ai/usage?periodDays=${periodDays}`)
      const d = res.data.data
      setQuota(d.quota)
      setByUser(d.byUser ?? [])
      setTrend(d.trend ?? [])
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message || 'Failed to load usage')
    } finally {
      setLoading(false)
    }
  }, [periodDays])

  useEffect(() => {
    load()
  }, [load])

  const totals = byUser.reduce(
    (acc, u) => ({
      requests: acc.requests + u.requests,
      input: acc.input + u.inputTokens,
      output: acc.output + u.outputTokens,
      cost: acc.cost + Number(u.costUsd || 0),
    }),
    { requests: 0, input: 0, output: 0, cost: 0 }
  )

  const chartData = trend.map((p) => ({
    day: new Date(p.day).toLocaleDateString(isAr ? 'ar-KW' : 'en-GB', {
      month: 'short',
      day: 'numeric',
    }),
    tokens: p.totalTokens,
    requests: p.requests,
  }))

  const cards = [
    {
      label: t('usage.requests'),
      value: String(totals.requests),
      color: NAVY,
    },
    {
      label: t('usage.inputTokens'),
      value: formatTokens(totals.input),
      color: BLUE,
    },
    {
      label: t('usage.outputTokens'),
      value: formatTokens(totals.output),
      color: '#0096c7',
    },
    {
      label: t('usage.cost'),
      value: formatUsd(totals.cost),
      color: '#2f9e44',
    },
  ]

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
          title={t('usage.title')}
          subtitle={t('usage.subtitle')}
          actions={
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              style={{
                border: '1px solid #dfe3ec',
                borderRadius: 9,
                padding: '8px 12px',
                fontSize: 12.5,
                fontWeight: 600,
                color: '#2b3147',
                background: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <option value={7}>{t('usage.period7')}</option>
              <option value={30}>{t('usage.period30')}</option>
              <option value={90}>{t('usage.period90')}</option>
            </select>
          }
        />

        <main style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div
              style={{
                background: '#fff1f1',
                border: '1px solid #ffc9c9',
                color: '#c92a2a',
                borderRadius: 10,
                padding: '11px 14px',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {/* Monthly quota */}
          {quota && (
            <div
              style={{
                background: '#fff',
                borderRadius: 14,
                border: '1px solid #e8eaf0',
                padding: 18,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 800, color: NAVY }}>
                  {t('usage.quotaUsed')}
                </div>
                <div style={{ fontSize: 12.5, color: '#7b839c', fontWeight: 600 }}>
                  {formatTokens(quota.used)} / {formatTokens(quota.limit)}{' '}
                  {t('usage.tokens')} · {t('usage.remaining')}{' '}
                  {formatTokens(quota.remaining)}
                </div>
              </div>

              <div
                style={{
                  height: 10,
                  background: '#eef0f5',
                  borderRadius: 99,
                  overflow: 'hidden',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: `${Math.min(quota.percentUsed, 100)}%`,
                    height: '100%',
                    borderRadius: 99,
                    background: quota.exceeded
                      ? '#e03131'
                      : quota.nearLimit
                        ? '#f59f00'
                        : `linear-gradient(90deg, ${NAVY}, ${BLUE})`,
                    transition: 'width 0.3s',
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: 19,
                  fontWeight: 900,
                  color: quota.exceeded
                    ? '#c92a2a'
                    : quota.nearLimit
                      ? '#b37400'
                      : NAVY,
                }}
              >
                {quota.percentUsed}%
              </div>
            </div>
          )}

          {/* Totals */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {cards.map((c) => (
              <div
                key={c.label}
                style={{
                  background: '#fff',
                  borderRadius: 13,
                  border: '1px solid #e8eaf0',
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#8b92a8',
                    marginBottom: 7,
                  }}
                >
                  {c.label}
                </div>
                <div style={{ fontSize: 23, fontWeight: 900, color: c.color }}>
                  {c.value}
                </div>
              </div>
            ))}
          </div>

          {/* Trend */}
          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #e8eaf0',
              padding: 18,
            }}
          >
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                color: NAVY,
                marginBottom: 14,
              }}
            >
              {t('usage.trend')}
            </div>

            {chartData.length === 0 ? (
              <div
                style={{
                  padding: '40px 0',
                  textAlign: 'center',
                  fontSize: 13,
                  color: '#9aa1b5',
                }}
              >
                {loading ? '…' : t('usage.noData')}
              </div>
            ) : (
              <div style={{ width: '100%', height: 230, direction: 'ltr' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="tokensFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={BLUE} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: '#8b92a8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#8b92a8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => formatTokens(v)}
                    />
                    <Tooltip
                      formatter={(v) => [formatTokens(Number(v ?? 0)), t('usage.tokens')]}
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid #e8eaf0',
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="tokens"
                      stroke={BLUE}
                      strokeWidth={2}
                      fill="url(#tokensFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Per user */}
          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #e8eaf0',
              padding: 18,
            }}
          >
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                color: NAVY,
                marginBottom: 14,
              }}
            >
              {t('usage.byUser')}
            </div>

            {byUser.length === 0 ? (
              <div
                style={{
                  padding: '30px 0',
                  textAlign: 'center',
                  fontSize: 13,
                  color: '#9aa1b5',
                }}
              >
                {loading ? '…' : t('usage.noData')}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ textAlign: isAr ? 'right' : 'left' }}>
                      {[
                        t('usage.user'),
                        t('usage.role'),
                        t('usage.requests'),
                        t('usage.inputTokens'),
                        t('usage.outputTokens'),
                        t('usage.cost'),
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '9px 10px',
                            borderBottom: '1px solid #eef0f5',
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#8b92a8',
                            whiteSpace: 'nowrap',
                            textAlign: isAr ? 'right' : 'left',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byUser.map((u) => (
                      <tr key={u.userId}>
                        <td
                          style={{
                            padding: '11px 10px',
                            borderBottom: '1px solid #f4f5f9',
                            fontWeight: 700,
                            color: '#2b3147',
                          }}
                        >
                          {isAr ? u.nameAr || u.name : u.name}
                          <div style={{ fontSize: 11, color: '#9aa1b5', fontWeight: 500 }}>
                            {u.email}
                          </div>
                        </td>
                        <td
                          style={{
                            padding: '11px 10px',
                            borderBottom: '1px solid #f4f5f9',
                            color: '#5c6480',
                          }}
                        >
                          {u.role ? t(`role.${u.role}` as never) : '—'}
                        </td>
                        <td
                          style={{
                            padding: '11px 10px',
                            borderBottom: '1px solid #f4f5f9',
                            color: '#2b3147',
                            fontWeight: 600,
                          }}
                        >
                          {u.requests}
                        </td>
                        <td
                          style={{
                            padding: '11px 10px',
                            borderBottom: '1px solid #f4f5f9',
                            color: '#5c6480',
                          }}
                        >
                          {formatTokens(u.inputTokens)}
                        </td>
                        <td
                          style={{
                            padding: '11px 10px',
                            borderBottom: '1px solid #f4f5f9',
                            color: '#5c6480',
                          }}
                        >
                          {formatTokens(u.outputTokens)}
                        </td>
                        <td
                          style={{
                            padding: '11px 10px',
                            borderBottom: '1px solid #f4f5f9',
                            color: '#2f9e44',
                            fontWeight: 700,
                          }}
                        >
                          {formatUsd(u.costUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
