'use client'

import Link from 'next/link'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  RECEIVED:            { label: 'تم الاستلام',       color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  DIAGNOSING:          { label: 'قيد التشخيص',       color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  QUOTED:              { label: 'عرض السعر',          color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe' },
  AWAITING_APPROVAL:   { label: 'انتظار الموافقة',    color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  APPROVED:            { label: 'موافق عليه',         color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  IN_PROGRESS:         { label: 'قيد التنفيذ',        color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  QUALITY_CHECK:       { label: 'فحص الجودة',         color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
  READY_FOR_DELIVERY:  { label: 'جاهزة للاستلام',     color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  DELIVERED:           { label: 'تم التسليم',          color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  CANCELLED:           { label: 'ملغي',               color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
}

interface Order {
  id: string
  orderNumber: string
  status: string
  vehicle: { plateNumber: string; make: string; model: string } | null
  customer: { name: string } | null
  totalAmount: number | string
  receivedAt: string
}

interface RecentWorkOrdersProps {
  orders: Order[]
  loading?: boolean
}

export default function RecentWorkOrders({ orders, loading }: RecentWorkOrdersProps) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #f0f0f5',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
            آخر طلبات الخدمة
          </span>
        </div>
        <Link
          href="/work-orders"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#4f46e5',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            borderRadius: 8,
            background: '#f5f3ff',
            border: '1px solid #e0e7ff',
            transition: 'all 0.15s ease',
          }}
        >
          عرض الكل
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              {['رقم الطلب', 'السيارة', 'العميل', 'الحالة', 'المبلغ', 'التاريخ', ''].map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: '10px 16px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#9ca3af',
                    textAlign: 'right',
                    borderBottom: '1px solid #f3f4f6',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} style={{ padding: '14px 16px' }}>
                      <div
                        style={{
                          height: 14,
                          borderRadius: 6,
                          background: '#f3f4f6',
                          width: j === 0 ? 70 : j === 3 ? 80 : 90,
                          animation: 'pulse 1.5s ease infinite',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '48px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔧</div>
                  <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>
                    لا توجد طلبات خدمة مسجلة حالياً
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((order, idx) => {
                const st = STATUS_LABELS[order.status]
                return (
                  <tr
                    key={order.id}
                    style={{
                      borderBottom: idx < orders.length - 1 ? '1px solid #f9fafb' : 'none',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#fafafa'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    {/* Order number */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>
                        #{order.orderNumber}
                      </span>
                    </td>

                    {/* Vehicle */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                        {order.vehicle?.make} {order.vehicle?.model}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginTop: 2 }}>
                        {order.vehicle?.plateNumber}
                      </div>
                    </td>

                    {/* Customer */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>
                        {order.customer?.name || '—'}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: '14px 16px' }}>
                      {st && (
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: 10,
                            fontWeight: 700,
                            color: st.color,
                            background: st.bg,
                            border: `1px solid ${st.border}`,
                            borderRadius: 999,
                            padding: '3px 10px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {st.label}
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', fontFamily: 'monospace', direction: 'ltr', display: 'inline-block' }}>
                        {Number(order.totalAmount).toFixed(3)} د.ك
                      </span>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
                        {new Date(order.receivedAt).toLocaleDateString('ar-KW')}
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '14px 16px' }}>
                      <Link
                        href={`/work-orders/${order.id}`}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#4f46e5',
                          textDecoration: 'none',
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: '#f5f3ff',
                          border: '1px solid #e0e7ff',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        تفاصيل
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
