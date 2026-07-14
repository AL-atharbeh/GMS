'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import Link from 'next/link'

interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  createdAt: string
  noShowCount?: number
  noShowLevel?: 'OK' | 'WARN' | 'CRITICAL'
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    type: 'INDIVIDUAL' as 'INDIVIDUAL' | 'FLEET',
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const res = await api.get('/customers')
      setCustomers(res.data.data || [])
    } catch (err) {
      console.error('Error fetching customers', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/customers', form)
      setShowAddModal(false)
      setForm({ name: '', phone: '', email: '', type: 'INDIVIDUAL' })
      fetchCustomers()
    } catch (err) {
      alert('فشل إضافة العميل')
    }
  }

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
  )

  const AVATAR_COLORS = [
    { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
    { bg: '#faf5ff', text: '#7c3aed', border: '#ddd6fe' },
    { bg: '#ecfdf5', text: '#10b981', border: '#a7f3d0' },
    { bg: '#fff7ed', text: '#f97316', border: '#fed7aa' },
    { bg: '#fdf2f8', text: '#db2777', border: '#fbcfe8' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar
          title="قاعدة بيانات العملاء"
          subtitle="إدارة بيانات وعناوين التواصل مع عملاء الكراج"
          actions={
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.2)',
                outline: 'none',
              }}
            >
              ➕ إضافة عميل جديد
            </button>
          }
        />

        <main style={{ padding: '24px 28px', flex: 1 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Search filter card */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #eeeff4',
                borderRadius: 16,
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو رقم الهاتف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: 12.5,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6b7280' }}>
                عدد العملاء: <span style={{ color: '#4f46e5', fontWeight: 800 }}>{filteredCustomers.length}</span>
              </div>
            </div>

            {/* Content Display */}
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>جاري تحميل العملاء...</span>
                </div>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div
                style={{
                  background: '#ffffff',
                  border: '1px dashed #cbd5e1',
                  borderRadius: 16,
                  padding: '64px 24px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>لا توجد نتائج مطابقة للبحث</div>
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>ابدأ بإضافة أول عميل جديد</p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 20,
                }}
              >
                {filteredCustomers.map((customer) => {
                  const avatarColor = AVATAR_COLORS[customer.name.length % AVATAR_COLORS.length]
                  return (
                    <div
                      key={customer.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #eeeff4',
                        borderRadius: 16,
                        padding: 20,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 16,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            background: avatarColor.bg,
                            color: avatarColor.text,
                            border: `1px solid ${avatarColor.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            fontWeight: 800,
                          }}
                        >
                          {customer.name ? customer.name[0] : 'U'}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: 13.5, fontWeight: 800, color: '#1f2937', margin: 0 }}>
                              {customer.name}
                            </h3>
                            {/* No-Show Badge */}
                            {customer.noShowLevel === 'CRITICAL' && (
                              <span
                                title={`غاب ${customer.noShowCount} مرة بدون حضور`}
                                style={{
                                  fontSize: 9.5, fontWeight: 800,
                                  color: '#991b1b', background: '#fef2f2',
                                  border: '1px solid #fca5a5', borderRadius: 5,
                                  padding: '1px 6px', cursor: 'default',
                                }}
                              >
                                🔴 غياب متكرر ({customer.noShowCount}×)
                              </span>
                            )}
                            {customer.noShowLevel === 'WARN' && (
                              <span
                                title={`غاب ${customer.noShowCount} مرة بدون حضور`}
                                style={{
                                  fontSize: 9.5, fontWeight: 800,
                                  color: '#92400e', background: '#fffbeb',
                                  border: '1px solid #fcd34d', borderRadius: 5,
                                  padding: '1px 6px', cursor: 'default',
                                }}
                              >
                                ⚠️ كثير الغياب ({customer.noShowCount}×)
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 10.5, color: '#94a3b8', display: 'block', marginTop: 2 }}>
                            سجل منذ: {new Date(customer.createdAt).toLocaleDateString('ar-KW')}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: '#94a3b8' }}>رقم التواصل:</span>
                          <a href={`tel:${customer.phone}`} style={{ fontWeight: 700, color: '#4f46e5', textDecoration: 'none', fontFamily: 'monospace' }}>
                            {customer.phone}
                          </a>
                        </div>
                        {customer.email && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: '#94a3b8' }}>البريد الإلكتروني:</span>
                            <span style={{ fontWeight: 600, color: '#475569', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 150 }}>{customer.email}</span>
                          </div>
                        )}
                      </div>

                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex' }}>
                        <Link
                          href={`/customers/${customer.id}`}
                          style={{
                            flex: 1,
                            textAlign: 'center',
                            background: '#f5f3ff',
                            border: '1px solid #e0e7ff',
                            color: '#4f46e5',
                            borderRadius: 10,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: 'none',
                          }}
                        >
                          🔍 ملف القيادة الكامل
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.3)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="modal-content"
            style={{
              background: '#ffffff',
              border: '1px solid #eeeff4',
              borderRadius: 24,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)',
              width: '100%',
              maxWidth: 400,
              maxHeight: '90vh',
              overflowY: 'auto',
              direction: 'rtl',
              padding: '24px 30px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  👤
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', margin: 0 }}>إضافة عميل جديد</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  color: '#6b7280',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>اسم العميل</label>
                <input
                  type="text"
                  placeholder="أدخل الاسم الثنائي أو الثلاثي..."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    outline: 'none',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>رقم الهاتف</label>
                <input
                  type="text"
                  placeholder="مثال: 50144012"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    outline: 'none',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  placeholder="example@mail.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>نوع العميل</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    background: '#ffffff',
                    outline: 'none',
                  }}
                >
                  <option value="INDIVIDUAL">👤 فرد (Individual)</option>
                  <option value="FLEET">🏢 شركة / أسطول (Fleet)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #eeeff4', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 24px',
                    borderRadius: 12,
                    border: 'none',
                    background: '#4f46e5',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                  }}
                >
                  حفظ العميل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
