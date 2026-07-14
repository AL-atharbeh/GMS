'use client'

import { useEffect, useState, use } from 'react'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Vehicle {
  id: string
  make: string
  model: string
  year?: number
  plateNumber: string
  vin?: string
  color?: string | null
  fuelType?: string | null
  transmissionType?: string | null
  photoUrl?: string | null
}

interface CustomerVehicleRelation {
  id: string
  vehicle: Vehicle
}

interface WorkOrder {
  id: string
  status: string
  receivedAt: string
  totalAmount: number
  vehicle?: Vehicle
}

interface Invoice {
  id: string
  total: number
  paidAmount: number
  remainingAmount: number
  status: string
}

interface CustomerDetails {
  id: string
  name: string
  phone: string
  email?: string
  type: 'INDIVIDUAL' | 'FLEET'
  companyName?: string
  address?: string
  notes?: string
  preferredContactMethod?: 'WHATSAPP' | 'SMS' | 'CALL'
  optInMarketing?: boolean
  createdAt: string
  vehicles: CustomerVehicleRelation[]
  workOrders: WorkOrder[]
  invoices: Invoice[]
  financials: {
    totalInvoiced: number
    totalPaid: number
    totalRemaining: number
    avgInvoiceValue: number
  }
  // ── No-Show tracking (live from appointments COUNT) ──
  noShowCount?: number
  noShowLevel?: 'OK' | 'WARN' | 'CRITICAL'
  noShowWarnThreshold?: number
  noShowCriticalThreshold?: number
}

interface NoteEntry {
  text: string
  createdAt: string
  author: string
}

export default function CustomerCommandCenter({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter()
  const customerId = resolvedParams.id

  const [customer, setCustomer] = useState<CustomerDetails | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Quick Add Vehicle Modal state
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [vehicleForm, setVehicleForm] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    plateNumber: '',
    chassisNumber: '',
    color: '',
    fuelType: 'PETROL' as 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID',
    transmissionType: 'AUTO' as 'AUTO' | 'MANUAL',
    photoData: '',
  })

  // Edit Preferences state
  const [prefForm, setPrefForm] = useState({
    preferredContactMethod: 'WHATSAPP' as 'WHATSAPP' | 'SMS' | 'CALL',
    optInMarketing: true,
    type: 'INDIVIDUAL' as 'INDIVIDUAL' | 'FLEET',
  })

  // Note text state
  const [newNoteText, setNewNoteText] = useState('')

  // Customer Statement states
  const [showStatementModal, setShowStatementModal] = useState(false)
  const [stmtStartDate, setStmtStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  )
  const [stmtEndDate, setStmtEndDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchCustomerDetails()
  }, [customerId])

  const fetchCustomerDetails = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/customers/${customerId}`)
      const data = res.data.data
      setCustomer(data)
      
      // Seed preferences form
      setPrefForm({
        preferredContactMethod: data.preferredContactMethod || 'WHATSAPP',
        optInMarketing: data.optInMarketing !== false,
        type: data.type || 'INDIVIDUAL',
      })
    } catch (err) {
      console.error('Error fetching customer details', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePrintStatement = async () => {
    try {
      const res = await api.get(`/customers/${customerId}/statement`, {
        params: {
          startDate: stmtStartDate,
          endDate: stmtEndDate,
        },
      })
      const {
        customer: cust,
        tenant,
        startDate: sDate,
        endDate: eDate,
        beginningBalance,
        endingBalance,
        totalInvoicedDuring,
        totalPaidDuring,
        ledger,
      } = res.data.data

      const printWindow = window.open('', '_blank')
      if (!printWindow) return

      const logoHtml = tenant.logo 
        ? `<img src="${tenant.logo}" style="max-height: 70px; border-radius: 8px; margin-bottom: 10px;" />`
        : `<div style="font-size: 28px;">🏢</div>`

      const ledgerRows = ledger.map((item: any) => {
        const dateStr = new Date(item.date).toLocaleDateString('ar-KW')
        const amountVal = Number(Math.abs(item.amount)).toLocaleString('ar-KW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const isInvoice = item.type === 'INVOICE'
        const runningBalStr = Number(item.rollingBalance).toLocaleString('ar-KW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        
        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; color: #475569;">${dateStr}</td>
            <td style="padding: 10px; font-weight: bold; color: #1e293b;">${item.reference}</td>
            <td style="padding: 10px; color: #334155;">${item.description}</td>
            <td style="padding: 10px; color: #16a34a; font-weight: 700; text-align: left;">
              ${isInvoice ? `${amountVal} ${tenant.currency}` : '-'}
            </td>
            <td style="padding: 10px; color: #dc2626; font-weight: 700; text-align: left;">
              ${!isInvoice ? `${amountVal} ${tenant.currency}` : '-'}
            </td>
            <td style="padding: 10px; color: #0f172a; font-weight: bold; text-align: left;">
              ${runningBalStr} ${tenant.currency}
            </td>
          </tr>
        `
      }).join('')

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>كشف حساب العميل - ${cust.name}</title>
          <style>
            body {
              font-family: 'system-ui', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 30px;
              color: #1e293b;
              background-color: #ffffff;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .header-cell {
              vertical-align: top;
            }
            .title {
              font-size: 22px;
              font-weight: 900;
              color: #0f172a;
              margin: 0 0 4px;
            }
            .subtitle {
              font-size: 13px;
              color: #475569;
              margin: 0;
            }
            .meta-section {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 16px 20px;
              margin-bottom: 24px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
            }
            .meta-item {
              font-size: 12.5px;
            }
            .meta-label {
              color: #64748b;
              font-weight: bold;
              display: inline-block;
              width: 140px;
            }
            .meta-value {
              color: #0f172a;
              font-weight: 800;
            }
            .summary-cards {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 14px;
              margin-bottom: 30px;
            }
            .summary-card {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px;
              text-align: right;
            }
            .summary-card-title {
              font-size: 10.5px;
              color: #64748b;
              font-weight: bold;
              display: block;
              margin-bottom: 4px;
            }
            .summary-card-value {
              font-size: 15px;
              font-weight: 900;
              color: #0f172a;
            }
            .ledger-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            .ledger-table th {
              background-color: #f1f5f9;
              color: #475569;
              text-align: right;
              padding: 10px 12px;
              font-weight: 800;
              border-bottom: 2px solid #cbd5e1;
            }
            .ledger-table th.left, .ledger-table td.left {
              text-align: left;
            }
            .footer {
              margin-top: 50px;
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              border-top: 1px dashed #e2e8f0;
              padding-top: 15px;
            }
            @media print {
              body { margin: 15px; }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td class="header-cell" style="width: 70%;">
                <h1 class="title">${tenant.nameAr || tenant.name}</h1>
                <p class="subtitle">كشف حساب العملاء والمبيعات الآجلة</p>
                <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0;">الفترة: من ${new Date(sDate).toLocaleDateString('ar-KW')} إلى ${new Date(eDate).toLocaleDateString('ar-KW')}</p>
              </td>
              <td class="header-cell" style="width: 30%; text-align: left;">
                ${logoHtml}
              </td>
            </tr>
          </table>

          <div style="font-size: 13.5px; font-weight: bold; margin-bottom: 8px; color: #0f172a;">📝 بيانات الحساب والعميل:</div>
          <div class="meta-section">
            <div class="meta-item">
              <span class="meta-label">العميل الحساب:</span>
              <span class="meta-value">${cust.name}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">رقم الهاتف:</span>
              <span class="meta-value" style="font-family: monospace;">${cust.phone}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">نوع الحساب:</span>
              <span class="meta-value">${cust.type === 'FLEET' ? 'حساب شركات وأسطول (Fleet Contract)' : 'حساب أفراد (Individual)'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">تاريخ الإصدار:</span>
              <span class="meta-value">${new Date().toLocaleDateString('ar-KW')}</span>
            </div>
          </div>

          <div class="summary-cards">
            <div class="summary-card" style="background-color: #f8fafc;">
              <span class="summary-card-title">الرصيد الافتتاحي (السابق)</span>
              <span class="summary-card-value">${Number(beginningBalance).toLocaleString('ar-KW', { minimumFractionDigits: 2 })} ${tenant.currency}</span>
            </div>
            <div class="summary-card" style="background-color: #eff6ff;">
              <span class="summary-card-title">إجمالي المبيعات/الفواتير (+)</span>
              <span class="summary-card-value" style="color: #2563eb;">${Number(totalInvoicedDuring).toLocaleString('ar-KW', { minimumFractionDigits: 2 })} ${tenant.currency}</span>
            </div>
            <div class="summary-card" style="background-color: #ecfdf5;">
              <span class="summary-card-title">إجمالي المدفوعات/المقبوضات (-)</span>
              <span class="summary-card-value" style="color: #10b981;">${Number(totalPaidDuring).toLocaleString('ar-KW', { minimumFractionDigits: 2 })} ${tenant.currency}</span>
            </div>
            <div class="summary-card" style="background-color: #fff7ed; border-color: #fed7aa;">
              <span class="summary-card-title">الرصيد الختامي المستحق (Balance)</span>
              <span class="summary-card-value" style="color: #ea580c; font-size: 16px;">${Number(endingBalance).toLocaleString('ar-KW', { minimumFractionDigits: 2 })} ${tenant.currency}</span>
            </div>
          </div>

          <div style="font-size: 13.5px; font-weight: bold; margin-bottom: 12px; color: #0f172a;">📊 كشف حركة المعاملات التفصيلي (Ledger Ledger):</div>
          <table class="ledger-table">
            <thead>
              <tr>
                <th style="width: 12%;">التاريخ</th>
                <th style="width: 14%;">الرقم المرجعي</th>
                <th style="width: 30%;">البيان والمعاملة</th>
                <th style="width: 14%; text-align: left;">مدين (فواتير +)</th>
                <th style="width: 14%; text-align: left;">دائن (سداد -)</th>
                <th style="width: 16%; text-align: left;">الرصيد التراكمي</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 10px; color: #94a3b8; font-style: italic;">-</td>
                <td style="padding: 10px; font-weight: bold; color: #94a3b8;">-</td>
                <td style="padding: 10px; color: #64748b; font-weight: bold;">الرصيد الافتتاحي المستحق للفترة</td>
                <td style="padding: 10px; text-align: left;">-</td>
                <td style="padding: 10px; text-align: left;">-</td>
                <td style="padding: 10px; color: #0f172a; font-weight: bold; text-align: left;">
                  ${Number(beginningBalance).toLocaleString('ar-KW', { minimumFractionDigits: 2 })} ${tenant.currency}
                </td>
              </tr>
              ${ledgerRows}
              <tr style="background-color: #f8fafc; border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1;">
                <td colspan="3" style="padding: 12px; font-weight: 900; color: #0f172a;">الرصيد النهائي المستحق بذمة العميل</td>
                <td colspan="3" style="padding: 12px; font-weight: 900; color: #ea580c; text-align: left; font-size: 14px;">
                  ${Number(endingBalance).toLocaleString('ar-KW', { minimumFractionDigits: 2 })} ${tenant.currency}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            مستند مالي رسمي صادر الكترونياً من كراج ${tenant.nameAr || tenant.name} • الرجاء مراجعة الحساب وتأكيد السداد.
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
        </html>
      `

      printWindow.document.open()
      printWindow.document.write(htmlContent)
      printWindow.document.close()
      setShowStatementModal(false)
    } catch (err) {
      console.error(err)
      alert('فشل توليد وتصدير كشف حساب العميل')
    }
  }

  // Handle Photo Select for quick vehicle add
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setVehicleForm((prev) => ({ ...prev, photoData: reader.result as string }))
    }
  }

  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/vehicles', {
        ...vehicleForm,
        year: Number(vehicleForm.year),
        vin: vehicleForm.chassisNumber || undefined,
        color: vehicleForm.color || undefined,
        fuelType: vehicleForm.fuelType,
        transmissionType: vehicleForm.transmissionType,
        photoData: vehicleForm.photoData || undefined,
        customerId: customerId, // auto bind to this customer
      })
      setShowAddVehicle(false)
      setVehicleForm({
        make: '',
        model: '',
        year: new Date().getFullYear(),
        plateNumber: '',
        chassisNumber: '',
        color: '',
        fuelType: 'PETROL',
        transmissionType: 'AUTO',
        photoData: '',
      })
      fetchCustomerDetails()
    } catch (err) {
      alert('فشل إضافة السيارة')
    }
  }

  const handleSavePreferences = async () => {
    try {
      await api.patch(`/customers/${customerId}`, prefForm)
      alert('تم تحديث تفضيلات العميل بنجاح')
      fetchCustomerDetails()
    } catch (err) {
      alert('فشل تحديث التفضيلات')
    }
  }

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !customer) return
    
    // Parse note history
    let history: NoteEntry[] = []
    try {
      if (customer.notes && (customer.notes.startsWith('[') || customer.notes.startsWith('{'))) {
        history = JSON.parse(customer.notes)
      } else if (customer.notes) {
        history = [{ text: customer.notes, createdAt: customer.createdAt, author: 'النظام' }]
      }
    } catch {
      if (customer.notes) {
        history = [{ text: customer.notes, createdAt: customer.createdAt, author: 'النظام' }]
      }
    }

    const newEntry: NoteEntry = {
      text: newNoteText.trim(),
      createdAt: new Date().toISOString(),
      author: 'المدير'
    }

    const updatedHistory = [newEntry, ...history]

    try {
      await api.patch(`/customers/${customerId}`, {
        notes: JSON.stringify(updatedHistory)
      })
      setNewNoteText('')
      fetchCustomerDetails()
    } catch (err) {
      alert('فشل حفظ الملاحظة')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <span style={{ fontSize: 14, color: '#64748b', fontWeight: 700 }}>جاري تحميل ملف العميل...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1f2937' }}>العميل غير موجود أو تم حذفه</div>
          <button onClick={() => router.push('/customers')} style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>العودة للعملاء</button>
        </div>
      </div>
    )
  }

  // Calculate age as customer
  const monthsSinceJoined = Math.max(1, Math.round(
    (new Date().getTime() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.4)
  ))

  // Determine fast status
  let statusBadge = { text: 'نشط 🟢', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' }
  if (customer.financials.totalRemaining > 0) {
    statusBadge = { text: 'متأخر بالدفع 🔴', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' }
  } else {
    // Check last work order date
    const validWOs = customer.workOrders.filter(w => w.status !== 'CANCELLED')
    if (validWOs.length > 0) {
      const lastWO = validWOs[0]
      const daysSinceLast = (new Date().getTime() - new Date(lastWO.receivedAt).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceLast > 90) {
        statusBadge = { text: 'غير نشط مؤخراً 🟡', color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
      }
    }
  }

  // Parse notes history
  let parsedNotes: NoteEntry[] = []
  try {
    if (customer.notes && (customer.notes.startsWith('[') || customer.notes.startsWith('{'))) {
      parsedNotes = JSON.parse(customer.notes)
    } else if (customer.notes) {
      parsedNotes = [{ text: customer.notes, createdAt: customer.createdAt, author: 'ملاحظة عامة' }]
    }
  } catch {
    if (customer.notes) {
      parsedNotes = [{ text: customer.notes, createdAt: customer.createdAt, author: 'ملاحظة عامة' }]
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar
          title={customer.name}
          subtitle={`مركز القيادة والتحكم للمستندات والعمليات الخاصة بالعميل`}
          actions={
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowStatementModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #03045e 0%, #0077b6 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(3,4,94,0.15)',
                }}
              >
                🧾 إصدار كشف حساب
              </button>
              <button
                onClick={() => router.push('/customers')}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                ⬅️ عودة لقائمة العملاء
              </button>
            </div>
          }
        />

        <main style={{ padding: '24px 28px', flex: 1 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* 1. Customer Header Profile Card */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #eeeff4',
                borderRadius: 24,
                padding: 24,
                boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                {/* Large Avatar */}
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: customer.type === 'FLEET' ? '#f5f3ff' : '#eff6ff',
                    color: customer.type === 'FLEET' ? '#7c3aed' : '#2563eb',
                    border: `1.5px solid ${customer.type === 'FLEET' ? '#ddd6fe' : '#bfdbfe'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    fontWeight: 900,
                  }}
                >
                  {customer.name ? customer.name[0] : '👤'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1f2937', margin: 0 }}>{customer.name}</h1>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        background: customer.type === 'FLEET' ? '#faf5ff' : '#eff6ff',
                        color: customer.type === 'FLEET' ? '#7c3aed' : '#2563eb',
                        border: `1px solid ${customer.type === 'FLEET' ? '#ddd6fe' : '#bfdbfe'}`,
                        borderRadius: 6,
                        padding: '2px 8px',
                      }}
                    >
                      {customer.type === 'FLEET' ? '🏢 أسطول / شركة' : '👤 فرد'}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        background: statusBadge.bg,
                        color: statusBadge.color,
                        border: `1px solid ${statusBadge.border}`,
                        borderRadius: 6,
                        padding: '2px 8px',
                      }}
                    >
                      {statusBadge.text}
                    </span>
                    {/* ── No-Show Badge ──────────────────────────────── */}
                    {customer.noShowLevel === 'CRITICAL' && (
                      <span
                        title={`غاب عن ${customer.noShowCount} موعد بدون حضور — تجاوز حد التحذير (${customer.noShowCriticalThreshold}×)`}
                        style={{
                          fontSize: 11, fontWeight: 800,
                          color: '#991b1b', background: '#fef2f2',
                          border: '1.5px solid #fca5a5', borderRadius: 6,
                          padding: '2px 8px', cursor: 'help',
                        }}
                      >
                        🔴 غياب متكرر &bull; {customer.noShowCount}×
                      </span>
                    )}
                    {customer.noShowLevel === 'WARN' && (
                      <span
                        title={`غاب عن ${customer.noShowCount} موعد بدون حضور — تجاوز حد التنبيه (${customer.noShowWarnThreshold}×)`}
                        style={{
                          fontSize: 11, fontWeight: 800,
                          color: '#92400e', background: '#fffbeb',
                          border: '1.5px solid #fcd34d', borderRadius: 6,
                          padding: '2px 8px', cursor: 'help',
                        }}
                      >
                        ⚠️ كثير الغياب &bull; {customer.noShowCount}×
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    <span>تاريخ التسجيل: {new Date(customer.createdAt).toLocaleDateString('ar-KW')}</span>
                    <span>•</span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>عميل مسجل منذ {monthsSinceJoined} {monthsSinceJoined > 10 ? 'شهراً' : monthsSinceJoined === 1 ? 'شهر' : 'أشهر'}</span>
                  </div>
                </div>
              </div>

              {/* Direct Actions (WhatsApp, SMS, Email) */}
              <div style={{ display: 'flex', gap: 10 }}>
                <a
                  href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#22c55e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
                  }}
                >
                  💬 واتساب
                </a>
                <a
                  href={`tel:${customer.phone}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                  }}
                >
                  📞 اتصال مباشر
                </a>
                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: 10,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    📧 البريد الإلكتروني
                  </a>
                )}
              </div>
            </div>

            {/* 2. Key Performance Indicators Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
              <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 700 }}>💰 إجمالي الإنفاق (LTV)</span>
                  <span style={{ fontSize: 20 }}>💵</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#1f2937', marginTop: 10 }}>
                  {customer.financials.totalInvoiced.toFixed(2)} د.ك
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 700 }}>🚗 السيارات المسجلة</span>
                  <span style={{ fontSize: 20 }}>🚘</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1f2937', marginTop: 10 }}>
                  {customer.vehicles.length} سيارات
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 700 }}>🔧 طلبات الخدمة الكلية</span>
                  <span style={{ fontSize: 20 }}>⚙️</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1f2937', marginTop: 10 }}>
                  {customer.workOrders.length} طلبات
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 700 }}>📅 تاريخ آخر زيارة صيانة</span>
                  <span style={{ fontSize: 20 }}>🗓️</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 750, color: '#1f2937', marginTop: 14 }}>
                  {customer.workOrders.length > 0
                    ? new Date(customer.workOrders[0].receivedAt).toLocaleDateString('ar-KW')
                    : 'لا توجد زيارات سابقة'}
                </div>
              </div>
            </div>

            {/* Layout for 2 Column Main Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'flex-start' }}>
              
              {/* Left Column: Vehicles List & Services Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {/* 3. Linked Vehicles Card */}
                <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 20, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1f2937', margin: 0 }}>🚘 السيارات المربوطة بهذا العميل</h3>
                    <button
                      onClick={() => setShowAddVehicle(true)}
                      style={{
                        background: '#f5f3ff',
                        color: '#4f46e5',
                        border: '1.5px solid #e0e7ff',
                        borderRadius: 10,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ➕ ربط سيارة جديدة
                    </button>
                  </div>

                  {customer.vehicles.length === 0 ? (
                    <div style={{ background: '#fafafb', border: '1.5px dashed #cbd5e1', borderRadius: 12, padding: '30px 16px', textAlign: 'center', color: '#64748b' }}>
                      لا توجد سيارات مربوطة بهذا العميل بعد.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {customer.vehicles.map((vRel) => {
                        const v = vRel.vehicle
                        return (
                          <div
                            key={v.id}
                            style={{
                              border: '1px solid #e2e8f0',
                              borderRadius: 14,
                              padding: 16,
                              background: '#ffffff',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 12,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 10, fontWeight: 800, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 5, padding: '1px 6px' }}>
                                {v.year || 'غير محدد'}
                              </span>

                              <div style={{ border: '1px solid #475569', borderRadius: 5, padding: '1px 6px', display: 'flex', gap: 4 }}>
                                <span style={{ fontSize: 9, color: '#64748b', borderLeft: '1px solid #e2e8f0', paddingLeft: 4 }}>الكويت</span>
                                <span style={{ fontSize: 11, fontWeight: 900, fontFamily: 'monospace' }}>{v.plateNumber}</span>
                              </div>
                            </div>

                            <h4 style={{ fontSize: 13.5, fontWeight: 800, color: '#334155', margin: 0 }}>
                              {v.make} {v.model}
                            </h4>

                            <div style={{ display: 'flex', gap: 6, fontSize: 10.5 }}>
                              {v.color && <span style={{ color: '#64748b' }}>🎨 {v.color}</span>}
                              {v.transmissionType && <span style={{ color: '#64748b' }}>⚙️ {v.transmissionType === 'AUTO' ? 'أوتوماتيك' : 'عادي'}</span>}
                            </div>

                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => router.push(`/work-orders?new=true&vehicleId=${v.id}&customerId=${customerId}`)}
                                style={{
                                  flex: 1,
                                  background: '#4f46e5',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: 8,
                                  padding: '5px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                🛠️ كرت عمل جديد
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Service History (Work Orders Timeline) */}
                <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 20, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1f2937', margin: 0, marginBottom: 18 }}>⏱️ تاريخ زيارات وطلبات الخدمة</h3>

                  {customer.workOrders.length === 0 ? (
                    <div style={{ background: '#fafafb', border: '1.5px dashed #cbd5e1', borderRadius: 12, padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>
                      لا يوجد أي طلب خدمة مسجل للعميل.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'right' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b' }}>
                            <th style={{ padding: '10px 8px' }}>الطلب</th>
                            <th style={{ padding: '10px 8px' }}>السيارة</th>
                            <th style={{ padding: '10px 8px' }}>التاريخ</th>
                            <th style={{ padding: '10px 8px' }}>الحالة</th>
                            <th style={{ padding: '10px 8px' }}>القيمة</th>
                            <th style={{ padding: '10px 8px' }}>الإجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customer.workOrders.map((wo) => {
                            let statusText = wo.status
                            let statusColor = { color: '#475569', bg: '#f1f5f9' }
                            
                            if (wo.status === 'DELIVERED') statusColor = { color: '#10b981', bg: '#ecfdf5' }
                            else if (wo.status === 'APPROVED' || wo.status === 'IN_PROGRESS') statusColor = { color: '#3b82f6', bg: '#eff6ff' }
                            else if (wo.status === 'CANCELLED') statusColor = { color: '#ef4444', bg: '#fef2f2' }
                            else if (wo.status === 'AWAITING_APPROVAL') statusColor = { color: '#d97706', bg: '#fffbeb' }

                            return (
                              <tr key={wo.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px 8px', fontWeight: 800 }}>#{wo.id.slice(0, 8)}</td>
                                <td style={{ padding: '12px 8px' }}>{wo.vehicle ? `${wo.vehicle.make} ${wo.vehicle.model}` : 'غير محدد'}</td>
                                <td style={{ padding: '12px 8px' }}>{new Date(wo.receivedAt).toLocaleDateString('ar-KW')}</td>
                                <td style={{ padding: '12px 8px' }}>
                                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 6, color: statusColor.color, background: statusColor.bg }}>
                                    {statusText}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 8px', fontWeight: 800 }}>{Number(wo.totalAmount).toFixed(2)} د.ك</td>
                                <td style={{ padding: '12px 8px' }}>
                                  <Link
                                    href={`/work-orders/${wo.id}`}
                                    style={{
                                      color: '#4f46e5',
                                      fontWeight: 800,
                                      textDecoration: 'none',
                                      fontSize: 12,
                                    }}
                                  >
                                    عرض التفاصيل 🔎
                                  </Link>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column: Financial summary, Preferences, and Internal Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {/* 5. Financial Summary Card */}
                <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 20, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                  <h3 style={{ fontSize: 14.5, fontWeight: 900, color: '#1f2937', margin: 0, marginBottom: 16 }}>📊 الملخص المالي للعميل</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: '#64748b' }}>إجمالي الفواتير الصادرة:</span>
                      <span style={{ fontWeight: 800, color: '#1f2937' }}>{customer.financials.totalInvoiced.toFixed(2)} د.ك</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>المسدد والمدفوع:</span>
                      <span style={{ fontWeight: 800, color: '#10b981' }}>{customer.financials.totalPaid.toFixed(2)} د.ك</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>المتبقي والذمم:</span>
                      <span style={{ fontWeight: 800, color: '#ef4444' }}>{customer.financials.totalRemaining.toFixed(2)} د.ك</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, borderTop: '1px dashed #e2e8f0', paddingTop: 12, marginTop: 4 }}>
                      <span style={{ color: '#64748b' }}>متوسط الفاتورة الواحدة:</span>
                      <span style={{ fontWeight: 800, color: '#4f46e5' }}>{customer.financials.avgInvoiceValue.toFixed(2)} د.ك</span>
                    </div>
                  </div>
                </div>

                {/* 6. Internal Notes System */}
                <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 20, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                  <h3 style={{ fontSize: 14.5, fontWeight: 900, color: '#1f2937', margin: 0, marginBottom: 16 }}>📝 الملاحظات الداخلية الخاصة بالورشة</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <textarea
                      placeholder="اكتب ملاحظة فنية، سلوك العميل، توصيات للزيارة القادمة..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      style={{
                        width: '100%',
                        height: 70,
                        padding: 10,
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        fontSize: 12,
                        outline: 'none',
                        resize: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={handleAddNote}
                      style={{
                        background: '#4f46e5',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        alignSelf: 'flex-start',
                      }}
                    >
                      حفظ الملاحظة 💾
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, maxHeight: 180, overflowY: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                      {parsedNotes.length === 0 ? (
                        <div style={{ fontSize: 11.5, color: '#94a3b8', textAlign: 'center', padding: '10px 0' }}>
                          لا توجد ملاحظات مسجلة حالياً
                        </div>
                      ) : (
                        parsedNotes.map((n, i) => (
                          <div key={i} style={{ background: '#f8fafc', padding: 10, borderRadius: 8, borderRight: '3px solid #cbd5e1' }}>
                            <p style={{ fontSize: 12, color: '#334155', margin: 0 }}>{n.text}</p>
                            <span style={{ fontSize: 9.5, color: '#94a3b8', display: 'block', marginTop: 4 }}>
                              بواسطة: {n.author} • {new Date(n.createdAt).toLocaleDateString('ar-KW')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 7. Communication Preferences Card */}
                <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 20, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                  <h3 style={{ fontSize: 14.5, fontWeight: 900, color: '#1f2937', margin: 0, marginBottom: 16 }}>⚙️ تفضيلات التواصل والإرسال</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>وسيلة التواصل المفضلة</label>
                      <select
                        value={prefForm.preferredContactMethod}
                        onChange={(e) => setPrefForm({ ...prefForm, preferredContactMethod: e.target.value as any })}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          outline: 'none',
                        }}
                      >
                        <option value="WHATSAPP">WhatsApp (واتساب)</option>
                        <option value="SMS">SMS (رسائل نصية)</option>
                        <option value="CALL">اتصال هاتفي مباشر</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <input
                        type="checkbox"
                        id="marketing-opt"
                        checked={prefForm.optInMarketing}
                        onChange={(e) => setPrefForm({ ...prefForm, optInMarketing: e.target.checked })}
                        style={{ width: 15, height: 15, cursor: 'pointer' }}
                      />
                      <label htmlFor="marketing-opt" style={{ fontSize: 12, color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                        الموافقة على تلقي العروض التسويقية
                      </label>
                    </div>

                    <button
                      onClick={handleSavePreferences}
                      style={{
                        background: '#4f46e5',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 16px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        marginTop: 6,
                      }}
                    >
                      تحديث الإعدادات
                    </button>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </main>
      </div>

      {/* Quick Add Vehicle Modal */}
      {showAddVehicle && (
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
              maxWidth: 440,
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
                  🚗
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', margin: 0 }}>ربط سيارة جديدة بهذا العميل</h3>
              </div>
              <button
                onClick={() => setShowAddVehicle(false)}
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

            <form onSubmit={handleAddVehicleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Image upload preview */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1px dashed #cbd5e1', borderRadius: 12, padding: 14, background: '#f8fafc' }}>
                {vehicleForm.photoData ? (
                  <div style={{ width: 120, height: 80, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                    <img src={vehicleForm.photoData} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <span style={{ fontSize: 24 }}>📸</span>
                )}
                <label style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5', cursor: 'pointer' }}>
                  {vehicleForm.photoData ? 'تغيير صورة السيارة' : 'رفع صورة توثيقية للسيارة'}
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>الماركة (Make) *</label>
                  <input
                    type="text"
                    placeholder="مثال: Toyota"
                    value={vehicleForm.make}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
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
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>الموديل (Model) *</label>
                  <input
                    type="text"
                    placeholder="مثال: Land Cruiser"
                    value={vehicleForm.model}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
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
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>رقم اللوحة *</label>
                  <input
                    type="text"
                    placeholder="مثال: 30-757123"
                    value={vehicleForm.plateNumber}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value })}
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
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>السنة *</label>
                  <input
                    type="number"
                    value={vehicleForm.year}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, year: parseInt(e.target.value) || new Date().getFullYear() })}
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
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>اللون</label>
                  <input
                    type="text"
                    placeholder="أبيض..."
                    value={vehicleForm.color}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })}
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
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>الوقود</label>
                  <select
                    value={vehicleForm.fuelType}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, fuelType: e.target.value as any })}
                    style={{
                      padding: '10px 10px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      fontSize: 12.5,
                      outline: 'none',
                    }}
                  >
                    <option value="PETROL">بنزين</option>
                    <option value="DIESEL">ديزل</option>
                    <option value="HYBRID">هايبرد</option>
                    <option value="ELECTRIC">كهربائي</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>ناقل الحركة</label>
                  <select
                    value={vehicleForm.transmissionType}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, transmissionType: e.target.value as any })}
                    style={{
                      padding: '10px 10px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      fontSize: 12.5,
                      outline: 'none',
                    }}
                  >
                    <option value="AUTO">أوتوماتيك</option>
                    <option value="MANUAL">عادي</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>رقم الشاصي (اختياري)</label>
                <input
                  type="text"
                  placeholder="أدخل رقم الشاصي الخاص بالسيارة..."
                  value={vehicleForm.chassisNumber}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, chassisNumber: e.target.value })}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #eeeff4', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowAddVehicle(false)}
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
                  ربط وحفظ السيارة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Statement Range Modal */}
      {showStatementModal && (
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
          onClick={(e) => { if (e.target === e.currentTarget) setShowStatementModal(false) }}
        >
          <div
            className="modal-content"
            style={{
              background: '#ffffff',
              border: '1px solid #eeeff4',
              borderRadius: 24,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)',
              width: '100%',
              maxWidth: 440,
              padding: '24px 30px',
              boxSizing: 'border-box',
              direction: 'rtl',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>🧾</span>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1f2937', margin: 0 }}>تصدير كشف حساب العميل</h3>
                <p style={{ margin: 0, fontSize: 11.5, color: '#64748b' }}>حدد الفترة الزمنية لتوليد كشف الحساب والمدفوعات</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
              {/* Quick selectors */}
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>خيارات سريعة للمدى الزمني:</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
                      setStmtStartDate(firstDay)
                      setStmtEndDate(new Date().toISOString().split('T')[0])
                    }}
                    style={{ flex: 1, padding: '6px', fontSize: 11, borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                  >
                    الشهر الحالي
                  </button>
                  <button
                    onClick={() => {
                      const prevDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                      setStmtStartDate(prevDate)
                      setStmtEndDate(new Date().toISOString().split('T')[0])
                    }}
                    style={{ flex: 1, padding: '6px', fontSize: 11, borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                  >
                    آخر 30 يوم
                  </button>
                  <button
                    onClick={() => {
                      const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
                      setStmtStartDate(firstDayOfYear)
                      setStmtEndDate(new Date().toISOString().split('T')[0])
                    }}
                    style={{ flex: 1, padding: '6px', fontSize: 11, borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                  >
                    العام الحالي
                  </button>
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5 }}>من تاريخ:</label>
                <input
                  type="date"
                  value={stmtStartDate}
                  onChange={(e) => setStmtStartDate(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1.5px solid #cbd5e1',
                    fontSize: 13,
                    width: '100%',
                    boxSizing: 'border-box',
                    color: '#1f2937',
                  }}
                />
              </div>

              {/* End Date */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5 }}>إلى تاريخ:</label>
                <input
                  type="date"
                  value={stmtEndDate}
                  onChange={(e) => setStmtEndDate(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1.5px solid #cbd5e1',
                    fontSize: 13,
                    width: '100%',
                    boxSizing: 'border-box',
                    color: '#1f2937',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                <button
                  onClick={() => setShowStatementModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  إلغاء
                </button>
                <button
                  onClick={handlePrintStatement}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #03045e 0%, #0077b6 100%)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  🖨️ عرض وطباعة الكشف
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
