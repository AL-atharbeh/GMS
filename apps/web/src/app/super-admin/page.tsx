'use client'

import { useEffect, useState, useMemo } from 'react'
import api from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Tenant {
  id: string; name: string; nameAr?: string; slug: string; email: string; phone?: string
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
  trialEndsAt?: string; createdAt: string
  subscription?: { planId: string; billingCycle: string; currentPeriodEnd: string; plan: { id: string; name: string; nameAr: string; monthlyPrice: number; annualPrice: number } }
  _count?: { users: number; workOrders: number; branches: number }
}

interface Plan {
  id: string; name: string; nameAr: string; nameEn: string
  monthlyPrice: number; annualPrice: number
  maxBranches: number; maxTechnicians: number; maxVehiclesPerMonth: number
  hasWhatsApp: boolean; hasAdvancedReports: boolean; hasFleetManagement: boolean; hasApiAccess: boolean
  trialDays: number; isActive: boolean
}

interface AuditLog {
  id: string; action: string; targetType: string; targetId?: string
  details?: any; ipAddress?: string; createdAt: string
  superAdmin: { name: string; email: string }
}

interface SupportTicket {
  id: string; subject: string; description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  createdAt: string; resolvedAt?: string
  tenant: { name: string; nameAr?: string; email: string }
  messages?: { id: string; senderType: string; message: string; createdAt: string }[]
}

interface Announcement { id: string; titleAr: string; contentAr: string; targetType: string; sentAt?: string; superAdmin: { name: string } }

type Section = 'dashboard' | 'tenants' | 'audit' | 'plans' | 'tickets' | 'announcements'

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  ACTIVE:    { label: 'نشط فعال',    color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  TRIAL:     { label: 'تجريبي',      color: '#0369a1', bg: '#e0f2fe', dot: '#0ea5e9' },
  SUSPENDED: { label: 'مجمّد',       color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
  CANCELLED: { label: 'ملغي',        color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
}
const PRIORITY_MAP = {
  LOW:    { label: 'منخفضة', color: '#374151', bg: '#f3f4f6' },
  MEDIUM: { label: 'متوسطة', color: '#0369a1', bg: '#e0f2fe' },
  HIGH:   { label: 'عالية',  color: '#c2410c', bg: '#ffedd5' },
  URGENT: { label: 'عاجلة',  color: '#991b1b', bg: '#fee2e2' },
}
const TICKET_STATUS_MAP = {
  OPEN:        { label: 'مفتوحة',   color: '#dc2626', bg: '#fee2e2' },
  IN_PROGRESS: { label: 'قيد المعالجة', color: '#d97706', bg: '#fef3c7' },
  RESOLVED:    { label: 'محلولة',   color: '#059669', bg: '#d1fae5' },
  CLOSED:      { label: 'مغلقة',    color: '#6b7280', bg: '#f3f4f6' },
}

const inp: React.CSSProperties = { padding: '9px 13px', borderRadius: 10, border: '1.5px solid #1e293b40', fontSize: 13, outline: 'none', background: '#0f172a', color: '#e2e8f0', width: '100%', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 5, display: 'block', letterSpacing: 0.4 }

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('dashboard')

  // Data
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [stats, setStats] = useState({ totalTenants: 0, activeTenants: 0, trialTenants: 0, suspendedTenants: 0, cancelledTenants: 0, activeSubscriptions: 0, mrr: 0, arr: 0, churnRate: 0, trialExpiringSoon: 0 })
  const [usageStats, setUsageStats] = useState<{ activeThisWeekCount: number; trialExpiring: any[]; inactiveTenants: any[] }>({ activeThisWeekCount: 0, trialExpiring: [], inactiveTenants: [] })
  const [loading, setLoading] = useState(true)

  // Modals
  const [selectedTenantForStatus, setSelectedTenantForStatus] = useState<Tenant | null>(null)
  const [newStatus, setNewStatus] = useState<Tenant['status']>('ACTIVE')
  const [selectedTenantForPlan, setSelectedTenantForPlan] = useState<Tenant | null>(null)
  const [newPlanId, setNewPlanId] = useState('')
  const [newBillingCycle, setNewBillingCycle] = useState('MONTHLY')
  const [newPeriodEnd, setNewPeriodEnd] = useState('')
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [editingPlanData, setEditingPlanData] = useState<Partial<Plan>>({})
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [ticketReply, setTicketReply] = useState('')
  const [ticketStatus, setTicketStatus] = useState<SupportTicket['status']>('IN_PROGRESS')
  const [saving, setSaving] = useState(false)
  const [selectedTenantForInvoices, setSelectedTenantForInvoices] = useState<Tenant | null>(null)
  const [tenantInvoices, setTenantInvoices] = useState<any[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)

  // Manual Tenant Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createGarageName, setCreateGarageName] = useState('')
  const [createGarageNameAr, setCreateGarageNameAr] = useState('')
  const [createOwnerName, setCreateOwnerName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createPlanId, setCreatePlanId] = useState('')
  const [createStatus, setCreateStatus] = useState<Tenant['status']>('TRIAL')

  // Tenant Details Modal
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [tenantDetails, setTenantDetails] = useState<any | null>(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Announcement form
  const [annTitle, setAnnTitle] = useState('')
  const [annContent, setAnnContent] = useState('')
  const [annTarget, setAnnTarget] = useState('ALL')
  const [broadcastType, setBroadcastType] = useState('ANNOUNCEMENT')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken')
      const isSA = localStorage.getItem('isSuperAdmin') === 'true'
      if (token && isSA) {
        setIsLoggedIn(true)
        loadAll()
      } else {
        // Make sure we clear any stale state
        localStorage.removeItem('isSuperAdmin')
        setLoading(false)
      }
    }
  }, [])

  const loadAll = async () => {
    try {
      setLoading(true)
      const [statsRes, tenantsRes, plansRes, auditRes, ticketsRes, annRes, usageRes] = await Promise.all([
        api.get('/super-admin/stats'),
        api.get('/super-admin/tenants'),
        api.get('/super-admin/plans'),
        api.get('/super-admin/audit-logs'),
        api.get('/super-admin/support-tickets'),
        api.get('/super-admin/announcements'),
        api.get('/super-admin/usage-stats'),
      ])
      setStats(statsRes.data.data)
      setTenants(tenantsRes.data.data)
      setPlans(plansRes.data.data)
      setAuditLogs(auditRes.data.data.logs || [])
      setTickets(ticketsRes.data.data)
      setAnnouncements(annRes.data.data)
      setUsageStats(usageRes.data.data)
    } catch (err: any) {
      // Force re-login if it's a 401 (unauthorized) or 403 (forbidden) — e.g. token mismatch
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        handleLogout()
      } else {
        console.error('Super admin data load error:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoginLoading(true)
      const res = await api.post('/auth/super-admin/login', { email, password })
      localStorage.setItem('accessToken', res.data.data.accessToken)
      localStorage.setItem('isSuperAdmin', 'true')
      setIsLoggedIn(true)
      loadAll()
    } catch (err: any) { alert(err.response?.data?.message || 'خطأ في بيانات الولوج') }
    finally { setLoginLoading(false) }
  }

  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('isSuperAdmin')
    setIsLoggedIn(false)
    setTenants([])
  }

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTenantForStatus) return
    try {
      setSaving(true)
      await api.patch(`/super-admin/tenants/${selectedTenantForStatus.id}/status`, { status: newStatus })
      setSelectedTenantForStatus(null)
      loadAll()
    } catch (err: any) { alert(err.response?.data?.message || 'فشل تعديل الحالة') }
    finally { setSaving(false) }
  }

  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTenantForPlan || !newPlanId || !newPeriodEnd) return
    try {
      setSaving(true)
      await api.patch(`/super-admin/tenants/${selectedTenantForPlan.id}/subscription`, { planId: newPlanId, billingCycle: newBillingCycle, currentPeriodEnd: new Date(newPeriodEnd).toISOString() })
      setSelectedTenantForPlan(null)
      loadAll()
    } catch (err: any) { alert(err.response?.data?.message || 'فشل تعديل الاشتراك') }
    finally { setSaving(false) }
  }

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlan) return
    try {
      setSaving(true)
      await api.patch(`/super-admin/plans/${editingPlan.id}`, editingPlanData)
      setEditingPlan(null)
      loadAll()
    } catch (err: any) { alert(err.response?.data?.message || 'فشل تعديل الباقة') }
    finally { setSaving(false) }
  }

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicket) return
    try {
      setSaving(true)
      await api.patch(`/super-admin/support-tickets/${selectedTicket.id}`, { status: ticketStatus, adminReply: ticketReply || undefined })
      setSelectedTicket(null)
      setTicketReply('')
      loadAll()
    } catch (err: any) { alert(err.response?.data?.message || 'فشل تعديل التذكرة') }
    finally { setSaving(false) }
  }

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (annTitle.trim().length < 2) {
      alert('عذراً، يجب أن يكون العنوان حرفين على الأقل ⚠️')
      return
    }
    if (annContent.trim().length < 2) {
      alert('عذراً، يجب أن يكون المحتوى حرفين على الأقل ⚠️')
      return
    }
    try {
      setSaving(true)
      await api.post('/super-admin/announcements', {
        title: annTitle,
        titleAr: annTitle,
        content: annContent,
        contentAr: annContent,
        targetType: annTarget,
        broadcastType
      })
      setAnnTitle('')
      setAnnContent('')
      setBroadcastType('ANNOUNCEMENT')
      loadAll()
      alert('تم بث الرسالة بنجاح ✅')
    } catch (err: any) { alert(err.response?.data?.message || 'فشل إرسال البث') }
    finally { setSaving(false) }
  }

  const handleImpersonate = async (tenant: Tenant) => {
    if (!window.confirm(`هل أنت متأكد من الدخول كمشاهد لحساب الكراج: ${tenant.nameAr || tenant.name}؟`)) return
    try {
      setLoading(true)
      const res = await api.post(`/super-admin/tenants/${tenant.id}/impersonate`)
      const { user: userData, tenant: tenantData, branch, tokens } = res.data.data

      // Store original super admin token
      const currentToken = localStorage.getItem('accessToken')
      if (currentToken) {
        localStorage.setItem('originalAdminToken', currentToken)
      }

      // Set the impersonated tokens and data
      localStorage.setItem('accessToken', tokens.accessToken)
      localStorage.setItem('refreshToken', tokens.refreshToken)
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('tenant', JSON.stringify(tenantData))
      localStorage.setItem('branch', branch ? JSON.stringify(branch) : '')
      localStorage.setItem('isImpersonating', 'true')

      // Populate Zustand gms-auth state for page hydration
      const gmsAuth = {
        state: {
          user: userData,
          tenant: tenantData,
          branch: branch || null,
          isAuthenticated: true,
        },
        version: 0,
      }
      localStorage.setItem('gms-auth', JSON.stringify(gmsAuth))

      // Redirect to main dashboard
      window.location.href = '/dashboard'
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل الدخول كمشاهد')
      setLoading(false)
    }
  }

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createGarageName || !createOwnerName || !createEmail || !createPassword || !createPlanId) {
      alert('الرجاء تعبئة كافة الحقول المطلوبة')
      return
    }
    try {
      setSaving(true)
      await api.post('/super-admin/tenants', {
        garageName: createGarageName,
        garageNameAr: createGarageNameAr || null,
        ownerName: createOwnerName,
        email: createEmail,
        password: createPassword,
        planId: createPlanId,
        status: createStatus,
        phone: null,
      })
      alert('تم إنشاء حساب الكراج وتجهيزه بنجاح ✅')
      setShowCreateModal(false)
      setCreateGarageName('')
      setCreateGarageNameAr('')
      setCreateOwnerName('')
      setCreateEmail('')
      setCreatePassword('')
      setCreatePlanId('')
      setCreateStatus('TRIAL')
      loadAll()
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل إنشاء الكراج')
    } finally {
      setSaving(false)
    }
  }

  const handleViewDetails = async (tenant: Tenant) => {
    try {
      setDetailsLoading(true)
      setShowDetailsModal(true)
      setTenantDetails(null)
      const res = await api.get(`/super-admin/tenants/${tenant.id}/details`)
      setTenantDetails(res.data.data)
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل جلب تفاصيل الكراج')
      setShowDetailsModal(false)
    } finally {
      setDetailsLoading(false)
    }
  }

  const filteredTenants = useMemo(() => tenants.filter(t => {
    const term = searchTerm.toLowerCase()
    const match = !term || t.name.toLowerCase().includes(term) || (t.nameAr && t.nameAr.toLowerCase().includes(term)) || t.slug.toLowerCase().includes(term) || t.email.toLowerCase().includes(term)
    return match && (statusFilter === 'ALL' || t.status === statusFilter)
  }), [tenants, searchTerm, statusFilter])

  // ─── Login Screen ──────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e293b 100%)', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'system-ui', sans-serif", direction: 'rtl' }}>
        {/* Background decorations */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '15%', right: '10%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: '20%', left: '5%', width: 250, height: 250, background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)', borderRadius: '50%' }} />
        </div>

        <div style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(20px)', borderRadius: 28, padding: '44px 40px', width: '100%', maxWidth: 420, boxShadow: '0 32px 64px -16px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', position: 'relative' }}>
          <img src="/warshatak_logo.png" style={{ width: 68, height: 68, borderRadius: 20, margin: '0 auto 20px', objectFit: 'cover', boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }} alt="Warshatak Logo" />
          <h2 style={{ color: '#f8fafc', fontWeight: 900, fontSize: 22, margin: '0 0 6px' }}>بوابة المالك العام</h2>
          <p style={{ color: '#475569', fontSize: 12.5, margin: '0 0 30px' }}>Warshatak SaaS Platform — Super Admin Panel</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'right' }}>
            <div>
              <label style={lbl}>البريد الإلكتروني الإداري</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@gms-platform.com" style={inp} required />
            </div>
            <div>
              <label style={lbl}>كلمة المرور السرية</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••" style={inp} required />
            </div>
            <button type="submit" disabled={loginLoading} style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', border: 'none', borderRadius: 14, padding: '13px', fontSize: 14, fontWeight: 800, cursor: loginLoading ? 'not-allowed' : 'pointer', marginTop: 6, boxShadow: '0 6px 20px rgba(124,58,237,0.35)', transition: 'opacity 0.2s', opacity: loginLoading ? 0.7 : 1 }}>
              {loginLoading ? '⏳ جاري التحقق...' : '🔑 دخول البوابة الإدارية'}
            </button>
          </form>
          <p style={{ color: '#334155', fontSize: 10.5, marginTop: 20 }}>🔒 مقيّد ببيانات اعتماد المدير العام فقط</p>
        </div>
      </div>
    )
  }

  // ─── SIDEBAR ITEMS ─────────────────────────────────────────────────────────
  const navItems: { key: Section; icon: string; label: string; badge?: number }[] = [
    { key: 'dashboard',     icon: '📊', label: 'لوحة المؤشرات' },
    { key: 'tenants',       icon: '🏢', label: 'الكراجات', badge: stats.totalTenants },
    { key: 'audit',         icon: '📋', label: 'سجل التدقيق', badge: auditLogs.length },
    { key: 'plans',         icon: '🎯', label: 'إدارة الباقات' },
    { key: 'tickets',       icon: '🎫', label: 'تذاكر الدعم', badge: tickets.filter(t => t.status === 'OPEN').length },
    { key: 'announcements', icon: '📣', label: 'الإعلانات' },
  ]

  const sectionTitles: Record<Section, string> = {
    dashboard:     'لوحة المؤشرات العامة',
    tenants:       'إدارة الكراجات المشتركة',
    audit:         'سجل تدقيق المنصة',
    plans:         'إدارة خطط الاشتراك',
    tickets:       'تذاكر الدعم الفني',
    announcements: 'الإعلانات والتواصل المركزي',
  }

  const statCard = (label: string, value: string | number, sub?: string, accent?: string) => (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '20px 22px', minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 900, color: accent || '#f8fafc', display: 'block' }}>{value}</span>
      {sub && <span style={{ fontSize: 10.5, color: '#475569', marginTop: 2, display: 'block' }}>{sub}</span>}
    </div>
  )

  const badge = (text: string, color: string, bg: string) => (
    <span style={{ fontSize: 10.5, fontWeight: 800, color, background: bg, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{text}</span>
  )

  // ─── MAIN DASHBOARD ────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', direction: 'rtl', fontFamily: "'system-ui', sans-serif", color: '#e2e8f0' }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 240, background: '#020617', borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column', padding: '20px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, padding: '0 8px' }}>
          <img src="/warshatak_logo.png" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} alt="Warshatak Logo" />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 900, color: '#f8fafc' }}>Warshatak Platform</div>
            <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 800, letterSpacing: 1 }}>SUPER ADMIN</div>
          </div>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, border: 'none', padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: activeSection === item.key ? 800 : 600, cursor: 'pointer', textAlign: 'right', width: '100%', transition: 'all 0.15s',
                background: activeSection === item.key ? 'linear-gradient(135deg, #1d4ed820, #7c3aed20)' : 'transparent',
                color: activeSection === item.key ? '#a78bfa' : '#64748b',
                borderRight: activeSection === item.key ? '3px solid #7c3aed' : '3px solid transparent',
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span style={{ fontSize: 10, fontWeight: 900, background: activeSection === item.key ? '#7c3aed' : '#1e293b', color: activeSection === item.key ? '#fff' : '#94a3b8', padding: '2px 7px', borderRadius: 10, minWidth: 20, textAlign: 'center' }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Logout */}
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#ef444412', color: '#f87171', border: '1px solid #ef444430', borderRadius: 10, padding: '10px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', marginTop: 12 }}>
          🚪 تسجيل الخروج
        </button>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* TopBar */}
        <div style={{ background: '#020617', borderBottom: '1px solid #1e293b', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#f8fafc' }}>{sectionTitles[activeSection]}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#475569' }}>Warshatak SaaS — لوحة التحكم الإشرافية الكاملة</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {stats.trialExpiringSoon > 0 && (
              <span style={{ fontSize: 11, fontWeight: 800, background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: 20 }}>
                ⚠️ {stats.trialExpiringSoon} تجريبي ينتهي قريباً
              </span>
            )}
            <button onClick={loadAll} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              🔄 تحديث
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 44, height: 44, border: '3px solid #1e293b', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
              <span style={{ color: '#64748b', fontSize: 13 }}>جاري تحميل بيانات المنصة...</span>
            </div>
          ) : (
            <>

              {/* ════════════════ DASHBOARD ════════════════ */}
              {activeSection === 'dashboard' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                  {/* KPI Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
                    {statCard('إجمالي الكراجات', stats.totalTenants)}
                    {statCard('الاشتراكات الفعالة', stats.activeTenants, undefined, '#34d399')}
                    {statCard('حسابات تجريبية', stats.trialTenants, undefined, '#38bdf8')}
                    {statCard('كراجات موقوفة', stats.suspendedTenants, undefined, '#f87171')}
                    {statCard('MRR (شهري)', `${stats.mrr.toFixed(0)} KWD`, 'الإيراد الشهري المتكرر', '#a78bfa')}
                    {statCard('ARR (سنوي)', `${stats.arr.toFixed(0)} KWD`, 'الإيراد السنوي المتوقع', '#fb923c')}
                    {statCard('Churn Rate', `${stats.churnRate}%`, 'معدل الإلغاء (30 يوم)', stats.churnRate > 5 ? '#f87171' : '#34d399')}
                    {statCard('نشط هذا الأسبوع', usageStats.activeThisWeekCount, 'كراج له طلبات فعلية', '#34d399')}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Trial Expiring */}
                    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '20px 22px' }}>
                      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>⏳ Trial تنتهي خلال 7 أيام</h3>
                      {usageStats.trialExpiring.length === 0 ? (
                        <p style={{ color: '#475569', fontSize: 12 }}>لا يوجد حسابات تجريبية منتهية قريباً</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {usageStats.trialExpiring.map((t: any) => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '10px 14px', borderRadius: 10 }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{t.nameAr || t.name}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{t.email}</div>
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', background: '#fef3c715', padding: '3px 10px', borderRadius: 8 }}>
                                {new Date(t.trialEndsAt).toLocaleDateString('ar-KW')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Inactive Tenants */}
                    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '20px 22px' }}>
                      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#f87171' }}>😴 كراجات خاملة (14+ يوم)</h3>
                      {usageStats.inactiveTenants.length === 0 ? (
                        <p style={{ color: '#475569', fontSize: 12 }}>كل الكراجات نشطة 🎉</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {usageStats.inactiveTenants.map((t: any) => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '10px 14px', borderRadius: 10 }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{t.nameAr || t.name}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{t.email}</div>
                              </div>
                              <span style={{ fontSize: 10, color: '#ef4444' }}>لا توجد طلبات</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ════════════════ TENANTS ════════════════ */}
              {activeSection === 'tenants' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Filters */}
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text" placeholder="🔍 ابحث بالاسم، البريد، أو الـ slug..." value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{ ...inp, flex: 1, minWidth: 220 }}
                    />
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>
                      <option value="ALL">كل الحالات</option>
                      <option value="ACTIVE">نشط</option>
                      <option value="TRIAL">تجريبي</option>
                      <option value="SUSPENDED">موقوف</option>
                      <option value="CANCELLED">ملغي</option>
                    </select>
                    <span style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>{filteredTenants.length} كراج</span>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      style={{ padding: '9px 16px', borderRadius: 10, background: '#4f46e5', border: 'none', color: '#ffffff', fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#4338ca'}
                      onMouseLeave={e => e.currentTarget.style.background = '#4f46e5'}
                    >
                      ➕ إضافة كراج جديد يدوياً
                    </button>
                  </div>

                  {/* Table */}
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
                          {['اسم الكراج', 'البريد / الرابط', 'الباقة', 'الحالة', 'الفروع/الموظفين/الطلبات', 'الإجراءات'].map(h => (
                            <th key={h} style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#64748b', fontSize: 11.5, letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTenants.map((t, i) => {
                          const s = STATUS_MAP[t.status]
                          return (
                            <tr key={t.id} style={{ borderBottom: '1px solid #1e293b80', background: i % 2 === 0 ? '#1e293b' : '#172033' }}>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ fontWeight: 800, color: '#f8fafc' }}>{t.nameAr || t.name}</div>
                                <div style={{ fontSize: 10.5, color: '#475569' }}>منذ {new Date(t.createdAt).toLocaleDateString('ar-KW')}</div>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.email}</div>
                                <div style={{ fontSize: 10.5, color: '#334155', fontFamily: 'monospace' }}>/{t.slug}</div>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#a78bfa' }}>
                                  {t.subscription?.plan?.nameAr || '—'}
                                </span>
                                {t.subscription && (
                                  <div style={{ fontSize: 10, color: '#475569' }}>
                                    ينتهي: {new Date(t.subscription.currentPeriodEnd).toLocaleDateString('ar-KW')}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: s.color, background: s.bg + '20', padding: '3px 10px', borderRadius: 20 }}>
                                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: s.dot, marginLeft: 5 }} />
                                  {s.label}
                                </span>
                                {t.trialEndsAt && t.status === 'TRIAL' && (
                                  <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 3 }}>
                                    ينتهي: {new Date(t.trialEndsAt).toLocaleDateString('ar-KW')}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#64748b' }}>
                                  <span>🏢 {t._count?.branches || 0}</span>
                                  <span>👥 {t._count?.users || 0}</span>
                                  <span>🔧 {t._count?.workOrders || 0}</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                  <button onClick={() => { setSelectedTenantForStatus(t); setNewStatus(t.status) }} style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid #334155', background: '#0f172a', color: '#94a3b8', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}>
                                    🔄 الحالة
                                  </button>
                                  <button onClick={() => { setSelectedTenantForPlan(t); setNewPlanId(t.subscription?.planId || ''); setNewBillingCycle(t.subscription?.billingCycle || 'MONTHLY'); setNewPeriodEnd('') }} style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid #334155', background: '#0f172a', color: '#94a3b8', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}>
                                    🎯 الباقة
                                  </button>
                                  <button
                                    onClick={async () => {
                                      setSelectedTenantForInvoices(t)
                                      setInvoicesLoading(true)
                                      try {
                                        const res = await api.get(`/super-admin/tenants/${t.id}/invoices`)
                                        setTenantInvoices(res.data.data || [])
                                      } catch { setTenantInvoices([]) }
                                      finally { setInvoicesLoading(false) }
                                    }}
                                    style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid #334155', background: '#0f172a', color: '#94a3b8', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    🧾 الفواتير
                                  </button>
                                  <button
                                    onClick={() => handleViewDetails(t)}
                                    style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid #334155', background: '#0f172a', color: '#38bdf8', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    ℹ️ التفاصيل
                                  </button>
                                  <button
                                    onClick={() => handleImpersonate(t)}
                                    style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid #1d4ed840', background: '#1d4ed810', color: '#60a5fa', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    👁️ مشاهدة
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {filteredTenants.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#334155', fontSize: 13 }}>لا توجد نتائج مطابقة</div>
                    )}
                  </div>
                </div>
              )}

              {/* ════════════════ AUDIT LOGS ════════════════ */}
              {activeSection === 'audit' && (
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>📋 سجل العمليات الإشرافية</h3>
                    <span style={{ fontSize: 11, color: '#475569' }}>{auditLogs.length} سجل</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
                          {['التاريخ', 'المدير', 'العملية', 'النوع', 'عنوان IP'].map(h => (
                            <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: '#64748b', fontSize: 11, letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log, i) => (
                          <tr key={log.id} style={{ borderBottom: '1px solid #1e293b60', background: i % 2 === 0 ? '#1e293b' : '#172033' }}>
                            <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                              {new Date(log.createdAt).toLocaleString('ar-KW')}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ fontWeight: 700, color: '#a78bfa' }}>{log.superAdmin.name}</div>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#e2e8f0', maxWidth: 320 }}>
                              {log.action}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: 10.5, fontWeight: 700, background: '#334155', color: '#94a3b8', padding: '3px 8px', borderRadius: 6 }}>
                                {log.targetType}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#475569', fontFamily: 'monospace', fontSize: 11 }}>
                              {log.ipAddress || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {auditLogs.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#334155', fontSize: 13 }}>لا توجد سجلات بعد</div>
                    )}
                  </div>
                </div>
              )}

              {/* ════════════════ PLANS ════════════════ */}
              {activeSection === 'plans' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                  {plans.map(plan => (
                    <div key={plan.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 18, padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc' }}>{plan.nameAr}</div>
                          <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>{plan.name}</div>
                        </div>
                        <span style={{ fontSize: 10.5, fontWeight: 800, background: plan.isActive ? '#10b98120' : '#ef444420', color: plan.isActive ? '#34d399' : '#f87171', padding: '4px 10px', borderRadius: 20 }}>
                          {plan.isActive ? 'مفعّلة ✓' : 'معطّلة'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          ['السعر الشهري', `${Number(plan.monthlyPrice).toFixed(2)} KWD`],
                          ['السعر السنوي', `${Number(plan.annualPrice).toFixed(2)} KWD`],
                          ['الفروع', plan.maxBranches],
                          ['الفنيين', plan.maxTechnicians],
                          ['السيارات/شهر', plan.maxVehiclesPerMonth],
                          ['أيام التجربة', plan.trialDays],
                        ].map(([k, v]) => (
                          <div key={String(k)} style={{ background: '#0f172a', padding: '10px 12px', borderRadius: 10 }}>
                            <div style={{ fontSize: 10, color: '#475569', marginBottom: 2 }}>{k}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>{v}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {plan.hasWhatsApp && badge('واتساب ✓', '#166534', '#bbf7d030')}
                        {plan.hasAdvancedReports && badge('تقارير ✓', '#1e40af', '#bfdbfe30')}
                        {plan.hasFleetManagement && badge('أسطول ✓', '#7c2d12', '#fed7aa30')}
                        {plan.hasApiAccess && badge('API ✓', '#581c87', '#e9d5ff30')}
                      </div>

                      <button
                        onClick={() => { setEditingPlan(plan); setEditingPlanData({ nameAr: plan.nameAr, monthlyPrice: plan.monthlyPrice, annualPrice: plan.annualPrice, maxBranches: plan.maxBranches, maxTechnicians: plan.maxTechnicians, maxVehiclesPerMonth: plan.maxVehiclesPerMonth, trialDays: plan.trialDays, hasWhatsApp: plan.hasWhatsApp, hasAdvancedReports: plan.hasAdvancedReports, hasFleetManagement: plan.hasFleetManagement, hasApiAccess: plan.hasApiAccess, isActive: plan.isActive }) }}
                        style={{ background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                      >
                        ✏️ تعديل الباقة
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ════════════════ TICKETS ════════════════ */}
              {activeSection === 'tickets' && (
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155' }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>🎫 تذاكر الدعم الفني</h3>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
                          {['الكراج', 'الموضوع', 'الأولوية', 'الحالة', 'التاريخ', 'الإجراء'].map(h => (
                            <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tickets.map((t, i) => {
                          const p = PRIORITY_MAP[t.priority]
                          const s = TICKET_STATUS_MAP[t.status]
                          return (
                            <tr key={t.id} style={{ borderBottom: '1px solid #1e293b60', background: i % 2 === 0 ? '#1e293b' : '#172033' }}>
                              <td style={{ padding: '11px 14px' }}>
                                <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{t.tenant.nameAr || t.tenant.name}</div>
                                <div style={{ fontSize: 10.5, color: '#475569' }}>{t.tenant.email}</div>
                              </td>
                              <td style={{ padding: '11px 14px', color: '#e2e8f0', maxWidth: 260 }}>{t.subject}</td>
                              <td style={{ padding: '11px 14px' }}>
                                <span style={{ fontSize: 10.5, fontWeight: 800, color: p.color, background: p.bg + '20', padding: '3px 9px', borderRadius: 20 }}>{p.label}</span>
                              </td>
                              <td style={{ padding: '11px 14px' }}>
                                <span style={{ fontSize: 10.5, fontWeight: 800, color: s.color, background: s.bg + '20', padding: '3px 9px', borderRadius: 20 }}>{s.label}</span>
                              </td>
                              <td style={{ padding: '11px 14px', color: '#475569', fontSize: 11, whiteSpace: 'nowrap' }}>
                                {new Date(t.createdAt).toLocaleDateString('ar-KW')}
                              </td>
                              <td style={{ padding: '11px 14px' }}>
                                <button onClick={() => { setSelectedTicket(t); setTicketStatus(t.status); setTicketReply('') }} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#94a3b8', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                  ↩️ رد
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {tickets.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#334155', fontSize: 13 }}>لا توجد تذاكر دعم 🎉</div>
                    )}
                  </div>
                </div>
              )}

              {/* ════════════════ ANNOUNCEMENTS ════════════════ */}
              {activeSection === 'announcements' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  {/* Send Form */}
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '24px' }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>📣 بث جديد للمنصة</h3>
                    <form onSubmit={handleSendAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label style={lbl}>عنوان البث *</label>
                        <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="مثال: تحديث نظام الفواتير الجديد" style={inp} required />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={lbl}>الاستهداف</label>
                          <select value={annTarget} onChange={e => setAnnTarget(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                            <option value="ALL">كل الكراجات</option>
                            <option value="PLAN">خطة محددة</option>
                          </select>
                        </div>
                        <div>
                          <label style={lbl}>نوع البث</label>
                          <select value={broadcastType} onChange={e => setBroadcastType(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                            <option value="ANNOUNCEMENT">إعلان وإشعار (عام) 📣</option>
                            <option value="NOTIFICATION">إشعار فقط (جرس) 🔔</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={lbl}>نص الرسالة / البث *</label>
                        <textarea value={annContent} onChange={e => setAnnContent(e.target.value)} rows={5} placeholder="اكتب نص البث هنا..." style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} required />
                      </div>
                      <button type="submit" disabled={saving} style={{ background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                        {saving ? '⏳ جاري البث...' : '📤 إرسال البث المستهدف'}
                      </button>
                    </form>
                  </div>

                  {/* Previous announcements */}
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '24px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>📜 الإعلانات السابقة</h3>
                    {announcements.length === 0 ? (
                      <p style={{ color: '#334155', fontSize: 12 }}>لا توجد إعلانات سابقة</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {announcements.map(ann => (
                          <div key={ann.id} style={{ background: '#0f172a', padding: '14px', borderRadius: 12, border: '1px solid #1e293b' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>{ann.titleAr}</div>
                              <span style={{ fontSize: 10, fontWeight: 700, background: '#1e293b', color: '#64748b', padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap', marginRight: 8 }}>
                                {ann.targetType === 'ALL' ? 'الكل' : ann.targetType}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{ann.contentAr}</p>
                            <div style={{ fontSize: 10.5, color: '#334155', marginTop: 8 }}>
                              {ann.superAdmin.name} — {ann.sentAt ? new Date(ann.sentAt).toLocaleDateString('ar-KW') : '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      </div>

      {/* ════ MODAL: Change Status ════ */}
      {selectedTenantForStatus && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setSelectedTenantForStatus(null) }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '30px', width: '100%', maxWidth: 420, direction: 'rtl' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 900, color: '#f8fafc' }}>🔄 تغيير حالة الكراج</h3>
            <p style={{ margin: '0 0 22px', fontSize: 12, color: '#64748b' }}>{selectedTenantForStatus.nameAr || selectedTenantForStatus.name}</p>
            <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>الحالة الجديدة</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as any)} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="ACTIVE">نشط فعال ✅</option>
                  <option value="TRIAL">تجريبي ⏱️</option>
                  <option value="SUSPENDED">موقوف 🛑</option>
                  <option value="CANCELLED">ملغي ❌</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setSelectedTenantForStatus(null)} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" disabled={saving} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? '⏳...' : '✅ حفظ التغيير'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL: Change Subscription ════ */}
      {selectedTenantForPlan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setSelectedTenantForPlan(null) }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '30px', width: '100%', maxWidth: 440, direction: 'rtl' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 900, color: '#f8fafc' }}>🎯 تغيير باقة الاشتراك</h3>
            <p style={{ margin: '0 0 22px', fontSize: 12, color: '#64748b' }}>{selectedTenantForPlan.nameAr || selectedTenantForPlan.name}</p>
            <form onSubmit={handleUpdateSubscription} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>الباقة الجديدة</label>
                <select value={newPlanId} onChange={e => setNewPlanId(e.target.value)} style={{ ...inp, cursor: 'pointer' }} required>
                  <option value="">— اختر الباقة —</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.nameAr} — {Number(p.monthlyPrice).toFixed(2)} KWD/شهر</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>دورة الفوترة</label>
                <select value={newBillingCycle} onChange={e => setNewBillingCycle(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="MONTHLY">شهري</option>
                  <option value="ANNUAL">سنوي</option>
                </select>
              </div>
              <div>
                <label style={lbl}>تاريخ انتهاء الفترة الحالية</label>
                <input type="date" value={newPeriodEnd} onChange={e => setNewPeriodEnd(e.target.value)} style={inp} required />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setSelectedTenantForPlan(null)} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" disabled={saving} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? '⏳...' : '✅ تطبيق الباقة الجديدة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL: Edit Plan ════ */}
      {editingPlan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }} onClick={e => { if (e.target === e.currentTarget) setEditingPlan(null) }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '30px', width: '100%', maxWidth: 520, direction: 'rtl', margin: 'auto' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 900, color: '#f8fafc' }}>✏️ تعديل باقة: {editingPlan.nameAr}</h3>
            <p style={{ margin: '0 0 22px', fontSize: 12, color: '#64748b' }}>التغييرات تنعكس فوراً على كل الكراجات المشتركة بهذه الباقة</p>
            <form onSubmit={handleUpdatePlan} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>السعر الشهري (KWD)</label>
                  <input type="number" step="0.01" value={editingPlanData.monthlyPrice || ''} onChange={e => setEditingPlanData(p => ({ ...p, monthlyPrice: parseFloat(e.target.value) }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>السعر السنوي (KWD)</label>
                  <input type="number" step="0.01" value={editingPlanData.annualPrice || ''} onChange={e => setEditingPlanData(p => ({ ...p, annualPrice: parseFloat(e.target.value) }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>الحد الأقصى للفروع</label>
                  <input type="number" value={editingPlanData.maxBranches || ''} onChange={e => setEditingPlanData(p => ({ ...p, maxBranches: parseInt(e.target.value) }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>الحد الأقصى للفنيين</label>
                  <input type="number" value={editingPlanData.maxTechnicians || ''} onChange={e => setEditingPlanData(p => ({ ...p, maxTechnicians: parseInt(e.target.value) }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>السيارات/شهر</label>
                  <input type="number" value={editingPlanData.maxVehiclesPerMonth || ''} onChange={e => setEditingPlanData(p => ({ ...p, maxVehiclesPerMonth: parseInt(e.target.value) }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>أيام التجربة المجانية</label>
                  <input type="number" value={editingPlanData.trialDays || ''} onChange={e => setEditingPlanData(p => ({ ...p, trialDays: parseInt(e.target.value) }))} style={inp} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['hasWhatsApp', 'واتساب مدمج'],
                  ['hasAdvancedReports', 'تقارير متقدمة'],
                  ['hasFleetManagement', 'إدارة الأسطول'],
                  ['hasApiAccess', 'وصول API'],
                  ['isActive', 'الباقة مفعّلة'],
                ].map(([field, label]) => (
                  <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: '#0f172a', padding: '10px 12px', borderRadius: 10 }}>
                    <input type="checkbox" checked={!!(editingPlanData as any)[field]} onChange={e => setEditingPlanData(p => ({ ...p, [field]: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    <span style={{ fontSize: 12.5, color: '#e2e8f0', fontWeight: 600 }}>{label}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setEditingPlan(null)} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" disabled={saving} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? '⏳...' : '💾 حفظ تعديلات الباقة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL: Support Ticket Reply ════ */}
      {selectedTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setSelectedTicket(null) }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '30px', width: '100%', maxWidth: 480, direction: 'rtl' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 900, color: '#f8fafc' }}>↩️ الرد على تذكرة الدعم</h3>
            <p style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b' }}>{selectedTicket.tenant.nameAr || selectedTicket.tenant.name}</p>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: 14, marginBottom: 18, border: '1px solid #334155' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>{selectedTicket.subject}</div>
              
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                {/* Original description */}
                <div style={{ borderBottom: '1px solid #33415550', paddingBottom: 10, marginBottom: 4 }}>
                  <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 800, marginBottom: 4, textTransform: 'uppercase' }}>شرح المشكلة الأصلي:</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{selectedTicket.description}</div>
                  <div style={{ fontSize: 8.5, color: '#475569', marginTop: 4, textAlign: 'left' }}>{new Date(selectedTicket.createdAt).toLocaleString('ar-KW')}</div>
                </div>

                {/* Conversation messages */}
                {selectedTicket.messages?.map(m => {
                  const isAdmin = m.senderType === 'SUPER_ADMIN'
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isAdmin ? 'flex-start' : 'flex-end',
                        background: isAdmin ? 'linear-gradient(135deg, #1d4ed8, #2563eb)' : '#334155',
                        color: '#ffffff',
                        padding: '8px 12px',
                        borderRadius: isAdmin ? '10px 10px 0 10px' : '10px 10px 10px 0',
                        fontSize: 12,
                        maxWidth: '85%',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      }}
                    >
                      <div style={{ fontSize: 9, color: isAdmin ? '#93c5fd' : '#94a3b8', fontWeight: 800, marginBottom: 2 }}>
                        {isAdmin ? 'ردك (إدارة المنصة)' : 'مالك الكراج'}
                      </div>
                      <div style={{ lineHeight: 1.4 }}>{m.message}</div>
                      <div style={{ fontSize: 8, color: isAdmin ? '#bfdbfe' : '#cbd5e1', textAlign: 'left', marginTop: 4 }}>
                        {new Date(m.createdAt).toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <form onSubmit={handleUpdateTicket} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>تغيير الحالة</label>
                <select value={ticketStatus} onChange={e => setTicketStatus(e.target.value as any)} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="OPEN">مفتوحة</option>
                  <option value="IN_PROGRESS">قيد المعالجة</option>
                  <option value="RESOLVED">محلولة ✅</option>
                  <option value="CLOSED">مغلقة</option>
                </select>
              </div>
              <div>
                <label style={lbl}>الرد (اختياري)</label>
                <textarea value={ticketReply} onChange={e => setTicketReply(e.target.value)} rows={4} placeholder="اكتب ردك هنا..." style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setSelectedTicket(null)} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" disabled={saving} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #059669, #0d9488)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? '⏳...' : '✅ إرسال الرد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL: Create Tenant Manually ════ */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }} onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(false) }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '30px', width: '100%', maxWidth: 480, direction: 'rtl', margin: 'auto' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 900, color: '#f8fafc' }}>➕ إضافة كراج جديد يدوياً</h3>
            <p style={{ margin: '0 0 20px', fontSize: 12, color: '#64748b' }}>سيقوم النظام بإنشاء الكراج والحساب المالك والفرع والاشتراك بشكل فوري.</p>
            <form onSubmit={handleCreateTenant} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>اسم الكراج (EN) *</label>
                  <input type="text" value={createGarageName} onChange={e => setCreateGarageName(e.target.value)} placeholder="e.g. Speed Garage" style={inp} required />
                </div>
                <div>
                  <label style={lbl}>اسم الكراج (AR)</label>
                  <input type="text" value={createGarageNameAr} onChange={e => setCreateGarageNameAr(e.target.value)} placeholder="مثال: كراج السرعة" style={inp} />
                </div>
              </div>
              <div>
                <label style={lbl}>اسم مالك الكراج *</label>
                <input type="text" value={createOwnerName} onChange={e => setCreateOwnerName(e.target.value)} placeholder="اسم المدير المسؤول" style={inp} required />
              </div>
              <div>
                <label style={lbl}>البريد الإلكتروني للمالك *</label>
                <input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="owner@garage.com" style={inp} required />
              </div>
              <div>
                <label style={lbl}>كلمة مرور الحساب *</label>
                <input type="password" value={createPassword} onChange={e => setCreatePassword(e.target.value)} placeholder="********" style={inp} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>الباقة الابتدائية *</label>
                  <select value={createPlanId} onChange={e => setCreatePlanId(e.target.value)} style={{ ...inp, cursor: 'pointer' }} required>
                    <option value="">— اختر باقة —</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.nameAr}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>حالة الحساب *</label>
                  <select value={createStatus} onChange={e => setCreateStatus(e.target.value as any)} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="TRIAL">تجريبي (Trial)</option>
                    <option value="ACTIVE">نشط (Active)</option>
                    <option value="SUSPENDED">موقوف (Suspended)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" disabled={saving} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? '⏳ جاري الإنشاء...' : '➕ إنشاء الكراج'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL: Garage Full Details ════ */}
      {showDetailsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setShowDetailsModal(false) }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '28px', width: '100%', maxWidth: 660, direction: 'rtl', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#f8fafc' }}>ℹ️ تفاصيل الكراج ونشاطه</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>عرض المؤشرات المالية، وحجم قاعدة البيانات وسجل التغييرات</p>
              </div>
              <button onClick={() => setShowDetailsModal(false)} style={{ background: '#334155', border: 'none', borderRadius: 8, width: 30, height: 30, color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>

            {detailsLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#64748b', fontSize: 13 }}>⏳ جاري جلب التفاصيل...</div>
            ) : !tenantDetails ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#f87171', fontSize: 13 }}>فشل تحميل البيانات</div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 1. Contact Information Card */}
                <div style={{ background: '#0f172a', padding: 16, borderRadius: 14, border: '1px solid #33415530', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#475569', fontWeight: 800 }}>اسم الكراج:</span>
                    <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 700, marginTop: 2 }}>{tenantDetails.tenant.nameAr || tenantDetails.tenant.name}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#475569', fontWeight: 800 }}>البريد الإلكتروني:</span>
                    <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 700, marginTop: 2 }}>{tenantDetails.tenant.email}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#475569', fontWeight: 800 }}>رقم الهاتف / الرابط:</span>
                    <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 700, marginTop: 2 }}>{tenantDetails.tenant.phone || '—'} / {tenantDetails.tenant.slug}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#475569', fontWeight: 800 }}>تاريخ التسجيل:</span>
                    <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 700, marginTop: 2 }}>{new Date(tenantDetails.tenant.createdAt).toLocaleString('ar-KW')}</div>
                  </div>
                </div>

                {/* 2. Key Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div style={{ background: '#0f172a', padding: 12, borderRadius: 12, textAlign: 'center', border: '1px solid #33415530' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 4 }}>إجمالي الإيرادات</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#34d399' }}>{tenantDetails.revenue.toFixed(3)} KWD</div>
                  </div>
                  <div style={{ background: '#0f172a', padding: 12, borderRadius: 12, textAlign: 'center', border: '1px solid #33415530' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 4 }}>السيارات المسجلة</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#38bdf8' }}>{tenantDetails.vehiclesCount} 🚗</div>
                  </div>
                  <div style={{ background: '#0f172a', padding: 12, borderRadius: 12, textAlign: 'center', border: '1px solid #33415530' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 4 }}>طلبات الصيانة</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#a78bfa' }}>{tenantDetails.tenant._count?.workOrders || 0} 🔧</div>
                  </div>
                  <div style={{ background: '#0f172a', padding: 12, borderRadius: 12, textAlign: 'center', border: '1px solid #33415530' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 4 }}>آخر نشاط</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>
                      {tenantDetails.lastActivity ? new Date(tenantDetails.lastActivity).toLocaleDateString('ar-KW') : 'خامل 😴'}
                    </div>
                  </div>
                </div>

                {/* 3. Platform Audit Logs for Tenant */}
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#f8fafc', fontWeight: 800 }}>📋 سجل التغييرات والنشاط الإداري</h4>
                  <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #33415540', borderRadius: 12, background: '#0f172a' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#1e293b', borderBottom: '1px solid #33415540' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>الحدث</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>بواسطة</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>التاريخ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenantDetails.auditLogs.map((log: any) => (
                          <tr key={log.id} style={{ borderBottom: '1px solid #1e293b40' }}>
                            <td style={{ padding: '8px 12px', color: '#e2e8f0', fontWeight: 600 }}>{log.action}</td>
                            <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{log.superAdmin?.name || 'سيرفر'}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 11 }}>{new Date(log.createdAt).toLocaleString('ar-KW')}</td>
                          </tr>
                        ))}
                        {tenantDetails.auditLogs.length === 0 && (
                          <tr>
                            <td colSpan={3} style={{ padding: 20, textAlign: 'center', color: '#334155' }}>لا توجد سجلات تغييرات موثقة بعد لهذا الكراج</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ MODAL: Subscription Invoices ════ */}
      {selectedTenantForInvoices && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setSelectedTenantForInvoices(null) }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '28px', width: '100%', maxWidth: 600, direction: 'rtl', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#f8fafc' }}>🧾 فواتير الاشتراك</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>{selectedTenantForInvoices.nameAr || selectedTenantForInvoices.name}</p>
              </div>
              <button onClick={() => setSelectedTenantForInvoices(null)} style={{ background: '#334155', border: 'none', borderRadius: 8, width: 30, height: 30, color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {invoicesLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>⏳ جاري التحميل...</div>
              ) : tenantInvoices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#334155' }}>لا توجد فواتير اشتراك مسجلة</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
                      {['رقم الفاتورة', 'المبلغ', 'الحالة', 'تاريخ الاستحقاق', 'تاريخ الدفع'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#64748b', fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tenantInvoices.map((inv: any, i: number) => {
                      const statusColors: Record<string, [string, string]> = {
                        PAID:    ['#34d399', '#10b98115'],
                        PENDING: ['#fbbf24', '#f59e0b15'],
                        FAILED:  ['#f87171', '#ef444415'],
                        VOID:    ['#94a3b8', '#33415515'],
                      }
                      const [color, bg] = statusColors[inv.status] || ['#94a3b8', '#33415515']
                      return (
                        <tr key={inv.id} style={{ borderBottom: '1px solid #1e293b60', background: i % 2 === 0 ? '#1e293b' : '#172033' }}>
                          <td style={{ padding: '10px 12px', color: '#a78bfa', fontFamily: 'monospace', fontSize: 11 }}>{inv.invoiceNumber || inv.id.slice(0, 8)}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#f8fafc' }}>{Number(inv.amount).toFixed(2)} KWD</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 800, color, background: bg, padding: '3px 9px', borderRadius: 20 }}>{inv.status}</span>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11 }}>{new Date(inv.dueDate || inv.createdAt).toLocaleDateString('ar-KW')}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11 }}>{inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('ar-KW') : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
