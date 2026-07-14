'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import api from '@/lib/api'

interface Tenant {
  id: string
  name: string
  nameAr?: string
  settings: any
}

const TEMPLATE_KEYS = [
  { key: 'WORK_ORDER_RECEIVED', label: '📥 تم استلام السيارة (Received)', desc: 'يُرسل فور تسجيل دخول السيارة وفتح كرت العمل' },
  { key: 'DIAGNOSIS_STARTED', label: '🔧 بدء الفحص والتشخيص (Diagnosis)', desc: 'يُرسل عند بدء الفنيين بعمليات الفحص وتحديد الأعطال' },
  { key: 'QUOTE_READY', label: '📋 عرض السعر جاهز (Quote Ready)', desc: 'يُرسل لتنبيه العميل بضرورة مراجعة عرض السعر والموافقة عليه إلكترونياً' },
  { key: 'WORK_STARTED', label: '⚙️ بدء العمل الفعلي (Work Started)', desc: 'يُرسل للعميل لطمأنته بأن الفنيين بدؤوا بالإصلاحات' },
  { key: 'VEHICLE_READY', label: '🎉 السيارة جاهزة للاستلام (Ready)', desc: 'يُرسل لإشعار العميل بانتهاء كافة أعمال الصيانة وسداد الفاتورة' },
  { key: 'VEHICLE_DELIVERED', label: '✅ تم تسليم السيارة (Delivered)', desc: 'رسالة شكر نهائية تُرسل بعد استلام العميل لسيارته وخروجها من الكراج' },
]

const DEFAULT_TEMPLATES: Record<string, string> = {
  WORK_ORDER_RECEIVED: 'مرحباً {customerName} 👋\n\nتم استلام سيارتكم {vehicleInfo} بنجاح ✅\n\nرقم طلب الخدمة: {orderNumber}\n\nيمكنكم متابعة حالة السيارة عبر الرابط:\n{trackingUrl}',
  DIAGNOSIS_STARTED: 'مرحباً {customerName} 🔧\n\nبدأ فريقنا الفني بتشخيص سيارتكم {vehicleInfo}\n\nرقم الطلب: {orderNumber}\n\nسيتم إعلامكم بعرض السعر قريباً.',
  QUOTE_READY: 'مرحباً {customerName} 📋\n\nعرض السعر الخاص بسيارتكم {vehicleInfo} جاهز!\n\nرقم الطلب: {orderNumber}\n\nيرجى مراجعة العرض والموافقة عليه من الرابط:\n{trackingUrl}\n\nبانتظار موافقتكم 🙏',
  WORK_STARTED: 'مرحباً {customerName} ⚙️\n\nبدأ العمل على سيارتكم {vehicleInfo}\n\nرقم الطلب: {orderNumber}\n\nتابعوا التقدم: {trackingUrl}',
  VEHICLE_READY: 'مرحباً {customerName} 🎉\n\nسيارتكم {vehicleInfo} جاهزة للاستلام!\n\nرقم الطلب: {orderNumber}\n\nنحن بانتظاركم خلال أوقات العمل. شكراً لثقتكم بنا 🙏',
  VEHICLE_DELIVERED: 'مرحباً {customerName} ✅\n\nتم تسليم سيارتكم {vehicleInfo} بنجاح.\n\nنتمنى لكم قيادة آمنة! 🚗\n\nشكراً لاختياركم لنا.',
}

const inputStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 12,
  border: '1.5px solid #cbd5e1',
  fontSize: 13.5,
  outline: 'none',
  background: '#fff',
  width: '100%',
  boxSizing: 'border-box',
  color: '#1f2937',
  minHeight: 120,
  fontFamily: 'monospace',
  lineHeight: 1.5,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#475569',
  marginBottom: 5,
  display: 'block',
}

const buttonStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #03045e 0%, #0077b6 100%)',
  color: '#ffffff',
  border: 'none',
  borderRadius: 12,
  padding: '12px 24px',
  fontSize: 13.5,
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(3, 4, 94, 0.15)',
}

export default function NotificationSettingsPage() {
  const { user: authUser, isAuthenticated, isHydrated } = useAuthStore()
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [templates, setTemplates] = useState<Record<string, string>>({})
  const [activeKey, setActiveKey] = useState('WORK_ORDER_RECEIVED')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) { router.push('/login'); return }
    if (authUser?.role !== 'GARAGE_OWNER') { router.push('/dashboard'); return }
    loadData()
  }, [isHydrated, isAuthenticated, authUser])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await api.get('/tenants/current')
      const tData = res.data.data
      setTenant(tData)
      
      const customTemplates = tData.settings?.notificationTemplates || {}
      // Merge with defaults
      const merged: Record<string, string> = {}
      TEMPLATE_KEYS.forEach(({ key }) => {
        merged[key] = customTemplates[key] || DEFAULT_TEMPLATES[key]
      })
      setTemplates(merged)
    } catch (err) {
      console.error(err)
      alert('فشل تحميل إعدادات الإشعارات')
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateChange = (text: string) => {
    setTemplates((prev) => ({
      ...prev,
      [activeKey]: text,
    }))
  }

  const handleResetToDefault = () => {
    if (confirm('هل أنت متأكد من رغبتك في استعادة الصيغة الافتراضية لهذا القالب؟')) {
      handleTemplateChange(DEFAULT_TEMPLATES[activeKey])
    }
  }

  const validateTemplates = (): boolean => {
    // Basic validations: Quote ready and Received templates must contain trackingUrl or paymentLink
    const criticalKeys = ['WORK_ORDER_RECEIVED', 'QUOTE_READY', 'WORK_STARTED', 'VEHICLE_READY']
    for (const key of criticalKeys) {
      const text = templates[key] || ''
      if (!text.includes('{trackingUrl}') && !text.includes('{paymentLink}')) {
        const label = TEMPLATE_KEYS.find((tk) => tk.key === key)?.label || key
        alert(`تنبيه أمني: يجب إدراج المتغير {trackingUrl} بداخل قالب "${label}" لتمكين العميل من متابعة سيارته أو الموافقة على عرض السعر وسداد الفاتورة!`)
        return false
      }
    }
    return true
  }

  const handleSave = async () => {
    if (!validateTemplates()) return
    try {
      setSaving(true)
      await api.put('/tenants/settings', {
        settings: {
          ...tenant?.settings,
          notificationTemplates: templates,
        },
      })
      alert('تم حفظ وتفعيل قوالب الإشعارات بنجاح ✅')
      loadData()
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }

  // Parse placeholder variables for preview bubble
  const renderedPreviewText = () => {
    const text = templates[activeKey] || ''
    const garageName = tenant?.nameAr || tenant?.name || 'كراج الساحل الذهبي'
    return text
      .replace(/{customerName}/g, 'أحمد الدوسري')
      .replace(/{vehicleInfo}/g, 'تويوتا لاندكروزر 2023 (10-4820)')
      .replace(/{orderNumber}/g, 'WO-2026-0008')
      .replace(/{trackingUrl}/g, 'http://localhost:3005/track/token-123')
      .replace(/{paymentLink}/g, 'http://localhost:3005/track/token-123')
      .replace(/{garageName}/g, garageName)
  }

  return (
    <div className="min-h-screen flex text-[#03045E] bg-[#f5f6fa]" style={{ direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title="قوالب رسائل الإشعارات (WhatsApp)" subtitle="تخصيص الرسائل التلقائية المرسلة للعملاء ومتابعة الحالات" />
        
        {/* Settings Navigation Tabs */}
        <div style={{ display: 'flex', gap: 20, padding: '0 24px', borderBottom: '1px solid #eeeff4', background: '#fff' }}>
          <a
            href="/settings/garage"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#64748b',
              padding: '12px 6px',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#03045e')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#64748b')}
          >
            🏢 إعدادات الكراج والفروع
          </a>
          <a
            href="/settings/notifications"
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#03045e',
              borderBottom: '3px solid #03045e',
              padding: '12px 6px',
              textDecoration: 'none',
            }}
          >
            💬 قوالب رسائل الواتساب
          </a>
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 0', flexDirection: 'column', gap: 10 }}>
              <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#0077b6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13, color: '#0077b6', fontWeight: 700 }}>جاري تحميل قوالب الإشعارات...</span>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Template Editors (7 spans) */}
              <div className="lg:col-span-7" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                
                {/* List of tabs */}
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #eeeff4', padding: '14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TEMPLATE_KEYS.map((tk) => (
                    <button
                      key={tk.key}
                      onClick={() => setActiveKey(tk.key)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: 'none',
                        background: activeKey === tk.key ? '#03045e' : 'rgba(3, 4, 94, 0.04)',
                        color: activeKey === tk.key ? '#fff' : '#03045e',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {tk.label.split(' ')[0]} {tk.label.split(' ').slice(1).join(' ').split(' (')[0]}
                    </button>
                  ))}
                </div>

                {/* Editor Card */}
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #eeeff4', padding: 24 }}>
                  <div style={{ marginBottom: 18 }}>
                    <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 900, color: '#1e1b4b' }}>
                      {TEMPLATE_KEYS.find((t) => t.key === activeKey)?.label}
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#64748b' }}>
                      {TEMPLATE_KEYS.find((t) => t.key === activeKey)?.desc}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={labelStyle}>نص الرسالة *</label>
                        <button
                          type="button"
                          onClick={handleResetToDefault}
                          style={{ border: 'none', background: 'transparent', color: '#ef4444', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}
                        >
                          🔄 استعادة الافتراضي
                        </button>
                      </div>
                      
                      <textarea
                        value={templates[activeKey] || ''}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        style={inputStyle}
                        placeholder="اكتب نص القالب هنا..."
                      />
                    </div>

                    {/* Helper placeholder variables */}
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#334155', display: 'block', marginBottom: 6 }}>
                        📋 المتغيرات المتاحة للنسخ (تُستبدل تلقائياً):
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {[
                          { var: '{customerName}', desc: 'اسم العميل' },
                          { var: '{vehicleInfo}', desc: 'بيانات السيارة' },
                          { var: '{orderNumber}', desc: 'رقم كرت العمل' },
                          { var: '{trackingUrl}', desc: 'رابط المتابعة والدفع' },
                          { var: '{garageName}', desc: 'اسم كراجك' },
                        ].map((v, i) => (
                          <div
                            key={i}
                            title={v.desc}
                            style={{
                              background: '#fff',
                              border: '1px solid #cbd5e1',
                              borderRadius: 6,
                              padding: '2px 8px',
                              fontSize: 10.5,
                              fontFamily: 'monospace',
                              color: '#03045e',
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              handleTemplateChange((templates[activeKey] || '') + ' ' + v.var)
                            }}
                          >
                            {v.var} <span style={{ color: '#94a3b8', fontSize: 9 }}>({v.desc})</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom action trigger */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        style={buttonStyle}
                      >
                        {saving ? '⏳ جاري تفعيل القوالب...' : '💾 حفظ وتفعيل كافة القوالب'}
                      </button>
                    </div>

                  </div>
                </div>

              </div>

              {/* Right Column: WhatsApp Live Preview (5 spans) */}
              <div className="lg:col-span-5">
                <div style={{
                  background: '#efeae2', // WhatsApp background color
                  borderRadius: 24,
                  border: '8px solid #334155', // Mock phone frame
                  padding: '20px 14px',
                  minHeight: 460,
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  position: 'relative',
                }}>
                  {/* Phone camera notch */}
                  <div style={{
                    width: 90,
                    height: 18,
                    background: '#334155',
                    borderRadius: '0 0 12px 12px',
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                  }} />

                  {/* Header info */}
                  <div style={{
                    background: '#075e54',
                    color: '#fff',
                    padding: '12px 10px',
                    borderRadius: '12px 12px 0 0',
                    marginTop: -10,
                    marginLeft: -14,
                    marginRight: -14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                    <span style={{ fontSize: 20 }}>💬</span>
                    <div>
                      <strong style={{ fontSize: 12, display: 'block' }}>إشعارات {tenant?.nameAr || tenant?.name}</strong>
                      <span style={{ fontSize: 9, color: '#128c7e' }}>نشط الآن (WhatsApp Business)</span>
                    </div>
                  </div>

                  {/* Message body */}
                  <div style={{ flex: 1, padding: '16px 4px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{
                      background: '#dcf8c6', // WhatsApp message green bubble
                      borderRadius: 12,
                      padding: 12,
                      maxWidth: '85%',
                      alignSelf: 'flex-start',
                      boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                      position: 'relative',
                    }}>
                      {/* Triangle pointer */}
                      <div style={{
                        position: 'absolute',
                        right: '100%',
                        top: 8,
                        width: 0,
                        height: 0,
                        borderTop: '5px solid transparent',
                        borderBottom: '5px solid transparent',
                        borderRight: '5px solid #dcf8c6',
                      }} />

                      <p style={{
                        margin: 0,
                        fontSize: 12,
                        color: '#303030',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                        direction: 'rtl',
                      }}>
                        {renderedPreviewText()}
                      </p>
                      <span style={{
                        fontSize: 8,
                        color: '#727272',
                        float: 'left',
                        marginTop: 4,
                      }}>
                        {new Date().toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })} ✔✔
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  )
}
