'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
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
  createdAt: string
  customerVehicle?: {
    customer: {
      id: string
      name: string
      phone: string
    }
  } | null
  workOrders?: Array<{
    id: string
    status: string
    receivedAt: string
  }>
}

interface Customer {
  id: string
  name: string
  phone: string
}

export default function VehiclesPage() {
  const router = useRouter()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [makeFilter, setMakeFilter] = useState('')
  const [orphanFilter, setOrphanFilter] = useState('ALL') // ALL, ORPHANS_ONLY
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [form, setForm] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    plateNumber: '',
    chassisNumber: '',
    customerId: '',
    color: '',
    fuelType: 'PETROL' as 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID',
    transmissionType: 'AUTO' as 'AUTO' | 'MANUAL',
    photoData: '',
  })

  useEffect(() => {
    fetchVehicles()
    fetchCustomers()
  }, [])

  const fetchVehicles = async () => {
    try {
      setLoading(true)
      const res = await api.get('/vehicles')
      setVehicles(res.data.data || [])
    } catch (err) {
      console.error('Error fetching vehicles', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers')
      setCustomers(res.data.data || [])
    } catch (err) {
      console.error('Error fetching customers', err)
    }
  }

  const handlePrintHistory = async (vehicleId: string) => {
    try {
      const res = await api.get(`/vehicles/${vehicleId}/history`)
      const { tenant, vehicle, workOrders } = res.data.data

      const printWindow = window.open('', '_blank')
      if (!printWindow) return

      const logoHtml = tenant.logo 
        ? `<img src="${tenant.logo}" style="max-height: 70px; border-radius: 8px; margin-bottom: 10px;" />`
        : `<div style="font-size: 28px;">🏢</div>`

      const rowsHtml = workOrders.map((wo: any) => {
        const dateStr = new Date(wo.receivedAt).toLocaleDateString('ar-KW')
        
        // Group services and parts
        const servicesList = wo.workOrderItems
          .filter((item: any) => item.type === 'LABOR')
          .map((item: any) => `<li>${item.descriptionAr || item.description}</li>`)
          .join('')

        const partsList = wo.workOrderItems
          .filter((item: any) => item.type === 'PART')
          .map((item: any) => `<li>${item.descriptionAr || item.description} (العدد: ${Number(item.quantity)})</li>`)
          .join('')

        // Technicians list
        const techs = Array.from(new Set(wo.taskAssignments.map((ta: any) => ta.technician?.user?.name)))
          .filter(Boolean)
          .join('، ')

        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-weight: bold; color: #1e293b;">${wo.orderNumber}</td>
            <td style="padding: 12px; color: #475569;">${dateStr}</td>
            <td style="padding: 12px; color: #475569;">${wo.mileageAtReception ? Number(wo.mileageAtReception).toLocaleString() + ' كم' : 'غير مسجل'}</td>
            <td style="padding: 12px; color: #334155; line-height: 1.6;">
              <ul style="margin: 0; padding-right: 20px;">
                ${servicesList || '<li>لا توجد خدمات صيانة مسجلة</li>'}
              </ul>
            </td>
            <td style="padding: 12px; color: #334155; line-height: 1.6;">
              <ul style="margin: 0; padding-right: 20px;">
                ${partsList || '<li style="color: #94a3b8; list-style: none;">بدون قطع غيار</li>'}
              </ul>
            </td>
            <td style="padding: 12px; color: #4b5563; font-weight: 500;">${techs || 'غير محدد'}</td>
          </tr>
        `
      }).join('')

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>سجل الصيانة الكامل - ${vehicle.make} ${vehicle.model}</title>
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
              font-size: 20px;
              font-weight: 900;
              color: #0f172a;
              margin: 0 0 4px;
            }
            .subtitle {
              font-size: 12px;
              color: #64748b;
              margin: 0;
            }
            .meta-section {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 16px 20px;
              margin-bottom: 30px;
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
            }
            .meta-item {
              font-size: 12px;
            }
            .meta-label {
              color: #64748b;
              font-weight: bold;
              display: block;
              margin-bottom: 2px;
            }
            .meta-value {
              color: #0f172a;
              font-weight: 800;
            }
            .history-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12.5px;
            }
            .history-table th {
              background-color: #f1f5f9;
              color: #475569;
              text-align: right;
              padding: 10px 12px;
              font-weight: 800;
              border-bottom: 2px solid #cbd5e1;
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
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td class="header-cell" style="width: 70%;">
                <h1 class="title">${tenant.nameAr || tenant.name}</h1>
                <p class="subtitle">سجل الصيانة الفني والتقني التاريخي للمركبة</p>
                <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-KW')} • هاتف: ${tenant.phone || 'غير مسجل'}</p>
              </td>
              <td class="header-cell" style="width: 30%; text-align: left;">
                ${logoHtml}
              </td>
            </tr>
          </table>

          <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #0f172a;">📋 مواصفات وبيانات المركبة:</div>
          <div class="meta-section">
            <div class="meta-item">
              <span class="meta-label">المركبة (الشركة والموديل):</span>
              <span class="meta-value">${vehicle.make} ${vehicle.model}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">رقم اللوحة:</span>
              <span class="meta-value">${vehicle.plateNumber}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">سنة الصنع:</span>
              <span class="meta-value">${vehicle.year || 'غير محدد'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">رقم الشاصي (VIN):</span>
              <span class="meta-value" style="font-family: monospace; font-size: 11px;">${vehicle.vin || 'غير مسجل'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">نوع الوقود / الجير:</span>
              <span class="meta-value">${vehicle.fuelType === 'PETROL' ? 'بنزين' : vehicle.fuelType === 'DIESEL' ? 'ديزل' : 'أخرى'} • ${vehicle.transmissionType === 'AUTO' ? 'أوتوماتيك' : 'عادي'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">المالك الحالي:</span>
              <span class="meta-value">${vehicle.customerVehicle?.customer?.name || 'غير مربوط بمالك'}</span>
            </div>
          </div>

          <div style="font-size: 14px; font-weight: bold; margin-bottom: 12px; color: #0f172a;">🛠️ السجل الفني لزيارات الصيانة والإصلاح:</div>
          <table class="history-table">
            <thead>
              <tr>
                <th style="width: 12%;">رقم كرت العمل</th>
                <th style="width: 12%;">تاريخ الزيارة</th>
                <th style="width: 12%;">قراءة العداد</th>
                <th style="width: 32%;">الأعمال المنجزة والخدمات</th>
                <th style="width: 20%;">قطع الغيار المستبدلة</th>
                <th style="width: 12%;">الفني المسؤول</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8;">لا توجد زيارات صيانة منتهية مسجلة لهذه المركبة.</td></tr>`}
            </tbody>
          </table>

          <div class="footer">
            مستند صادر الكترونياً من نظام إدارة الورشة • السجل مخصص للتوثيق الفني ويخلو تماماً من أي تفاصيل مالية حساسة.
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
    } catch (err) {
      console.error(err)
      alert('فشل استخراج سجل الصيانة الفني للمركبة')
    }
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setForm((prev) => ({ ...prev, photoData: reader.result as string }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerId) {
      alert('الرجاء اختيار العميل (المالك) لربطه بالسيارة')
      return
    }
    try {
      await api.post('/vehicles', {
        ...form,
        year: Number(form.year),
        vin: form.chassisNumber || undefined,
        color: form.color || undefined,
        fuelType: form.fuelType,
        transmissionType: form.transmissionType,
        photoData: form.photoData || undefined,
      })
      setShowAddModal(false)
      setForm({
        make: '',
        model: '',
        year: new Date().getFullYear(),
        plateNumber: '',
        chassisNumber: '',
        customerId: '',
        color: '',
        fuelType: 'PETROL',
        transmissionType: 'AUTO',
        photoData: '',
      })
      fetchVehicles()
    } catch (err) {
      alert('فشل إضافة السيارة')
    }
  }

  // Filter Logic
  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.plateNumber.includes(searchTerm)

    const matchesMake = makeFilter === '' || v.make.toLowerCase() === makeFilter.toLowerCase()

    const hasOwner = !!v.customerVehicle?.customer
    const matchesOrphan =
      orphanFilter === 'ALL' ||
      (orphanFilter === 'ORPHANS_ONLY' && !hasOwner)

    return matchesSearch && matchesMake && matchesOrphan
  })

  // List of distinct brands/makes for the drop-down filter
  const distinctMakes = Array.from(new Set(vehicles.map((v) => v.make))).filter(Boolean)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar
          title="سجل السيارات"
          subtitle="إدارة مركبات العملاء وتتبع التاريخ الميكانيكي"
          actions={
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.2)',
                outline: 'none',
              }}
            >
              ➕ إضافة سيارة جديدة
            </button>
          }
        />

        <main style={{ padding: '24px 28px', flex: 1 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Extended Filter & Search Panel */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #eeeff4',
                borderRadius: 16,
                padding: '20px 24px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ flex: '2 1 280px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>بحث نصي</label>
                <input
                  type="text"
                  placeholder="ابحث برقم اللوحة، ماركة أو موديل السيارة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: 12.5,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Brand filter */}
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>ماركة السيارة</label>
                <select
                  value={makeFilter}
                  onChange={(e) => setMakeFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: 12.5,
                    outline: 'none',
                  }}
                >
                  <option value="">كل الماركات</option>
                  {distinctMakes.map((make) => (
                    <option key={make} value={make}>
                      {make}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ownership filter (detect orphaned legacy records) */}
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>حالة الملكية</label>
                <select
                  value={orphanFilter}
                  onChange={(e) => setOrphanFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: 12.5,
                    outline: 'none',
                  }}
                >
                  <option value="ALL">جميع السيارات</option>
                  <option value="ORPHANS_ONLY">⚠️ سيارات بدون مالك مرتبط</option>
                </select>
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6b7280', alignSelf: 'flex-end', paddingBottom: 10 }}>
                المطابقة: <span style={{ color: '#4f46e5', fontWeight: 800 }}>{filteredVehicles.length}</span>
              </div>
            </div>

            {/* Content List */}
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>جاري تحميل السيارات...</span>
                </div>
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div
                style={{
                  background: '#ffffff',
                  border: '1px dashed #cbd5e1',
                  borderRadius: 16,
                  padding: '64px 24px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>🚗</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>لا توجد سيارات مطابقة للبحث أو الفلترة</div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                  gap: 20,
                }}
              >
                {filteredVehicles.map((vehicle) => {
                  const customer = vehicle.customerVehicle?.customer
                  const hasOwner = !!customer

                  // Calculate last service visit
                  let lastServiceText = 'لا توجد صيانة مسجلة'
                  if (vehicle.workOrders && vehicle.workOrders.length > 0) {
                    const sortedWO = [...vehicle.workOrders]
                      .filter(wo => wo.status !== 'CANCELLED')
                      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
                    if (sortedWO.length > 0) {
                      lastServiceText = new Date(sortedWO[0].receivedAt).toLocaleDateString('ar-KW')
                    }
                  }

                  const totalServiceCount = vehicle.workOrders?.length || 0

                  return (
                    <div
                      key={vehicle.id}
                      style={{
                        background: '#ffffff',
                        border: !hasOwner ? '2px solid #f97316' : '1px solid #eeeff4',
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        {/* Vehicle Photo Header */}
                        {vehicle.photoUrl ? (
                          <div style={{ width: '100%', height: 130, position: 'relative', overflow: 'hidden' }}>
                            <img src={vehicle.photoUrl} alt="Vehicle" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div style={{ width: '100%', height: 60, background: '#fafafb', borderBottom: '1px solid #f1f5f9' }} />
                        )}

                        <div style={{ padding: 20 }}>
                          {/* Plate & Year Badge */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                background: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe',
                                borderRadius: 6,
                                padding: '2px 8px',
                              }}
                            >
                              {vehicle.year || 'غير محدد'}
                            </span>

                            {/* Kuwait style plate number */}
                            <div
                              style={{
                                border: '1.5px solid #1e293b',
                                borderRadius: 6,
                                padding: '2px 8px',
                                background: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <span style={{ fontSize: 9, fontWeight: 800, color: '#1e293b', borderLeft: '1px solid #e2e8f0', paddingLeft: 4 }}>الكويت</span>
                              <span style={{ fontSize: 12.5, fontWeight: 900, color: '#1e293b', fontFamily: 'monospace' }}>
                                {vehicle.plateNumber}
                              </span>
                            </div>
                          </div>

                          {/* Make & Model */}
                          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1f2937', marginTop: 12, marginBottom: 0 }}>
                            {vehicle.make} {vehicle.model}
                          </h3>

                          {/* Color, Fuel, Transmission metadata */}
                          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                            {vehicle.color && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', background: '#f1f5f9', color: '#475569', borderRadius: 4 }}>
                                🎨 {vehicle.color}
                              </span>
                            )}
                            {vehicle.fuelType && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', background: '#ecfdf5', color: '#10b981', borderRadius: 4 }}>
                                ⛽ {vehicle.fuelType === 'PETROL' ? 'بنزين' : vehicle.fuelType === 'DIESEL' ? 'ديزل' : vehicle.fuelType === 'HYBRID' ? 'هايبرد' : 'كهربائي'}
                              </span>
                            )}
                            {vehicle.transmissionType && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', background: '#fff7ed', color: '#f97316', borderRadius: 4 }}>
                                ⚙️ {vehicle.transmissionType === 'AUTO' ? 'أوتوماتيك' : 'يدوي / عادي'}
                              </span>
                            )}
                          </div>

                          {/* Owner Warning or Details */}
                          {!hasOwner ? (
                            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '10px 12px', borderRadius: 10, marginTop: 12 }}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: '#ea580c' }}>⚠️ غير مربوطة بمالك!</div>
                              <span style={{ fontSize: 11.5, color: '#c2410c', marginTop: 2, display: 'block' }}>يرجى تعديلها وربطها بعميل لمنع تشتت السجلات.</span>
                            </div>
                          ) : (
                            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 10, marginTop: 12 }}>
                              <div style={{ fontSize: 11, color: '#9ca3af' }}>مالك السيارة:</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{customer.name}</span>
                                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>{customer.phone}</span>
                              </div>
                            </div>
                          )}

                          {/* Quick indicators: last service & count */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12, borderTop: '1px dashed #f1f5f9', paddingTop: 10, fontSize: 11.5 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#94a3b8' }}>تاريخ آخر زيارة صيانة:</span>
                              <span style={{ fontWeight: 700, color: '#475569' }}>{lastServiceText}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#94a3b8' }}>إجمالي زيارات الصيانة:</span>
                              <span style={{ fontWeight: 800, color: '#4f46e5' }}>{totalServiceCount} زيارة</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div style={{ padding: '0 20px 20px', display: 'flex', gap: 8 }}>
                        <button
                          disabled={!hasOwner}
                          onClick={() => {
                            router.push(`/work-orders?new=true&vehicleId=${vehicle.id}&customerId=${customer?.id || ''}`)
                          }}
                          style={{
                            flex: 1,
                            background: hasOwner ? '#f5f3ff' : '#f1f5f9',
                            border: hasOwner ? '1px solid #e0e7ff' : '1px solid #e2e8f0',
                            color: hasOwner ? '#4f46e5' : '#94a3b8',
                            borderRadius: 10,
                            padding: '8px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: hasOwner ? 'pointer' : 'not-allowed',
                            outline: 'none',
                          }}
                        >
                          🛠️ إنشاء كرت عمل
                        </button>
                        <button
                          onClick={() => handlePrintHistory(vehicle.id)}
                          style={{
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            color: '#16a34a',
                            borderRadius: 10,
                            padding: '8px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                        >
                          🖨️ سجل الصيانة
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Vehicle Modal */}
      {showAddModal && (
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
              maxWidth: 480,
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
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', margin: 0 }}>إضافة سيارة جديدة للسجل</h3>
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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Image upload preview */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1px dashed #cbd5e1', borderRadius: 12, padding: 14, background: '#f8fafc' }}>
                {form.photoData ? (
                  <div style={{ width: 120, height: 80, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                    <img src={form.photoData} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <span style={{ fontSize: 24 }}>📸</span>
                )}
                <label style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5', cursor: 'pointer' }}>
                  {form.photoData ? 'تغيير صورة السيارة' : 'رفع صورة توثيقية للسيارة'}
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                </label>
              </div>

              {/* Make & Model */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>الماركة (Make) *</label>
                  <input
                    type="text"
                    placeholder="مثال: Toyota"
                    value={form.make}
                    onChange={(e) => setForm({ ...form, make: e.target.value })}
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
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
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

              {/* Plate & Year */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>رقم اللوحة *</label>
                  <input
                    type="text"
                    placeholder="مثال: 30-757123"
                    value={form.plateNumber}
                    onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
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
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || new Date().getFullYear() })}
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

              {/* Color, Fuel & Transmission */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>اللون</label>
                  <input
                    type="text"
                    placeholder="أبيض، أسود..."
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
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
                    value={form.fuelType}
                    onChange={(e) => setForm({ ...form, fuelType: e.target.value as any })}
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
                    value={form.transmissionType}
                    onChange={(e) => setForm({ ...form, transmissionType: e.target.value as any })}
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

              {/* Chassis / VIN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>رقم الشاصي / VIN (اختياري)</label>
                <input
                  type="text"
                  placeholder="أدخل رقم الشاصي الخاص بالسيارة..."
                  value={form.chassisNumber}
                  onChange={(e) => setForm({ ...form, chassisNumber: e.target.value })}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Owner link - Required */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>ربط بمالك السيارة (عميل مسجل) *</label>
                <select
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: 12.5,
                    color: '#1e293b',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  required
                >
                  <option value="">-- اختر المالك / العميل للربط (إجباري) --</option>
                  {customers.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.name} ({cust.phone})
                    </option>
                  ))}
                </select>
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
                  حفظ السيارة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
