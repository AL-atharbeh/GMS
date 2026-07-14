'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

interface SupportMessage {
  id: string
  senderType: 'TENANT' | 'SUPER_ADMIN'
  senderId: string
  message: string
  createdAt: string
}

interface SupportTicket {
  id: string
  subject: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  createdAt: string
  messages: SupportMessage[]
}

const inp: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  border: '1.5px solid #e2e8f0',
  fontSize: 13.5,
  outline: 'none',
  background: '#ffffff',
  color: '#1e293b',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'all 0.2s ease',
}

const lbl: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#475569',
  marginBottom: 6,
  display: 'block',
  letterSpacing: '0.2px',
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #eeeff4',
  borderRadius: 16,
  boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
}

const PRIORITY_MAP = {
  LOW:    { label: 'منخفضة', color: '#64748b', bg: '#f1f5f9' },
  MEDIUM: { label: 'متوسطة', color: '#0284c7', bg: '#e0f2fe' },
  HIGH:   { label: 'عالية',  color: '#ea580c', bg: '#ffedd5' },
  URGENT: { label: 'عاجلة',  color: '#dc2626', bg: '#fee2e2' },
}

const STATUS_MAP = {
  OPEN:        { label: 'مفتوحة', color: '#ef4444', bg: '#fef2f2' },
  IN_PROGRESS: { label: 'قيد المعالجة', color: '#f59e0b', bg: '#fffbeb' },
  RESOLVED:    { label: 'محلولة ✅', color: '#10b981', bg: '#ecfdf5' },
  CLOSED:      { label: 'مغلقة', color: '#64748b', bg: '#f8fafc' },
}

export default function SupportPage() {
  const { isAuthenticated, isHydrated } = useAuthStore()
  const router = useRouter()
  
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  
  // Create ticket form
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [submitting, setSubmitting] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Chat/Active Ticket
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [replyMessage, setReplyMessage] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    fetchTickets()
  }, [isAuthenticated, isHydrated])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const res = await api.get('/support')
      setTickets(res.data.data || [])
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (subject.trim().length < 2) {
      alert('عذراً، يجب أن يكون عنوان المشكلة حرفين على الأقل ⚠️')
      return
    }
    if (description.trim().length < 2) {
      alert('عذراً، يجب أن يكون شرح المشكلة حرفين على الأقل ⚠️')
      return
    }
    try {
      setSubmitting(true)
      await api.post('/support', { subject, description, priority })
      alert('تم إرسال تذكرة الدعم الفني بنجاح ✅')
      setSubject('')
      setDescription('')
      setPriority('MEDIUM')
      setShowCreateModal(false)
      fetchTickets()
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل إرسال التذكرة')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyMessage.trim() || !selectedTicket) return
    try {
      setReplySubmitting(true)
      const res = await api.post(`/support/${selectedTicket.id}/messages`, { message: replyMessage })
      const newMsg: SupportMessage = res.data.data
      
      const updatedTicket = {
        ...selectedTicket,
        status: 'OPEN' as const,
        messages: [...selectedTicket.messages, newMsg]
      }
      setSelectedTicket(updatedTicket)
      setReplyMessage('')
      fetchTickets()
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل إرسال الرسالة')
    } finally {
      setReplySubmitting(false)
    }
  }

  // Count states for KPI Cards
  const totalCount = tickets.length
  const openCount = tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length

  if (!isHydrated) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar
          title="الدعم الفني والمساندة"
          subtitle="تواصل مباشرة مع مهندسي النظام لحل المشكلات والاستفسارات الفنية"
          actions={
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                border: 'none',
                color: '#ffffff',
                fontSize: 13.5,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(79, 70, 229, 0.35)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(79, 70, 229, 0.25)'
              }}
            >
              <span>➕</span>
              <span>فتح تذكرة دعم فني جديدة</span>
            </button>
          }
        />

        <div style={{ padding: '24px 28px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* KPI Dashboard Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💬</div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>إجمالي التذاكر</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', marginTop: 2 }}>{totalCount}</div>
              </div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⏳</div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>تذاكر معلقة / نشطة</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', marginTop: 2 }}>{openCount}</div>
              </div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#d1fae5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✅</div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>تذاكر محلولة / مغلقة</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', marginTop: 2 }}>{resolvedCount}</div>
              </div>
            </div>
          </div>

          {/* Split Screen Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: selectedTicket ? '1fr 420px' : '1fr', gap: 24, flex: 1, minHeight: 480 }}>
            {/* Tickets Table / List Card */}
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: '#1e293b' }}>قائمة الطلبات والمشكلات</h3>
              
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                  <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                  جاري تحميل التذاكر...
                </div>
              ) : tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 40px', color: '#94a3b8' }}>
                  <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>📬</span>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#475569' }}>لا توجد تذاكر دعم فني حالياً</div>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8' }}>إذا كنت تواجه أي استفسار أو مشكلة، اضغط على زر فتح تذكرة جديدة بالأعلى.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f1f5f9', background: '#f8fafc' }}>
                        {['موضوع التذكرة', 'تاريخ الفتح', 'الأهمية', 'الحالة', 'الرسائل'].map(h => (
                          <th key={h} style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#475569', fontSize: 12 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t, idx) => {
                        const p = PRIORITY_MAP[t.priority] || PRIORITY_MAP.MEDIUM
                        const s = STATUS_MAP[t.status] || STATUS_MAP.OPEN
                        const isSelected = selectedTicket?.id === t.id
                        return (
                          <tr
                            key={t.id}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              background: isSelected ? '#f5f3ff' : 'transparent',
                              transition: 'all 0.15s ease',
                            }}
                            onClick={() => setSelectedTicket(t)}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc' }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                          >
                            <td style={{ padding: '16px', fontWeight: 700, color: isSelected ? '#4f46e5' : '#1e293b' }}>{t.subject}</td>
                            <td style={{ padding: '16px', color: '#64748b', fontSize: 12.5 }}>{new Date(t.createdAt).toLocaleDateString('ar-KW')}</td>
                            <td style={{ padding: '16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: p.color, background: p.bg, padding: '4px 10px', borderRadius: 8 }}>{p.label}</span>
                            </td>
                            <td style={{ padding: '16px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, padding: '4px 10px', borderRadius: 8 }}>{s.label}</span>
                            </td>
                            <td style={{ padding: '16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12.5 }}>
                                <span>💬</span>
                                <span>{t.messages?.length || 0} رسائل</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Conversation Window */}
            {selectedTicket && (
              <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04)' }}>
                {/* Header */}
                <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                  <div style={{ textAlign: 'right' }}>
                    <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 900, color: '#1e293b' }}>{selectedTicket.subject}</h4>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_MAP[selectedTicket.status]?.color, background: STATUS_MAP[selectedTicket.status]?.bg, padding: '2px 8px', borderRadius: 6 }}>
                        {STATUS_MAP[selectedTicket.status]?.label}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: PRIORITY_MAP[selectedTicket.priority]?.color, background: PRIORITY_MAP[selectedTicket.priority]?.bg, padding: '2px 8px', borderRadius: 6 }}>
                        {PRIORITY_MAP[selectedTicket.priority]?.label}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    style={{
                      background: '#e2e8f0',
                      border: 'none',
                      borderRadius: '50%',
                      width: 28,
                      height: 28,
                      color: '#475569',
                      cursor: 'pointer',
                      fontSize: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
                    onMouseLeave={e => e.currentTarget.style.background = '#e2e8f0'}
                  >
                    ×
                  </button>
                </div>

                {/* Messages Panel */}
                <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, background: '#f8fafc' }}>
                  {/* Original ticket desc */}
                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: 14, border: '1px solid #eeeff4', fontSize: 13, color: '#334155', boxShadow: '0 2px 6px rgba(0,0,0,0.01)' }}>
                    <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 6, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3px' }}>شرح المشكلة والملاحظات الأساسية:</div>
                    <p style={{ margin: 0, lineHeight: 1.6 }}>{selectedTicket.description}</p>
                    <div style={{ fontSize: 9.5, color: '#94a3b8', textAlign: 'left', marginTop: 8 }}>{new Date(selectedTicket.createdAt).toLocaleString('ar-KW')}</div>
                  </div>

                  <div style={{ borderBottom: '1px dashed #cbd5e1', margin: '8px 0' }} />

                  {selectedTicket.messages?.map(m => {
                    const isMe = m.senderType === 'TENANT'
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isMe ? 'flex-start' : 'flex-end',
                          background: isMe ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : '#ffffff',
                          color: isMe ? '#ffffff' : '#1e293b',
                          padding: '12px 16px',
                          borderRadius: isMe ? '16px 16px 0 16px' : '16px 16px 16px 0',
                          border: isMe ? 'none' : '1px solid #eeeff4',
                          fontSize: 13,
                          maxWidth: '85%',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div style={{ fontSize: 10, color: isMe ? '#c7d2fe' : '#10b981', fontWeight: 800, marginBottom: 4 }}>
                          {isMe ? 'أنت (المرسل)' : 'فريق الدعم الفني'}
                        </div>
                        <div style={{ lineHeight: 1.5 }}>{m.message}</div>
                        <div style={{ fontSize: 9, color: isMe ? '#e0e7ff' : '#94a3b8', textAlign: 'left', marginTop: 6 }}>
                          {new Date(m.createdAt).toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Reply Form */}
                {selectedTicket.status !== 'CLOSED' ? (
                  <form onSubmit={handleSendReply} style={{ padding: '16px', borderTop: '1px solid #eeeff4', display: 'flex', gap: 10, background: '#ffffff' }}>
                    <input
                      type="text" placeholder="اكتب ردك وملاحظاتك هنا..." value={replyMessage}
                      onChange={e => setReplyMessage(e.target.value)}
                      style={{ ...inp, padding: '10px 14px', borderRadius: 10 }}
                      required
                    />
                    <button
                      type="submit" disabled={replySubmitting}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 10,
                        background: '#4f46e5',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: 12.5,
                        fontWeight: 800,
                        cursor: replySubmitting ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 8px rgba(79, 70, 229, 0.2)',
                      }}
                    >
                      {replySubmitting ? '⏳' : 'رد ↩️'}
                    </button>
                  </form>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', background: '#f1f5f9', color: '#64748b', fontSize: 12.5, fontWeight: 700 }}>التذكرة مغلقة حالياً ولا تقبل ردوداً جديدة 🔒</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════ MODAL: Create Ticket ════ */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(false) }}>
          <div style={{ background: '#ffffff', borderRadius: 24, padding: '32px', width: '100%', maxWidth: 480, direction: 'rtl', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 900, color: '#1e293b' }}>✉️ فتح تذكرة دعم فني جديدة</h3>
            <p style={{ margin: '0 0 20px', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>صف المشكلة الفنية أو الاستفسار وسيقوم فريق هندسة المنصة بمتابعتها والرد عليك فوراً.</p>
            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>عنوان المشكلة أو الاستفسار *</label>
                <input type="text" placeholder="مثال: مشكلة في تفعيل قارئ الباركود" value={subject} onChange={e => setSubject(e.target.value)} style={inp} required />
              </div>
              <div>
                <label style={lbl}>شرح تفصيلي للمشكلة والخطوات المتبعة *</label>
                <textarea rows={4} placeholder="الرجاء وصف المشكلة ومكان حدوثها بالتفصيل لتسهيل معالجتها..." value={description} onChange={e => setDescription(e.target.value)} style={{ ...inp, resize: 'none', fontFamily: 'inherit' }} required />
              </div>
              <div>
                <label style={lbl}>مستوى الأهمية / الاستعجال *</label>
                <select value={priority} onChange={e => setPriority(e.target.value as any)} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="LOW">منخفضة</option>
                  <option value="MEDIUM">متوسطة (افتراضي)</option>
                  <option value="HIGH">عالية</option>
                  <option value="URGENT">عاجلة جداً 🚨</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" disabled={submitting} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(79,70,229,0.2)' }}>
                  {submitting ? '⏳ جاري الإرسال...' : '✅ إرسال الطلب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
