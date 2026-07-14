'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

interface Part {
  id: string
  name: string
  nameAr?: string
  partNumber: string
}

interface PartSupplier {
  id: string
  part: Part
  isPreferred: boolean
}

interface PurchaseOrder {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
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

const AVATAR_COLORS = [
  { bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)', text: '#2563eb', border: '#bfdbfe' },
  { bg: 'linear-gradient(135deg, #faf5ff, #ede9fe)', text: '#7c3aed', border: '#ddd6fe' },
  { bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', text: '#059669', border: '#a7f3d0' },
  { bg: 'linear-gradient(135deg, #fff7ed, #fed7aa)', text: '#ea580c', border: '#fdba74' },
  { bg: 'linear-gradient(135deg, #fdf2f8, #fce7f3)', text: '#db2777', border: '#fbcfe8' },
  { bg: 'linear-gradient(135deg, #f0fdf4, #bbf7d0)', text: '#16a34a', border: '#86efac' },
]

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  PENDING: { color: '#b45309', bg: '#fef3c7' },
  ORDERED: { color: '#1d4ed8', bg: '#dbeafe' },
  RECEIVED: { color: '#059669', bg: '#d1fae5' },
  CANCELLED: { color: '#dc2626', bg: '#fee2e2' },
}

export default function SuppliersPage() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    phone: '',
    whatsapp: '',
    email: '',
    contactPerson: '',
    address: '',
    paymentTermDays: 30,
    notes: '',
  })

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      const res = await api.get('/suppliers')
      setSuppliers(res.data.data || [])
    } catch (err) {
      console.error('Error fetching suppliers', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      await api.post('/suppliers', {
        ...form,
        paymentTermDays: Number(form.paymentTermDays),
      })
      setShowAddModal(false)
      setForm({ name: '', nameAr: '', phone: '', whatsapp: '', email: '', contactPerson: '', address: '', paymentTermDays: 30, notes: '' })
      fetchSuppliers()
    } catch {
      alert('فشل إضافة المورد')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.nameAr && s.nameAr.includes(searchTerm)) ||
      (s.phone && s.phone.includes(searchTerm)) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const totalParts = suppliers.reduce((sum, s) => sum + s._count.partSuppliers, 0)
  const totalPOs = suppliers.reduce((sum, s) => sum + s._count.purchaseOrders, 0)
  const activePOs = suppliers.reduce(
    (sum, s) => sum + s.purchaseOrders.filter((po) => po.status === 'PENDING' || po.status === 'ORDERED').length,
    0
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          title="إدارة الموردين"
          subtitle="إدارة شركات توريد قطع الغيار وربطها بالمخزون وطلبات الشراء"
          actions={
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
              }}
            >
              ➕ إضافة مورد جديد
            </button>
          }
        />

        <main style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
              {[
                { icon: '🏭', label: 'إجمالي الموردين', value: suppliers.length, color: '#4f46e5', bg: '#ede9fe' },
                { icon: '🔩', label: 'إجمالي القطع المرتبطة', value: totalParts, color: '#0891b2', bg: '#cffafe' },
                { icon: '📋', label: 'إجمالي طلبات الشراء', value: totalPOs, color: '#059669', bg: '#d1fae5' },
                { icon: '⏳', label: 'طلبات جارية', value: activePOs, color: activePOs > 0 ? '#d97706' : '#6b7280', bg: activePOs > 0 ? '#fef3c7' : '#f3f4f6' },
              ].map((kpi, i) => (
                <div key={i} style={{
                  background: '#fff',
                  border: '1px solid #eeeff4',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
                    {kpi.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{kpi.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Search */}
            <div style={{
              background: '#fff',
              border: '1px solid #eeeff4',
              borderRadius: 14,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
            }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8' }}>🔍</span>
                <input
                  type="text"
                  placeholder="ابحث باسم المورد أو الهاتف أو الشخص المسؤول..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 34 }}
                />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap' }}>
                يُعرض: <span style={{ color: '#4f46e5' }}>{filteredSuppliers.length}</span> من {suppliers.length}
              </div>
            </div>

            {/* Cards Grid */}
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>جاري تحميل الموردين...</span>
                </div>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div style={{
                background: '#fff',
                border: '1px dashed #cbd5e1',
                borderRadius: 18,
                padding: '64px 24px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>🏭</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1f2937' }}>لا توجد نتائج مطابقة</div>
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>
                  {searchTerm ? 'جرب كلمة بحث مختلفة' : 'ابدأ بإضافة أول مورد لقطع الغيار'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
                {filteredSuppliers.map((sup) => {
                  const avatarColor = AVATAR_COLORS[sup.name.length % AVATAR_COLORS.length]
                  const latestPO = sup.purchaseOrders[0]
                  const activePOCount = sup.purchaseOrders.filter(
                    (po) => po.status === 'PENDING' || po.status === 'ORDERED'
                  ).length

                  return (
                    <div
                      key={sup.id}
                      onClick={() => router.push(`/suppliers/${sup.id}`)}
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #eeeff4',
                        borderRadius: 18,
                        padding: 0,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        overflow: 'hidden',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(79,70,229,0.12)'
                        e.currentTarget.style.borderColor = '#a5b4fc'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)'
                        e.currentTarget.style.borderColor = '#eeeff4'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      {/* Card Header */}
                      <div style={{
                        background: avatarColor.bg,
                        padding: '18px 18px 14px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}>
                        <div style={{
                          width: 46,
                          height: 46,
                          borderRadius: 12,
                          background: '#fff',
                          border: `1.5px solid ${avatarColor.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                          fontWeight: 900,
                          color: avatarColor.text,
                          flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        }}>
                          {sup.nameAr ? sup.nameAr[0] : sup.name[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1f2937', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sup.nameAr || sup.name}
                          </h3>
                          {sup.nameAr && sup.name && (
                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sup.name}
                            </div>
                          )}
                          {sup.contactPerson && (
                            <div style={{ fontSize: 11.5, color: '#475569', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              👤 {sup.contactPerson}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 14, color: '#6b7280' }}>›</div>
                      </div>

                      {/* Card Body */}
                      <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* Contact Info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {sup.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                              <span style={{ color: '#94a3b8', width: 14 }}>📞</span>
                              <a
                                href={`tel:${sup.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontWeight: 600, color: '#374151', textDecoration: 'none', fontFamily: 'monospace' }}
                              >
                                {sup.phone}
                              </a>
                            </div>
                          )}
                          {sup.whatsapp && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                              <span style={{ color: '#94a3b8', width: 14 }}>💬</span>
                              <a
                                href={`https://wa.me/${sup.whatsapp}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontWeight: 600, color: '#16a34a', textDecoration: 'none', fontFamily: 'monospace' }}
                              >
                                {sup.whatsapp}
                              </a>
                            </div>
                          )}
                          {sup.address && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                              <span style={{ color: '#94a3b8', width: 14 }}>📍</span>
                              <span style={{ color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sup.address}</span>
                            </div>
                          )}
                        </div>

                        {/* Stats Row */}
                        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                          <div style={{
                            flex: 1,
                            background: '#f8fafc',
                            borderRadius: 10,
                            padding: '8px 10px',
                            textAlign: 'center',
                          }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#4f46e5' }}>{sup._count.partSuppliers}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>قطعة</div>
                          </div>
                          <div style={{
                            flex: 1,
                            background: '#f8fafc',
                            borderRadius: 10,
                            padding: '8px 10px',
                            textAlign: 'center',
                          }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#0891b2' }}>{sup._count.purchaseOrders}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>طلب شراء</div>
                          </div>
                          <div style={{
                            flex: 1,
                            background: activePOCount > 0 ? '#fef3c7' : '#f8fafc',
                            borderRadius: 10,
                            padding: '8px 10px',
                            textAlign: 'center',
                          }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: activePOCount > 0 ? '#d97706' : '#94a3b8' }}>{activePOCount}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>جارٍ</div>
                          </div>
                        </div>

                        {/* Latest PO */}
                        {latestPO && (
                          <div style={{
                            background: '#f8fafc',
                            borderRadius: 10,
                            padding: '8px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#1f2937' }}>{latestPO.orderNumber}</div>
                              <div style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(latestPO.createdAt).toLocaleDateString('ar')}</div>
                            </div>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: (STATUS_COLORS[latestPO.status] || { color: '#6b7280' }).color,
                              background: (STATUS_COLORS[latestPO.status] || { bg: '#f3f4f6' }).bg,
                              padding: '3px 8px',
                              borderRadius: 20,
                            }}>
                              {latestPO.status === 'PENDING' ? 'في الانتظار' :
                               latestPO.status === 'ORDERED' ? 'تم الطلب' :
                               latestPO.status === 'RECEIVED' ? 'مستلم' :
                               latestPO.status === 'CANCELLED' ? 'ملغي' : latestPO.status}
                            </span>
                          </div>
                        )}

                        {/* Payment Terms */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                          <span style={{ color: '#94a3b8' }}>شروط الدفع:</span>
                          <span style={{ fontWeight: 700, color: '#475569' }}>{sup.paymentTermDays} يوم</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
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
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false) }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #eeeff4',
              borderRadius: 24,
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.12)',
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              direction: 'rtl',
              padding: '28px 32px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  🏭
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1f2937', margin: 0 }}>إضافة مورد جديد</h3>
                  <p style={{ fontSize: 11.5, color: '#6b7280', margin: 0 }}>سيظهر في قائمة الموردين ويمكن ربطه بالقطع</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6b7280', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Arabic / English names */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>الاسم بالعربية *</label>
                  <input
                    type="text"
                    placeholder="شركة قطع الغيار..."
                    value={form.nameAr}
                    onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>الاسم بالإنجليزية *</label>
                  <input
                    type="text"
                    placeholder="Parts Corp..."
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              {/* Phone + WhatsApp */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>رقم الهاتف</label>
                  <input
                    type="text"
                    placeholder="50144012"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>رقم الواتساب (مع كود الدولة)</label>
                  <input
                    type="text"
                    placeholder="96550144012"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Email + Contact Person */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>البريد الإلكتروني</label>
                  <input
                    type="email"
                    placeholder="supplier@mail.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>الشخص المسؤول</label>
                  <input
                    type="text"
                    placeholder="مسؤول المبيعات..."
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Address + Payment Terms */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>العنوان / الموقع</label>
                  <input
                    type="text"
                    placeholder="الشويخ الصناعية..."
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>أيام الدفع الآجل</label>
                  <input
                    type="number"
                    placeholder="30"
                    min={0}
                    max={365}
                    value={form.paymentTermDays}
                    onChange={(e) => setForm({ ...form, paymentTermDays: Number(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>ملاحظات إضافية</label>
                <textarea
                  placeholder="توصيل سريع، خصم على الكميات..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ ...inputStyle, height: 60, resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #eeeff4', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {submitting ? '⏳ جاري الحفظ...' : '💾 حفظ المورد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
