'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

interface Part {
  id: string
  name: string
  nameAr?: string
  partNumber: string
  inventory?: Array<{ quantity: number; minStockLevel: number }>
}

interface PartSupplier {
  id: string
  part: Part
  purchasePrice: number
  isPreferred: boolean
  supplierPartNumber?: string
  leadTimeDays: number
}

interface POItem {
  id: string
  part: { name: string; nameAr?: string; partNumber: string }
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface PurchaseOrder {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  orderedAt?: string
  expectedAt?: string
  receivedAt?: string
  sentViaWhatsApp: boolean
  notes?: string
  items: POItem[]
}

interface Supplier {
  id: string
  name: string
  nameAr?: string
  phone?: string
  whatsapp?: string
  email?: string
  contactPerson?: string
  address?: string
  paymentTermDays: number
  notes?: string
  isActive: boolean
  createdAt: string
  partSuppliers: PartSupplier[]
  purchaseOrders: PurchaseOrder[]
  _count: { partSuppliers: number; purchaseOrders: number }
  totalSpend: number
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'في الانتظار', color: '#b45309', bg: '#fef3c7' },
  ORDERED: { label: 'تم الطلب', color: '#1d4ed8', bg: '#dbeafe' },
  PARTIALLY_RECEIVED: { label: 'استلام جزئي', color: '#7c3aed', bg: '#ede9fe' },
  RECEIVED: { label: 'مستلم', color: '#059669', bg: '#d1fae5' },
  CANCELLED: { label: 'ملغي', color: '#dc2626', bg: '#fee2e2' },
}

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'parts' | 'orders'>('parts')
  const [expandedPO, setExpandedPO] = useState<string | null>(null)

  useEffect(() => {
    fetchSupplier()
  }, [id])

  const fetchSupplier = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/suppliers/${id}`)
      setSupplier(res.data.data)
    } catch {
      console.error('Error fetching supplier')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (poId: string, status: string) => {
    try {
      await api.patch(`/suppliers/purchase-orders/${poId}/status`, { status })
      fetchSupplier()
    } catch {
      alert('فشل تحديث الحالة')
    }
  }

  const buildWhatsAppMessage = (po: PurchaseOrder) => {
    if (!supplier) return ''
    const lines = [
      `*طلب شراء — ${supplier.nameAr || supplier.name}*`,
      `رقم الطلب: ${po.orderNumber}`,
      `التاريخ: ${new Date().toLocaleDateString('ar')}`,
      '',
      '*القطع المطلوبة:*',
      ...po.items.map(
        (item) =>
          `• ${item.part.nameAr || item.part.name} (${item.part.partNumber}) × ${item.quantity} — ${Number(item.unitPrice).toFixed(3)} د.ك`
      ),
      '',
      `*الإجمالي: ${Number(po.totalAmount).toFixed(3)} د.ك*`,
    ]
    return encodeURIComponent(lines.join('\n'))
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <span style={{ fontSize: 13, color: '#9ca3af' }}>جاري التحميل...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#6b7280' }}>المورد غير موجود</p>
        </div>
      </div>
    )
  }

  const totalPartsLowStock = supplier.partSuppliers.filter((ps) => {
    const inv = ps.part.inventory?.[0]
    return inv && Number(inv.quantity) <= Number(inv.minStockLevel)
  }).length

  const pendingOrders = supplier.purchaseOrders.filter((po) => po.status === 'PENDING' || po.status === 'ORDERED').length
  const avatarChar = supplier.nameAr ? supplier.nameAr[0] : supplier.name[0]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          title={supplier.nameAr || supplier.name}
          subtitle="مركز قيادة المورد — قطع الغيار المرتبطة وسجل طلبات الشراء"
          actions={
            <div style={{ display: 'flex', gap: 10 }}>
              {supplier.whatsapp && (
                <a
                  href={`https://wa.me/${supplier.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '9px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 8px rgba(22,163,74,0.25)',
                  }}
                >
                  💬 واتساب
                </a>
              )}
              <button
                onClick={() => router.back()}
                style={{
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ← رجوع
              </button>
            </div>
          }
        />

        <main style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Header Profile Card */}
            <div style={{
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4f46e5 100%)',
              borderRadius: 20,
              padding: 28,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              flexWrap: 'wrap',
            }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                background: 'rgba(255,255,255,0.15)',
                border: '2px solid rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 900,
                flexShrink: 0,
              }}>
                {avatarChar}
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{supplier.nameAr || supplier.name}</h1>
                {supplier.nameAr && supplier.name && (
                  <p style={{ margin: '4px 0 0', opacity: 0.75, fontSize: 13 }}>{supplier.name}</p>
                )}
                <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                  {supplier.contactPerson && (
                    <span style={{ fontSize: 12, opacity: 0.9, background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 20 }}>
                      👤 {supplier.contactPerson}
                    </span>
                  )}
                  {supplier.phone && (
                    <span style={{ fontSize: 12, opacity: 0.9, background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 20 }}>
                      📞 {supplier.phone}
                    </span>
                  )}
                  {supplier.email && (
                    <span style={{ fontSize: 12, opacity: 0.9, background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 20 }}>
                      ✉️ {supplier.email}
                    </span>
                  )}
                  {supplier.address && (
                    <span style={{ fontSize: 12, opacity: 0.9, background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 20 }}>
                      📍 {supplier.address}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 900 }}>{supplier._count.partSuppliers}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>قطعة مرتبطة</div>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 900 }}>{supplier._count.purchaseOrders}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>طلب شراء</div>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>{supplier.totalSpend.toFixed(3)}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>د.ك إجمالي المشتريات</div>
                </div>
              </div>
            </div>

            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {[
                { icon: '⚠️', label: 'قطع تحت الحد الأدنى', value: totalPartsLowStock, color: totalPartsLowStock > 0 ? '#dc2626' : '#059669', bg: totalPartsLowStock > 0 ? '#fee2e2' : '#d1fae5' },
                { icon: '📦', label: 'طلبات جارية', value: pendingOrders, color: '#d97706', bg: '#fef3c7' },
                { icon: '📅', label: 'أيام سداد متفق عليها', value: `${supplier.paymentTermDays} يوم`, color: '#4f46e5', bg: '#ede9fe' },
              ].map((kpi, i) => (
                <div key={i} style={{
                  background: '#fff',
                  border: `1px solid #eeeff4`,
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    {kpi.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{kpi.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
              {[
                { key: 'parts', label: `🔩 القطع المرتبطة (${supplier._count.partSuppliers})` },
                { key: 'orders', label: `📋 سجل طلبات الشراء (${supplier._count.purchaseOrders})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as 'parts' | 'orders')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 9,
                    border: 'none',
                    background: activeTab === tab.key ? '#fff' : 'transparent',
                    color: activeTab === tab.key ? '#4f46e5' : '#6b7280',
                    fontSize: 13,
                    fontWeight: activeTab === tab.key ? 800 : 600,
                    cursor: 'pointer',
                    boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'parts' && (
              <div>
                {supplier.partSuppliers.length === 0 ? (
                  <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32 }}>🔩</div>
                    <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>لا توجد قطع مرتبطة بهذا المورد بعد</p>
                    <p style={{ fontSize: 12, color: '#9ca3af' }}>عند إضافة قطعة جديدة بالمخزون، اختر هذا المورد لتظهر هنا تلقائياً</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                    {supplier.partSuppliers.map((ps) => {
                      const inv = ps.part.inventory?.[0]
                      const qty = inv ? Number(inv.quantity) : 0
                      const minQty = inv ? Number(inv.minStockLevel) : 0
                      const isLow = qty <= minQty
                      return (
                        <div key={ps.id} style={{
                          background: '#fff',
                          border: `1.5px solid ${isLow ? '#fca5a5' : '#eeeff4'}`,
                          borderRadius: 14,
                          padding: 16,
                          position: 'relative',
                          overflow: 'hidden',
                        }}>
                          {isLow && (
                            <div style={{ position: 'absolute', top: 0, right: 0, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: '0 14px 0 8px' }}>
                              تحت الحد الأدنى
                            </div>
                          )}
                          {ps.isPreferred && (
                            <div style={{ position: 'absolute', top: isLow ? 20 : 0, right: 0, background: '#4f46e5', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: '0 0 0 8px' }}>
                              ⭐ مورد مفضل
                            </div>
                          )}
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1f2937' }}>
                              {ps.part.nameAr || ps.part.name}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontFamily: 'monospace' }}>
                              {ps.part.partNumber}
                            </div>
                          </div>
                          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <div>
                              <span style={{ color: '#94a3b8' }}>الكمية: </span>
                              <span style={{ fontWeight: 700, color: isLow ? '#dc2626' : '#059669' }}>{qty}</span>
                              <span style={{ color: '#94a3b8' }}> / الحد: {minQty}</span>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8' }}>سعر الشراء: </span>
                              <span style={{ fontWeight: 700, color: '#4f46e5' }}>{Number(ps.purchasePrice).toFixed(3)} د.ك</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'orders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {supplier.purchaseOrders.length === 0 ? (
                  <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32 }}>📋</div>
                    <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>لا توجد طلبات شراء لهذا المورد بعد</p>
                  </div>
                ) : (
                  supplier.purchaseOrders.map((po) => {
                    const statusInfo = STATUS_MAP[po.status] || { label: po.status, color: '#6b7280', bg: '#f3f4f6' }
                    const isExpanded = expandedPO === po.id
                    const waMsg = buildWhatsAppMessage(po)
                    return (
                      <div key={po.id} style={{
                        background: '#fff',
                        border: '1px solid #eeeff4',
                        borderRadius: 14,
                        overflow: 'hidden',
                      }}>
                        <div
                          style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
                          onClick={() => setExpandedPO(isExpanded ? null : po.id)}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1f2937' }}>{po.orderNumber}</span>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: statusInfo.color,
                                background: statusInfo.bg,
                                padding: '3px 10px',
                                borderRadius: 20,
                              }}>
                                {statusInfo.label}
                              </span>
                              {po.sentViaWhatsApp && (
                                <span style={{ fontSize: 11, color: '#16a34a', background: '#dcfce7', padding: '3px 8px', borderRadius: 20 }}>
                                  ✓ أُرسل عبر واتساب
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#64748b' }}>
                              {po.orderedAt && <span>📅 {new Date(po.orderedAt).toLocaleDateString('ar')}</span>}
                              {po.expectedAt && <span>⏱ متوقع: {new Date(po.expectedAt).toLocaleDateString('ar')}</span>}
                              <span>🔩 {po.items.length} صنف</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#4f46e5' }}>{Number(po.totalAmount).toFixed(3)}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>د.ك</div>
                          </div>
                          <div style={{ fontSize: 18, color: '#94a3b8' }}>{isExpanded ? '▲' : '▼'}</div>
                        </div>

                        {isExpanded && (
                          <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 18px', background: '#fafafa' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', borderRadius: '8px 0 0 8px' }}>القطعة</th>
                                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>رقم الصنف</th>
                                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>الكمية</th>
                                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>سعر الوحدة</th>
                                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', borderRadius: '0 8px 8px 0' }}>الإجمالي</th>
                                </tr>
                              </thead>
                              <tbody>
                                {po.items.map((item) => (
                                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1f2937' }}>{item.part.nameAr || item.part.name}</td>
                                    <td style={{ padding: '8px 10px', color: '#64748b', fontFamily: 'monospace' }}>{item.part.partNumber}</td>
                                    <td style={{ padding: '8px 10px', color: '#374151' }}>{item.quantity}</td>
                                    <td style={{ padding: '8px 10px', color: '#374151' }}>{Number(item.unitPrice).toFixed(3)} د.ك</td>
                                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#4f46e5' }}>{Number(item.totalPrice).toFixed(3)} د.ك</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {po.notes && (
                              <div style={{ marginTop: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#475569' }}>
                                📝 {po.notes}
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                              {po.status === 'PENDING' && (
                                <button
                                  onClick={() => handleUpdateStatus(po.id, 'ORDERED')}
                                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                >
                                  ✓ تأكيد الطلب
                                </button>
                              )}
                              {(po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED') && (
                                <button
                                  onClick={() => handleUpdateStatus(po.id, 'RECEIVED')}
                                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#d1fae5', color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                >
                                  📦 تأكيد الاستلام
                                </button>
                              )}
                              {po.status !== 'CANCELLED' && po.status !== 'RECEIVED' && (
                                <button
                                  onClick={() => handleUpdateStatus(po.id, 'CANCELLED')}
                                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                >
                                  ✕ إلغاء الطلب
                                </button>
                              )}
                              {supplier.whatsapp && (
                                <a
                                  href={`https://wa.me/${supplier.whatsapp}?text=${waMsg}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#dcfce7', color: '#16a34a', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}
                                >
                                  💬 إرسال عبر واتساب
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
