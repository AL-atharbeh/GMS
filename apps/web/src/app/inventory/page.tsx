'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

interface Transaction {
  id: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RESERVED' | 'UNRESERVED'
  quantity: number
  referenceType?: string
  notes?: string
  createdAt: string
}

interface Part {
  id: string
  partNumber: string
  barcode?: string
  name: string
  nameAr?: string
  category?: string
  brand?: string
  vehicleCompatibility: string[]
  unit: string
  purchasePrice: number
  sellingPrice: number
  createdAt: string
  inventory: Array<{
    id: string
    quantity: number
    availableQty: number
    minStockLevel: number
    location?: string
    transactions: Transaction[]
    branch: { name: string }
  }>
  suppliers?: Array<{
    id: string
    isPreferred: boolean
    supplier: {
      id: string
      name: string
      nameAr?: string
      phone?: string
      whatsapp?: string
    }
  }>
}

interface Supplier {
  id: string
  name: string
  nameAr?: string
  phone?: string
  whatsapp?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  MECHANICAL: 'ميكانيك ⚙️',
  ELECTRICAL: 'كهرباء ⚡',
  BODY: 'هيكل / سمكرة 🚗',
  TIRES: 'إطارات / عجلات 🛞',
  ACCESSORIES: 'إكسسوارات / كماليات ✨',
  OILS: 'زيوت وسوائل 🛢️',
}

const UNIT_LABELS: Record<string, string> = {
  PCS: 'حبة (PCS)',
  LITER: 'لتر (L)',
  METER: 'متر (M)',
  KG: 'كيلوغرام (KG)',
  BOX: 'علبة (BOX)',
}

const DEAD_STOCK_DAYS_THRESHOLD = 90;

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
  transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: '#475569',
  marginBottom: 5,
  display: 'block',
}

export default function InventoryPage() {
  const [parts, setParts] = useState<Part[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const [filterStock, setFilterStock] = useState<string>('ALL') // ALL, LOW, IN_STOCK, DEAD_STOCK
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showLogsPart, setShowLogsPart] = useState<Part | null>(null) // part ID for which logs are shown
  const [selectedPart, setSelectedPart] = useState<Part | null>(null)
  const [adjustQty, setAdjustQty] = useState(0)
  const [adjustNotes, setAdjustNotes] = useState('')

  const [form, setForm] = useState({
    partNumber: '',
    name: '',
    nameAr: '',
    category: 'MECHANICAL',
    brand: '',
    purchasePrice: 0,
    sellingPrice: 0,
    initialQty: 10,
    minStockLevel: 2,
    unit: 'PCS',
    location: '',
    barcode: '',
    vehicleCompatibility: '',
    supplierId: '',
  })

  useEffect(() => {
    fetchParts()
    fetchSuppliers()
  }, [])

  const fetchParts = async () => {
    try {
      setLoading(true)
      const res = await api.get('/inventory')
      setParts(res.data.data || [])
    } catch (err) {
      console.error('Error fetching inventory parts', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers')
      setSuppliers(res.data.data || [])
    } catch (err) {
      console.error('Error fetching suppliers list', err)
    }
  }

  const handleCreatePart = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const compatibilityArray = form.vehicleCompatibility
        ? form.vehicleCompatibility.split(',').map((x) => x.trim()).filter(Boolean)
        : []

      await api.post('/inventory', {
        ...form,
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: Number(form.sellingPrice),
        initialQty: Number(form.initialQty),
        minStockLevel: Number(form.minStockLevel),
        vehicleCompatibility: compatibilityArray,
        supplierId: form.supplierId || undefined,
      })
      setShowAddModal(false)
      setForm({
        partNumber: '',
        name: '',
        nameAr: '',
        category: 'MECHANICAL',
        brand: '',
        purchasePrice: 0,
        sellingPrice: 0,
        initialQty: 10,
        minStockLevel: 2,
        unit: 'PCS',
        location: '',
        barcode: '',
        vehicleCompatibility: '',
        supplierId: '',
      })
      fetchParts()
    } catch (err) {
      alert('فشل إضافة قطعة الغيار. يرجى التحقق من فرادانية رقم القطعة.')
    }
  }

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPart) return
    try {
      await api.patch(`/inventory/${selectedPart.id}/stock`, {
        quantity: Number(adjustQty),
        notes: adjustNotes || undefined,
      })
      setShowAdjustModal(false)
      setAdjustQty(0)
      setAdjustNotes('')
      setSelectedPart(null)
      fetchParts()
    } catch (err) {
      alert('فشل تعديل المخزون')
    }
  }

  const isDeadStock = (part: Part) => {
    const stock = part.inventory[0]?.quantity || 0
    if (Number(stock) <= 0) return false

    const transactions = part.inventory[0]?.transactions || []
    const outTransactions = transactions.filter((t) => t.type === 'OUT')

    if (outTransactions.length > 0) {
      // Find the most recent OUT transaction
      const mostRecentOut = outTransactions.reduce((latest, current) => {
        return new Date(current.createdAt).getTime() > new Date(latest.createdAt).getTime() ? current : latest
      })
      const daysSinceLastOut = (new Date().getTime() - new Date(mostRecentOut.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      return daysSinceLastOut >= DEAD_STOCK_DAYS_THRESHOLD
    } else {
      // No OUT transactions at all. Check if the part has been created for more than 90 days.
      const daysSinceCreated = (new Date().getTime() - new Date(part.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      return daysSinceCreated >= DEAD_STOCK_DAYS_THRESHOLD
    }
  }

  const filteredParts = parts.filter((p) => {
    const stock = p.inventory[0]?.quantity || 0
    const minStock = p.inventory[0]?.minStockLevel || 0
    const isLow = Number(stock) <= Number(minStock)
    const isDead = isDeadStock(p)

    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.nameAr && p.nameAr.includes(searchTerm)) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.vehicleCompatibility && p.vehicleCompatibility.some((x) => x.toLowerCase().includes(searchTerm.toLowerCase())))

    const matchCategory = filterCategory === 'ALL' || p.category === filterCategory

    const matchStock =
      filterStock === 'ALL' ||
      (filterStock === 'LOW' && isLow) ||
      (filterStock === 'IN_STOCK' && !isLow && !isDead) ||
      (filterStock === 'DEAD_STOCK' && isDead)

    return matchSearch && matchCategory && matchStock
  })

  // Calculate statistics
  const totalItems = parts.length
  const lowStockItems = parts.filter((p) => {
    const stock = p.inventory[0]?.quantity || 0
    const minStock = p.inventory[0]?.minStockLevel || 0
    return Number(stock) <= Number(minStock)
  }).length
  const deadStockItems = parts.filter((p) => isDeadStock(p)).length
  const totalValue = parts.reduce((acc, p) => {
    const stock = p.inventory[0]?.quantity || 0
    return acc + Number(p.purchasePrice) * Number(stock)
  }, 0)

  const handleWhatsAppOrder = (part: Part) => {
    // Find preferred or first supplier linked
    const prefSupplier = part.suppliers?.find((s) => s.isPreferred) || part.suppliers?.[0]
    if (!prefSupplier?.supplier) {
      alert('لا يوجد مورد أساسي مربوط بهذه القطعة. يرجى تعديل القطعة لربطها بمورد.')
      return
    }

    const s = prefSupplier.supplier
    const phone = s.whatsapp || s.phone
    if (!phone) {
      alert(`المورد المربوط (${s.nameAr || s.name}) لا يحتوي على رقم هاتف مسجل للتواصل عبر واتساب.`)
      return
    }

    // Prefill template message
    const msg = `السلام عليكم ورحمة الله،\n\nنود طلب قطعة الغيار التالية من مستودعنا:\n- الصنف: ${part.nameAr || part.name}\n- رقم القطعة: ${part.partNumber}\n- الكمية المطلوبة: 10 ${UNIT_LABELS[part.unit] || part.unit}\n\nيرجى تأكيد توفرها وتزويدنا بسعر التوريد. شكراً لكم.`
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <TopBar
          title="مستودع قطع الغيار والمخزون"
          subtitle="إدارة وتتبع كميات قطع الغيار، أسعار البيع والشراء ومستويات التنبيه"
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
                outline: 'none',
              }}
            >
              ➕ إضافة صنف جديد
            </button>
          }
        />

        <main style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Quick KPI stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
              <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📦</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>إجمالي الأصناف مسجلة</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1f2937', marginTop: 2 }}>{totalItems} أصناف</div>
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⚠️</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>أصناف منخفضة المخزون</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', marginTop: 2 }}>{lowStockItems} أصناف</div>
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🐌</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>أصناف راكدة (Dead Stock)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706', marginTop: 2 }}>{deadStockItems} أصناف</div>
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💰</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>القيمة الإجمالية للمخزون</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', marginTop: 2 }}>{totalValue.toFixed(3)} د.ك</div>
                </div>
              </div>
            </div>

            {/* Actions & Filters Panel */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #eeeff4',
                borderRadius: 16,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ position: 'relative', width: '100%', maxWidth: 300, flex: 1 }}>
                <input
                  type="text"
                  placeholder="ابحث بالاسم، رقم القطعة، التوافق، الباركود..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={{ ...inputStyle, maxWidth: 160, cursor: 'pointer' }}
              >
                <option value="ALL">كل الفئات</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              <select
                value={filterStock}
                onChange={(e) => setFilterStock(e.target.value)}
                style={{ ...inputStyle, maxWidth: 160, cursor: 'pointer' }}
              >
                <option value="ALL">كل حالات الكمية</option>
                <option value="IN_STOCK">✅ متوفر</option>
                <option value="LOW">⚠️ مخزون منخفض</option>
                <option value="DEAD_STOCK">🐌 قطع راكدة</option>
              </select>

              <div style={{ marginRight: 'auto', fontSize: 12.5, fontWeight: 700, color: '#6b7280' }}>
                المطابق: <span style={{ color: '#4f46e5', fontWeight: 800 }}>{filteredParts.length}</span>
              </div>
            </div>

            {/* Inventory List */}
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>جاري تحميل المخزون...</span>
                </div>
              </div>
            ) : filteredParts.length === 0 ? (
              <div
                style={{
                  background: '#ffffff',
                  border: '1px dashed #cbd5e1',
                  borderRadius: 16,
                  padding: '64px 24px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>لا توجد قطع غيار مطابقة للبحث</div>
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>قم بإضافة أصناف جديدة لمستودع الكراج وتعديل كمياتها</p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: 20,
                }}
              >
                {filteredParts.map((part) => {
                  const stock = part.inventory[0]?.quantity || 0
                  const minStock = part.inventory[0]?.minStockLevel || 0
                  const isLow = Number(stock) <= Number(minStock)
                  const isDead = isDeadStock(part)
                  const location = part.inventory[0]?.location
                  const categoryLabel = part.category ? CATEGORY_LABELS[part.category] || part.category : 'غير مصنف'
                  const preferredSupplier = part.suppliers?.find((s) => s.isPreferred) || part.suppliers?.[0]

                  return (
                    <div
                      key={part.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #eeeff4',
                        borderRadius: 16,
                        padding: 20,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 14,
                        transition: 'transform 0.15s, box-shadow 0.15s',
                      }}
                    >
                      <div>
                        {/* Header Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: isLow ? '#dc2626' : '#16a34a',
                                background: isLow ? '#fef2f2' : '#f0fdf4',
                                border: isLow ? '1px solid #fca5a5' : '1px solid #bbf7d0',
                                borderRadius: 6,
                                padding: '2px 8px',
                              }}
                            >
                              {isLow ? '⚠️ مخزون منخفض' : '✅ متوفر'}
                            </span>
                            {isDead && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: '#b45309',
                                  background: '#fffbeb',
                                  border: '1px solid #fde68a',
                                  borderRadius: 6,
                                  padding: '2px 8px',
                                }}
                              >
                                🐌 راكد (90يوم+)
                              </span>
                            )}
                          </div>

                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: 6, fontFamily: 'monospace' }}>
                            {part.partNumber}
                          </span>
                        </div>

                        {/* Title and Brand */}
                        <h3 style={{ fontSize: 14.5, fontWeight: 800, color: '#1f2937', marginTop: 12, marginBottom: 0 }}>
                          {part.nameAr || part.name}
                        </h3>
                        {part.nameAr && part.name && (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{part.name}</div>
                        )}

                        {/* Additional Metadata row */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: '#4f46e5', background: '#f5f3ff', border: '1px solid #e0e7ff', padding: '1px 6px', borderRadius: 4 }}>
                            {categoryLabel}
                          </span>
                          {part.brand && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#0ea5e9', background: '#f0f9ff', border: '1px solid #e0f2fe', padding: '1px 6px', borderRadius: 4 }}>
                              🏷️ {part.brand}
                            </span>
                          )}
                          {location && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#0f766e', background: '#f0fdfa', border: '1px solid #ccfbf1', padding: '1px 6px', borderRadius: 4 }}>
                              📍 {location}
                            </span>
                          )}
                          {part.barcode && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                              [|||] {part.barcode}
                            </span>
                          )}
                        </div>

                        {/* Compatibility row */}
                        {part.vehicleCompatibility && part.vehicleCompatibility.length > 0 && (
                          <div style={{ marginTop: 10, background: '#f8fafc', border: '1px solid #eeeff4', borderRadius: 10, padding: '6px 10px', fontSize: 10.5 }}>
                            <span style={{ color: '#94a3b8', fontWeight: 700 }}>🚗 متوافق مع:</span>{' '}
                            <span style={{ color: '#475569', fontWeight: 600 }}>{part.vehicleCompatibility.join('، ')}</span>
                          </div>
                        )}

                        {/* Preferred Supplier row */}
                        {preferredSupplier?.supplier && (
                          <div style={{ marginTop: 8, background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 10, padding: '6px 10px', fontSize: 10.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ color: '#16a34a', fontWeight: 700 }}>🏭 المورد:</span>{' '}
                              <span style={{ color: '#14532d', fontWeight: 700 }}>{preferredSupplier.supplier.nameAr || preferredSupplier.supplier.name}</span>
                            </div>
                            {(preferredSupplier.supplier.whatsapp || preferredSupplier.supplier.phone) && (
                              <button
                                onClick={() => handleWhatsAppOrder(part)}
                                style={{
                                  background: '#10b981',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '2px 8px',
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                💬 طلب شراء
                              </button>
                            )}
                          </div>
                        )}

                        {/* Inventory info grid */}
                        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: '1px solid #f1f5f9', paddingTop: 10, fontSize: 11.5 }}>
                          <div>
                            <span style={{ color: '#94a3b8', fontSize: 10, display: 'block' }}>سعر البيع:</span>
                            <span style={{ fontWeight: 700, color: '#1f2937' }}>{Number(part.sellingPrice).toFixed(3)} د.ك</span>
                          </div>

                          <div>
                            <span style={{ color: '#94a3b8', fontSize: 10, display: 'block' }}>الكمية الحالية:</span>
                            <span style={{ fontWeight: 800, color: isLow ? '#dc2626' : '#1e293b' }}>
                              {stock} {UNIT_LABELS[part.unit] || part.unit}
                            </span>
                          </div>

                          <div>
                            <span style={{ color: '#94a3b8', fontSize: 10, display: 'block' }}>سعر الشراء:</span>
                            <span style={{ fontWeight: 600, color: '#64748b' }}>{Number(part.purchasePrice).toFixed(3)} د.ك</span>
                          </div>

                          <div>
                            <span style={{ color: '#94a3b8', fontSize: 10, display: 'block' }}>الحد الأدنى:</span>
                            <span style={{ fontWeight: 600, color: '#64748b' }}>{minStock} {UNIT_LABELS[part.unit] || part.unit}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 'auto' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => {
                              setSelectedPart(part)
                              setAdjustQty(0)
                              setAdjustNotes('')
                              setShowAdjustModal(true)
                            }}
                            style={{
                              flex: 1,
                              background: '#f5f3ff',
                              border: '1px solid #e0e7ff',
                              color: '#4f46e5',
                              borderRadius: 10,
                              padding: '8px 12px',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ⚙️ ضبط الكمية
                          </button>

                          <button
                            onClick={() => setShowLogsPart(showLogsPart?.id === part.id ? null : part)}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              color: '#475569',
                              borderRadius: 10,
                              padding: '8px 12px',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            📜 السجل ({part.inventory[0]?.transactions?.length || 0})
                          </button>
                        </div>

                        {/* Collapsible Stock Movement Logs */}
                        {showLogsPart?.id === part.id && (
                          <div style={{ marginTop: 8, background: '#f8fafc', borderRadius: 10, padding: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>📜 سجل حركة المخزون (Audit Log)</div>
                            {part.inventory[0]?.transactions && part.inventory[0].transactions.length > 0 ? (
                              part.inventory[0].transactions.map((t) => (
                                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '2px 0' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 700, color: t.type === 'IN' ? '#16a34a' : '#dc2626' }}>
                                      {t.type === 'IN' ? '➕ توريد / إضافة' : '➖ سحب / بيع'} ({t.quantity})
                                    </span>
                                    {t.notes && <span style={{ color: '#64748b', fontSize: 9.5 }}>{t.notes}</span>}
                                  </div>
                                  <span style={{ color: '#94a3b8', fontSize: 9.5 }}>{new Date(t.createdAt).toLocaleDateString('ar-KW')}</span>
                                </div>
                              ))
                            ) : (
                              <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', paddingTop: 8, paddingBottom: 8 }}>لا توجد حركات مسجلة</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Part Modal */}
      {showAddModal && (
        <div
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
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false) }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #eeeff4',
              borderRadius: 24,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)',
              width: '100%',
              maxWidth: 460,
              maxHeight: '92vh',
              overflowY: 'auto',
              direction: 'rtl',
              padding: '24px 30px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  📦
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', margin: 0 }}>إضافة صنف جديد</h3>
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

            <form onSubmit={handleCreatePart} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>رقم الصنف (Part Number)</label>
                  <input
                    type="text"
                    placeholder="مثال: FILTER-1234"
                    value={form.partNumber}
                    onChange={(e) => setForm({ ...form, partNumber: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>رمز الباركود (Barcode)</label>
                  <input
                    type="text"
                    placeholder="امسح أو اكتب الباركود..."
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>الاسم بالعربية</label>
                  <input
                    type="text"
                    placeholder="فلتر زيت"
                    value={form.nameAr}
                    onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>الاسم بالإنجليزية</label>
                  <input
                    type="text"
                    placeholder="Oil Filter"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>الفئة</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer', background: '#fff' }}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>وحدة القياس</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer', background: '#fff' }}
                  >
                    {Object.entries(UNIT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>المورد الأساسي</label>
                  <select
                    value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer', background: '#fff' }}
                  >
                    <option value="">— اختر موردًا (اختياري) —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.nameAr || s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>موقع التخزين (رف / Bin)</label>
                  <input
                    type="text"
                    placeholder="مثال: A3، رف 5"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>السيارات/الماركات المتوافقة</label>
                <input
                  type="text"
                  placeholder="فصل الفئات بفاصلة (مثال: Toyota Land Cruiser 2018-2022, Lexus LX)"
                  value={form.vehicleCompatibility}
                  onChange={(e) => setForm({ ...form, vehicleCompatibility: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>سعر الشراء</label>
                  <input
                    type="number"
                    step="0.001"
                    value={form.purchasePrice}
                    onChange={(e) => setForm({ ...form, purchasePrice: parseFloat(e.target.value) || 0 })}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>سعر البيع</label>
                  <input
                    type="number"
                    step="0.001"
                    value={form.sellingPrice}
                    onChange={(e) => setForm({ ...form, sellingPrice: parseFloat(e.target.value) || 0 })}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>الكمية الافتتاحية</label>
                  <input
                    type="number"
                    value={form.initialQty}
                    onChange={(e) => setForm({ ...form, initialQty: parseInt(e.target.value) || 0 })}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>الحد الأدنى للتنبيه</label>
                  <input
                    type="number"
                    value={form.minStockLevel}
                    onChange={(e) => setForm({ ...form, minStockLevel: parseInt(e.target.value) || 2 })}
                    style={inputStyle}
                  />
                </div>
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
                    background: 'linear-gradient(135deg, #4f46e5, #6366f1 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                  }}
                >
                  حفظ في المخزن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedPart && (
        <div
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
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAdjustModal(false); setSelectedPart(null) } }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #eeeff4',
              borderRadius: 24,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)',
              width: '100%',
              maxWidth: 380,
              direction: 'rtl',
              padding: '24px 30px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ⚙️
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', margin: 0 }}>تعديل كمية المخزون</h3>
              </div>
              <button
                onClick={() => { setShowAdjustModal(false); setSelectedPart(null) }}
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

            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
              أنت تقوم بتعديل مخزون الصنف: <br />
              <span style={{ color: '#1f2937', fontWeight: 800 }}>{selectedPart.nameAr || selectedPart.name}</span>
            </p>

            <form onSubmit={handleAdjustStock} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>موجب للزيادة / سالب للسحب</label>
                <input
                  type="number"
                  placeholder="مثال: 5 لإضافة 5 حبات، -3 لسحب 3..."
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>سبب التعديل / ملاحظات (Audit Log)</label>
                <input
                  type="text"
                  placeholder="مثال: سحب لكرت عمل 12، بضاعة تالفة، إلخ..."
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #eeeff4', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => { setShowAdjustModal(false); setSelectedPart(null) }}
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
                    background: 'linear-gradient(135deg, #4f46e5, #6366f1 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                  }}
                >
                  تحديث المخزون
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
