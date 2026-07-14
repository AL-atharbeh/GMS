'use client'

import { useEffect, useState, useMemo } from 'react'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

interface Payment {
  id: string
  amount: number
  method: 'CASH' | 'CARD' | 'BANK_TRANSFER'
  reference?: string
  createdAt: string
}

interface WorkOrderItem {
  id: string
  type: 'LABOR' | 'PART'
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  isApproved: boolean
}

interface Invoice {
  id: string
  invoiceNumber: string
  status: 'PENDING' | 'PARTIAL' | 'PAID'
  subtotal: number
  discountAmount: number
  taxableAmount: number
  taxRate: number
  taxAmount: number
  total: number
  paidAmount: number
  remainingAmount: number
  currency: string
  createdAt: string
  workOrderId: string
  notes?: string
  dueAt?: string | null
  paidAt?: string | null
  customer?: { name: string; phone: string; email?: string }
  workOrder?: {
    orderNumber: string
    vehicle?: { make: string; model: string; plateNumber: string; year?: number }
    customer?: { name: string; phone: string; email?: string }
    workOrderItems?: WorkOrderItem[]
  }
  tenant?: {
    name: string
    phone?: string
    address?: string
    vatNumber?: string
  }
  payments?: Payment[]
}

interface Customer {
  id: string
  name: string
  phone: string
}

interface InventoryPart {
  id: string
  partNumber: string
  name: string
  nameAr?: string
  purchasePrice: number
  sellingPrice: number
  inventory: Array<{ quantity: number }>
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  PENDING: { label: 'بانتظار الدفع', color: '#b45309', bg: '#fef3c7', dot: '#f59e0b' },
  PARTIAL: { label: 'مدفوعة جزئياً', color: '#1d4ed8', bg: '#dbeafe', dot: '#3b82f6' },
  PAID: { label: 'مدفوعة بالكامل', color: '#047857', bg: '#d1fae5', dot: '#10b981' },
}

const PAYMENT_METHODS: Record<string, string> = {
  CASH: 'نقدي 💵',
  CARD: 'بطاقة ائتمان 💳',
  KNET: 'كي نت 🛜',
  BANK_TRANSFER: 'تحويل بنكي 🏦',
  LINK: 'رابط دفع 🔗',
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

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [parts, setParts] = useState<InventoryPart[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL') // ALL, PENDING, PARTIAL, PAID, OVERDUE

  // Date range filter
  const [dateRangeType, setDateRangeType] = useState<string>('ALL') // ALL, THIS_MONTH, LAST_MONTH, CUSTOM
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Detailed Modal state
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null)
  const [invoiceDetails, setInvoiceDetails] = useState<Invoice | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  // Payment Modal state
  const [paymentModal, setPaymentModal] = useState<Invoice | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'KNET' | 'BANK_TRANSFER' | 'LINK'>('KNET')
  const [transactionRef, setTransactionRef] = useState('')
  const [recordingPayment, setRecordingPayment] = useState(false)

  // Manual Invoice Modal state
  const [showManualModal, setShowManualModal] = useState(false)
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [manualForm, setManualForm] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    discountAmount: 0,
    notes: '',
    dueAt: '',
    items: [{ type: 'PART' as 'PART' | 'LABOR', partId: '', description: '', quantity: 1, unitPrice: 0 }]
  })
  const [creatingManual, setCreatingManual] = useState(false)

  useEffect(() => {
    fetchInvoices()
    fetchAuxiliaryData()
  }, [])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const res = await api.get('/invoices')
      setInvoices(res.data.data || [])
    } catch (err) {
      console.error('Error fetching invoices', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAuxiliaryData = async () => {
    try {
      const [custRes, partRes] = await Promise.all([
        api.get('/customers'),
        api.get('/inventory'),
      ])
      setCustomers(custRes.data.data || [])
      setParts(partRes.data.data || [])
    } catch (err) {
      console.error('Error fetching auxiliary data', err)
    }
  }

  // Load detailed single invoice
  const openInvoiceDetails = async (invoice: Invoice) => {
    try {
      setActiveInvoice(invoice)
      setDetailsLoading(true)
      const res = await api.get(`/invoices/work-order/${invoice.workOrderId}`)
      setInvoiceDetails(res.data.data)
    } catch (err) {
      console.error('Error fetching invoice details', err)
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentModal) return
    const amount = Number(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('الرجاء إدخال مبلغ صحيح وأكبر من الصفر')
      return
    }
    if (amount > Number(paymentModal.remainingAmount)) {
      alert('مبلغ الدفعة يتجاوز المتبقي من الفاتورة')
      return
    }

    try {
      setRecordingPayment(true)
      await api.post(`/invoices/${paymentModal.id}/payments`, {
        amount,
        paymentMethod,
        transactionReference: transactionRef || undefined,
      })
      setPaymentModal(null)
      setPaymentAmount('')
      setTransactionRef('')
      fetchInvoices()
      if (activeInvoice && activeInvoice.id === paymentModal.id) {
        openInvoiceDetails(activeInvoice)
      }
    } catch (err) {
      console.error('Error recording payment', err)
      alert('فشل تسجيل الدفعة')
    } finally {
      setRecordingPayment(false)
    }
  }

  const handleCreateManualInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    const validItems = manualForm.items.filter(it => it.description.trim() !== '' && it.quantity > 0 && it.unitPrice > 0)
    if (validItems.length === 0) {
      alert('أضف عنصراً واحداً على الأقل للفاتورة')
      return
    }

    try {
      setCreatingManual(true)
      await api.post('/invoices/manual', {
        customerId: isNewCustomer ? undefined : (manualForm.customerId || undefined),
        customerName: isNewCustomer ? manualForm.customerName : undefined,
        customerPhone: isNewCustomer ? manualForm.customerPhone : undefined,
        discountAmount: Number(manualForm.discountAmount) || 0,
        notes: manualForm.notes || undefined,
        dueAt: manualForm.dueAt || undefined,
        items: validItems.map(item => ({
          type: item.type,
          partId: item.type === 'PART' ? (item.partId || undefined) : undefined,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        }))
      })

      setShowManualModal(false)
      setManualForm({
        customerId: '',
        customerName: '',
        customerPhone: '',
        discountAmount: 0,
        notes: '',
        dueAt: '',
        items: [{ type: 'PART', partId: '', description: '', quantity: 1, unitPrice: 0 }]
      })
      fetchInvoices()
    } catch (err) {
      console.error('Error creating manual invoice', err)
      alert('فشل إنشاء الفاتورة اليدوية')
    } finally {
      setCreatingManual(false)
    }
  }

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['رقم الفاتورة', 'العميل', 'رقم الهاتف', 'كرت العمل', 'الإجمالي (د.ك)', 'المدفوع (د.ك)', 'المتبقي (د.ك)', 'الحالة', 'تاريخ الإصدار', 'تاريخ الاستحقاق']
    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber,
      inv.customer?.name || 'عميل عام',
      inv.customer?.phone || '',
      inv.workOrder?.orderNumber || '',
      Number(inv.total).toFixed(3),
      Number(inv.paidAmount).toFixed(3),
      Number(inv.remainingAmount).toFixed(3),
      inv.status === 'PAID' ? 'مدفوعة بالكامل' : inv.status === 'PARTIAL' ? 'مدفوعة جزئياً' : 'بانتظار الدفع',
      new Date(inv.createdAt).toLocaleDateString('ar-KW'),
      inv.dueAt ? new Date(inv.dueAt).toLocaleDateString('ar-KW') : 'غير محدد',
    ])

    const csvContent =
      '\uFEFF' + // UTF-8 BOM for Excel Arabic encoding
      [headers.join(','), ...rows.map((e) => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `fawateer_export_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Calculate statistics (filtered by date)
  const stats = useMemo(() => {
    let totalInvoiced = 0
    let totalPaid = 0
    let totalRemaining = 0
    let paidCount = 0
    let partialCount = 0
    let pendingCount = 0
    let overdueCount = 0

    invoices.forEach((inv) => {
      // Date filter check for stats
      const invDate = new Date(inv.createdAt)
      const now = new Date()
      if (dateRangeType === 'THIS_MONTH') {
        if (invDate.getMonth() !== now.getMonth() || invDate.getFullYear() !== now.getFullYear()) return
      } else if (dateRangeType === 'LAST_MONTH') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
        const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
        if (invDate.getMonth() !== lastMonth || invDate.getFullYear() !== lastYear) return
      } else if (dateRangeType === 'CUSTOM') {
        if (customStartDate && invDate < new Date(customStartDate)) return
        if (customEndDate && invDate > new Date(customEndDate + 'T23:59:59')) return
      }

      totalInvoiced += Number(inv.total)
      totalPaid += Number(inv.paidAmount)
      totalRemaining += Number(inv.remainingAmount)

      if (inv.status === 'PAID') paidCount++
      else if (inv.status === 'PARTIAL') partialCount++
      else pendingCount++

      // Overdue check
      const isOverdue = inv.status !== 'PAID' && inv.dueAt && new Date(inv.dueAt) < now
      if (isOverdue) overdueCount++
    })

    const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0

    return {
      totalInvoiced,
      totalPaid,
      totalRemaining,
      paidCount,
      partialCount,
      pendingCount,
      overdueCount,
      collectionRate,
    }
  }, [invoices, dateRangeType, customStartDate, customEndDate])

  // Filter invoices by search term, status tab, and date range
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Search term check
      const term = searchTerm.toLowerCase()
      const matchSearch =
        !term ||
        inv.invoiceNumber.toLowerCase().includes(term) ||
        inv.customer?.name.toLowerCase().includes(term) ||
        inv.customer?.phone.includes(term) ||
        inv.workOrder?.orderNumber.toLowerCase().includes(term)

      if (!matchSearch) return false

      // 2. Status filter check
      const now = new Date()
      const isOverdue = inv.status !== 'PAID' && inv.dueAt && new Date(inv.dueAt) < now

      if (statusFilter === 'PENDING' && inv.status !== 'PENDING') return false
      if (statusFilter === 'PARTIAL' && inv.status !== 'PARTIAL') return false
      if (statusFilter === 'PAID' && inv.status !== 'PAID') return false
      if (statusFilter === 'OVERDUE' && !isOverdue) return false

      // 3. Date range check
      const invDate = new Date(inv.createdAt)
      if (dateRangeType === 'THIS_MONTH') {
        if (invDate.getMonth() !== now.getMonth() || invDate.getFullYear() !== now.getFullYear()) return false
      } else if (dateRangeType === 'LAST_MONTH') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
        const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
        if (invDate.getMonth() !== lastMonth || invDate.getFullYear() !== lastYear) return false
      } else if (dateRangeType === 'CUSTOM') {
        if (customStartDate && invDate < new Date(customStartDate)) return false
        if (customEndDate && invDate > new Date(customEndDate + 'T23:59:59')) return false
      }

      return true
    })
  }, [invoices, statusFilter, searchTerm, dateRangeType, customStartDate, customEndDate])

  const activeRemaining = paymentModal ? Number(paymentModal.remainingAmount) : 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          title="المستندات المالية"
          subtitle="متابعة وإصدار الفواتير وتحصيل مدفوعات العملاء"
          actions={
            <button
              onClick={() => setShowManualModal(true)}
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ➕ فاتورة يدوية مستقلة
            </button>
          }
        />

        <main style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

            {/* ── KPI Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
              {[
                { icon: '🧾', label: 'إجمالي المفوتر', value: `${stats.totalInvoiced.toFixed(3)} د.ك`, color: '#1e1b4b', bg: '#ede9fe' },
                { icon: '💵', label: 'إجمالي المحصل', value: `${stats.totalPaid.toFixed(3)} د.ك`, color: '#059669', bg: '#d1fae5' },
                { icon: '⏳', label: 'المتبقي المستحق', value: `${stats.totalRemaining.toFixed(3)} د.ك`, color: stats.totalRemaining > 0 ? '#d97706' : '#6b7280', bg: stats.totalRemaining > 0 ? '#fef3c7' : '#f3f4f6' },
                { icon: '⚠️', label: 'فواتير متأخرة الاستحقاق', value: `${stats.overdueCount} فاتورة`, color: stats.overdueCount > 0 ? '#dc2626' : '#6b7280', bg: stats.overdueCount > 0 ? '#fee2e2' : '#f3f4f6' },
                { icon: '📈', label: 'نسبة التحصيل', value: `${stats.collectionRate.toFixed(1)}%`, color: '#0891b2', bg: '#cffafe' },
              ].map((kpi, i) => (
                <div
                  key={i}
                  style={{
                    background: '#fff',
                    border: '1px solid #eeeff4',
                    borderRadius: 14,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {kpi.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: kpi.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {kpi.value}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#6b7280', marginTop: 1 }}>{kpi.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Filter & Search & Export Row ── */}
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
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 420 }}>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8' }}>🔍</span>
                  <input
                    type="text"
                    placeholder="ابحث برقم الفاتورة، اسم العميل أو كرت العمل..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 34 }}
                  />
                </div>

                {/* Date range selection */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>الفترة:</span>
                  <select
                    value={dateRangeType}
                    onChange={(e) => setDateRangeType(e.target.value)}
                    style={{ ...inputStyle, width: 'auto', padding: '6px 12px', height: 'auto', background: '#f1f5f9', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                  >
                    <option value="ALL">كل الأوقات 🌐</option>
                    <option value="THIS_MONTH">هذا الشهر 📅</option>
                    <option value="LAST_MONTH">الشهر الماضي 🗓️</option>
                    <option value="CUSTOM">فترة مخصصة 🛠️</option>
                  </select>

                  {dateRangeType === 'CUSTOM' && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        style={{ ...inputStyle, padding: '4px 8px', fontSize: 11.5, width: 120 }}
                      />
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>إلى</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        style={{ ...inputStyle, padding: '4px 8px', fontSize: 11.5, width: 120 }}
                      />
                    </div>
                  )}
                </div>

                {/* Export Button */}
                <button
                  onClick={handleExportCSV}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#059669',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  📥 تصدير ملف Excel/CSV
                </button>
              </div>

              {/* Status filter tabs */}
              <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10, width: 'fit-content', overflowX: 'auto' }}>
                {[
                  { key: 'ALL', label: `الكل` },
                  { key: 'PENDING', label: `بانتظار الدفع (${stats.pendingCount})` },
                  { key: 'PARTIAL', label: `مدفوعة جزئياً (${stats.partialCount})` },
                  { key: 'PAID', label: `مدفوعة بالكامل (${stats.paidCount})` },
                  { key: 'OVERDUE', label: `🔴 متجاوزة الاستحقاق (${stats.overdueCount})` },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setStatusFilter(item.key)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: statusFilter === item.key ? '#fff' : 'transparent',
                      color: statusFilter === item.key ? (item.key === 'OVERDUE' ? '#dc2626' : '#4f46e5') : '#64748b',
                      fontSize: 12,
                      fontWeight: statusFilter === item.key ? 800 : 600,
                      cursor: 'pointer',
                      boxShadow: statusFilter === item.key ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Invoices Table ── */}
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>جاري تحميل الفواتير...</span>
                </div>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div style={{
                background: '#fff',
                border: '1px dashed #cbd5e1',
                borderRadius: 18,
                padding: '64px 24px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>🧾</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1f2937' }}>لا توجد نتائج مطابقة</div>
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>
                  جرب تغيير خيارات التصفية أو التواريخ
                </p>
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #eeeff4', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #eeeff4' }}>
                        {['رقم الفاتورة', 'العميل', 'كرت العمل', 'قيمة الفاتورة', 'المحصل', 'المستحق', 'تاريخ الإصدار', 'تاريخ الاستحقاق', 'الحالة', 'الخيارات'].map((h, i) => (
                          <th key={i} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#475569' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv) => {
                        const now = new Date()
                        const isOverdue = inv.status !== 'PAID' && inv.dueAt && new Date(inv.dueAt) < now
                        const status = STATUS_MAP[inv.status] || { label: inv.status, color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' }
                        return (
                          <tr
                            key={inv.id}
                            style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#fafbfc' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                          >
                            {/* Invoice number */}
                            <td style={{ padding: '14px 16px', fontWeight: 800, color: '#1e1b4b', fontFamily: 'monospace' }}>
                              {inv.invoiceNumber}
                            </td>

                            {/* Customer */}
                            <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1f2937' }}>
                              {inv.customer?.name || 'عميل عام'}
                              {inv.customer?.phone && (
                                <span style={{ display: 'block', fontSize: 10.5, color: '#64748b', fontWeight: 500, fontFamily: 'monospace', marginTop: 2 }}>
                                  {inv.customer.phone}
                                </span>
                              )}
                            </td>

                            {/* Work order */}
                            <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 600, color: '#4f46e5' }}>
                              {inv.workOrder?.orderNumber ? (
                                inv.workOrder.orderNumber.startsWith('WO-DIRECT-') ? (
                                  <span style={{ color: '#059669', background: '#d1fae5', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>بيع مباشر 🛒</span>
                                ) : (
                                  inv.workOrder.orderNumber
                                )
                              ) : '—'}
                            </td>

                            {/* Total Amount */}
                            <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1e1b4b' }}>
                              {Number(inv.total).toFixed(3)} د.ك
                            </td>

                            {/* Paid Amount */}
                            <td style={{ padding: '14px 16px', fontWeight: 700, color: '#059669' }}>
                              {Number(inv.paidAmount).toFixed(3)} د.ك
                            </td>

                            {/* Remaining Amount */}
                            <td style={{ padding: '14px 16px', fontWeight: 700, color: Number(inv.remainingAmount) > 0 ? '#d97706' : '#94a3b8' }}>
                              {Number(inv.remainingAmount).toFixed(3)} د.ك
                            </td>

                            {/* Created Date */}
                            <td style={{ padding: '14px 16px', color: '#64748b', fontWeight: 500 }}>
                              {new Date(inv.createdAt).toLocaleDateString('ar-KW')}
                            </td>

                            {/* Due Date */}
                            <td style={{ padding: '14px 16px', color: isOverdue ? '#dc2626' : '#64748b', fontWeight: isOverdue ? 700 : 500 }}>
                              {inv.dueAt ? (
                                <>
                                  {new Date(inv.dueAt).toLocaleDateString('ar-KW')}
                                  {isOverdue && <span style={{ display: 'block', fontSize: 10, color: '#dc2626', marginTop: 2 }}>⚠️ متأخرة</span>}
                                </>
                              ) : 'غير محدد'}
                            </td>

                            {/* Status Badge */}
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                color: isOverdue ? '#dc2626' : status.color,
                                background: isOverdue ? '#fee2e2' : status.bg,
                                padding: '3px 10px',
                                borderRadius: 20,
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOverdue ? '#dc2626' : status.dot }} />
                                {isOverdue ? 'متجاوزة الاستحقاق' : status.label}
                              </span>
                            </td>

                            {/* Actions */}
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  onClick={() => openInvoiceDetails(inv)}
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    background: '#fff',
                                    color: '#4f46e5',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                  }}
                                >
                                  👁️ عرض
                                </button>
                                {inv.status !== 'PAID' && (
                                  <button
                                    onClick={() => {
                                      setPaymentModal(inv)
                                      setPaymentAmount(Number(inv.remainingAmount).toFixed(3))
                                    }}
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: 8,
                                      border: 'none',
                                      background: '#d1fae5',
                                      color: '#059669',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      fontSize: 11,
                                    }}
                                  >
                                    💵 دفع
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Invoice Details Preview Modal ── */}
      {activeInvoice && (
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
          onClick={(e) => { if (e.target === e.currentTarget) setActiveInvoice(null) }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 24,
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.12)',
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              overflowY: 'auto',
              direction: 'rtl',
              padding: '30px',
              boxSizing: 'border-box',
              position: 'relative',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1px solid #eeeff4', paddingBottom: 14 }} className="no-print">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>🧾</span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1f2937', margin: 0 }}>عرض مستند الفاتورة</h3>
                  <p style={{ fontSize: 11.5, color: '#6b7280', margin: 0 }}>الفاتورة رقم: {activeInvoice.invoiceNumber}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 9,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#374151',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🖨️ طباعة الفاتورة
                </button>
                <button
                  onClick={() => setActiveInvoice(null)}
                  style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6b7280', cursor: 'pointer' }}
                >×</button>
              </div>
            </div>

            {detailsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>جاري جلب تفاصيل الفاتورة...</span>
                </div>
              </div>
            ) : invoiceDetails ? (
              <div>
                {/* Print layout container */}
                <div id="invoice-print-area">
                  {/* Invoice Header (Logo & Company Details) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1f2937', margin: 0 }}>
                        {invoiceDetails.tenant?.name || 'كراج المحرك المطور'}
                      </h2>
                      <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>
                        📍 {invoiceDetails.tenant?.address || 'الشويخ الصناعية، الكويت'}
                      </p>
                      {invoiceDetails.tenant?.phone && (
                        <p style={{ fontSize: 12, color: '#475569', margin: '2px 0 0', fontFamily: 'monospace' }}>
                          📞 {invoiceDetails.tenant.phone}
                        </p>
                      )}
                      {invoiceDetails.tenant?.vatNumber && (
                        <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
                          الرقم الضريبي: {invoiceDetails.tenant.vatNumber}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <h1 style={{ fontSize: 24, fontWeight: 900, color: '#4f46e5', margin: 0 }}>فاتورة ضريبية</h1>
                      <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
                        <div>رقم الفاتورة: <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{invoiceDetails.invoiceNumber}</span></div>
                        <div>التاريخ: <span style={{ fontWeight: 700 }}>{new Date(invoiceDetails.createdAt).toLocaleDateString('ar-KW')}</span></div>
                        <div>رقم كرت العمل: <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                          {invoiceDetails.workOrder?.orderNumber.startsWith('WO-DIRECT-') ? 'بيع مباشر 🛒' : invoiceDetails.workOrder?.orderNumber}
                        </span></div>
                      </div>
                    </div>
                  </div>

                  {/* Customer & Vehicle Info cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
                    <div style={{ border: '1px solid #eeeff4', borderRadius: 12, padding: 14 }}>
                      <h4 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#64748b' }}>العميل</h4>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>
                        {invoiceDetails.workOrder?.customer?.name || invoiceDetails.customer?.name || 'عميل عام'}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 4, fontFamily: 'monospace' }}>
                        📞 {invoiceDetails.workOrder?.customer?.phone || invoiceDetails.customer?.phone}
                      </div>
                    </div>

                    <div style={{ border: '1px solid #eeeff4', borderRadius: 12, padding: 14 }}>
                      <h4 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#64748b' }}>السيارة المرتبطة</h4>
                      {invoiceDetails.workOrder?.vehicle && invoiceDetails.workOrder.vehicle.plateNumber !== 'DIRECT_SALE' ? (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>
                            {invoiceDetails.workOrder.vehicle.make} {invoiceDetails.workOrder.vehicle.model} {invoiceDetails.workOrder.vehicle.year && `(${invoiceDetails.workOrder.vehicle.year})`}
                          </div>
                          <div style={{ fontSize: 12, color: '#4f46e5', fontWeight: 800, marginTop: 4 }}>
                            رقم اللوحة: {invoiceDetails.workOrder.vehicle.plateNumber}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: '#059669', fontWeight: 700, marginTop: 4 }}>
                          🛒 بيع قطع غيار/خدمات مباشرة (بدون سيارة)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Work Order Items Table */}
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: '#64748b' }}>تفاصيل الخدمات وقطع الغيار</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #eeeff4' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#475569', borderRadius: '6px 0 0 6px' }}>الصنف / الخدمة</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>النوع</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>الكمية</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>سعر الوحدة</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', borderRadius: '0 6px 6px 0' }}>الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceDetails.workOrder?.workOrderItems && invoiceDetails.workOrder.workOrderItems.length > 0 ? (
                          invoiceDetails.workOrder.workOrderItems.map((item) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1f2937' }}>{item.description}</td>
                              <td style={{ padding: '10px 12px', color: '#475569', fontSize: 11 }}>
                                {item.type === 'LABOR' ? '🔧 أجور عمل' : '📦 قطعة غيار'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#1f2937' }}>{item.quantity}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>
                                {Number(item.unitPrice).toFixed(3)} د.ك
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#1e1b4b' }}>
                                {Number(item.totalPrice).toFixed(3)} د.ك
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} style={{ padding: '16px 12px', textAlign: 'center', color: '#9ca3af' }}>
                              لا توجد أصناف معتمدة في كرت العمل هذا
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Totals block */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
                    <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b' }}>المجموع الفرعي:</span>
                        <span style={{ fontWeight: 600, color: '#1f2937' }}>{Number(invoiceDetails.subtotal).toFixed(3)} د.ك</span>
                      </div>
                      {Number(invoiceDetails.discountAmount) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ color: '#dc2626' }}>الخصم الممنوح:</span>
                          <span style={{ fontWeight: 600, color: '#dc2626' }}>- {Number(invoiceDetails.discountAmount).toFixed(3)} د.ك</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b' }}>الضريبة ({invoiceDetails.taxRate}%):</span>
                        <span style={{ fontWeight: 600, color: '#1f2937' }}>{Number(invoiceDetails.taxAmount).toFixed(3)} د.ك</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '2px double #cbd5e1', fontSize: 14 }}>
                        <span style={{ fontWeight: 800, color: '#1f2937' }}>الإجمالي الكلي:</span>
                        <span style={{ fontWeight: 900, color: '#4f46e5' }}>{Number(invoiceDetails.total).toFixed(3)} د.ك</span>
                      </div>

                      {/* Collection status inside the totals block */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11 }}>
                        <span style={{ color: '#059669' }}>المبلغ المحصل:</span>
                        <span style={{ fontWeight: 700, color: '#059669' }}>{Number(invoiceDetails.paidAmount).toFixed(3)} د.ك</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11 }}>
                        <span style={{ color: Number(invoiceDetails.remainingAmount) > 0 ? '#d97706' : '#94a3b8' }}>المبلغ المتبقي:</span>
                        <span style={{ fontWeight: 700, color: Number(invoiceDetails.remainingAmount) > 0 ? '#d97706' : '#94a3b8' }}>
                          {Number(invoiceDetails.remainingAmount).toFixed(3)} د.ك
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment History inside detailed view */}
                  {invoiceDetails.payments && invoiceDetails.payments.length > 0 && (
                    <div style={{ borderTop: '1px solid #eeeff4', paddingTop: 18, marginBottom: 20 }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: '#64748b' }}>سجل عمليات الدفع والتحصيل</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {invoiceDetails.payments.map((pmt) => (
                          <div
                            key={pmt.id}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #eeeff4',
                              borderRadius: 10,
                              padding: '10px 14px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: 12,
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 700, color: '#059669' }}>+ {Number(pmt.amount).toFixed(3)} د.ك</span>
                              <span style={{ margin: '0 10px', color: '#94a3b8' }}>|</span>
                              <span style={{ color: '#475569', fontWeight: 600 }}>{PAYMENT_METHODS[pmt.method] || pmt.method}</span>
                              {pmt.reference && (
                                <span style={{ display: 'block', fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                                  مرجع: {pmt.reference}
                                </span>
                              )}
                            </div>
                            <span style={{ color: '#94a3b8', fontSize: 11 }}>
                              📅 {new Date(pmt.createdAt).toLocaleString('ar-KW')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invoice Notes footer */}
                  {invoiceDetails.notes && (
                    <div style={{ borderRight: '3px solid #cbd5e1', background: '#f8fafc', padding: 10, borderRadius: '0 8px 8px 0', fontSize: 11.5, color: '#475569' }}>
                      💡 <strong>ملاحظات:</strong> {invoiceDetails.notes}
                    </div>
                  )}
                </div>

                {/* Direct payment CTA from details modal if unpaid */}
                {invoiceDetails.status !== 'PAID' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22, borderTop: '1px solid #eeeff4', paddingTop: 16 }} className="no-print">
                    <button
                      onClick={() => {
                        setPaymentModal(invoiceDetails)
                        setPaymentAmount(Number(invoiceDetails.remainingAmount).toFixed(3))
                      }}
                      style={{
                        padding: '10px 24px',
                        borderRadius: 12,
                        border: 'none',
                        background: 'linear-gradient(135deg, #059669, #10b981)',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(5,150,105,0.2)',
                      }}
                    >
                      💵 تسجيل دفعة مالية جديدة
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Record Payment Modal ── */}
      {paymentModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.35)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setPaymentModal(null) }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 24,
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.12)',
              width: '100%',
              maxWidth: 420,
              maxHeight: '90vh',
              overflowY: 'auto',
              direction: 'rtl',
              padding: '26px 30px',
              boxSizing: 'border-box',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>💵</span>
                <div>
                  <h3 style={{ fontSize: 15.5, fontWeight: 900, color: '#1f2937', margin: 0 }}>تسجيل دفعة للفاتورة</h3>
                  <p style={{ fontSize: 11.5, color: '#6b7280', margin: 0 }}>{paymentModal.invoiceNumber} — {paymentModal.customer?.name || 'عميل عام'}</p>
                </div>
              </div>
              <button
                onClick={() => setPaymentModal(null)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6b7280', cursor: 'pointer' }}
              >×</button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Payment Amount */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={labelStyle}>مبلغ الدفعة المستلمة *</label>
                  <span style={{ fontSize: 11, color: '#64748b' }}>المتبقي: {activeRemaining.toFixed(3)} د.ك</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    step={0.001}
                    min={0.001}
                    max={activeRemaining}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    style={{ ...inputStyle, fontWeight: 700, fontSize: 15, color: '#111827', textAlign: 'center' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(activeRemaining.toFixed(3))}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#ede9fe',
                      color: '#4f46e5',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    دفع كامل المتبقي
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label style={labelStyle}>طريقة الدفع *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  style={{ ...inputStyle, cursor: 'pointer', fontWeight: 600 }}
                  required
                >
                  <option value="KNET">KNET (كي نت 🛜)</option>
                  <option value="CARD">CREDIT CARD (فيزا / ماستر 💳)</option>
                  <option value="CASH">CASH (نقدي 💵)</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER (تحويل بنكي 🏦)</option>
                  <option value="LINK">PAYMENT LINK (رابط دفع 🔗)</option>
                </select>
              </div>

              {/* Transaction Reference */}
              <div>
                <label style={labelStyle}>رقم المعاملة / المرجع (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: REF-92837192"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Info summary */}
              <div style={{ background: '#f8fafc', border: '1px solid #eeeff4', borderRadius: 12, padding: '10px 12px', fontSize: 11.5, color: '#475569' }}>
                💡 تسجيل هذه الدفعة سيقوم بتحديث حالة الفاتورة فوراً. وفي حال سداد كامل المبلغ المتبقي، سيتحول كرت العمل تلقائياً إلى <strong>مكتمل ومستلم</strong>.
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #eeeff4' }}>
                <button
                  type="button"
                  onClick={() => setPaymentModal(null)}
                  style={{ padding: '10px 22px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  style={{
                    padding: '10px 26px',
                    borderRadius: 12,
                    border: 'none',
                    background: recordingPayment ? '#a7f3d0' : 'linear-gradient(135deg, #059669, #10b981)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: recordingPayment ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(5,150,105,0.2)',
                  }}
                >
                  {recordingPayment ? '⏳ جاري التسجيل...' : '✓ تأكيد تسجيل الدفعة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── New Manual Invoice Modal ── */}
      {showManualModal && (
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
          onClick={(e) => { if (e.target === e.currentTarget) setShowManualModal(false) }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 24,
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.15)',
              width: '100%',
              maxWidth: 640,
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
                <span style={{ fontSize: 20 }}>🛒</span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1f2937', margin: 0 }}>إصدار فاتورة يدوية مباشرة</h3>
                  <p style={{ fontSize: 11.5, color: '#6b7280', margin: 0 }}>لبيع قطع غيار أو خدمات مباشرة بدون فتح كرت عمل</p>
                </div>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6b7280', cursor: 'pointer' }}
              >×</button>
            </div>

            <form onSubmit={handleCreateManualInvoice} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Customer Selector / Toggle */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>العميل *</label>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomer(!isNewCustomer)}
                    style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {isNewCustomer ? '🔍 اختيار عميل مسجل' : '➕ إضافة عميل جديد للفاتورة'}
                  </button>
                </div>

                {isNewCustomer ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <input
                      type="text"
                      placeholder="اسم العميل الجديد..."
                      value={manualForm.customerName}
                      onChange={(e) => setManualForm({ ...manualForm, customerName: e.target.value })}
                      style={inputStyle}
                      required
                    />
                    <input
                      type="text"
                      placeholder="رقم الهاتف..."
                      value={manualForm.customerPhone}
                      onChange={(e) => setManualForm({ ...manualForm, customerPhone: e.target.value })}
                      style={inputStyle}
                      required
                    />
                  </div>
                ) : (
                  <select
                    value={manualForm.customerId}
                    onChange={(e) => setManualForm({ ...manualForm, customerId: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">عميل عام (غير محدد)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Due Date & Discount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>تاريخ الاستحقاق (اختياري)</label>
                  <input
                    type="date"
                    value={manualForm.dueAt}
                    onChange={(e) => setManualForm({ ...manualForm, dueAt: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>الخصم (د.ك)</label>
                  <input
                    type="number"
                    step={0.001}
                    min={0}
                    value={manualForm.discountAmount}
                    onChange={(e) => setManualForm({ ...manualForm, discountAmount: Number(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>عناصر الفاتورة *</label>
                  <button
                    type="button"
                    onClick={() => setManualForm({
                      ...manualForm,
                      items: [...manualForm.items, { type: 'PART', partId: '', description: '', quantity: 1, unitPrice: 0 }]
                    })}
                    style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: '#ede9fe', color: '#4f46e5', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    + إضافة صنف/خدمة
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', padding: 2 }}>
                  {manualForm.items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '90px 1.5fr 70px 90px 30px',
                        gap: 6,
                        background: '#f8fafc',
                        border: '1px solid #eeeff4',
                        borderRadius: 10,
                        padding: 8,
                        alignItems: 'center',
                      }}
                    >
                      {/* Type Select */}
                      <select
                        value={item.type}
                        onChange={(e) => {
                          const newItems = [...manualForm.items]
                          newItems[idx] = { ...newItems[idx], type: e.target.value as any, partId: '', description: '' }
                          setManualForm({ ...manualForm, items: newItems })
                        }}
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: 11.5 }}
                      >
                        <option value="PART">📦 قطعة</option>
                        <option value="LABOR">🔧 خدمة</option>
                      </select>

                      {/* Description / Part Select */}
                      {item.type === 'PART' ? (
                        <select
                          value={item.partId}
                          onChange={(e) => {
                            const p = parts.find((pt) => pt.id === e.target.value)
                            const newItems = [...manualForm.items]
                            newItems[idx] = {
                              ...newItems[idx],
                              partId: e.target.value,
                              description: p ? (p.nameAr || p.name) : '',
                              unitPrice: p ? Number(p.sellingPrice) : 0,
                            }
                            setManualForm({ ...manualForm, items: newItems })
                          }}
                          style={{ ...inputStyle, padding: '6px 8px', fontSize: 11.5 }}
                        >
                          <option value="">— اختر قطعة الغيار —</option>
                          {parts.map((p) => (
                            <option key={p.id} value={p.id}>{p.nameAr || p.name} ({p.partNumber})</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="وصف الخدمة المقدمة..."
                          value={item.description}
                          onChange={(e) => {
                            const newItems = [...manualForm.items]
                            newItems[idx].description = e.target.value
                            setManualForm({ ...manualForm, items: newItems })
                          }}
                          style={{ ...inputStyle, padding: '6px 8px', fontSize: 11.5 }}
                          required
                        />
                      )}

                      {/* Qty */}
                      <input
                        type="number"
                        placeholder="الكمية"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...manualForm.items]
                          newItems[idx].quantity = Number(e.target.value)
                          setManualForm({ ...manualForm, items: newItems })
                        }}
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: 11.5, textAlign: 'center' }}
                        required
                      />

                      {/* Price */}
                      <input
                        type="number"
                        placeholder="السعر"
                        step={0.001}
                        min={0}
                        value={item.unitPrice}
                        onChange={(e) => {
                          const newItems = [...manualForm.items]
                          newItems[idx].unitPrice = Number(e.target.value)
                          setManualForm({ ...manualForm, items: newItems })
                        }}
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: 11.5, textAlign: 'center' }}
                        required
                      />

                      {/* Delete item */}
                      <button
                        type="button"
                        onClick={() => setManualForm({
                          ...manualForm,
                          items: manualForm.items.filter((_, i) => i !== idx)
                        })}
                        disabled={manualForm.items.length === 1}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          border: 'none',
                          background: manualForm.items.length === 1 ? '#f3f4f6' : '#fee2e2',
                          color: manualForm.items.length === 1 ? '#9ca3af' : '#dc2626',
                          cursor: manualForm.items.length === 1 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total preview */}
              <div style={{
                background: '#ede9fe',
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#5b21b6' }}>إجمالي الفاتورة التقريبي (قبل الضريبة):</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: '#4f46e5' }}>
                  {Math.max(0, manualForm.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) - Number(manualForm.discountAmount)).toFixed(3)} د.ك
                </span>
              </div>

              {/* Invoice notes */}
              <div>
                <label style={labelStyle}>ملاحظات الفاتورة</label>
                <textarea
                  placeholder="ملاحظات تظهر بالفاتورة للعميل..."
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  style={{ ...inputStyle, height: 50, resize: 'none' }}
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #eeeff4' }}>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  style={{ padding: '10px 22px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creatingManual}
                  style={{
                    padding: '10px 28px',
                    borderRadius: 12,
                    border: 'none',
                    background: creatingManual ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: creatingManual ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                  }}
                >
                  {creatingManual ? '⏳ جاري الحفظ...' : '💾 إصدار الفاتورة اليدوية'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global CSS style block to hide UI elements during printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-print-area, #invoice-print-area * {
            visibility: visible;
          }
          #invoice-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            direction: rtl !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
