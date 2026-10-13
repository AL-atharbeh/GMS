'use client'

/**
 * Platform-wide AI usage for the super admin: spend per garage, the heaviest
 * individual users, and the daily trend. Matches the dark super-admin theme.
 */
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
import api from '@/lib/api'

interface Totals {
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: string | number
}

interface TenantRow {
  tenantId: string
  tenantName: string
  tenantNameAr: string | null
  plan: string
  quotaLimit: number
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  percentOfQuota: number | null
  costUsd: string | number
}

interface UserRow {
  userId: string
  name: string
  nameAr: string | null
  email: string | null
  role: string | null
  tenantName: string | null
  requests: number
  totalTokens: number
  costUsd: string | number
}

interface TrendPoint {
  day: string
  totalTokens: number
  requests: number
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatUsd(v: string | number): string {
  return `$${Number(v || 0).toFixed(4)}`
}

const PLAN_COLORS: Record<string, string> = {
  BASIC: '#38bdf8',
  PROFESSIONAL: '#a78bfa',
  ENTERPRISE: '#fbbf24',
}

export default function AiUsagePanel() {
  const [periodDays, setPeriodDays] = useState(30)
  const [totals, setTotals] = useState<Totals | null>(null)
  const [byTenant, setByTenant] = useState<TenantRow[]>([])
  const [topUsers, setTopUsers] = useState<UserRow[]>([])
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/super-admin/ai-usage?periodDays=${periodDays}`)
      const d = res.data.data
      setTotals(d.totals)
      setByTenant(d.byTenant ?? [])
      setTopUsers(d.topUsers ?? [])
      setTrend(d.trend ?? [])
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message || 'فشل تحميل بيانات الاستهلاك')
    } finally {
      setLoading(false)
    }
  }, [periodDays])

  useEffect(() => {
    load()
  }, [load])

  const chartData = trend.map((p) => ({
    day: new Date(p.day).toLocaleDateString('ar-KW', {
      month: 'short',
      day: 'numeric',
    }),
    tokens: p.totalTokens,
  }))

  const card = (label: string, value: string, hint?: string, color = '#f8fafc') => (
    <div
      style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 14,
        padding: '16px 18px',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 7 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
      {hint && <div style={{ fontSize: 10.5, color: '#475569', marginTop: 4 }}>{hint}</div>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setPeriodDays(d)}
            style={{
              background: periodDays === d ? '#7c3aed' : '#1e293b',
              color: periodDays === d ? '#fff' : '#94a3b8',
              border: `1px solid ${periodDays === d ? '#7c3aed' : '#334155'}`,
              borderRadius: 9,
              padding: '7px 15px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {d} يوم
          </button>
        ))}
        {loading && <span style={{ fontSize: 12, color: '#64748b' }}>جاري التحميل…</span>}
      </div>

      {error && (
        <div
          style={{
            background: '#7f1d1d30',
            border: '1px solid #991b1b',
            color: '#fca5a5',
            borderRadius: 10,
            padding: '11px 14px',
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* Platform totals */}
      {totals && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 14,
          }}
        >
          {card('إجمالي الطلبات', String(totals.requests), 'كل الورش')}
          {card('توكِن مُدخَل', formatTokens(totals.inputTokens), undefined, '#38bdf8')}
          {card('توكِن مُخرَج', formatTokens(totals.outputTokens), undefined, '#a78bfa')}
          {card('إجمالي التوكِنات', formatTokens(totals.totalTokens), undefined, '#fbbf24')}
          {card('التكلفة الكليّة', formatUsd(totals.costUsd), 'على المنصّة', '#34d399')}
        </div>
      )}

      {/* Trend */}
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: '20px 22px',
        }}
      >
        <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 800, color: '#a78bfa' }}>
          📈 الاستهلاك اليومي
        </h3>
        {chartData.length === 0 ? (
          <p style={{ color: '#475569', fontSize: 12 }}>
            {loading ? '…' : 'لا استهلاك مسجَّل في هذه الفترة'}
          </p>
        ) : (
          <div style={{ width: '100%', height: 220, direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="saTokensFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatTokens(v)}
                />
                <Tooltip
                  formatter={(v) => [formatTokens(Number(v ?? 0)), 'توكِن']}
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 10,
                    fontSize: 12,
                    color: '#f8fafc',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  fill="url(#saTokensFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Per garage */}
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: '20px 22px',
        }}
      >
        <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 800, color: '#38bdf8' }}>
          🏢 الاستهلاك حسب الورشة
        </h3>

        {byTenant.length === 0 ? (
          <p style={{ color: '#475569', fontSize: 12 }}>
            {loading ? '…' : 'لا استهلاك مسجَّل في هذه الفترة'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {byTenant.map((row) => {
              const pct = row.percentOfQuota ?? 0
              const barColor = pct >= 100 ? '#f87171' : pct >= 80 ? '#fbbf24' : '#34d399'
              return (
                <div
                  key={row.tenantId}
                  style={{ background: '#0f172a', padding: '13px 16px', borderRadius: 11 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 9,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                        {row.tenantNameAr || row.tenantName}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: PLAN_COLORS[row.plan] ?? '#94a3b8',
                          background: `${PLAN_COLORS[row.plan] ?? '#94a3b8'}18`,
                          padding: '2px 8px',
                          borderRadius: 7,
                        }}
                      >
                        {row.plan}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 11.5 }}>
                      <span style={{ color: '#64748b' }}>
                        {row.requests} طلب
                      </span>
                      <span style={{ color: '#94a3b8', fontWeight: 700 }}>
                        {formatTokens(row.totalTokens)} / {formatTokens(row.quotaLimit)}
                      </span>
                      <span style={{ color: '#34d399', fontWeight: 800 }}>
                        {formatUsd(row.costUsd)}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      height: 6,
                      background: '#1e293b',
                      borderRadius: 99,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: 99,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: barColor,
                      fontWeight: 800,
                      marginTop: 4,
                    }}
                  >
                    {pct.toFixed(1)}% من الحصة
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Heaviest individual users */}
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: '20px 22px',
        }}
      >
        <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>
          👤 أعلى المستهلكين
        </h3>

        {topUsers.length === 0 ? (
          <p style={{ color: '#475569', fontSize: 12 }}>
            {loading ? '…' : 'لا استهلاك مسجَّل في هذه الفترة'}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>
                  {['المستخدم', 'الورشة', 'الطلبات', 'التوكِنات', 'التكلفة'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '9px 10px',
                        borderBottom: '1px solid #334155',
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#64748b',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u) => (
                  <tr key={u.userId}>
                    <td
                      style={{
                        padding: '11px 10px',
                        borderBottom: '1px solid #1e293b',
                        color: '#f8fafc',
                        fontWeight: 700,
                      }}
                    >
                      {u.nameAr || u.name}
                      <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>
                        {u.email}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: '11px 10px',
                        borderBottom: '1px solid #1e293b',
                        color: '#94a3b8',
                      }}
                    >
                      {u.tenantName ?? '—'}
                    </td>
                    <td
                      style={{
                        padding: '11px 10px',
                        borderBottom: '1px solid #1e293b',
                        color: '#94a3b8',
                      }}
                    >
                      {u.requests}
                    </td>
                    <td
                      style={{
                        padding: '11px 10px',
                        borderBottom: '1px solid #1e293b',
                        color: '#a78bfa',
                        fontWeight: 700,
                      }}
                    >
                      {formatTokens(u.totalTokens)}
                    </td>
                    <td
                      style={{
                        padding: '11px 10px',
                        borderBottom: '1px solid #1e293b',
                        color: '#34d399',
                        fontWeight: 800,
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
    </div>
  )
}
