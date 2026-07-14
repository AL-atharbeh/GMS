'use client'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  RECEIVED:           { label: 'تم الاستلام',      color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  DIAGNOSING:         { label: 'قيد التشخيص',      color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  QUOTED:             { label: 'عرض السعر',         color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe' },
  AWAITING_APPROVAL:  { label: 'انتظار الموافقة',   color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  APPROVED:           { label: 'موافق عليه',        color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  IN_PROGRESS:        { label: 'قيد التنفيذ',       color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  QUALITY_CHECK:      { label: 'فحص الجودة',        color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
  READY_FOR_DELIVERY: { label: 'جاهزة للاستلام',    color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  DELIVERED:          { label: 'تم التسليم',         color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  CANCELLED:          { label: 'ملغي',              color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
}

interface StatusBreakdownProps {
  data: Array<{ status: string; count: number }>
  loading?: boolean
}

export default function StatusBreakdown({ data, loading }: StatusBreakdownProps) {
  const total = data.reduce((s, d) => s + d.count, 0)
  const activeData = data.filter(d => d.count > 0)
  const displayData = activeData.length > 0 ? activeData : data.slice(0, 4)

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #f0f0f5',
        borderRadius: 16,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid #f3f4f6',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#faf5ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
            توزيع الحالات
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#7c3aed',
            background: '#faf5ff',
            border: '1px solid #e9d5ff',
            borderRadius: 999,
            padding: '3px 10px',
          }}
        >
          لحظي ⚡
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                style={{
                  height: 44,
                  borderRadius: 10,
                  background: '#f3f4f6',
                  animation: 'pulse 1.5s ease infinite',
                }}
              />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>
              لا توجد كروت عمل نشطة
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayData.map(item => {
              const config = STATUS_CONFIG[item.status]
              if (!config) return null
              const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0

              return (
                <div
                  key={item.status}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: '#fafafa',
                    border: '1px solid #f3f4f6',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = config.bg}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = '#fafafa'}
                >
                  {/* Row: label + count */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: config.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                        {config.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>
                        {percentage}%
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: config.color,
                          background: config.bg,
                          border: `1px solid ${config.border}`,
                          borderRadius: 6,
                          padding: '1px 7px',
                          minWidth: 28,
                          textAlign: 'center',
                          fontFamily: 'monospace',
                        }}
                      >
                        {item.count}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 4, borderRadius: 999, background: '#f3f4f6', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${percentage}%`,
                        background: config.color,
                        borderRadius: 999,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && total > 0 && (
        <div
          style={{
            margin: '0 24px 16px',
            padding: '12px 16px',
            borderRadius: 10,
            background: '#f9fafb',
            border: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
            إجمالي كروت العمل
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#111827',
              fontFamily: 'monospace',
            }}
          >
            {total} كرت
          </span>
        </div>
      )}
    </div>
  )
}
