'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

interface Announcement {
  id: string
  title: string
  titleAr?: string
  content: string
  contentAr?: string
  targetType: string
  sentAt?: string
  createdAt: string
}

export default function AnnouncementsPage() {
  const { isAuthenticated, isHydrated } = useAuthStore()
  const router = useRouter()
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    fetchAnnouncements()
  }, [isAuthenticated, isHydrated])

  const fetchAnnouncements = async () => {
    try {
      setLoading(true)
      const res = await api.get('/support/announcements')
      setAnnouncements(res.data.data || [])
    } catch (err) {
      console.error('Error fetching announcements:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isHydrated) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar
          title="إعلانات وتحديثات المنصة"
          subtitle="تابع هنا آخر الأخبار، تحديثات النظام، وتنبيهات الإدارة العامة"
        />

        <div style={{ padding: '24px 28px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loading ? (
            <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: '60px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              جاري تحميل إعلانات المنصة...
            </div>
          ) : announcements.length === 0 ? (
            <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: '80px 40px', textAlign: 'center', color: '#94a3b8', boxShadow: '0 4px 18px rgba(0,0,0,0.01)' }}>
              <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>📢</span>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#475569' }}>لا توجد إعلانات نشطة حالياً</div>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8' }}>سيظهر هنا أي إعلان أو إشعار رسمي يتم بثه من الإدارة العامة للمنصة.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 840 }}>
              {/* Introduction Announcement Box */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                  borderRadius: 20,
                  padding: '24px 30px',
                  color: '#ffffff',
                  boxShadow: '0 10px 25px rgba(79, 70, 229, 0.15)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>مركز إعلانات المشتركين 📢</h2>
                  <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.9, lineHeight: 1.6 }}>
                    نحن نعمل باستمرار على تحسين وتطوير المنصة. هنا تجد كل الإعلانات الرسمية والتنبيهات الموجهة لحساب كراجك لتكون على اطلاع بكل جديد.
                  </p>
                </div>
                {/* Decorative background shape */}
                <div style={{ position: 'absolute', right: '-40px', top: '-40px', width: 140, height: 140, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)', zIndex: 1 }} />
              </div>

              {/* Announcements Feed */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {announcements.map((ann, idx) => (
                  <div
                    key={ann.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #eeeff4',
                      borderRadius: 18,
                      padding: '24px',
                      display: 'flex',
                      gap: 20,
                      boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      borderLeft: '4px solid #f59e0b', // Highlight line
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.04)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none'
                      e.currentTarget.style.boxShadow = '0 4px 18px rgba(0, 0, 0, 0.02)'
                    }}
                  >
                    {/* Announcement Icon container */}
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: '#fffbeb',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        flexShrink: 0,
                        boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)',
                      }}
                    >
                      📢
                    </div>

                    {/* Announcement Content */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
                          {ann.titleAr || ann.title}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
                          <span>📅</span>
                          <span>
                            {new Date(ann.sentAt || ann.createdAt).toLocaleString('ar-KW', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <p style={{ margin: 0, fontSize: 13.5, color: '#475569', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                        {ann.contentAr || ann.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
