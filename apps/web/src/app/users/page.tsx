'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

interface User {
  id: string
  name: string
  nameAr?: string
  email: string
  phone?: string
  avatar?: string
  role: 'SUPER_ADMIN' | 'GARAGE_OWNER' | 'BRANCH_MANAGER' | 'ACCOUNTANT' | 'TECHNICIAN' | 'RECEPTIONIST'
  isActive: boolean
  createdAt: string
  lastLoginAt?: string
  branch?: {
    id: string
    name: string
    nameAr?: string
  }
}

interface Branch {
  id: string
  name: string
  nameAr?: string
}

interface AuditLog {
  id: string
  action: string
  resource: string
  resourceId: string
  newData: any
  oldData: any
  createdAt: string
  user?: {
    name: string
  }
}

const ROLE_MAP: Record<string, { label: string; desc: string; color: string; bg: string; icon: string }> = {
  GARAGE_OWNER: { label: 'مالك الكراج (Owner)', desc: 'كامل الصلاحيات الإدارية والمالية والتقارير على مستوى كل الفروع', color: '#7c3aed', bg: '#f3e8ff', icon: '👑' },
  BRANCH_MANAGER: { label: 'مدير فرع (Manager)', desc: 'إدارة مخزون الورشة، إسناد المهام، وعرض أداء الفنيين في فرع محدد', color: '#2563eb', bg: '#dbeafe', icon: '💼' },
  ACCOUNTANT: { label: 'محاسب (Accountant)', desc: 'إصدار الفواتير، تسجيل المدفوعات، سندات القبض، وعرض التقارير المالية', color: '#0891b2', bg: '#cffafe', icon: '📊' },
  RECEPTIONIST: { label: 'موظف استقبال (Receptionist)', desc: 'تسجيل دخول المركبات، فتح كروت العمل، وتحديث حالات طلبات الخدمة', color: '#059669', bg: '#d1fae5', icon: '📋' },
  TECHNICIAN: { label: 'فني / مهندس صيانة (Technician)', desc: 'تسجيل الدخول للهاتف وعرض المهام المسندة والبدء الفعلي وإتمام العمل', color: '#b45309', bg: '#fef3c7', icon: '🔧' },
}

const AVATAR_PRESETS = [
  '🧔', '👩', '🧑', '👨‍💼', '👩‍💼', '👨‍💻', '👩‍💻', '👤'
]

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1.5px solid #cbd5e1',
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

const selectStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 10,
  border: '1.5px solid #cbd5e1',
  fontSize: 13,
  outline: 'none',
  background: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
}

export default function UsersPage() {
  const { user: authUser, isAuthenticated, isHydrated } = useAuthStore()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL')
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL')

  // Create Form States
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'BRANCH_MANAGER' as User['role'],
    branchId: '',
    avatar: '👨‍💼',
  })

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) { router.push('/login'); return }
    if (authUser?.role !== 'GARAGE_OWNER') { router.push('/dashboard'); return }
    fetchUsers()
    fetchBranches()
    fetchAuditLogs()
  }, [isHydrated, isAuthenticated, authUser])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await api.get('/users')
      setUsers(res.data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches')
      setBranches(res.data.data || [])
      if (res.data.data?.length > 0) {
        setForm((prev) => ({ ...prev, branchId: res.data.data[0].id }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/users/audit-logs')
      setAuditLogs(res.data.data || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    const actionText = currentStatus ? 'تعطيل' : 'تنشيط'
    if (!confirm(`هل أنت متأكد من ${actionText} حساب هذا الموظف؟ لن يتمكن من تسجيل الدخول للنظام حتى يتم تنشيطه مجدداً.`)) return
    try {
      await api.patch(`/users/${userId}/status`, { isActive: !currentStatus })
      setUsers(users.map((u) => (u.id === userId ? { ...u, isActive: !currentStatus } : u)))
      fetchAuditLogs()
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل تعديل حالة الحساب')
    }
  }

  const handleChangeRole = async (userId: string, newRole: User['role']) => {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole })
      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))
      fetchAuditLogs()
      alert('تم تحديث صلاحية الموظف في النظام وسجل الأمان')
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل تعديل صلاحية المستخدم')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('⚠️ تحذير: حذف الحساب نهائياً قد يؤثر على تكامل الإحصائيات التاريخية للموظف. هل تفضل "تعطيله" بدلاً من الحذف لضمان أمان البيانات؟ اضغط إلغاء للتعطيل، أو موافق للحذف النهائي.')) return
    try {
      await api.delete(`/users/${userId}`)
      setUsers(users.filter((u) => u.id !== userId))
      fetchAuditLogs()
      alert('تم حذف حساب الموظف نهائياً')
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل حذف المستخدم')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      const res = await api.post('/users', form)
      setShowCreateModal(false)
      
      // Generate secure mock reset/invite link
      const inviteUrl = `${window.location.origin}/reset-password?email=${encodeURIComponent(form.email)}&invite=true`
      setCreatedInviteLink(inviteUrl)

      setForm({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'BRANCH_MANAGER',
        branchId: branches[0]?.id || '',
        avatar: '👨‍💼',
      })
      fetchUsers()
      fetchAuditLogs()
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل إضافة المستخدم')
    } finally {
      setSaving(false)
    }
  }

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const term = searchTerm.toLowerCase()
      const matchSearch =
        !term ||
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.phone && u.phone.includes(term))

      if (!matchSearch) return false

      if (selectedRoleFilter !== 'ALL' && u.role !== selectedRoleFilter) return false

      if (selectedBranchFilter !== 'ALL' && u.branch?.id !== selectedBranchFilter) return false

      return true
    })
  }, [users, searchTerm, selectedRoleFilter, selectedBranchFilter])

  // Count stats
  const totalEmployees = users.length
  const managersCount = users.filter((u) => u.role === 'GARAGE_OWNER' || u.role === 'BRANCH_MANAGER').length
  const receptionistsCount = users.filter((u) => u.role === 'RECEPTIONIST').length
  const activeUsersCount = users.filter((u) => u.isActive).length

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          title="المستخدمون وصلاحيات الموظفين"
          subtitle="إدارة حسابات طاقم العمل، موظفي الاستقبال، المدراء، ومراقبة التغييرات الأمنية (Audit Logs)"
          actions={
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                background: 'linear-gradient(135deg, #03045e 0%, #0077b6 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(3, 4, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ➕ إضافة مستخدم جديد
            </button>
          }
        />

        <main style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── KPI Stats Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div style={{ background: '#fff', border: '1px solid #eeeff4', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', display: 'block' }}>إجمالي الموظفين</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#03045e' }}>{totalEmployees}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>حسابات مسجلة</span>
                </div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #eeeff4', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', display: 'block' }}>المدراء والمشرفين</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#2563eb' }}>{managersCount}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>إداري</span>
                </div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #eeeff4', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', display: 'block' }}>موظفو الاستقبال</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#059669' }}>{receptionistsCount}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>استقبال وتذاكر</span>
                </div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #eeeff4', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', display: 'block' }}>المستخدمون النشطون</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>{activeUsersCount}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>نشط حالياً</span>
                </div>
              </div>
            </div>

            {/* ── Main Layout: Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.3fr', gap: 20, alignItems: 'flex-start' }}>

              {/* Left Column: Users table list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                
                {/* Search & Filters */}
                <div style={{
                  background: '#fff',
                  border: '1px solid #eeeff4',
                  borderRadius: 16,
                  padding: '16px',
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                }}>
                  {/* Search */}
                  <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 360 }}>
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8' }}>🔍</span>
                    <input
                      type="text"
                      placeholder="ابحث بالاسم، البريد الإلكتروني، الهاتف..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ ...inputStyle, paddingRight: 34 }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {/* Filter Branch */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>الفرع:</span>
                      <select
                        value={selectedBranchFilter}
                        onChange={(e) => setSelectedBranchFilter(e.target.value)}
                        style={selectStyle}
                      >
                        <option value="ALL">كل الفروع 🏢</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.nameAr || b.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Filter Role */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>الصلاحية:</span>
                      <select
                        value={selectedRoleFilter}
                        onChange={(e) => setSelectedRoleFilter(e.target.value)}
                        style={selectStyle}
                      >
                        <option value="ALL">كل الصلاحيات 🌐</option>
                        <option value="GARAGE_OWNER">مالك الكراج</option>
                        <option value="BRANCH_MANAGER">مدير الفرع</option>
                        <option value="ACCOUNTANT">محاسب</option>
                        <option value="RECEPTIONIST">موظف استقبال</option>
                        <option value="TECHNICIAN">فني صيانة</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Table Container */}
                <div style={{
                  background: '#fff',
                  border: '1px solid #eeeff4',
                  borderRadius: 18,
                  padding: '8px 0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.01)',
                  overflowX: 'auto',
                }}>
                  {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', flexDirection: 'column', gap: 10 }}>
                      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#0077b6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>جاري تحميل قائمة المستخدمين...</span>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                      <span style={{ fontSize: 44, display: 'block', marginBottom: 12 }}>👤</span>
                      <strong style={{ fontSize: 14, color: '#475569' }}>لا يوجد مستخدمون مطابقون للبحث</strong>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <th style={{ padding: '12px 20px', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}>المستخدم</th>
                          <th style={{ padding: '12px 20px', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}>الدور والصلاحية</th>
                          <th style={{ padding: '12px 20px', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}>الفرع</th>
                          <th style={{ padding: '12px 20px', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}>حالة الحساب</th>
                          <th style={{ padding: '12px 20px', fontSize: 11.5, fontWeight: 800, color: '#64748b', textAlign: 'center' }}>التحكم</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => {
                          const r = ROLE_MAP[user.role] || { label: user.role, color: '#475569', bg: '#f1f5f9', icon: '👤' }
                          return (
                            <tr
                              key={user.id}
                              style={{
                                borderBottom: '1px solid #f8fafc',
                                transition: 'background 0.15s',
                                opacity: user.isActive ? 1 : 0.6,
                                background: user.isActive ? '#fff' : '#f8fafc',
                              }}
                            >
                              {/* User details */}
                              <td style={{ padding: '14px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: '50%',
                                    background: '#f1f5f9',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 18,
                                    border: '1.5px solid #e2e8f0',
                                  }}>
                                    {user.avatar || '👤'}
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <strong style={{ fontSize: 13, color: '#1e1b4b' }}>{user.name}</strong>
                                      {user.id === authUser?.id && (
                                        <span style={{ fontSize: 9, background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>حسابك الحالي</span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', display: 'block' }}>{user.email}</span>
                                    <span style={{ fontSize: 9.5, color: '#94a3b8', display: 'block', marginTop: 2 }}>
                                      🕒 آخر دخول: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('ar-KW', { dateStyle: 'short', timeStyle: 'short' }) : 'لم يسجل دخول بعد'}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Role Select / Badge */}
                              <td style={{ padding: '14px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <select
                                    value={user.role}
                                    onChange={(e) => handleChangeRole(user.id, e.target.value as any)}
                                    disabled={user.id === authUser?.id}
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 800,
                                      color: r.color,
                                      background: r.bg,
                                      border: `1px solid ${r.color}33`,
                                      borderRadius: 8,
                                      padding: '3px 8px',
                                      cursor: user.id === authUser?.id ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    <option value="GARAGE_OWNER">👑 مالك الكراج</option>
                                    <option value="BRANCH_MANAGER">💼 مدير الفرع</option>
                                    <option value="ACCOUNTANT">📊 محاسب</option>
                                  </select>
                                </div>
                              </td>

                              {/* Branch */}
                              <td style={{ padding: '14px 20px', fontSize: 12.5, fontWeight: 700, color: '#475569' }}>
                                🏢 {user.branch?.nameAr || user.branch?.name || 'كل الفروع'}
                              </td>

                              {/* Active Status Toggle */}
                              <td style={{ padding: '14px 20px' }}>
                                <button
                                  onClick={() => handleToggleStatus(user.id, user.isActive)}
                                  disabled={user.id === authUser?.id}
                                  style={{
                                    border: 'none',
                                    borderRadius: 20,
                                    padding: '4px 12px',
                                    fontSize: 11,
                                    fontWeight: 800,
                                    cursor: user.id === authUser?.id ? 'not-allowed' : 'pointer',
                                    background: user.isActive ? '#d1fae5' : '#fee2e2',
                                    color: user.isActive ? '#065f46' : '#991b1b',
                                  }}
                                  title={user.isActive ? 'تعطيل الحساب مؤقتاً' : 'تنشيط الحساب'}
                                >
                                  {user.isActive ? '🟢 نشط' : '🔴 معطل'}
                                </button>
                              </td>

                              {/* Actions */}
                              <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={user.id === authUser?.id}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: user.id === authUser?.id ? 'not-allowed' : 'pointer',
                                    opacity: user.id === authUser?.id ? 0.3 : 1,
                                    fontSize: 14,
                                  }}
                                  title="حذف الحساب نهائياً"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Right Column: Roles & Permission Guide (RBAC Guide) & Audit Logs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* ── Role Permissions Guide ── */}
                <div style={{
                  background: '#fff',
                  border: '1px solid #eeeff4',
                  borderRadius: 18,
                  padding: '18px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.01)',
                }}>
                  <h4 style={{ margin: '0 0 14px', fontSize: 13.5, fontWeight: 900, color: '#1e1b4b' }}>
                    🔑 دليل صلاحيات الأدوار (RBAC)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {Object.entries(ROLE_MAP).map(([key, item]) => (
                      <div
                        key={key}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #eeeff4',
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 14 }}>{item.icon}</span>
                          <strong style={{ fontSize: 12, fontWeight: 800, color: item.color }}>{item.label}</strong>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Two-Factor Authentication Disclaimer */}
                  <div style={{
                    marginTop: 14,
                    padding: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    fontSize: 10.5,
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <span>🔒</span>
                    <span><strong>ميزة أمان قادمة (قريباً):</strong> جاري العمل على دعم التحقق بخطوتين (2FA) ومفاتيح المرور (Passkeys) لحماية حساب المالك والمدراء.</span>
                  </div>
                </div>

                {/* ── Security Audit Logs Panel ── */}
                <div style={{
                  background: '#fff',
                  border: '1px solid #eeeff4',
                  borderRadius: 18,
                  padding: '18px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.01)',
                }}>
                  <h4 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 900, color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🛡️ سجل التدقيق والمراقبة الأمنية
                  </h4>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    maxHeight: 330,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}>
                    {auditLogs.length === 0 ? (
                      <span style={{ fontSize: 11.5, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>لا يوجد سجلات تدقيق سابقة</span>
                    ) : (
                      auditLogs.map((log) => {
                        const dateStr = new Date(log.createdAt).toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })
                        return (
                          <div
                            key={log.id}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #eeeff4',
                              borderRadius: 10,
                              padding: '8px 10px',
                              fontSize: 11,
                              lineHeight: 1.4,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                              <span style={{ fontWeight: 800, color: '#03045e' }}>{log.user?.name || 'النظام'}</span>
                              <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>{dateStr}</span>
                            </div>
                            <span style={{ color: '#475569' }}>
                              {log.action === 'CREATE' && '➕ أنشأ حساب موظف جديد'}
                              {log.action === 'DELETE' && '🗑️ حذف حساب موظف'}
                              {log.action === 'UPDATE' && log.resource === 'user_role' && '🔑 عدّل الصلاحيات'}
                              {log.action === 'UPDATE' && log.resource === 'user_status' && '⚙️ عدّل حالة الحساب'}
                            </span>
                            {log.newData?.role && (
                              <span style={{ fontSize: 10, color: '#2563eb', fontWeight: 700, marginRight: 4 }}>
                                ⬅️ {ROLE_MAP[log.newData.role]?.label || log.newData.role}
                              </span>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>
        </main>
      </div>

      {/* Invite Success Dialog Modal */}
      {createdInviteLink && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 24,
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.15)',
              width: '100%',
              maxWidth: 460,
              padding: '28px 32px',
              direction: 'rtl',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 44 }}>🎉</span>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: '#10b981', margin: '12px 0 6px' }}>تم إنشاء حساب الموظف بنجاح!</h3>
            <p style={{ fontSize: 12, color: '#475569', margin: '0 0 16px', lineHeight: 1.5 }}>
              يرجى نسخ رابط الدعوة وإرساله للموظف عبر الواتساب أو البريد الإلكتروني ليتمكن من ضبط كلمة المرور الخاصة به وتفعيل حسابه بشكل آمن.
            </p>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '12px 14px',
              wordBreak: 'break-all',
              fontFamily: 'monospace',
              fontSize: 11.5,
              color: '#0369a1',
              marginBottom: 20,
            }}>
              {createdInviteLink}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdInviteLink)
                  alert('تم نسخ رابط الدعوة بنجاح 📋')
                }}
                style={{
                  background: 'linear-gradient(135deg, #03045e 0%, #0077b6 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '9px 18px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(3, 4, 94, 0.15)',
                }}
              >
                📋 نسخ رابط الدعوة
              </button>
              <button
                onClick={() => setCreatedInviteLink(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#475569',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false) }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 24,
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.15)',
              width: '100%',
              maxWidth: 480,
              maxHeight: '90vh',
              overflowY: 'auto',
              direction: 'rtl',
              padding: '28px 32px',
              boxSizing: 'border-box',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>👤</span>
                <div>
                  <h3 style={{ fontSize: 15.5, fontWeight: 900, color: '#1f2937', margin: 0 }}>إضافة موظف جديد للنظام</h3>
                  <p style={{ fontSize: 11.5, color: '#6b7280', margin: 0 }}>أدخل البيانات لإنشاء حساب وتحديد رتبته وصلاحياته</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6b7280', cursor: 'pointer' }}
              >×</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Emojis selector */}
              <div>
                <label style={labelStyle}>اختر الرمز الشخصي</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {AVATAR_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setForm({ ...form, avatar: emoji })}
                      style={{
                        fontSize: 22,
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        border: form.avatar === emoji ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                        background: form.avatar === emoji ? '#f5f3ff' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>الاسم الثلاثي للموظف *</label>
                <input
                  type="text"
                  placeholder="مثال: أحمد العتيبي..."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>البريد الإلكتروني للوجين *</label>
                  <input
                    type="email"
                    placeholder="name@gmail.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>رقم الهاتف</label>
                  <input
                    type="text"
                    placeholder="+965xxxxxx"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>كلمة المرور المؤقتة *</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>الدور والصلاحية *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    required
                  >
                    <option value="BRANCH_MANAGER">💼 مدير الفرع</option>
                    <option value="ACCOUNTANT">📊 محاسب</option>
                    <option value="GARAGE_OWNER">👑 مالك الكراج</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>الفرع التابع له *</label>
                  <select
                    value={form.branchId}
                    onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nameAr || b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #eeeff4' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '10px 22px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 28px',
                    borderRadius: 12,
                    border: 'none',
                    background: saving ? '#a5b4fc' : 'linear-gradient(135deg, #03045e 0%, #0077b6 100%)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(3,4,94,0.15)',
                  }}
                >
                  {saving ? '⏳ جاري الحفظ...' : '💾 إضافة الحساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
