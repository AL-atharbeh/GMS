'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkOrderItem {
  id: string
  type: 'LABOR' | 'PART'
  description: string
  descriptionAr?: string
  quantity: number
  part?: { id: string; name: string; nameAr?: string; unit?: string; inventory?: { quantity: number }[] }
  laborRate?: { id: string; name: string; nameAr?: string }
}
interface WorkOrderPhoto {
  id: string; url: string; type: string; caption?: string; capturedAt: string
}
interface Task {
  id: string
  workOrderId: string
  specialty: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD'
  estimatedHours?: number
  startedAt?: string
  completedAt?: string
  notes?: string
  workOrder: {
    id: string; orderNumber: string; status: string; priority: string
    customerComplaints?: string; diagnosisDiagram?: any; mileageAtReception?: number
    vehicle: { make: string; model: string; year?: number; plateNumber: string; color?: string }
    customer?: { name: string; phone: string }
    photos: WorkOrderPhoto[]
    workOrderItems: WorkOrderItem[]
    qualityChecks?: any[]
  }
}
interface QualityItem {
  id: string; nameAr: string; category?: string; isRequired: boolean; sortOrder: number
}
type TabType = 'tasks' | 'detail' | 'photos' | 'checklist' | 'profile'

// ─── Design Tokens (matches globals.css GMS Light Mode) ───────────────────────
const C = {
  bgBase: '#f5f6fa',
  bgSurface: '#ffffff',
  bgCard: '#ffffff',
  primary: '#03045E',
  primaryMid: '#0077B6',
  primaryLight: '#00B4D8',
  accent: '#CAF0F8',
  accentDeep: '#90E0EF',
  text: '#03045E',
  textSec: '#0077B6',
  textMuted: '#5a7f96',
  border: '#b8dde8',
  borderLight: '#daeef5',
  danger: '#dc2626',
  warning: '#d97706',
  success: '#0e9f6e',
  gradPrimary: 'linear-gradient(135deg, #03045E 0%, #0077B6 100%)',
  gradLight: 'linear-gradient(135deg, #00B4D8 0%, #90E0EF 100%)',
  shadow: '0 4px 20px rgba(3, 4, 94, 0.06)',
  shadowMd: '0 8px 30px rgba(3, 4, 94, 0.09)',
}

// ─── Priority & Status Config ──────────────────────────────────────────────────
const PRIORITY: Record<string, {label:string; color:string; bg:string; dot:string}> = {
  URGENT: { label: 'عاجل جداً', color: '#dc2626', bg: '#fef2f2', dot: '🔴' },
  HIGH:   { label: 'عالي',      color: '#ea580c', bg: '#fff7ed', dot: '🟠' },
  NORMAL: { label: 'عادي',     color: C.primaryMid, bg: '#eff6ff', dot: '🔵' },
  LOW:    { label: 'منخفض',   color: '#0e9f6e', bg: '#ecfdf5', dot: '🟢' },
}
const STATUS: Record<string, {label:string; color:string; bg:string}> = {
  PENDING:     { label: 'بانتظار البدء', color: '#ea580c', bg: '#fff7ed' },
  IN_PROGRESS: { label: 'قيد التنفيذ',  color: C.primaryMid, bg: '#eff6ff' },
  COMPLETED:   { label: 'مكتمل',         color: '#0e9f6e', bg: '#ecfdf5' },
  ON_HOLD:     { label: 'موقوف',          color: '#64748b', bg: '#f8fafc' },
}
function specialtyLabel(s: string) {
  const m: Record<string,string> = { MECHANICAL: '⚙️ ميكانيكا', ELECTRICAL: '⚡ كهرباء', AC_SYSTEM: '❄️ تكييف', BODY_WORK: '🔨 هيكل', TIRES: '🛞 إطارات' }
  return m[s] || s
}
function photoCategoryLabel(type: string) {
  const m: Record<string,string> = { RECEPTION: '📥 استلام', BEFORE: '🔍 قبل', DIAGNOSIS: '🔎 تشخيص', DEFECT: '⚠️ عطل', COMPLETION: '✅ بعد', DURING: '🔧 أثناء' }
  return m[type] || type
}

// ─── Live Timer ────────────────────────────────────────────────────────────────
function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [startedAt])
  const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: C.primaryMid, fontWeight: 700, background: C.accent, padding: '3px 10px', borderRadius: 8 }}>
      ⏱ {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </span>
  )
}

// ─── Diagnosis Diagram ────────────────────────────────────────────────────────
function DiagramView({ diagram }: { diagram: any }) {
  if (!diagram?.points?.length) return null
  const pts: { x: number; y: number; label: string; severity?: string }[] = diagram.points
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', background: C.accent, border: `1px solid ${C.border}`, marginTop: 10 }}>
      <svg viewBox="0 0 300 140" style={{ width: '100%', display: 'block' }}>
        <rect width="300" height="140" fill={C.bgBase} />
        <path d="M30,90 L30,60 Q50,30 100,25 L200,25 Q250,30 270,60 L270,90 Q270,105 255,105 L45,105 Q30,105 30,90 Z" fill="#daeef5" stroke={C.border} strokeWidth="1.5" />
        <path d="M90,25 Q100,5 130,3 L170,3 Q200,5 210,25" fill="#b8dde8" stroke={C.primaryLight} strokeWidth="1" />
        <circle cx="80"  cy="105" r="18" fill="#94a3b8" stroke={C.border} strokeWidth="2"/>
        <circle cx="80"  cy="105" r="8" fill="#64748b"/>
        <circle cx="220" cy="105" r="18" fill="#94a3b8" stroke={C.border} strokeWidth="2"/>
        <circle cx="220" cy="105" r="8" fill="#64748b"/>
        <rect x="255" y="58" width="12" height="8" rx="2" fill="#fbbf24" opacity="0.9"/>
        <rect x="33"  y="58" width="12" height="8" rx="2" fill="#f97316" opacity="0.7"/>
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x * 3} cy={p.y * 1.4} r="8" fill={p.severity === 'HIGH' ? '#fee2e2' : '#fef9c3'} stroke={p.severity === 'HIGH' ? '#dc2626' : '#d97706'} strokeWidth="1.5"/>
            <text x={p.x * 3} y={p.y * 1.4 + 4} textAnchor="middle" fontSize="7" fill={p.severity === 'HIGH' ? '#dc2626' : '#92400e'} fontWeight="bold">{i+1}</text>
          </g>
        ))}
      </svg>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {pts.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 }}>
            <span style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 4, padding: '1px 7px', color: '#dc2626', fontWeight: 800 }}>{i+1}</span>
            <span style={{ color: C.text, fontWeight: 600 }}>{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Badge Component ──────────────────────────────────────────────────────────
function Badge({ text, color, bg, borderColor }: { text: string; color: string; bg: string; borderColor?: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: bg, color, border: `1px solid ${borderColor || color + '40'}`, whiteSpace: 'nowrap' as const, fontFamily: "'Almarai', system-ui" }}>
      {text}
    </span>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TechnicianDashboardPage() {
  const { isAuthenticated, isHydrated, user, logout } = useAuthStore()
  const router = useRouter()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('tasks')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [photoCategory, setPhotoCategory] = useState<'BEFORE' | 'DURING' | 'COMPLETION'>('BEFORE')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [qualityTemplate, setQualityTemplate] = useState<QualityItem[]>([])
  const [qualityAnswers, setQualityAnswers] = useState<Record<string, boolean | null>>({})
  const [qualityNotes, setQualityNotes] = useState('')
  const [qualitySubmitting, setQualitySubmitting] = useState(false)
  const [qualityDone, setQualityDone] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) { router.push('/login'); return }
    if (user?.role !== 'TECHNICIAN') { router.push('/dashboard'); return }
    fetchTasks()
    setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [isHydrated, isAuthenticated, user])

  const fetchTasks = async () => {
    try { setLoading(true); const r = await api.get('/technicians/my-tasks'); setTasks(r.data.data || []) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  const openTask = (task: Task) => { setSelectedTask(task); setActiveTab('detail'); loadQualityTemplate(task.id) }
  const loadQualityTemplate = async (taskId: string) => {
    try {
      const r = await api.get(`/technicians/tasks/${taskId}/quality-template`)
      const items = r.data.data?.items || []
      setQualityTemplate(items)
      const init: Record<string, boolean | null> = {}
      items.forEach((i: QualityItem) => { init[i.id] = null })
      setQualityAnswers(init)
      setQualityDone(false)
    } catch (e) { console.error(e) }
  }
  const handleUpdateStatus = async (taskId: string, status: 'IN_PROGRESS' | 'COMPLETED') => {
    try {
      setSaving(true)
      await api.patch(`/technicians/tasks/${taskId}/status`, { status })
      await fetchTasks()
    } catch (e: any) { alert(e.response?.data?.message || 'فشل تحديث حالة المهمة') }
    finally { setSaving(false) }
  }
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedTask) return
    setUploadingPhoto(true)
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = async () => {
      try {
        await api.post(`/work-orders/${selectedTask.workOrderId}/photos`, { photoData: reader.result, type: photoCategory, caption: `صورة ${photoCategoryLabel(photoCategory)} — ${user?.name}` })
        alert('✅ تم رفع الصورة بنجاح!')
        fetchTasks()
      } catch { alert('❌ فشل رفع الصورة') }
      finally { setUploadingPhoto(false); if (fileInputRef.current) fileInputRef.current.value = '' }
    }
  }
  const handleQualitySubmit = async () => {
    if (!selectedTask) return
    const required = qualityTemplate.filter(i => i.isRequired)
    const unanswered = required.filter(i => qualityAnswers[i.id] === null)
    if (unanswered.length > 0) { alert(`⚠️ يرجى الإجابة على ${unanswered.length} عنصر إجباري أولاً`); return }
    setQualitySubmitting(true)
    try {
      const items = qualityTemplate.map(item => ({ templateItemId: item.id, isPassed: qualityAnswers[item.id] ?? true }))
      await api.post(`/technicians/tasks/${selectedTask.id}/quality-check`, { items, notes: qualityNotes || null })
      setQualityDone(true)
      alert('✅ تم حفظ قائمة الجودة بنجاح!')
    } catch { alert('❌ فشل حفظ قائمة الجودة') }
    finally { setQualitySubmitting(false) }
  }

  const activeTasks = tasks.filter(t => t.status !== 'COMPLETED')
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED')

  if (!isHydrated || loading) return (
    <div style={{ minHeight: '100vh', background: C.bgBase, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, direction: 'rtl' }}>
      <div style={{ width: 48, height: 48, border: `4px solid ${C.border}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: C.textMuted, fontSize: 14, fontFamily: "'Almarai', system-ui" }}>جاري تحميل مهامك...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // Shared styles
  const S = {
    page: { minHeight: '100vh', background: C.bgBase, paddingBottom: 80, fontFamily: "'Almarai', 'IBM Plex Sans Arabic', system-ui, sans-serif", direction: 'rtl' as const, color: C.text },
    header: { padding: '14px 16px', background: C.bgSurface, borderBottom: `1px solid ${C.borderLight}`, position: 'sticky' as const, top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(3,4,94,0.05)' },
    section: { padding: '14px 14px 8px' },
    card: { background: C.bgCard, border: `1px solid ${C.borderLight}`, borderRadius: 16, padding: '16px', marginBottom: 12, boxShadow: C.shadow },
    label: { fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 5, display: 'block' },
    sectionTitle: { fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '14px 0 8px', display: 'block' },
    btn: (color: string, bg: string, border?: string) => ({
      width: '100%', padding: '13px', borderRadius: 12, border: border || 'none', background: bg,
      color, fontSize: 13, fontWeight: 800, cursor: 'pointer', marginTop: 6, fontFamily: "'Almarai', system-ui",
    }),
  }

  // ─── Tab Bar ──────────────────────────────────────────────────────────────
  const TabBar = () => (
    <nav style={{
      position: 'fixed', bottom: 0, right: 0, left: 0, zIndex: 1000,
      background: C.bgSurface, borderTop: `1px solid ${C.borderLight}`,
      display: 'flex', height: 62, boxShadow: '0 -4px 16px rgba(3,4,94,0.08)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {([
        { id: 'tasks',     icon: '📋', label: 'المهام',   badge: activeTasks.length },
        { id: 'detail',    icon: '🔍', label: 'التفاصيل', badge: 0 },
        { id: 'photos',    icon: '📸', label: 'الصور',    badge: 0 },
        { id: 'checklist', icon: '✅', label: 'الجودة',   badge: 0 },
        { id: 'profile',   icon: '👤', label: 'الحساب',   badge: 0 },
      ] as const).map(tab => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
          color: activeTab === tab.id ? C.primary : C.textMuted,
          borderTop: activeTab === tab.id ? `3px solid ${C.primary}` : '3px solid transparent',
          transition: 'all 0.15s ease',
        }}>
          <span style={{ fontSize: 19 }}>{tab.icon}</span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.03em' }}>{tab.label}</span>
          {tab.badge > 0 && (
            <span style={{
              position: 'absolute', top: 6, right: '50%', marginRight: -17,
              background: C.danger, color: '#fff', fontSize: 9, fontWeight: 800,
              borderRadius: 10, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
            }}>{tab.badge}</span>
          )}
        </button>
      ))}
    </nav>
  )

  // ─── Offline Banner ───────────────────────────────────────────────────────
  const OfflineBanner = () => !isOnline ? (
    <div style={{ background: C.danger, color: '#fff', padding: '7px 16px', fontSize: 12, fontWeight: 700, textAlign: 'center', fontFamily: "'Almarai', system-ui" }}>
      📵 أنت غير متصل بالإنترنت — التغييرات لن تُحفظ
    </div>
  ) : null

  // ─── TAB: Tasks ───────────────────────────────────────────────────────────
  const TasksTab = () => (
    <div>
      <div style={S.header}>
        {/* Top gradient header bar */}
        <div style={{ background: C.gradPrimary, borderRadius: 14, padding: '14px 16px', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#fff' }}>مهامي اليومية</div>
            <div style={{ fontSize: 11, color: C.accentDeep, marginTop: 2 }}>{user?.name} — {activeTasks.length} مهمة نشطة</div>
          </div>
          <button onClick={fetchTasks} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '7px 13px', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Almarai', system-ui" }}>
            🔄 تحديث
          </button>
        </div>
      </div>

      <div style={S.section}>
        {activeTasks.length === 0 && completedTasks.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', padding: '50px 24px' }}>
            <div style={{ width: 70, height: 70, background: C.accent, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 16px' }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.primary }}>لا توجد مهام معلقة</div>
            <p style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>استمتع بوقتك أو راجع المشرف</p>
          </div>
        ) : (
          <>
            {activeTasks.map(task => {
              const priority = PRIORITY[task.workOrder.priority] || PRIORITY.NORMAL
              const status = STATUS[task.status] || STATUS.PENDING
              return (
                <div key={task.id} onClick={() => openTask(task)} style={{ ...S.card, cursor: 'pointer', borderRight: `4px solid ${status.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <span style={{ fontSize: 9.5, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>#{task.workOrder.orderNumber}</span>
                      <div style={{ fontSize: 16, fontWeight: 900, color: C.primary, marginTop: 1, lineHeight: 1.2 }}>
                        {task.workOrder.vehicle.make} {task.workOrder.vehicle.model}
                      </div>
                      <div style={{ fontSize: 12, color: C.primaryLight, fontFamily: "'JetBrains Mono', monospace", marginTop: 3, fontWeight: 700 }}>
                        {task.workOrder.vehicle.plateNumber}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <Badge text={status.label} color={status.color} bg={status.bg} />
                      <span style={{ fontSize: 10, color: priority.color }}>{priority.dot} {priority.label}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, fontSize: 12, marginBottom: 10, color: C.textSec }}>
                    <div><span style={{ color: C.textMuted }}>العميل: </span><strong>{task.workOrder.customer?.name || '—'}</strong></div>
                    <div style={{ color: C.textMuted }}>{specialtyLabel(task.specialty)}</div>
                  </div>

                  {task.status === 'IN_PROGRESS' && task.startedAt && <div style={{ marginBottom: 10 }}><LiveTimer startedAt={task.startedAt} /></div>}

                  <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${C.borderLight}`, paddingTop: 12 }}>
                    {task.status === 'PENDING' && (
                      <button onClick={e => { e.stopPropagation(); handleUpdateStatus(task.id, 'IN_PROGRESS') }} disabled={saving}
                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: C.gradPrimary, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Almarai', system-ui" }}>
                        ⚡ بدء العمل الفعلي
                      </button>
                    )}
                    {task.status === 'IN_PROGRESS' && (
                      <button onClick={e => { e.stopPropagation(); handleUpdateStatus(task.id, 'COMPLETED') }} disabled={saving}
                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#059669,#0e9f6e)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Almarai', system-ui" }}>
                        ✅ إكمال المهمة
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); openTask(task) }}
                      style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.accent, color: C.primary, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: "'Almarai', system-ui" }}>
                      التفاصيل
                    </button>
                  </div>
                </div>
              )
            })}

            {completedTasks.length > 0 && (
              <>
                <span style={S.sectionTitle}>المهام المنجزة اليوم ({completedTasks.length})</span>
                {completedTasks.map(task => (
                  <div key={task.id} style={{ ...S.card, opacity: 0.7, borderRight: `4px solid ${C.success}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{task.workOrder.vehicle.make} {task.workOrder.vehicle.model}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>#{task.workOrder.orderNumber}</div>
                      </div>
                      <Badge text="✅ مكتمل" color={C.success} bg="#ecfdf5" />
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )

  // ─── TAB: Detail ──────────────────────────────────────────────────────────
  const DetailTab = () => {
    if (!selectedTask) return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
        <div style={{ fontSize: 15, color: C.textMuted }}>اختر مهمة لعرض تفاصيلها</div>
        <button onClick={() => setActiveTab('tasks')} style={{ marginTop: 20, padding: '12px 24px', background: C.gradPrimary, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: "'Almarai', system-ui" }}>← الذهاب للمهام</button>
      </div>
    )
    const task = selectedTask
    const status = STATUS[task.status] || STATUS.PENDING
    const parts = task.workOrder.workOrderItems.filter(i => i.type === 'PART')
    const labor = task.workOrder.workOrderItems.filter(i => i.type === 'LABOR')
    return (
      <div>
        <div style={S.header}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => setActiveTab('tasks')} style={{ background: C.accent, border: `1px solid ${C.border}`, borderRadius: 10, padding: '7px 12px', color: C.primary, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: "'Almarai', system-ui" }}>←</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.primary }}>{task.workOrder.vehicle.make} {task.workOrder.vehicle.model} {task.workOrder.vehicle.year}</div>
              <div style={{ fontSize: 10.5, color: C.primaryLight, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                {task.workOrder.vehicle.plateNumber} — #{task.workOrder.orderNumber}
              </div>
            </div>
          </div>
        </div>
        <div style={S.section}>
          {/* Status card */}
          <div style={{ ...S.card, borderRight: `4px solid ${status.color}`, background: status.bg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <Badge text={status.label} color={status.color} bg={status.bg + '80'} />
              {task.estimatedHours && <span style={{ fontSize: 11, color: C.textMuted }}>⏳ {task.estimatedHours} ساعة متوقعة</span>}
            </div>
            {task.status === 'IN_PROGRESS' && task.startedAt && <div style={{ marginBottom: 10 }}><LiveTimer startedAt={task.startedAt} /></div>}
            {task.status === 'PENDING' && (
              <button onClick={() => handleUpdateStatus(task.id, 'IN_PROGRESS')} disabled={saving} style={{ ...S.btn('#fff', C.gradPrimary) }}>
                ⚡ بدء العمل الفعلي
              </button>
            )}
            {task.status === 'IN_PROGRESS' && (
              <button onClick={() => handleUpdateStatus(task.id, 'COMPLETED')} disabled={saving} style={{ ...S.btn('#fff', 'linear-gradient(135deg,#059669,#0e9f6e)') }}>
                ✅ إكمال المهمة وتسليمها
              </button>
            )}
          </div>

          {task.workOrder.customerComplaints && (
            <div style={S.card}>
              <span style={S.label}>🗣️ شكاوى العميل</span>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px', fontSize: 13, color: '#92400e', lineHeight: 1.7, fontWeight: 600 }}>
                {task.workOrder.customerComplaints}
              </div>
            </div>
          )}

          {task.notes && (
            <div style={S.card}>
              <span style={S.label}>📝 ملاحظات المشرف</span>
              <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{task.notes}</p>
            </div>
          )}

          {task.workOrder.diagnosisDiagram?.points?.length > 0 && (
            <div style={S.card}>
              <span style={S.label}>🗺️ مواقع الأعطال</span>
              <DiagramView diagram={task.workOrder.diagnosisDiagram} />
            </div>
          )}

          {parts.length > 0 && (
            <div style={S.card}>
              <span style={S.label}>🔩 القطع المطلوبة</span>
              {parts.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.borderLight}` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>{item.part?.nameAr || item.descriptionAr || item.description}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>الكمية: {Number(item.quantity)}</div>
                  </div>
                  {item.part && (() => {
                    const inStock = (item.part.inventory || []).some(inv => inv.quantity > 0)
                    return (
                      <Badge
                        text={inStock ? '✅ متوفرة' : '❌ غير متوفرة'}
                        color={inStock ? C.success : C.danger}
                        bg={inStock ? '#ecfdf5' : '#fef2f2'}
                      />
                    )
                  })()}
                </div>
              ))}
            </div>
          )}

          {labor.length > 0 && (
            <div style={S.card}>
              <span style={S.label}>🔧 أعمال الصيانة</span>
              {labor.map(item => (
                <div key={item.id} style={{ padding: '9px 0', borderBottom: `1px solid ${C.borderLight}`, fontSize: 13, color: C.textSec, fontWeight: 600 }}>
                  {item.laborRate?.nameAr || item.descriptionAr || item.description}
                </div>
              ))}
            </div>
          )}

          {task.workOrder.customer && (
            <div style={S.card}>
              <span style={S.label}>👤 معلومات العميل</span>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.primary }}>{task.workOrder.customer.name}</div>
              <a href={`tel:${task.workOrder.customer.phone}`} style={{ fontSize: 13, color: C.primaryMid, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontWeight: 700 }}>
                📞 {task.workOrder.customer.phone}
              </a>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── TAB: Photos ──────────────────────────────────────────────────────────
  const PhotosTab = () => {
    const photos = selectedTask?.workOrder.photos || []
    return (
      <div>
        <div style={S.header}>
          <div style={{ background: C.gradPrimary, borderRadius: 12, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>📸 صور الطلب</div>
            {selectedTask && <div style={{ fontSize: 10, color: C.accentDeep }}>#{selectedTask.workOrder.orderNumber}</div>}
          </div>
        </div>
        <div style={S.section}>
          {!selectedTask ? (
            <div style={{ textAlign: 'center', padding: '50px 24px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
              <p style={{ color: C.textMuted }}>اختر مهمة أولاً لرفع صورها</p>
            </div>
          ) : (
            <>
              <div style={S.card}>
                <span style={S.label}>رفع صورة جديدة</span>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {(['BEFORE', 'DURING', 'COMPLETION'] as const).map(cat => (
                    <button key={cat} onClick={() => setPhotoCategory(cat)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                      border: `2px solid ${photoCategory === cat ? C.primary : C.border}`,
                      background: photoCategory === cat ? C.accent : 'transparent',
                      color: photoCategory === cat ? C.primary : C.textMuted,
                      fontSize: 10.5, fontWeight: 800, fontFamily: "'Almarai', system-ui",
                    }}>
                      {photoCategoryLabel(cat)}
                    </button>
                  ))}
                </div>
                <label style={{ display: 'block', width: '100%', padding: '18px', borderRadius: 12, border: `2px dashed ${C.border}`, textAlign: 'center', cursor: 'pointer', color: C.textMuted, fontSize: 13, fontWeight: 700, background: C.bgBase }}>
                  {uploadingPhoto ? '⏳ جاري الرفع...' : '📷 اضغط لفتح الكاميرا'}
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} style={{ display: 'none' }} disabled={uploadingPhoto} />
                </label>
              </div>

              {photos.length > 0 ? (
                <>
                  <span style={S.sectionTitle}>الصور المرفقة ({photos.length})</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {photos.map(photo => (
                      <div key={photo.id} style={{ borderRadius: 14, overflow: 'hidden', background: C.bgCard, border: `1px solid ${C.borderLight}`, boxShadow: C.shadow }}>
                        <img src={photo.url} alt={photo.caption || ''} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                        <div style={{ padding: '7px 10px', fontSize: 10, color: C.textMuted, fontWeight: 700, background: C.accent }}>
                          {photoCategoryLabel(photo.type)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px', color: C.textMuted, fontSize: 13 }}>لا توجد صور مرفقة بعد</div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── TAB: Quality Checklist ───────────────────────────────────────────────
  const ChecklistTab = () => {
    if (!selectedTask) return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <p style={{ color: C.textMuted }}>اختر مهمة أولاً لتعبئة قائمة الجودة</p>
      </div>
    )
    const byCategory = qualityTemplate.reduce((acc, item) => {
      const cat = item.category || 'عام'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc
    }, {} as Record<string, QualityItem[]>)
    const required = qualityTemplate.filter(i => i.isRequired)
    const answeredRequired = required.filter(i => qualityAnswers[i.id] !== null)
    const progress = required.length > 0 ? (answeredRequired.length / required.length) * 100 : 100

    return (
      <div>
        <div style={S.header}>
          <div style={{ background: C.gradPrimary, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>✅ قائمة فحص الجودة</div>
              <div style={{ fontSize: 11, color: C.accentDeep }}>{answeredRequired.length}/{required.length} إجباري</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, height: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: progress === 100 ? '#34d399' : C.accentDeep, width: `${progress}%`, borderRadius: 8, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        </div>
        <div style={S.section}>
          {qualityDone ? (
            <div style={{ ...S.card, textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ width: 80, height: 80, background: '#ecfdf5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 16px' }}>🎉</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: C.success }}>تم حفظ قائمة الجودة بنجاح!</div>
            </div>
          ) : (
            <>
              {Object.entries(byCategory).map(([category, items]) => (
                <div key={category}>
                  <span style={S.sectionTitle}>📂 {category}</span>
                  {items.map(item => (
                    <div key={item.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', marginBottom: 8 }}>
                      <div style={{ flex: 1, paddingLeft: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, lineHeight: 1.4 }}>{item.nameAr}</div>
                        {item.isRequired && <span style={{ fontSize: 9, color: C.danger, fontWeight: 800, marginTop: 2, display: 'inline-block' }}>إجباري *</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[{ val: true, icon: '✓', color: C.success, bg: '#ecfdf5', border: '#6ee7b7' }, { val: false, icon: '✗', color: C.danger, bg: '#fef2f2', border: '#fca5a5' }].map(opt => (
                          <button key={String(opt.val)} onClick={() => setQualityAnswers(prev => ({ ...prev, [item.id]: opt.val }))} style={{
                            width: 38, height: 38, borderRadius: 10, cursor: 'pointer', fontSize: 18, fontWeight: 800,
                            border: `2px solid ${qualityAnswers[item.id] === opt.val ? opt.border : C.border}`,
                            background: qualityAnswers[item.id] === opt.val ? opt.bg : 'transparent',
                            color: qualityAnswers[item.id] === opt.val ? opt.color : C.textMuted,
                          }}>{opt.icon}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              <div style={S.card}>
                <span style={S.label}>ملاحظات إضافية (اختياري)</span>
                <textarea value={qualityNotes} onChange={e => setQualityNotes(e.target.value)} placeholder="أي ملاحظات إضافية..." rows={3}
                  style={{ width: '100%', background: C.bgBase, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: C.text, fontSize: 13, resize: 'none', fontFamily: "'Almarai', system-ui", boxSizing: 'border-box' as const }} />
              </div>

              <button onClick={handleQualitySubmit} disabled={qualitySubmitting || progress < 100}
                style={{ ...S.btn('#fff', progress < 100 ? C.textMuted : 'linear-gradient(135deg,#059669,#0e9f6e)'), opacity: progress < 100 ? 0.6 : 1, cursor: progress < 100 ? 'not-allowed' : 'pointer' }}>
                {qualitySubmitting ? '⏳ جاري الحفظ...' : progress < 100 ? `⚠️ أكمل ${required.length - answeredRequired.length} إجباري أولاً` : '✅ حفظ نتائج الفحص'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── TAB: Profile ─────────────────────────────────────────────────────────
  const ProfileTab = () => {
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length
    const availability = inProgress === 0 ? { label: '🟢 متاح للعمل', color: C.success, bg: '#ecfdf5' } : { label: `🟠 مشغول بـ ${inProgress} مهمة`, color: '#ea580c', bg: '#fff7ed' }
    return (
      <div>
        <div style={S.header}>
          <div style={{ background: C.gradPrimary, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>👤 الحساب الشخصي</div>
          </div>
        </div>
        <div style={S.section}>
          {/* Profile hero */}
          <div style={{ ...S.card, textAlign: 'center', padding: '30px 24px', background: `linear-gradient(135deg, ${C.accent} 0%, ${C.bgCard} 100%)` }}>
            <div style={{ width: 78, height: 78, borderRadius: '50%', background: C.gradPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 14px', boxShadow: C.shadowMd }}>👨‍🔧</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.primary }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{user?.email}</div>
            <div style={{ marginTop: 14, display: 'inline-block', padding: '8px 20px', borderRadius: 20, background: availability.bg, color: availability.color, fontSize: 12, fontWeight: 800, border: `1px solid ${availability.color}40` }}>
              {availability.label}
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'نشطة', value: activeTasks.length, color: C.primary, bg: C.accent },
              { label: 'قيد التنفيذ', value: inProgress, color: '#ea580c', bg: '#fff7ed' },
              { label: 'منجزة', value: completedTasks.length, color: C.success, bg: '#ecfdf5' },
            ].map(stat => (
              <div key={stat.label} style={{ ...S.card, textAlign: 'center', padding: '16px 8px', marginBottom: 0, background: stat.bg, border: `1px solid ${stat.color}20` }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: stat.color, marginTop: 4, fontWeight: 700 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <button onClick={() => { logout(); router.push('/login') }}
            style={{ ...S.btn(C.danger, '#fef2f2', `1px solid ${C.danger}40`), marginTop: 20 }}>
            🚪 تسجيل الخروج
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <OfflineBanner />
      {activeTab === 'tasks'     && <TasksTab />}
      {activeTab === 'detail'    && <DetailTab />}
      {activeTab === 'photos'    && <PhotosTab />}
      {activeTab === 'checklist' && <ChecklistTab />}
      {activeTab === 'profile'   && <ProfileTab />}
      <TabBar />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        button { font-family: 'Almarai', system-ui, sans-serif; }
        textarea, input { font-family: 'Almarai', system-ui, sans-serif; }
      `}</style>
    </div>
  )
}
