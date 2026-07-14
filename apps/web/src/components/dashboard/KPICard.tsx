'use client'

interface KPICardProps {
  title: string
  value: string | null
  icon: React.ReactNode
  color: 'blue' | 'green' | 'amber' | 'purple'
  trend?: string
  trendUp?: boolean
  subtitle?: string
  loading?: boolean
  isLive?: boolean
}

const colorMap = {
  blue:   { light: '#eff6ff', icon: '#2563eb', text: '#1d4ed8' },
  green:  { light: '#f0fdf4', icon: '#16a34a', text: '#15803d' },
  amber:  { light: '#fffbeb', icon: '#d97706', text: '#b45309' },
  purple: { light: '#faf5ff', icon: '#7c3aed', text: '#6d28d9' },
}

export default function KPICard({
  title, value, icon, color, trend, trendUp, subtitle, loading, isLive
}: KPICardProps) {
  const c = colorMap[color]

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #f0f0f5',
        borderRadius: 16,
        padding: '20px 24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
      }}
    >
      {/* Top row: icon + title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: c.light,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: c.icon,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        {isLive && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              fontWeight: 700,
              color: '#16a34a',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 999,
              padding: '2px 8px',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#16a34a',
                animation: 'pulse 2s infinite',
                display: 'inline-block',
              }}
            />
            مباشر
          </span>
        )}
      </div>

      {/* Value */}
      <div>
        {loading ? (
          <div
            style={{
              height: 28,
              width: 100,
              borderRadius: 8,
              background: '#f3f4f6',
              animation: 'pulse 1.5s ease infinite',
            }}
          />
        ) : (
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: '#111827',
              lineHeight: 1.1,
              letterSpacing: '-0.5px',
              direction: 'ltr',
              textAlign: 'left',
            }}
          >
            {value}
          </div>
        )}
      </div>

      {/* Title & trend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>{title}</div>

        {trend && !loading && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: trendUp ? '#16a34a' : '#dc2626',
            }}
          >
            <span>{trendUp ? '↑' : '↓'}</span>
            <span>{trend}</span>
          </div>
        )}

        {subtitle && !loading && (
          <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>{subtitle}</div>
        )}
      </div>
    </div>
  )
}
