'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import api from '@/lib/api'

interface Branch {
  id: string
  name: string
  nameAr?: string
  address?: string
  addressAr?: string
  phone?: string
  email?: string
  isActive: boolean
  dailyCapacity: number
  workingHours: any // { open?: string, close?: string }
  createdAt: string
}

interface Tenant {
  id: string
  name: string
  nameAr?: string
  slug: string
  email: string
  phone?: string
  logo?: string
  trialEndsAt?: string
  country: string
  currency: string
  vatNumber?: string
  vatRate: number
  timezone: string
  settings: any // { invoiceTemplate?: string }
  branches: Branch[]
  subscription?: {
    currentPeriodEnd: string
    plan: {
      nameAr: string
    }
  }
}

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1.5px solid #cbd5e1',
  fontSize: 13,
  outline: 'none',
  background: '#f8fafc',
  width: '100%',
  boxSizing: 'border-box',
  color: '#1f2937',
  transition: 'border-color 0.2s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#475569',
  marginBottom: 5,
  display: 'block',
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 16,
  border: '1px solid #eeeff4',
  padding: '24px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)',
}

const PRESET_LOGOS = [
  { name: 'افتراضي أزرق', url: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3' },
  { name: 'ورشة رياضية', url: 'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3' },
  { name: 'تروس ذهبية', url: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3' },
]

export default function GarageSettingsPage() {
  const { user: authUser, isAuthenticated, isHydrated } = useAuthStore()
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingBranch, setSavingBranch] = useState(false)

  // Tenant Form
  const [nameAr, setNameAr] = useState('')
  const [phone, setPhone] = useState('')
  const [logo, setLogo] = useState('')
  const [invoiceTemplate, setInvoiceTemplate] = useState('MODERN')
  const [vatNumber, setVatNumber] = useState('')
  const [vatRate, setVatRate] = useState(0)
  const [timezone, setTimezone] = useState('Asia/Kuwait')
  const [currency, setCurrency] = useState('KWD')

  // Branch Modals
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false)
  
  // Branch Form
  const [bName, setBName] = useState('')
  const [bNameAr, setBNameAr] = useState('')
  const [bAddress, setBAddress] = useState('')
  const [bAddressAr, setBAddressAr] = useState('')
  const [bPhone, setBPhone] = useState('')
  const [bEmail, setBEmail] = useState('')
  const [bIsActive, setBIsActive] = useState(true)
  const [bDailyCapacity, setBDailyCapacity] = useState(15)
  const [bOpenTime, setBOpenTime] = useState('08:00')
  const [bCloseTime, setBCloseTime] = useState('18:00')

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) { router.push('/login'); return }
    if (authUser?.role !== 'GARAGE_OWNER') { router.push('/dashboard'); return }
    loadSettings()
  }, [isHydrated, isAuthenticated, authUser])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const res = await api.get('/tenants/current')
      const data = res.data.data
      setTenant(data)
      setNameAr(data.nameAr || '')
      setPhone(data.phone || '')
      setLogo(data.logo || '')
      setVatNumber(data.vatNumber || '')
      setVatRate(Number(data.vatRate || 0))
      setTimezone(data.timezone || 'Asia/Kuwait')
      setCurrency(data.currency || 'KWD')
      
      const settingsObj = data.settings || {}
      setInvoiceTemplate(settingsObj.invoiceTemplate || 'MODERN')
    } catch (err) {
      console.error(err)
      alert('فشل تحميل الإعدادات من الخادم')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSavingSettings(true)
      await api.put('/tenants/settings', {
        nameAr,
        phone,
        logo,
        vatNumber,
        vatRate: Number(vatRate),
        timezone,
        currency,
        settings: {
          ...tenant?.settings,
          invoiceTemplate,
        },
      })
      alert('تم حفظ إعدادات الكراج بنجاح')
      loadSettings()
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل حفظ الإعدادات')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleOpenAddBranch = () => {
    setSelectedBranch(null)
    setBName('')
    setBNameAr('')
    setBAddress('')
    setBAddressAr('')
    setBPhone('')
    setBEmail('')
    setBIsActive(true)
    setBDailyCapacity(15)
    setBOpenTime('08:00')
    setBCloseTime('18:00')
    setIsBranchModalOpen(true)
  }

  const handleOpenEditBranch = (branch: Branch) => {
    setSelectedBranch(branch)
    setBName(branch.name)
    setBNameAr(branch.nameAr || '')
    setBAddress(branch.address || '')
    setBAddressAr(branch.addressAr || '')
    setBPhone(branch.phone || '')
    setBEmail(branch.email || '')
    setBIsActive(branch.isActive)
    setBDailyCapacity(branch.dailyCapacity || 10)
    setBOpenTime(branch.workingHours?.open || '08:00')
    setBCloseTime(branch.workingHours?.close || '18:00')
    setIsBranchModalOpen(true)
  }

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSavingBranch(true)
      const payload = {
        name: bName,
        nameAr: bNameAr,
        address: bAddress,
        addressAr: bAddressAr,
        phone: bPhone,
        email: bEmail || null,
        isActive: bIsActive,
        dailyCapacity: Number(bDailyCapacity),
        workingHours: {
          open: bOpenTime,
          close: bCloseTime,
        },
      }

      if (selectedBranch) {
        // Edit existing
        await api.put(`/tenants/branches/${selectedBranch.id}`, payload)
        alert('تم تعديل بيانات الفرع بنجاح')
      } else {
        // Create new
        await api.post('/tenants/branches', payload)
        alert('تم إضافة الفرع الجديد بنجاح')
      }
      setIsBranchModalOpen(false)
      loadSettings()
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل حفظ الفرع')
    } finally {
      setSavingBranch(false)
    }
  }

  const simulateLogoUpload = () => {
    const randomImg = PRESET_LOGOS[Math.floor(Math.random() * PRESET_LOGOS.length)].url
    setLogo(randomImg)
    alert('تم محاكاة رفع شعار الكراج بنجاح! يرجى النقر على زر حفظ التعديلات لحفظه نهائياً.')
  }

  return (
    <div className="min-h-screen flex text-[#03045E] bg-[#f5f6fa]" style={{ direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title="إعدادات الكراج والفروع" subtitle="إدارة الملف التعريفي والتحكم المالي والفروع" />
        
        {/* Settings Navigation Tabs */}
        <div style={{ display: 'flex', gap: 20, padding: '0 24px', borderBottom: '1px solid #eeeff4', background: '#fff' }}>
          <a
            href="/settings/garage"
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#03045e',
              borderBottom: '3px solid #03045e',
              padding: '12px 6px',
              textDecoration: 'none',
            }}
          >
            🏢 إعدادات الكراج والفروع
          </a>
          <a
            href="/settings/notifications"
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
            💬 قوالب رسائل الواتساب
          </a>
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 0', flexDirection: 'column', gap: 10 }}>
              <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#0077b6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13, color: '#0077b6', fontWeight: 700 }}>جاري تحميل إعدادات النظام...</span>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Profile Card (Right Column - 7 spans) */}
              <div className="lg:col-span-7" style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <span style={{ fontSize: 22 }}>🏢</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#1e1b4b' }}>ملف تعريف الكراج والضرائب</h3>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>إعدادات الهوية الوطنية وقيم الفوترة والضريبة المضافة المطبقة للكراج</p>
                  </div>
                </div>

                <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* Logo Upload Section */}
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 14, border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      background: logo ? `url(${logo}) center/cover no-repeat` : '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: logo ? 0 : 24,
                      color: '#94a3b8',
                      flexShrink: 0,
                    }}>
                      {!logo && '🖼️'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#334155', display: 'block' }}>شعار الكراج للعلامة التجارية</span>
                      <span style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 8 }}>يظهر الشعار في ترويسة الفواتير المطبوعة وتتبع كروت العمل للعميل</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={simulateLogoUpload}
                          style={{
                            background: '#03045e',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '5px 12px',
                            fontSize: 10.5,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          📤 رفع شعار جديد
                        </button>
                        <select
                          value={logo}
                          onChange={(e) => setLogo(e.target.value)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 8,
                            border: '1px solid #cbd5e1',
                            fontSize: 10.5,
                            fontWeight: 700,
                            background: '#fff',
                            color: '#334155',
                          }}
                        >
                          <option value="">لا يوجد شعار</option>
                          {PRESET_LOGOS.map((pl, idx) => (
                            <option key={idx} value={pl.url}>{pl.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Arabic Name & English Name */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>اسم الكراج (بالعربية) *</label>
                      <input
                        type="text"
                        value={nameAr}
                        onChange={(e) => setNameAr(e.target.value)}
                        placeholder="كراج الساحل الذهبي"
                        style={inputStyle}
                        required
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>اسم الكراج (بالإنجليزية) *</label>
                      <input
                        type="text"
                        value={tenant?.name || ''}
                        disabled
                        style={{ ...inputStyle, background: '#f1f5f9', cursor: 'not-allowed' }}
                      />
                    </div>
                  </div>

                  {/* Phone & Invoice Template */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>هاتف الكراج الرئيسي</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+965 99999999"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>تنسيق قالب الفواتير الرئيسي *</label>
                      <select
                        value={invoiceTemplate}
                        onChange={(e) => setInvoiceTemplate(e.target.value)}
                        style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}
                        required
                      >
                        <option value="MODERN">عصري ومبتكر (Modern Dynamic) 🌈</option>
                        <option value="CLASSIC">كلاسيكي رسمي (Classic Corporate) 💼</option>
                        <option value="MINIMALIST">مبسط أبيض وأسود (Minimal Print) 🖨️</option>
                      </select>
                    </div>
                  </div>

                  {/* VAT number & VAT rate */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>الرقم الضريبي (إن وجد)</label>
                      <input
                        type="text"
                        value={vatNumber}
                        onChange={(e) => setVatNumber(e.target.value)}
                        placeholder="TRN-100293028"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>نسبة ضريبة القيمة المضافة (VAT %) *</label>
                      <input
                        type="number"
                        value={vatRate}
                        onChange={(e) => setVatRate(Number(e.target.value))}
                        placeholder="0"
                        min="0"
                        max="100"
                        step="0.01"
                        style={inputStyle}
                        required
                      />
                    </div>
                  </div>

                  {/* Currency & Timezone */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>العملة الرئيسية *</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}
                        required
                      >
                        <option value="KWD">دينار كويتي (KWD)</option>
                        <option value="SAR">ريال سعودي (SAR)</option>
                        <option value="AED">درهم إماراتي (AED)</option>
                        <option value="QAR">ريال قطري (QAR)</option>
                        <option value="BHD">دينار بحريني (BHD)</option>
                        <option value="OMR">ريال عماني (OMR)</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>المنطقة الزمنية *</label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}
                        required
                      >
                        <option value="Asia/Kuwait">الكويت / الرياض (Asia/Kuwait)</option>
                        <option value="Asia/Dubai">دبي / أبوظبي (Asia/Dubai)</option>
                        <option value="Asia/Qatar">الدوحة (Asia/Qatar)</option>
                        <option value="Asia/Bahrain">المنامة (Asia/Bahrain)</option>
                        <option value="Asia/Muscat">مسقط (Asia/Muscat)</option>
                      </select>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={savingSettings}
                    style={{
                      background: 'linear-gradient(135deg, #03045e 0%, #0077b6 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 12,
                      padding: '12px',
                      fontSize: 13.5,
                      fontWeight: 800,
                      cursor: savingSettings ? 'not-allowed' : 'pointer',
                      marginTop: 10,
                      boxShadow: '0 4px 12px rgba(3, 4, 94, 0.15)',
                    }}
                  >
                    {savingSettings ? '⏳ جاري الحفظ والتحديث...' : '💾 حفظ التعديلات والملف'}
                  </button>

                </form>
              </div>

              {/* Left Column (Branches & Subscription Info - 5 spans) */}
              <div className="lg:col-span-5" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                {/* Active Plan / Billing Info Summary */}
                <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', border: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 900, color: '#38bdf8', letterSpacing: 0.5 }}>باقة وحالة الاشتراك للـ SaaS</span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#059669', color: '#fff', fontWeight: 800 }}>
                      نشط فعال 🟢
                    </span>
                  </div>
                  
                  <strong style={{ fontSize: 16, color: '#fff', display: 'block' }}>
                    باقة: {tenant?.subscription?.plan?.nameAr || 'الفترة التجريبية (Trial)'}
                  </strong>
                  
                  <span style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginTop: 4 }}>
                    تاريخ التجديد/الانتهاء: {tenant?.subscription?.currentPeriodEnd ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString('ar-KW') : (tenant?.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString('ar-KW') : 'غير محدد')}
                  </span>
                  
                  <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '14px 0' }} />
                  
                  <a
                    href="/super-admin" // Direct link to manage platform billing/garages
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#f8fafc',
                      borderRadius: 10,
                      padding: '9px 14px',
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'block',
                      textAlign: 'center',
                      textDecoration: 'none',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      transition: 'background 0.2s',
                    }}
                  >
                    ⚙️ إدارة خطة الاشتراك والفوترة
                  </a>
                </div>

                {/* Branches Info */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>🏢</span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 900, color: '#1e1b4b' }}>فروع الورشة</h3>
                        <p style={{ margin: 0, fontSize: 10.5, color: '#64748b' }}>إدارة الفروع ومواقع العمل الحالية</p>
                      </div>
                    </div>
                    <button
                      onClick={handleOpenAddBranch}
                      style={{
                        background: 'rgba(3, 4, 94, 0.06)',
                        color: '#03045e',
                        border: 'none',
                        borderRadius: 10,
                        padding: '6px 14px',
                        fontSize: 11.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      ➕ إضافة فرع
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {tenant?.branches.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                        <span style={{ fontSize: 32, display: 'block', marginBottom: 6 }}>📭</span>
                        <span style={{ fontSize: 12 }}>لا توجد فروع مسجلة حالياً</span>
                      </div>
                    ) : (
                      tenant?.branches.map((branch) => (
                        <div
                          key={branch.id}
                          style={{
                            border: '1px solid #eeeff4',
                            borderRadius: 14,
                            padding: '14px 16px',
                            background: branch.isActive ? '#fff' : '#f8fafc',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'transform 0.15s',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong style={{ fontSize: 13, color: '#1e1b4b' }}>{branch.nameAr || branch.name}</strong>
                              <span style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 20,
                                color: branch.isActive ? '#065f46' : '#991b1b',
                                background: branch.isActive ? '#d1fae5' : '#fee2e2',
                              }}>
                                {branch.isActive ? 'نشط' : 'معطّل'}
                              </span>
                            </div>
                            <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 4 }}>
                              📞 {branch.phone || 'غير مسجل'} • 📍 {branch.addressAr || branch.address || 'العنوان غير محدد'}
                            </span>
                            <span style={{ fontSize: 10, color: '#0369a1', display: 'block', marginTop: 3 }}>
                              ⏱️ العمل: {branch.workingHours?.open || '08:00'} - {branch.workingHours?.close || '18:00'} | 🚗 استيعاب: {branch.dailyCapacity || 10} سيارة/يوم
                            </span>
                          </div>

                          <button
                            onClick={() => handleOpenEditBranch(branch)}
                            style={{
                              background: '#f1f5f9',
                              color: '#475569',
                              border: 'none',
                              borderRadius: 8,
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            ⚙️ تعديل
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}
        </main>
      </div>

      {/* Branch Modal Form */}
      {isBranchModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(12px)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsBranchModalOpen(false) }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 24,
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.15)',
              width: '100%',
              maxWidth: 440,
              padding: '28px 32px',
              direction: 'rtl',
            }}
          >
            <h3 style={{ fontSize: 15.5, fontWeight: 900, color: '#1e1b4b', margin: '0 0 4px' }}>
              {selectedBranch ? 'تعديل بيانات الفرع' : 'إضافة فرع ورشة جديد'}
            </h3>
            <p style={{ fontSize: 11.5, color: '#64748b', margin: '0 0 20px' }}>
              تعبئة بيانات المواعيد وساعات العمل والطاقة الاستيعابية اليومية لورشة الصيانة
            </p>

            <form onSubmit={handleSaveBranch} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Names */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>اسم الفرع (بالعربية) *</label>
                  <input
                    type="text"
                    value={bNameAr}
                    onChange={(e) => setBNameAr(e.target.value)}
                    placeholder="فرع الشويخ"
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>اسم الفرع (بالإنجليزية) *</label>
                  <input
                    type="text"
                    value={bName}
                    onChange={(e) => setBName(e.target.value)}
                    placeholder="Shuwaikh Branch"
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              {/* Phone & Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>هاتف الفرع *</label>
                  <input
                    type="text"
                    value={bPhone}
                    onChange={(e) => setBPhone(e.target.value)}
                    placeholder="+965 24810000"
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>البريد الإلكتروني للفرع</label>
                  <input
                    type="email"
                    value={bEmail}
                    onChange={(e) => setBEmail(e.target.value)}
                    placeholder="shuwaikh@gms.com"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Capacity & Working Hours */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>استيعاب اليومي *</label>
                  <input
                    type="number"
                    value={bDailyCapacity}
                    onChange={(e) => setBDailyCapacity(Number(e.target.value))}
                    min="1"
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>ساعة الفتح *</label>
                  <select
                    value={bOpenTime}
                    onChange={(e) => setBOpenTime(e.target.value)}
                    style={{ ...inputStyle, background: '#fff' }}
                    required
                  >
                    <option value="07:00">07:00 ص</option>
                    <option value="08:00">08:00 ص</option>
                    <option value="09:00">09:00 ص</option>
                    <option value="10:00">10:00 ص</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>ساعة الإغلاق *</label>
                  <select
                    value={bCloseTime}
                    onChange={(e) => setBCloseTime(e.target.value)}
                    style={{ ...inputStyle, background: '#fff' }}
                    required
                  >
                    <option value="16:00">04:00 م</option>
                    <option value="17:00">05:00 م</option>
                    <option value="18:00">06:00 م</option>
                    <option value="19:00">07:00 م</option>
                    <option value="20:00">08:00 م</option>
                    <option value="22:00">10:00 م</option>
                  </select>
                </div>
              </div>

              {/* Addresses */}
              <div>
                <label style={labelStyle}>العنوان (بالعربية)</label>
                <input
                  type="text"
                  value={bAddressAr}
                  onChange={(e) => setBAddressAr(e.target.value)}
                  placeholder="الشويخ الصناعية، قطة 2، شارع 12"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>العنوان (بالإنجليزية)</label>
                <input
                  type="text"
                  value={bAddress}
                  onChange={(e) => setBAddress(e.target.value)}
                  placeholder="Shuwaikh Industrial, Block 2, St 12"
                  style={inputStyle}
                />
              </div>

              {/* Active Toggle if edit */}
              {selectedBranch && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    id="bActive"
                    checked={bIsActive}
                    onChange={(e) => setBIsActive(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="bActive" style={{ fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                    الفرع نشط فعال بالمنصة (يمكن استقبال المهام وحجز قطع الغيار فيه)
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingBranch}
                  style={{
                    padding: '8px 24px',
                    borderRadius: 10,
                    border: 'none',
                    background: savingBranch ? '#93c5fd' : 'linear-gradient(135deg, #03045e 0%, #0077b6 100%)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: savingBranch ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingBranch ? '⏳ جاري الحفظ...' : '💾 حفظ البيانات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
