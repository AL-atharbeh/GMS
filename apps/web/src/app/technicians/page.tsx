'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

interface TaskAssignment {
  id: string
  workOrderId: string
  status: string // PENDING, IN_PROGRESS, COMPLETED, CANCELLED
  reworkCount: number
  reworkStatus?: string
  reworkReason?: string
  createdAt: string
  workOrder: {
    orderNumber: string
    vehicle: { make: string; model: string; plateNumber: string }
    customer?: { name: string }
  }
}

interface Technician {
  id: string
  specialties: string[]
  skillLevel: 'JUNIOR' | 'MID_LEVEL' | 'SENIOR' | 'MASTER'
  isAvailable: boolean
  commissionPercent: number
  hourlyRate: number
  employeeId?: string
  certifications: string[] // We store hireDate as certifications[0]
  user: {
    id: string
    name: string
    email: string
    phone?: string
    avatar?: string
    isActive: boolean
  }
  branch: {
    id: string
    name: string
    nameAr?: string
  }
  taskAssignments?: TaskAssignment[]
  performance?: Array<{
    avgCompletionHours?: number
    reworkRate?: number
    customerRating?: number
  }>
}

interface Branch {
  id: string
  name: string
  nameAr?: string
}

const SKILL_MAP: Record<string, { label: string; color: string; bg: string }> = {
  JUNIOR: { label: 'مبتدئ (Junior)', color: '#4b5563', bg: '#f3f4f6' },
  MID_LEVEL: { label: 'متوسط الخبرة (Mid)', color: '#0891b2', bg: '#cffafe' },
  SENIOR: { label: 'خبير (Senior)', color: '#2563eb', bg: '#dbeafe' },
  MASTER: { label: 'كبير الفنيين (Master)', color: '#7c3aed', bg: '#f3e8ff' },
}

const SPECIALTY_MAP: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  MECHANICAL: { label: 'ميكانيكا', icon: '🔧', color: '#b45309', bg: '#fef3c7' },
  ELECTRICAL: { label: 'كهرباء سيارات', icon: '⚡', color: '#097969', bg: '#e8f8f5' },
  BODYWORK: { label: 'حدادة وسمكرة', icon: '🔨', color: '#475569', bg: '#f1f5f9' },
  PAINTING: { label: 'صبغ ودوكو', icon: '🎨', color: '#be185d', bg: '#fce7f3' },
  AC_SYSTEM: { label: 'تكييف وتبريد', icon: '❄️', color: '#0284c7', bg: '#e0f2fe' },
  TIRES: { label: 'إطارات وميزان', icon: '🛞', color: '#4f46e5', bg: '#ede9fe' },
  GENERAL: { label: 'صيانة عامة سريعة', icon: '🏎️', color: '#059669', bg: '#d1fae5' },
}

const AVATAR_PRESETS = [
  '👨‍🔧', '👩‍🔧', '🧑‍🔧', '👷‍♂️', '👷‍♀️', '⚙️', '🛠️', '🏎️'
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

export default function TechniciansPage() {
  const { user: authUser } = useAuthStore()
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  // Detailed tasks viewer (Technician Command Center)
  const [selectedTechForTasks, setSelectedTechForTasks] = useState<Technician | null>(null)

  // Create form states
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    branchId: '',
    skillLevel: 'MID_LEVEL',
    specialties: [] as string[],
    commissionPercent: '',
    hourlyRate: '',
    employeeId: '',
    hireDate: new Date().toISOString().split('T')[0],
    avatar: '👨‍🔧',
  })

  useEffect(() => {
    fetchTechnicians()
    fetchBranches()
  }, [])

  const fetchTechnicians = async () => {
    try {
      setLoading(true)
      const res = await api.get('/technicians')
      setTechnicians(res.data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmRework = async (taskId: string) => {
    const reason = prompt('أدخل تفاصيل وملاحظات الخطأ الفني لتأكيد الـ Rework:')
    if (reason === null) return // cancel
    try {
      await api.post(`/technicians/tasks/${taskId}/rework/confirm`, { reason })
      alert('تم تأكيد الـ Rework واحتسابه في مؤشرات أداء الفني.')
      fetchTechnicians()
      setSelectedTechForTasks(null)
    } catch (err) {
      console.error(err)
      alert('فشل تأكيد الـ Rework')
    }
  }

  const handleDismissRework = async (taskId: string) => {
    const reason = prompt('أدخل سبب استثناء هذا الطلب (مثال: عطل منفصل، سوء استخدام العميل):')
    if (reason === null) return // cancel
    try {
      await api.post(`/technicians/tasks/${taskId}/rework/dismiss`, { reason })
      alert('تم قبول الاستثناء وإلغاء تنبيه الـ Rework.')
      fetchTechnicians()
      setSelectedTechForTasks(null)
    } catch (err) {
      console.error(err)
      alert('فشل استثناء الـ Rework')
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

  const handleOpenCreateModal = () => {
    setShowCreateModal(true)
  }

  const handleCheckboxChange = (specKey: string) => {
    if (form.specialties.includes(specKey)) {
      setForm({ ...form, specialties: form.specialties.filter((s) => s !== specKey) })
    } else {
      setForm({ ...form, specialties: [...form.specialties, specKey] })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.branchId) {
      alert('الرجاء اختيار الفرع')
      return
    }
    try {
      setSaving(true)
      await api.post('/technicians', {
        ...form,
        commissionPercent: Number(form.commissionPercent) || 0,
        hourlyRate: Number(form.hourlyRate) || 0,
        certifications: [form.hireDate], // store hire date
      })
      setShowCreateModal(false)
      setForm({
        name: '',
        email: '',
        password: '',
        phone: '',
        branchId: branches[0]?.id || '',
        skillLevel: 'MID_LEVEL',
        specialties: [],
        commissionPercent: '',
        hourlyRate: '',
        employeeId: '',
        hireDate: new Date().toISOString().split('T')[0],
        avatar: '👨‍🔧',
      })
      fetchTechnicians()
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل إضافة الفني')
    } finally {
      setSaving(false)
    }
  }

  // Calculate active tasks count for a technician
  const getActiveTasksCount = (tech: Technician) => {
    if (!tech.taskAssignments) return 0
    return tech.taskAssignments.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length
  }

  // Calculate completed tasks count
  const getCompletedTasksCount = (tech: Technician) => {
    if (!tech.taskAssignments) return 0
    return tech.taskAssignments.filter(t => t.status === 'COMPLETED').length
  }

  // Calculate rework count
  const getReworkCount = (tech: Technician) => {
    if (!tech.taskAssignments) return 0
    return tech.taskAssignments.reduce((sum, t) => sum + (t.reworkCount || 0), 0)
  }

  // Leaderboard ranking: sort technicians by completed tasks count descending
  const leaderboard = useMemo(() => {
    return [...technicians]
      .map(t => ({
        id: t.id,
        name: t.user.name,
        avatar: t.user.avatar || '👨‍🔧',
        completed: getCompletedTasksCount(t),
        active: getActiveTasksCount(t),
      }))
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5)
  }, [technicians])

  // Filtered list
  const filteredTechnicians = useMemo(() => {
    return technicians.filter(tech => {
      const term = searchTerm.toLowerCase()
      const matchSearch = !term ||
        tech.user.name.toLowerCase().includes(term) ||
        tech.user.email.toLowerCase().includes(term) ||
        (tech.user.phone && tech.user.phone.includes(term)) ||
        (tech.employeeId && tech.employeeId.toLowerCase().includes(term))

      if (!matchSearch) return false

      if (selectedBranch && tech.branch.id !== selectedBranch) return false

      if (selectedSpecialty !== 'ALL' && !tech.specialties.includes(selectedSpecialty)) return false

      return true
    })
  }, [technicians, searchTerm, selectedBranch, selectedSpecialty])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          title="الفنيون والمهندسون"
          subtitle="إدارة طاقم صيانة الورشة وتوزيع المهام والتحكم بالحالة النشطة ومتابعة الأداء"
          actions={
            <button
              onClick={handleOpenCreateModal}
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
              ➕ إضافة فني جديد
            </button>
          }
        />

        <main style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Main Layout: Technicians Grid vs Leaderboard ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 20, alignItems: 'flex-start' }}>
              
              {/* Left Column: Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                
                {/* ── Filters Control Bar ── */}
                <div style={{
                  background: '#fff',
                  border: '1px solid #eeeff4',
                  borderRadius: 16,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                    
                    {/* Search Input */}
                    <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 380 }}>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8' }}>🔍</span>
                      <input
                        type="text"
                        placeholder="ابحث بالفني، رقم الموظف، الهاتف..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ ...inputStyle, paddingRight: 34 }}
                      />
                    </div>

                    {/* Branch selector */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>تصفية الفرع:</span>
                      <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        style={selectStyle}
                      >
                        <option value="">كل الفروع 🏢</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.nameAr || b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Specialties Filter tabs */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid #eeeff4', paddingTop: 12 }}>
                    <button
                      onClick={() => setSelectedSpecialty('ALL')}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: selectedSpecialty === 'ALL' ? '#03045e' : '#f1f5f9',
                        color: selectedSpecialty === 'ALL' ? '#fff' : '#475569',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      🌐 كل التخصصات
                    </button>
                    {Object.entries(SPECIALTY_MAP).map(([key, item]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedSpecialty(key)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 8,
                          border: 'none',
                          background: selectedSpecialty === key ? item.bg : '#f1f5f9',
                          color: selectedSpecialty === key ? item.color : '#475569',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          borderWidth: 1,
                          borderColor: selectedSpecialty === key ? item.color : 'transparent',
                          borderStyle: 'solid',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Technicians Cards Grid ── */}
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', flexDirection: 'column', gap: 10 }}>
                    <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#0077b6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>جاري تحميل قائمة المهندسين...</span>
                  </div>
                ) : filteredTechnicians.length === 0 ? (
                  <div style={{
                    background: '#fff',
                    border: '1px dashed #cbd5e1',
                    borderRadius: 18,
                    padding: '64px 24px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 44, marginBottom: 14 }}>👨‍🔧</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1f2937' }}>لا يوجد فنيون مطابوقون للمواصفات</div>
                    <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>أضف فنياً جديداً أو قم بتغيير خيارات التصفية والبحث</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 18 }}>
                    {filteredTechnicians.map((tech) => {
                      const skill = SKILL_MAP[tech.skillLevel] || { label: tech.skillLevel, color: '#475569', bg: '#f1f5f9' }
                      const activeTasks = getActiveTasksCount(tech)
                      const completedTasks = getCompletedTasksCount(tech)
                      const totalRework = getReworkCount(tech)
                      const hireDateStr = tech.certifications[0] || '2026/01/01'

                      return (
                        <div
                          key={tech.id}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #eeeff4',
                            borderRadius: 18,
                            padding: '20px',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.01)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: 330,
                            transition: 'transform 0.15s, box-shadow 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.03)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none'
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.01)'
                          }}
                        >
                          <div>
                            {/* Card Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                {/* Avatar (Preset Emoji or Image) */}
                                <div style={{
                                  width: 46,
                                  height: 46,
                                  borderRadius: 12,
                                  background: 'linear-gradient(135deg, #03045e 0%, #0077b6 100%)',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 900,
                                  fontSize: 22,
                                }}>
                                  {tech.user.avatar || '👨‍🔧'}
                                </div>
                                
                                {/* Name & Branch */}
                                <div>
                                  <h4 style={{ fontSize: 14.5, fontWeight: 900, color: '#1e1b4b', margin: 0 }}>{tech.user.name}</h4>
                                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
                                    <span style={{ fontSize: 11, color: '#0077b6', fontWeight: 700 }}>
                                      🏢 {tech.branch.nameAr || tech.branch.name}
                                    </span>
                                    <span style={{ fontSize: 10, color: '#94a3b8' }}>•</span>
                                    <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>
                                      ID: {tech.employeeId || 'فني'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Availability Switch (Linked to active task count) */}
                              <div style={{
                                borderRadius: 20,
                                padding: '4px 12px',
                                fontSize: 10.5,
                                fontWeight: 800,
                                color: activeTasks > 0 ? '#b45309' : '#059669',
                                background: activeTasks > 0 ? '#fef3c7' : '#d1fae5',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeTasks > 0 ? '#d97706' : '#10b981', display: 'inline-block' }} />
                                {activeTasks > 0 ? `مشغول بـ (${activeTasks}) مهام` : 'متاح للعمل'}
                              </div>
                            </div>

                            {/* Job info section */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12, background: '#f8fafc', padding: 10, borderRadius: 12, border: '1px solid #eeeff4' }}>
                              <div>
                                <span style={{ fontSize: 10.5, color: '#64748b', display: 'block' }}>مستوى المهارة</span>
                                <span style={{ fontSize: 11, fontWeight: 800, color: skill.color }}>{skill.label}</span>
                              </div>
                              <div>
                                <span style={{ fontSize: 10.5, color: '#64748b', display: 'block' }}>تاريخ التوظيف</span>
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1f2937', fontFamily: 'monospace' }}>{hireDateStr}</span>
                              </div>
                              <div>
                                <span style={{ fontSize: 10.5, color: '#64748b', display: 'block' }}>الراتب الأساسي</span>
                                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a' }}>{Number(tech.hourlyRate || 0).toFixed(0)} د.ك / شهر</span>
                              </div>
                              <div>
                                <span style={{ fontSize: 10.5, color: '#64748b', display: 'block' }}>نسبة العمولات</span>
                                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#059669' }}>{Number(tech.commissionPercent).toFixed(0)}% من العمل</span>
                              </div>
                            </div>

                            {/* Performance metrics section */}
                            <div style={{ marginBottom: 12 }}>
                              <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>📈 مؤشرات الأداء الحالية:</span>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                                <div style={{ background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: 8, padding: 6 }}>
                                  <div style={{ fontSize: 15, fontWeight: 900, color: '#166534', fontFamily: 'monospace' }}>{completedTasks}</div>
                                  <div style={{ fontSize: 9, color: '#059669', fontWeight: 700 }}>سيارات منجزة</div>
                                </div>
                                <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: 8, padding: 6 }}>
                                  <div style={{ fontSize: 15, fontWeight: 900, color: '#0f766e', fontFamily: 'monospace' }}>{tech.performance?.[0]?.avgCompletionHours || '0'} س</div>
                                  <div style={{ fontSize: 9, color: '#0d9488', fontWeight: 700 }}>وقت الإنجاز</div>
                                </div>
                                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, padding: 6 }}>
                                  <div style={{ fontSize: 15, fontWeight: 900, color: '#991b1b', fontFamily: 'monospace' }}>{totalRework}</div>
                                  <div style={{ fontSize: 9, color: '#dc2626', fontWeight: 700 }}>إعادات صيانة</div>
                                </div>
                              </div>
                            </div>

                            {/* Specialties badges */}
                            <div style={{ marginBottom: 16 }}>
                              <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>التخصصات المعتمدة:</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {tech.specialties.length === 0 ? (
                                  <span style={{ fontSize: 11, color: '#94a3b8' }}>بدون تخصصات مسجلة</span>
                                ) : (
                                  tech.specialties.map((spec) => {
                                    const info = SPECIALTY_MAP[spec] || { label: spec, icon: '🔧', color: '#475569', bg: '#f1f5f9' }
                                    return (
                                      <span
                                        key={spec}
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 700,
                                          color: info.color,
                                          background: info.bg,
                                          padding: '2px 6px',
                                          borderRadius: 5,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 3,
                                        }}
                                      >
                                        <span>{info.icon}</span>
                                        <span>{info.label}</span>
                                      </span>
                                    )
                                  })
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Footer Contact Details & Direct Command button */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #eeeff4', paddingTop: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: '#64748b' }}>
                              <a href={`mailto:${tech.user.email}`} style={{ textDecoration: 'none', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                📧 {tech.user.email}
                              </a>
                              {tech.user.phone && (
                                <a href={`tel:${tech.user.phone}`} style={{ textDecoration: 'none', color: '#0077b6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  📞 {tech.user.phone}
                                </a>
                              )}
                            </div>
                            
                            <button
                              onClick={() => setSelectedTechForTasks(tech)}
                              style={{
                                background: '#f1f5f9',
                                color: '#4f46e5',
                                border: 'none',
                                borderRadius: 10,
                                padding: '8px 12px',
                                fontSize: 12,
                                fontWeight: 800,
                                cursor: 'pointer',
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                              }}
                            >
                              ⚙️ لوحة تحكم المهام لهذا الفني ({tech.taskAssignments?.length || 0})
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Leaderboard ranking */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #eeeff4',
                borderRadius: 18,
                padding: '18px',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.01)',
              }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 900, color: '#1e1b4b' }}>🏆 لوحة شرف الفنيين (الأكثر إنتاجية)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {leaderboard.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        background: idx === 0 ? '#fffbeb' : '#f8fafc',
                        border: idx === 0 ? '1px solid #fde68a' : '1px solid #eeeff4',
                        borderRadius: 12,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 900, color: idx === 0 ? '#d97706' : '#64748b', width: 20 }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                        </span>
                        <span style={{ fontSize: 18 }}>{item.avatar}</span>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1f2937' }}>{item.name}</div>
                          <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>{item.active} مهام نشطة حالياً</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#059669', fontFamily: 'monospace' }}>{item.completed}</div>
                        <div style={{ fontSize: 9, color: '#64748b' }}>سيارة منجزة</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </main>
      </div>

      {/* Technician Command Center Modal (Direct link to tasks) */}
      {selectedTechForTasks && (
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
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedTechForTasks(null) }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 24,
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.15)',
              width: '100%',
              maxWidth: 580,
              maxHeight: '90vh',
              overflowY: 'auto',
              direction: 'rtl',
              padding: '28px 32px',
              boxSizing: 'border-box',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>⚙️</span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1f2937', margin: 0 }}>لوحة مهام الفني: {selectedTechForTasks.user.name}</h3>
                  <p style={{ fontSize: 11.5, color: '#6b7280', margin: 0 }}>عرض كافة المهام الحالية والمنجزة لهذا الفني بالورشة</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTechForTasks(null)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6b7280', cursor: 'pointer' }}
              >×</button>
            </div>

            {/* Tasks list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!selectedTechForTasks.taskAssignments || selectedTechForTasks.taskAssignments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94a3b8', fontSize: 13 }}>
                  📭 لا توجد مهام مسندة لهذا الفني حالياً.
                </div>
              ) : (
                selectedTechForTasks.taskAssignments.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #eeeff4',
                      borderRadius: 14,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#4f46e5', fontFamily: 'monospace' }}>
                            {task.workOrder.orderNumber}
                          </span>
                          <span style={{ fontSize: 10.5, color: '#94a3b8' }}>•</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#1f2937' }}>
                            {task.workOrder.customer?.name || 'عميل عام'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: '#475569', marginTop: 4 }}>
                          🚗 السيارة: {task.workOrder.vehicle.make} {task.workOrder.vehicle.model}
                          <span style={{ fontSize: 10.5, color: '#64748b', fontFamily: 'monospace', marginRight: 6 }}>
                            ({task.workOrder.vehicle.plateNumber})
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6, fontFamily: 'monospace' }}>
                          تاريخ الإسناد: {new Date(task.createdAt).toLocaleDateString('ar-KW')} - {new Date(task.createdAt).toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div>
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: 6,
                          color: task.status === 'COMPLETED' ? '#059669' : task.status === 'IN_PROGRESS' ? '#0284c7' : '#4b5563',
                          background: task.status === 'COMPLETED' ? '#d1fae5' : task.status === 'IN_PROGRESS' ? '#e0f2fe' : '#f3f4f6',
                        }}>
                          {task.status === 'COMPLETED' ? 'مكتمل ✓' : task.status === 'IN_PROGRESS' ? 'قيد التنفيذ ⚙️' : 'بانتظار البدء ⏱️'}
                        </span>
                      </div>
                    </div>

                    {/* Potential Rework manager actions banner */}
                    {task.reworkStatus === 'PENDING' && (
                      <div style={{
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: 12,
                        padding: '10px 12px',
                        fontSize: 12,
                        color: '#7f1d1d',
                      }}>
                        <strong>⚠️ نظام كشف إعادات العمل التلقائي:</strong>
                        <p style={{ margin: '4px 0 10px', fontSize: 11.5, color: '#92400e', lineHeight: 1.4 }}>
                          {task.reworkReason}
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleConfirmRework(task.id)}
                            style={{
                              background: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            ⚠️ تأكيد كخطأ فني (Rework)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDismissRework(task.id)}
                            style={{
                              background: '#10b981',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            ✅ استثناء - سبب خارجي
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22, borderTop: '1px solid #eeeff4', paddingTop: 14 }}>
              <button
                onClick={() => setSelectedTechForTasks(null)}
                style={{ padding: '8px 22px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
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
              maxWidth: 500,
              maxHeight: '90vh',
              overflowY: 'auto',
              direction: 'rtl',
              padding: '28px 32px',
              boxSizing: 'border-box',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>👨‍🔧</span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1f2937', margin: 0 }}>إضافة فني جديد لطاقم العمل</h3>
                  <p style={{ fontSize: 11.5, color: '#6b7280', margin: 0 }}>أدخل البيانات لإنشاء ملف فني وحساب مستخدم للنظام</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6b7280', cursor: 'pointer' }}
              >×</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Profile avatar presets */}
              <div>
                <label style={labelStyle}>اختر الصورة الشخصية (أيقونة الفني)</label>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>اسم الفني *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="الاسم الثلاثي للفني..."
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>رقم الهاتف *</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="مثال: +9651234567"
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>البريد الإلكتروني للوجين *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="tech@example.com"
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>كلمة المرور المؤقتة *</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                <div>
                  <label style={labelStyle}>مستوى الخبرة والمهارة *</label>
                  <select
                    value={form.skillLevel}
                    onChange={(e) => setForm({ ...form, skillLevel: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    required
                  >
                    <option value="JUNIOR">مبتدئ (Junior)</option>
                    <option value="MID_LEVEL">متوسط الخبرة (Mid-Level)</option>
                    <option value="SENIOR">خبير (Senior)</option>
                    <option value="MASTER">كبير الفنيين (Master)</option>
                  </select>
                </div>
              </div>

              {/* Advanced job and finance info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>الراتب الشهري الأساسي (د.ك) *</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="مثال: 450"
                    value={form.hourlyRate}
                    onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>نسبة عمولة الفني (%) *</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="مثال: 5"
                    value={form.commissionPercent}
                    onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>الرقم التعريفي للموظف (اختياري)</label>
                  <input
                    type="text"
                    placeholder="مثال: EMP-9021"
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>تاريخ التوظيف / المباشرة *</label>
                  <input
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              {/* Specialties checklist */}
              <div>
                <label style={labelStyle}>تخصصات الصيانة *</label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  background: '#f8fafc',
                  padding: '14px',
                  borderRadius: 14,
                  border: '1px solid #cbd5e1',
                }}>
                  {Object.entries(SPECIALTY_MAP).map(([key, item]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#1e1b4b', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.specialties.includes(key)}
                        onChange={() => handleCheckboxChange(key)}
                        style={{ width: 15, height: 15, cursor: 'pointer' }}
                      />
                      <span>{item.icon} {item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Actions */}
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
                  {saving ? '⏳ جاري الحفظ...' : '💾 إضافة الفني'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
