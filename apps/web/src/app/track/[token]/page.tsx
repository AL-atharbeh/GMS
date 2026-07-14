'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const STATUS_STEPS = [
  { status: 'RECEIVED', label: 'تم الاستلام', icon: '📋', desc: 'تم استلام سيارتك بنجاح وجاري فحصها' },
  { status: 'DIAGNOSING', label: 'التشخيص', icon: '🔍', desc: 'يتم الآن فحص وتحديد مشاكل السيارة' },
  { status: 'QUOTED', label: 'عرض السعر جاهز', icon: '🧾', desc: 'تم إعداد كشف التكلفة وبانتظار موافقتك' },
  { status: 'AWAITING_APPROVAL', label: 'بانتظار موافقتك', icon: '⏳', desc: 'الرجاء مراجعة البنود والموافقة للبدء بالعمل' },
  { status: 'APPROVED', label: 'موافق عليه للعمل', icon: '⚙️', desc: 'تمت الموافقة من قبلك وجاري التحضير لبدء الإصلاح' },
  { status: 'IN_PROGRESS', label: 'قيد التنفيذ والإصلاح', icon: '🛠️', desc: 'جاري العمل الفعلي على السيارة من قبل فنيي الصيانة' },
  { status: 'QUALITY_CHECK', label: 'فحص الجودة النهائي', icon: '🔎', desc: 'يتم التحقق من جودة الإصلاحات واختبار السيارة' },
  { status: 'READY_FOR_DELIVERY', label: 'جاهزة للاستلام', icon: '🎉', desc: 'سيارتك جاهزة تماماً، يمكنك الحضور لاستلامها' },
  { status: 'DELIVERED', label: 'تم التسليم والمغادرة', icon: '✅', desc: 'تم تسليم السيارة للعميل بالسلامة' },
]

export default function TrackPage() {
  const params = useParams()
  const token = params.token as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rating, setRating] = useState(0)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  useEffect(() => {
    fetchTracking()
  }, [token])

  const fetchTracking = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/track/${token}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      setData(json.data)
    } catch (e: any) {
      setError(e.message || 'رابط التتبع غير صحيح')
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (approved: boolean) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/work-orders/approve/${data.approvalToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved }),
        }
      )
      const json = await res.json()
      if (json.success) {
        fetchTracking()
      }
    } catch (e) {
      alert('حدث خطأ أثناء إرسال الموافقة')
    }
  }

  const submitFeedback = () => {
    if (rating === 0) return
    setFeedbackSubmitted(true)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f5f6fa' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, animation: 'bounce 1s infinite', marginBottom: 12 }}>🚗</div>
          <div style={{ fontSize: 14, color: '#6b7280', fontWeight: 600 }}>جاري تحميل بيانات تتبع السيارة...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f5f6fa' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, color: '#dc2626', fontWeight: 700 }}>خطأ في الرابط</div>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{error}</p>
        </div>
      </div>
    )
  }

  const stepIdx = STATUS_STEPS.findIndex((s) => s.status === data.status)

  return (
    <div style={{ background: '#f5f6fa', minHeight: '100vh', direction: 'rtl', paddingBottom: 48 }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: '#ffffff',
          padding: '40px 20px',
          textAlign: 'center',
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 999,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          تتبع مباشر لحالة الصيانة
        </span>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
          {data.vehicle?.make} {data.vehicle?.model}
        </h1>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', opacity: 0.9, marginTop: 4 }}>
          {data.vehicle?.plateNumber}
        </div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>
          رقم الطلب: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{data.orderNumber}</span>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '20px auto 0', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Estimated Date Card */}
        {data.estimatedReadyAt && data.status !== 'DELIVERED' && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #f0f0f5',
              borderRadius: 16,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            }}
          >
            <div>
              <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>تاريخ التسليم المتوقع</span>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 2 }}>
                {new Date(data.estimatedReadyAt).toLocaleString('ar-KW', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <div style={{ fontSize: 24 }}>⏳</div>
          </div>
        )}

        {/* Quote Approval Card */}
        {data.status === 'AWAITING_APPROVAL' && data.approvalToken && (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 16,
              padding: '20px 24px',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(217,119,6,0.05)',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#92400e', margin: 0 }}>
              عرض السعر بانتظار موافقتك
            </h3>
            <p style={{ fontSize: 12, color: '#b45309', marginTop: 4, marginBottom: 16 }}>
              الرجاء مراجعة تفاصيل التكلفة أدناه والموافقة للبدء بالعمل
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => handleApproval(true)}
                style={{
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 24px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(22,163,74,0.2)',
                }}
              >
                ✅ أوافق — ابدأ العمل
              </button>
              <button
                onClick={() => handleApproval(false)}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 24px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(220,38,38,0.2)',
                }}
              >
                ❌ أرفض العرض
              </button>
            </div>
          </div>
        )}

        {/* Invoice & Payment Card */}
        {data.invoice && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #f0f0f5',
              borderRadius: 16,
              padding: '20px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>🧾</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>فاتورة الصيانة</span>
              </div>
              <button
                onClick={() => window.print()}
                style={{
                  background: '#f5f3ff',
                  border: '1px solid #e0e7ff',
                  color: '#4f46e5',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                📥 طباعة / تحميل الفاتورة
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#9ca3af' }}>رقم الفاتورة</span>
                <span style={{ fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>{data.invoice.invoiceNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#9ca3af' }}>المبلغ الإجمالي</span>
                <span style={{ fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>{Number(data.invoice.total).toFixed(3)} د.ك</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#9ca3af' }}>المبلغ المدفوع</span>
                <span style={{ fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>{Number(data.invoice.paidAmount).toFixed(3)} د.ك</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderTop: '1px dashed #f3f4f6', paddingTop: 8, marginTop: 4 }}>
                <span style={{ color: '#111827', fontWeight: 700 }}>المتبقي المطلوب</span>
                <span style={{ fontWeight: 800, color: data.invoice.status === 'PAID' ? '#16a34a' : '#ea580c', fontFamily: 'monospace' }}>
                  {data.invoice.status === 'PAID' ? 'مدفوعة بالكامل' : `${Number(data.invoice.remainingAmount).toFixed(3)} د.ك`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Quotation Item Review Table */}
        {data.items && data.items.length > 0 && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #f0f0f5',
              borderRadius: 16,
              padding: '20px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>💰</span> بنود التكلفة وقطع الغيار
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <th style={{ padding: '8px 0', fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>النوع</th>
                    <th style={{ padding: '8px 0', fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>الوصف</th>
                    <th style={{ padding: '8px 0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>الكمية</th>
                    <th style={{ padding: '8px 0', fontSize: 11, color: '#9ca3af', textAlign: 'left' }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: idx < data.items.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                      <td style={{ padding: '10px 0', fontSize: 11, fontWeight: 700, color: item.type === 'PART' ? '#00b4d8' : '#3b82f6' }}>
                        {item.type === 'PART' ? 'قطعة غيار' : 'أجور يد'}
                      </td>
                      <td style={{ padding: '10px 0', fontSize: 12, fontWeight: 600, color: '#374151' }}>
                        {item.descriptionAr || item.description}
                      </td>
                      <td style={{ padding: '10px 0', fontSize: 12, textAlign: 'center', color: '#6b7280', fontFamily: 'monospace' }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: '10px 0', fontSize: 12, fontWeight: 700, color: '#111827', textAlign: 'left', fontFamily: 'monospace' }}>
                        {Number(item.totalPrice).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f3f4f6', paddingTop: 12, marginTop: 12, fontSize: 13, fontWeight: 700 }}>
              <span style={{ color: '#111827' }}>المجموع الإجمالي</span>
              <span style={{ color: '#4f46e5', fontFamily: 'monospace' }}>{Number(data.totalAmount).toFixed(3)} د.ك</span>
            </div>
          </div>
        )}

        {/* Assigned Technician details */}
        {data.technicians && data.technicians.length > 0 && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #f0f0f5',
              borderRadius: 16,
              padding: '16px 20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>الفني المسؤول عن الإصلاح</span>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 2 }}>
                {data.technicians.map((t: any) => t.name).join(', ')}
              </div>
            </div>
            <div style={{ fontSize: 22 }}>👨‍🔧</div>
          </div>
        )}

        {/* Timeline Tracking */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #f0f0f5',
            borderRadius: 16,
            padding: '20px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 20 }}>
            مراحل صيانة السيارة
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {STATUS_STEPS.filter((s) => s.status !== 'DELIVERED' || data.status === 'DELIVERED').map((step, index) => {
              const isCompleted = index < stepIdx
              const isActive = step.status === data.status
              const isPending = index > stepIdx

              return (
                <div key={step.status} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Indicator circle */}
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: isCompleted ? '#ecfdf5' : isActive ? '#f5f3ff' : '#f9fafb',
                      border: `1.5px solid ${isCompleted ? '#a7f3d0' : isActive ? '#c7d2fe' : '#e5e7eb'}`,
                      color: isCompleted ? '#10b981' : isActive ? '#4f46e5' : '#9ca3af',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {isCompleted ? '✓' : step.icon}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: isActive ? 800 : 600,
                          color: isActive ? '#111827' : isPending ? '#9ca3af' : '#4b5563',
                        }}
                      >
                        {step.label}
                      </span>
                      {isActive && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: '#4f46e5',
                            background: '#f5f3ff',
                            border: '1px solid #e0e7ff',
                            padding: '1px 6px',
                            borderRadius: 4,
                          }}
                        >
                          الحالة الحالية
                        </span>
                      )}
                    </div>
                    {isActive && (
                      <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0 0' }}>
                        {step.desc}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Photos Gallery */}
        {data.photos && data.photos.length > 0 && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #f0f0f5',
              borderRadius: 16,
              padding: '20px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
              📸 صور توثيق حالة السيارة
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {data.photos.map((photo: any, idx: number) => (
                <div key={idx} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #f0f0f5', background: '#fafafa' }}>
                  <img src={photo.url} alt={photo.caption || 'Photo'} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                  <div style={{ padding: 8, fontSize: 10, fontWeight: 600, color: '#4b5563', textAlign: 'center' }}>
                    {photo.type === 'RECEPTION' ? 'عند الاستلام' : 'أثناء الصيانة/التسليم'} {photo.caption ? `- ${photo.caption}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feedback / Review Section */}
        {data.status === 'DELIVERED' && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 16,
              padding: '20px 24px',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(22,163,74,0.03)',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#166534', margin: 0 }}>
              ما هو تقييمك لخدمة كراجنا؟
            </h3>
            <p style={{ fontSize: 12, color: '#15803d', marginTop: 4, marginBottom: 16 }}>
              نسعد دائماً بسماع رأيك لتطوير جودة خدماتنا
            </p>

            {feedbackSubmitted ? (
              <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                ❤️ شكراً جزيلاً لتقييمك! يومك سعيد!
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                {/* Stars */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 24,
                        cursor: 'pointer',
                        outline: 'none',
                        color: rating >= star ? '#fbbf24' : '#d1d5db',
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <button
                  onClick={submitFeedback}
                  disabled={rating === 0}
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 20px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: rating === 0 ? 'not-allowed' : 'pointer',
                    opacity: rating === 0 ? 0.6 : 1,
                  }}
                >
                  إرسال التقييم
                </button>
              </div>
            )}
          </div>
        )}

        {/* Branch Info Card */}
        {data.branch && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #f0f0f5',
              borderRadius: 16,
              padding: '20px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            }}
          >
            <h3 style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 10 }}>
              معلومات الكراج والتواصل
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9ca3af' }}>الفرع</span>
                <span style={{ fontWeight: 700, color: '#374151' }}>{data.branch.nameAr || data.branch.name}</span>
              </div>
              {data.branch.phone && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9ca3af' }}>رقم التواصل</span>
                  <a href={`tel:${data.branch.phone}`} style={{ fontWeight: 700, color: '#4f46e5', textDecoration: 'none' }}>
                    {data.branch.phone}
                  </a>
                </div>
              )}
              {data.branch.address && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9ca3af' }}>العنوان</span>
                  <span style={{ fontWeight: 700, color: '#374151' }}>{data.branch.address}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
