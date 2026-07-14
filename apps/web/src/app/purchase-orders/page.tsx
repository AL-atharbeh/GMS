'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface POItem {
  id: string
  part: { name: string; nameAr?: string; partNumber: string }
  quantity: number
  unitPrice: number
  totalPrice: number
  receivedQty: number
}

interface PurchaseOrder {
  id: string
  orderNumber: string
  status: PartOrderStatus
  totalAmount: number
  orderedAt?: string
  expectedAt?: string
  receivedAt?: string
  sentViaWhatsApp: boolean
  notes?: string
  createdAt: string
  supplier: {
    id: string
    name: string
    nameAr?: string
    whatsapp?: string
    phone?: string
  }
  items: POItem[]
}

interface Supplier {
  id: string
  name: string
  nameAr?: string
  whatsapp?: string
}

interface Part {
  id: string
  name: string
  nameAr?: string
  partNumber: string
  purchasePrice: number
  inventory?: Array<{ quantity: number; minStockLevel: number }>
}

type PartOrderStatus = 'PENDING' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'
type TabFilter = 'all' | PartOrderStatus

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<PartOrderStatus, { label: string; color: string; bg: string; dot: string }> = {
  PENDING:            { label: 'في الانتظار',    color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  ORDERED:            { label: 'تم الطلب',        color: '#1e40af', bg: '#dbeafe', dot: '#3b82f6' },
  PARTIALLY_RECEIVED: { label: 'استلام جزئي',     color: '#6d28d9', bg: '#ede9fe', dot: '#8b5cf6' },
  RECEIVED:           { label: 'مستلم',           color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  CANCELLED:          { label: 'ملغي',             color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
}

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1.5px solid #e2e8f0',
  fontSize: 13,
  outline: 'none',
  background: '#f8fafc',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  color: '#1f2937',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: '#475569',
  marginBottom: 5,
  display: 'block',
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PurchaseOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Receive flow
  const [receiveModal, setReceiveModal] = useState<PurchaseOrder | null>(null)
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({})
  const [receiving, setReceiving] = useState(false)

  // New PO form
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poItems, setPoItems] = useState<Array<{ partId: string; quantity: number; unitPrice: number }>>([
    { partId: '', quantity: 1, unitPrice: 0 },
  ])

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    try {
      setLoading(true)
      const [suppRes, invRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/inventory'),
      ])
      const supplierList: Supplier[] = suppRes.data.data || []
      const partList: Part[] = invRes.data.data || []

      setSuppliers(supplierList)
      setParts(partList)

      // Collect all POs from all suppliers
      const allPOs: PurchaseOrder[] = []
      for (const sup of supplierList) {
        try {
          const poRes = await api.get(`/suppliers/${sup.id}/purchase-orders`)
          const supsOrders = (poRes.data.data || []).map((po: PurchaseOrder) => ({
            ...po,
            supplier: { id: sup.id, name: sup.name, nameAr: sup.nameAr, whatsapp: sup.whatsapp, phone: (sup as Supplier & { phone?: string }).phone },
          }))
          allPOs.push(...supsOrders)
        } catch {
          // skip
        }
      }
      // Sort by createdAt desc
      allPOs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setOrders(allPOs)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (poId: string, _supplierId: string, status: string) => {
    try {
      await api.patch(`/suppliers/purchase-orders/${poId}/status`, { status })
      fetchAll()
    } catch {
      alert('فشل تحديث الحالة')
    }
  }

  const openReceiveModal = (po: PurchaseOrder) => {
    const initialQtys: Record<string, number> = {}
    po.items.forEach((item) => {
      const remaining = Number(item.quantity) - Number(item.receivedQty)
      initialQtys[item.id] = remaining > 0 ? remaining : 0
    })
    setReceiveQtys(initialQtys)
    setReceiveModal(po)
  }

  const handleReceive = async () => {
    if (!receiveModal) return
    const items = Object.entries(receiveQtys)
      .filter(([, qty]) => qty > 0)
      .map(([id, receivedQty]) => ({ id, receivedQty }))
    if (items.length === 0) {
      alert('أدخل كمية استلام واحدة على الأقل')
      return
    }
    try {
      setReceiving(true)
      await api.patch(`/suppliers/purchase-orders/${receiveModal.id}/status`, {
        status: 'RECEIVING',
        items,
      })
      setReceiveModal(null)
      fetchAll()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      alert(msg || 'فشل تسجيل الاستلام')
    } finally {
      setReceiving(false)
    }
  }

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSupplierId) { alert('اختر المورد أولاً'); return }
    const validItems = poItems.filter((it) => it.partId && it.quantity > 0 && it.unitPrice > 0)
    if (validItems.length === 0) { alert('أضف عنصراً واحداً على الأقل بكمية وسعر صحيح'); return }
    try {
      setSubmitting(true)
      await api.post(`/suppliers/${selectedSupplierId}/purchase-orders`, {
        items: validItems,
        expectedAt: expectedAt || undefined,
        notes: poNotes || undefined,
      })
      setShowNewModal(false)
      setSelectedSupplierId('')
      setExpectedAt('')
      setPoNotes('')
      setPoItems([{ partId: '', quantity: 1, unitPrice: 0 }])
      fetchAll()
    } catch {
      alert('فشل إنشاء طلب الشراء')
    } finally {
      setSubmitting(false)
    }
  }

  const buildWhatsAppMessage = (po: PurchaseOrder) => {
    const lines = [
      `*طلب شراء — ${po.supplier.nameAr || po.supplier.name}*`,
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

  // ─── Derived Stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = orders.length
    const pending = orders.filter((o) => o.status === 'PENDING').length
    const ordered = orders.filter((o) => o.status === 'ORDERED').length
    const received = orders.filter((o) => o.status === 'RECEIVED').length
    const totalValue = orders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + Number(o.totalAmount), 0)
    return { total, pending, ordered, received, totalValue }
  }, [orders])

  // ─── Filtered Orders ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchTab = activeTab === 'all' || o.status === activeTab
      const term = searchTerm.toLowerCase()
      const matchSearch =
        !term ||
        o.orderNumber.toLowerCase().includes(term) ||
        o.supplier.name.toLowerCase().includes(term) ||
        (o.supplier.nameAr && o.supplier.nameAr.includes(searchTerm))
      return matchTab && matchSearch
    })
  }, [orders, activeTab, searchTerm])

  const TABS: Array<{ key: TabFilter; label: string }> = [
    { key: 'all', label: `الكل (${orders.length})` },
    { key: 'PENDING', label: `في الانتظار (${stats.pending})` },
    { key: 'ORDERED', label: `تم الطلب (${stats.ordered})` },
    { key: 'PARTIALLY_RECEIVED', label: `استلام جزئي` },
    { key: 'RECEIVED', label: `مستلم (${stats.received})` },
    { key: 'CANCELLED', label: 'ملغي' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          title="طلبات الشراء"
          subtitle="متابعة وإصدار أوامر شراء قطع الغيار من الموردين"
          actions={
            <button
              onClick={() => setShowNewModal(true)}
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ➕ إنشاء طلب شراء
            </button>
          }
        />

        <main style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

            {/* ── KPI Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: 14 }}>
              {[
                { icon: '📋', label: 'إجمالي الطلبات', value: stats.total, color: '#4f46e5', bg: '#ede9fe' },
                { icon: '⏳', label: 'في الانتظار', value: stats.pending, color: stats.pending > 0 ? '#d97706' : '#6b7280', bg: stats.pending > 0 ? '#fef3c7' : '#f3f4f6' },
                { icon: '✈️', label: 'تم الطلب', value: stats.ordered, color: '#1d4ed8', bg: '#dbeafe' },
                { icon: '✅', label: 'مستلمة', value: stats.received, color: '#059669', bg: '#d1fae5' },
                { icon: '💰', label: 'إجمالي قيمة الطلبات', value: `${stats.totalValue.toFixed(3)} د.ك`, color: '#0891b2', bg: '#cffafe' },
              ].map((kpi, i) => (
                <div
                  key={i}
                  style={{
                    background: '#fff',
                    border: '1px solid #eeeff4',
                    borderRadius: 14,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {kpi.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: typeof kpi.value === 'string' ? 14 : 20, fontWeight: 900, color: kpi.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {kpi.value}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{kpi.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Search + Filter Row ── */}
            <div style={{
              background: '#fff',
              border: '1px solid #eeeff4',
              borderRadius: 14,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 380 }}>
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8' }}>🔍</span>
                <input
                  type="text"
                  placeholder="ابحث برقم الطلب أو اسم المورد..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 34 }}
                />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginRight: 'auto' }}>
                يُعرض <span style={{ color: '#4f46e5', fontWeight: 800 }}>{filtered.length}</span> من {orders.length} طلب
              </div>
              <button
                onClick={() => router.push('/suppliers')}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: '#f8fafc',
                  color: '#374151',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                🏭 إدارة الموردين
              </button>
            </div>

            {/* ── Status Tabs ── */}
            <div style={{
              background: '#fff',
              border: '1px solid #eeeff4',
              borderRadius: 14,
              padding: 6,
              display: 'flex',
              gap: 4,
              overflowX: 'auto',
            }}>
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: activeTab === tab.key ? '#4f46e5' : 'transparent',
                    color: activeTab === tab.key ? '#fff' : '#6b7280',
                    fontSize: 12.5,
                    fontWeight: activeTab === tab.key ? 800 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                    boxShadow: activeTab === tab.key ? '0 2px 8px rgba(79,70,229,0.2)' : 'none',
                  }}
                >
                  {tab.key !== 'all' && tab.key !== 'PARTIALLY_RECEIVED' && tab.key !== 'CANCELLED' && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: activeTab === tab.key ? '#fff' : (STATUS_MAP[tab.key as PartOrderStatus]?.dot || '#6b7280'),
                        marginLeft: 6,
                        verticalAlign: 'middle',
                      }}
                    />
                  )}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Orders List ── */}
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                  <span style={{ fontSize: 13, color: '#9ca3af' }}>جاري تحميل طلبات الشراء...</span>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{
                background: '#fff',
                border: '1px dashed #cbd5e1',
                borderRadius: 18,
                padding: '64px 24px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1f2937' }}>
                  {searchTerm || activeTab !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا توجد طلبات شراء بعد'}
                </div>
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>
                  {activeTab !== 'all' ? 'جرب تبويباً آخر' : 'أنشئ أول طلب شراء من الموردين'}
                </p>
                {activeTab === 'all' && !searchTerm && (
                  <button
                    onClick={() => setShowNewModal(true)}
                    style={{
                      marginTop: 16,
                      padding: '10px 24px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ➕ إنشاء طلب شراء
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filtered.map((po) => {
                  const status = STATUS_MAP[po.status]
                  const isExpanded = expandedId === po.id
                  const receivedValue = po.items.reduce((s, i) => s + Number(i.receivedQty) * Number(i.unitPrice), 0)
                  const pendingValue = Number(po.totalAmount) - receivedValue
                  const waMsg = buildWhatsAppMessage(po)
                  const isOverdue = po.expectedAt && new Date(po.expectedAt) < new Date() && po.status !== 'RECEIVED' && po.status !== 'CANCELLED'

                  return (
                    <div
                      key={po.id}
                      style={{
                        background: '#fff',
                        border: `1.5px solid ${isExpanded ? '#a5b4fc' : isOverdue ? '#fca5a5' : '#eeeff4'}`,
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: isExpanded ? '0 4px 16px rgba(79,70,229,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {/* ── Card Header ── */}
                      <div
                        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}
                        onClick={() => setExpandedId(isExpanded ? null : po.id)}
                      >
                        {/* Status Dot */}
                        <div style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: status.dot,
                          flexShrink: 0,
                          boxShadow: `0 0 0 3px ${status.bg}`,
                        }} />

                        {/* Order Number + Supplier */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 900, color: '#1f2937', fontFamily: 'monospace' }}>
                              {po.orderNumber}
                            </span>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: status.color,
                              background: status.bg,
                              padding: '3px 10px',
                              borderRadius: 20,
                            }}>
                              {status.label}
                            </span>
                            {po.sentViaWhatsApp && (
                              <span style={{ fontSize: 10.5, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                                ✓ أُرسل واتساب
                              </span>
                            )}
                            {isOverdue && (
                              <span style={{ fontSize: 10.5, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                                ⚠️ متأخر
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 14, marginTop: 5, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: '#4f46e5' }}>🏭 {po.supplier.nameAr || po.supplier.name}</span>
                            {po.orderedAt && <span>📅 {new Date(po.orderedAt).toLocaleDateString('ar')}</span>}
                            {po.expectedAt && (
                              <span style={{ color: isOverdue ? '#dc2626' : '#64748b' }}>
                                ⏱ متوقع: {new Date(po.expectedAt).toLocaleDateString('ar')}
                              </span>
                            )}
                            <span>🔩 {po.items.length} صنف</span>
                          </div>
                        </div>

                        {/* Total */}
                        <div style={{ textAlign: 'center', flexShrink: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#4f46e5' }}>
                            {Number(po.totalAmount).toFixed(3)}
                          </div>
                          <div style={{ fontSize: 10.5, color: '#94a3b8' }}>د.ك</div>
                        </div>

                        {/* Expand Arrow */}
                        <div style={{
                          fontSize: 13,
                          color: '#94a3b8',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                          flexShrink: 0,
                        }}>
                          ▼
                        </div>
                      </div>

                      {/* ── Expanded Detail ── */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
                          {/* Items Table */}
                          <div style={{ padding: '14px 20px' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                              تفاصيل الأصناف المطلوبة
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 500 }}>
                                <thead>
                                  <tr style={{ background: '#f1f5f9' }}>
                                    {['القطعة', 'رقم الصنف', 'الكمية', 'تم استلام', 'سعر الوحدة', 'الإجمالي'].map((h, i) => (
                                      <th key={i} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#475569', borderRadius: i === 0 ? '8px 0 0 8px' : i === 5 ? '0 8px 8px 0' : undefined }}>
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {po.items.map((item) => {
                                    const isPartialReceived = Number(item.receivedQty) > 0 && Number(item.receivedQty) < Number(item.quantity)
                                    const isFullReceived = Number(item.receivedQty) >= Number(item.quantity)
                                    return (
                                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1f2937' }}>
                                          {item.part.nameAr || item.part.name}
                                        </td>
                                        <td style={{ padding: '9px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>
                                          {item.part.partNumber}
                                        </td>
                                        <td style={{ padding: '9px 12px', color: '#374151' }}>
                                          {item.quantity}
                                        </td>
                                        <td style={{ padding: '9px 12px' }}>
                                          <span style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: isFullReceived ? '#059669' : isPartialReceived ? '#7c3aed' : '#94a3b8',
                                            background: isFullReceived ? '#d1fae5' : isPartialReceived ? '#ede9fe' : '#f3f4f6',
                                            padding: '2px 8px',
                                            borderRadius: 20,
                                          }}>
                                            {item.receivedQty} / {item.quantity}
                                          </span>
                                        </td>
                                        <td style={{ padding: '9px 12px', color: '#374151' }}>
                                          {Number(item.unitPrice).toFixed(3)} د.ك
                                        </td>
                                        <td style={{ padding: '9px 12px', fontWeight: 700, color: '#4f46e5' }}>
                                          {Number(item.totalPrice).toFixed(3)} د.ك
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr style={{ background: '#f8fafc' }}>
                                    <td colSpan={5} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 12 }}>
                                      الإجمالي الكلي
                                    </td>
                                    <td style={{ padding: '10px 12px', fontWeight: 900, color: '#1e1b4b', fontSize: 14 }}>
                                      {Number(po.totalAmount).toFixed(3)} د.ك
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>

                            {/* Summary Row */}
                            {(po.status === 'PARTIALLY_RECEIVED' || po.status === 'ORDERED') && (
                              <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, background: '#d1fae5', borderRadius: 10, padding: '8px 14px' }}>
                                  <div style={{ fontSize: 11, color: '#065f46' }}>تم استلامه</div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>{receivedValue.toFixed(3)} د.ك</div>
                                </div>
                                <div style={{ flex: 1, background: '#fef3c7', borderRadius: 10, padding: '8px 14px' }}>
                                  <div style={{ fontSize: 11, color: '#92400e' }}>متبقي</div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: '#d97706' }}>{pendingValue.toFixed(3)} د.ك</div>
                                </div>
                              </div>
                            )}

                            {/* Notes */}
                            {po.notes && (
                              <div style={{ marginTop: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#475569' }}>
                                📝 {po.notes}
                              </div>
                            )}
                          </div>

                          {/* Action Bar */}
                          <div style={{
                            padding: '12px 20px',
                            borderTop: '1px solid #f1f5f9',
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            background: '#fff',
                          }}>
                            {po.status === 'PENDING' && (
                              <button
                                onClick={() => handleUpdateStatus(po.id, po.supplier.id, 'ORDERED')}
                                style={actionBtn('#dbeafe', '#1d4ed8')}
                              >
                                ✓ تأكيد الإرسال للمورد
                              </button>
                            )}
                            {/* ── Receive Button: opens per-item modal ── */}
                            {(po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED' || po.status === 'PENDING') && (
                              <button
                                onClick={() => openReceiveModal(po)}
                                style={{
                                  ...actionBtn('#d1fae5', '#065f46'),
                                  border: '1.5px solid #6ee7b7',
                                  fontWeight: 800,
                                }}
                              >
                                📦 استلام الأصناف
                              </button>
                            )}
                            {po.status !== 'CANCELLED' && po.status !== 'RECEIVED' && (
                              <button
                                onClick={() => handleUpdateStatus(po.id, po.supplier.id, 'CANCELLED')}
                                style={actionBtn('#fee2e2', '#dc2626')}
                              >
                                ✕ إلغاء الطلب
                              </button>
                            )}
                            {po.supplier.whatsapp && (
                              <a
                                href={`https://wa.me/${po.supplier.whatsapp}?text=${waMsg}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ ...actionBtn('#dcfce7', '#16a34a'), textDecoration: 'none' }}
                              >
                                💬 إرسال للمورد عبر واتساب
                              </a>
                            )}
                            <button
                              onClick={() => router.push(`/suppliers/${po.supplier.id}`)}
                              style={{ ...actionBtn('#f1f5f9', '#475569'), marginRight: 'auto' }}
                            >
                              🏭 صفحة المورد
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Receive Modal ── */}
      {receiveModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setReceiveModal(null) }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 24,
              boxShadow: '0 25px 60px -12px rgba(0,0,0,0.18)',
              width: '100%',
              maxWidth: 580,
              maxHeight: '88vh',
              overflowY: 'auto',
              direction: 'rtl',
              padding: '28px 32px',
              boxSizing: 'border-box',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📦</div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1f2937', margin: 0 }}>استلام الأصناف</h3>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{receiveModal.orderNumber} — {receiveModal.supplier.nameAr || receiveModal.supplier.name}</p>
                </div>
              </div>
              <button
                onClick={() => setReceiveModal(null)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6b7280', cursor: 'pointer' }}
              >×</button>
            </div>

            {/* Info Banner */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#166534' }}>
              💡 أدخل الكمية التي وصلت فعلياً من كل صنف. الكمية المتبقية ستضاف للمخزون تلقائياً وسيتحدث سعر الشراء.
            </div>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {receiveModal.items.map((item) => {
                const alreadyReceived = Number(item.receivedQty)
                const ordered = Number(item.quantity)
                const remaining = ordered - alreadyReceived
                const incoming = receiveQtys[item.id] ?? 0
                const afterReceive = alreadyReceived + incoming
                const pct = ordered > 0 ? Math.round((afterReceive / ordered) * 100) : 0
                const isComplete = afterReceive >= ordered

                return (
                  <div
                    key={item.id}
                    style={{
                      background: remaining <= 0 ? '#f0fdf4' : '#fafafa',
                      border: `1.5px solid ${remaining <= 0 ? '#bbf7d0' : '#eeeff4'}`,
                      borderRadius: 14,
                      padding: '14px 16px',
                    }}
                  >
                    {/* Part Name */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1f2937' }}>
                          {item.part.nameAr || item.part.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>{item.part.partNumber}</div>
                      </div>
                      {remaining <= 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '3px 10px', borderRadius: 20 }}>✓ مكتمل</span>
                      )}
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 12 }}>
                      <div style={{ flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, color: '#374151' }}>{ordered}</div>
                        <div style={{ color: '#94a3b8', fontSize: 10.5 }}>المطلوب</div>
                      </div>
                      <div style={{ flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, color: '#059669' }}>{alreadyReceived}</div>
                        <div style={{ color: '#94a3b8', fontSize: 10.5 }}>سبق استلامه</div>
                      </div>
                      <div style={{ flex: 1, background: remaining > 0 ? '#fef3c7' : '#d1fae5', border: `1px solid ${remaining > 0 ? '#fde68a' : '#bbf7d0'}`, borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, color: remaining > 0 ? '#d97706' : '#059669' }}>{remaining}</div>
                        <div style={{ color: '#94a3b8', fontSize: 10.5 }}>المتبقي</div>
                      </div>
                    </div>

                    {/* Input */}
                    {remaining > 0 && (
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5 }}>
                          الكمية الواصلة الآن (الحد الأقصى: {remaining})
                        </label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            value={incoming}
                            onChange={(e) => {
                              const val = Math.min(Number(e.target.value), remaining)
                              setReceiveQtys((prev) => ({ ...prev, [item.id]: Math.max(0, val) }))
                            }}
                            style={{
                              flex: 1,
                              padding: '9px 12px',
                              borderRadius: 10,
                              border: `1.5px solid ${incoming > 0 ? '#6ee7b7' : '#e2e8f0'}`,
                              fontSize: 14,
                              fontWeight: 700,
                              outline: 'none',
                              background: incoming > 0 ? '#f0fdf4' : '#f8fafc',
                              color: '#1f2937',
                              textAlign: 'center',
                              transition: 'all 0.15s',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setReceiveQtys((prev) => ({ ...prev, [item.id]: remaining }))}
                            style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: '#ede9fe', color: '#4f46e5', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            كل المتبقي
                          </button>
                        </div>

                        {/* Progress bar */}
                        {incoming > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                              <span>بعد الاستلام: {afterReceive} / {ordered}</span>
                              <span style={{ fontWeight: 700, color: isComplete ? '#059669' : '#d97706' }}>{pct}%</span>
                            </div>
                            <div style={{ height: 6, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: isComplete ? '#10b981' : '#f59e0b', borderRadius: 99, transition: 'width 0.2s' }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Summary + Confirm */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '14px 18px', marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#166534' }}>
                <span>إجمالي الكمية الواصلة الآن:</span>
                <span>{Object.values(receiveQtys).reduce((s, q) => s + q, 0)} وحدة</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                سيتم رفع المخزون تلقائياً وتسجيل حركة دخول لكل صنف.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setReceiveModal(null)}
                style={{ padding: '10px 22px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                إلغاء
              </button>
              <button
                onClick={handleReceive}
                disabled={receiving || Object.values(receiveQtys).every((q) => q === 0)}
                style={{
                  padding: '10px 28px',
                  borderRadius: 12,
                  border: 'none',
                  background: receiving ? '#a7f3d0' : 'linear-gradient(135deg, #059669, #10b981)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: receiving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(5,150,105,0.2)',
                  opacity: Object.values(receiveQtys).every((q) => q === 0) ? 0.5 : 1,
                }}
              >
                {receiving ? '⏳ جاري التسجيل...' : '✓ تأكيد الاستلام وتحديث المخزون'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New PO Modal ── */}
      {showNewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.35)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false) }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 24,
              boxShadow: '0 25px 60px -12px rgba(0,0,0,0.14)',
              width: '100%',
              maxWidth: 620,
              maxHeight: '90vh',
              overflowY: 'auto',
              direction: 'rtl',
              padding: '28px 32px',
              boxSizing: 'border-box',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  📋
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1f2937', margin: 0 }}>إنشاء طلب شراء جديد</h3>
                  <p style={{ fontSize: 11.5, color: '#6b7280', margin: 0 }}>حدد المورد والأصناف المطلوبة</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6b7280', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreatePO} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Supplier Select */}
              <div>
                <label style={labelStyle}>المورد *</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  required
                >
                  <option value="">— اختر المورد —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.nameAr || s.name}</option>
                  ))}
                </select>
              </div>

              {/* Expected Date */}
              <div>
                <label style={labelStyle}>تاريخ الاستلام المتوقع (اختياري)</label>
                <input
                  type="date"
                  value={expectedAt}
                  onChange={(e) => setExpectedAt(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Items */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>الأصناف المطلوبة *</label>
                  <button
                    type="button"
                    onClick={() => setPoItems([...poItems, { partId: '', quantity: 1, unitPrice: 0 }])}
                    style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#ede9fe', color: '#4f46e5', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    + إضافة صنف
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {poItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 80px 100px 32px',
                        gap: 8,
                        background: '#f8fafc',
                        borderRadius: 10,
                        padding: '10px 12px',
                        border: '1px solid #eeeff4',
                        alignItems: 'center',
                      }}
                    >
                      <select
                        value={item.partId}
                        onChange={(e) => {
                          const part = parts.find((p) => p.id === e.target.value)
                          const newItems = [...poItems]
                          newItems[idx] = {
                            ...newItems[idx],
                            partId: e.target.value,
                            unitPrice: part ? Number(part.purchasePrice) : 0,
                          }
                          setPoItems(newItems)
                        }}
                        style={{ ...inputStyle, background: '#fff', cursor: 'pointer', fontSize: 12 }}
                        required
                      >
                        <option value="">— اختر القطعة —</option>
                        {parts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nameAr || p.name} ({p.partNumber})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        placeholder="الكمية"
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...poItems]
                          newItems[idx].quantity = Number(e.target.value)
                          setPoItems(newItems)
                        }}
                        style={{ ...inputStyle, background: '#fff', textAlign: 'center', fontSize: 12 }}
                        required
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.001}
                        placeholder="السعر"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const newItems = [...poItems]
                          newItems[idx].unitPrice = Number(e.target.value)
                          setPoItems(newItems)
                        }}
                        style={{ ...inputStyle, background: '#fff', textAlign: 'center', fontSize: 12 }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))}
                        disabled={poItems.length === 1}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          border: 'none',
                          background: poItems.length === 1 ? '#f3f4f6' : '#fee2e2',
                          color: poItems.length === 1 ? '#9ca3af' : '#dc2626',
                          cursor: poItems.length === 1 ? 'not-allowed' : 'pointer',
                          fontSize: 14,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total Preview */}
                <div style={{ marginTop: 10, background: '#ede9fe', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9' }}>إجمالي الطلب:</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#4f46e5' }}>
                    {poItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(3)} د.ك
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>ملاحظات (اختياري)</label>
                <textarea
                  placeholder="ملاحظات للمورد..."
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  style={{ ...inputStyle, height: 60, resize: 'none' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #eeeff4', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  style={{ padding: '10px 22px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 28px',
                    borderRadius: 12,
                    border: 'none',
                    background: submitting ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                  }}
                >
                  {submitting ? '⏳ جاري الإنشاء...' : '📋 إنشاء طلب الشراء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helper ──────────────────────────────────────────────────────────────────
function actionBtn(bg: string, color: string): React.CSSProperties {
  return {
    padding: '7px 14px',
    borderRadius: 9,
    border: 'none',
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  }
}
