'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import Link from 'next/link'

interface ActiveWorkOrder {
  id: string
  orderNumber: string
  status: string
  vehicle: { plateNumber: string; make: string; model: string }
  customer: { name: string } | null
  receivedAt: string
  estimatedReadyAt: string | null
}

const WORKSHOP_STAGES = [
  { status: 'RECEIVED',           label: 'الاستلام',        color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { status: 'DIAGNOSING',         label: 'التشخيص',         color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { status: 'QUOTED',             label: 'عرض السعر',       color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe' },
  { status: 'AWAITING_APPROVAL',  label: 'انتظار الموافقة', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  { status: 'APPROVED',           label: 'موافق عليه',      color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { status: 'IN_PROGRESS',        label: 'قيد التنفيذ',     color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  { status: 'QUALITY_CHECK',      label: 'فحص الجودة',      color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
  { status: 'READY_FOR_DELIVERY', label: 'جاهزة للاستلام',  color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
]

export default function WorkshopStatus() {
  const [orders, setOrders] = useState<ActiveWorkOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchActiveOrders()
    const interval = setInterval(fetchActiveOrders, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchActiveOrders = async () => {
    try {
      const response = await api.get('/work-orders?limit=50')
      const activeStatuses = WORKSHOP_STAGES.map(s => s.status)
      const active = (response.data.data || []).filter((o: any) => activeStatuses.includes(o.status))
      setOrders(active)
    } catch {}
    finally { setLoading(false) }
  }

  const ordersByStage = WORKSHOP_STAGES.map(stage => ({
    ...stage,
    orders: orders.filter(o => o.status === stage.status),
  }))

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #f0f0f5',
        borderRadius: 16,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        overflow: 'hidden',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#f0f9ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', display: 'block' }}>
              حالة الورشة اللحظية
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#16a34a',
                  animation: 'pulse 2s infinite',
                }}
              />
              <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                {orders.length} مركبة نشطة الآن
              </span>
            </div>
          </div>
        </div>

        <Link
          href="/work-orders"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#0284c7',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            borderRadius: 8,
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            transition: 'all 0.15s ease',
          }}
        >
          إدارة الطلبات
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>
      </div>

      {/* Stage Cards Grid */}
      <div style={{ padding: '16px 24px 20px' }}>
        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 88,
                  borderRadius: 12,
                  background: '#f3f4f6',
                  animation: 'pulse 1.5s ease infinite',
                }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
            }}
          >
            {ordersByStage.map(stage => (
              <div
                key={stage.status}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${stage.orders.length > 0 ? stage.border : '#f3f4f6'}`,
                  background: stage.orders.length > 0 ? stage.bg : '#fafafa',
                  padding: '14px 16px',
                  transition: 'all 0.2s ease',
                  cursor: stage.orders.length > 0 ? 'pointer' : 'default',
                }}
                onMouseEnter={e => {
                  if (stage.orders.length > 0) {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 12px ${stage.color}20`
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                }}
              >
                {/* Stage Label */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: stage.orders.length > 0 ? stage.color : '#9ca3af',
                    marginBottom: 8,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {stage.label}
                </div>

                {/* Count */}
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: stage.orders.length > 0 ? stage.color : '#d1d5db',
                    lineHeight: 1,
                    fontFamily: 'monospace',
                    letterSpacing: '-1px',
                  }}
                >
                  {stage.orders.length}
                </div>

                <div
                  style={{
                    fontSize: 10,
                    color: stage.orders.length > 0 ? stage.color : '#d1d5db',
                    marginTop: 4,
                    fontWeight: 500,
                    opacity: 0.7,
                  }}
                >
                  مركبة
                </div>

                {/* Order links if any */}
                {stage.orders.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: `1px dashed ${stage.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                    }}
                  >
                    {stage.orders.slice(0, 2).map(order => (
                      <Link
                        key={order.id}
                        href={`/work-orders/${order.id}`}
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: stage.color,
                          textDecoration: 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'block',
                        }}
                      >
                        {order.vehicle.plateNumber}
                      </Link>
                    ))}
                    {stage.orders.length > 2 && (
                      <span
                        style={{
                          fontSize: 10,
                          color: stage.color,
                          fontWeight: 600,
                          opacity: 0.6,
                        }}
                      >
                        +{stage.orders.length - 2} أخرى
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
