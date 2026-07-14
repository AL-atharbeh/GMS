'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

interface InAppNotification {
  id: string
  title: string
  body: string
  type: string
  sourceType: string
  isRead: boolean
  createdAt: string
}

export default function NotificationsPage() {
  const { isAuthenticated, isHydrated } = useAuthStore()
  const router = useRouter()
  
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL')

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    fetchNotifications()
  }, [isAuthenticated, isHydrated])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const res = await api.get('/notifications')
      setNotifications(res.data.data || [])
    } catch (err) {
      console.error('Error fetching notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      )
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      alert('تم تحديد جميع الإشعارات كمقروءة ✅')
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'UNREAD') return !n.isRead
    return true
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  if (!isHydrated) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar
          title="الإشعارات والتنبيهات"
          subtitle="تابع الإشعارات والرسائل التنبيهية الخاصة بنظامك"
          actions={
            unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                style={{
                  padding: '9px 18px',
                  borderRadius: 10,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#4f46e5',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
              >
                ✔️ تعيين الكل كمقروء
              </button>
            )
          }
        />

        <div style={{ padding: '24px 28px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Filter Toolbar */}
          <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid #eeeff4', paddingBottom: 12 }}>
            <button
              onClick={() => setFilter('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: filter === 'ALL' ? '#e0e7ff' : 'transparent',
                color: filter === 'ALL' ? '#3730a3' : '#64748b',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              الكل ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('UNREAD')}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: filter === 'UNREAD' ? '#fee2e2' : 'transparent',
                color: filter === 'UNREAD' ? '#991b1b' : '#64748b',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              غير المقروءة ({unreadCount})
            </button>
          </div>

          {/* List Feed */}
          {loading ? (
            <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              جاري تحميل الإشعارات...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div style={{ background: '#ffffff', border: '1px solid #eeeff4', borderRadius: 16, padding: '60px 40px', textAlign: 'center', color: '#94a3b8' }}>
              <span style={{ fontSize: 44, display: 'block', marginBottom: 12 }}>🔔</span>
              لا توجد إشعارات لعرضها في هذا الفلتر.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 800 }}>
              {filteredNotifications.map(n => (
                <div
                  key={n.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #eeeff4',
                    borderRadius: 16,
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    borderRight: n.isRead ? '4px solid #cbd5e1' : '4px solid #4f46e5',
                  }}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    {/* Icon based on source type */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: n.sourceType === 'ANNOUNCEMENT' ? '#fef3c7' : '#e0f2fe',
                        color: n.sourceType === 'ANNOUNCEMENT' ? '#d97706' : '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      {n.sourceType === 'ANNOUNCEMENT' ? '📢' : '🔔'}
                    </div>

                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: n.isRead ? 700 : 900, color: '#1e293b', marginBottom: 4 }}>
                        {n.title}
                        {!n.isRead && (
                          <span style={{ fontSize: 9.5, background: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: 4, marginRight: 8, fontWeight: 800 }}>
                            جديد
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: '#475569', lineHeight: 1.6 }}>{n.body}</p>
                      <span style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginTop: 6 }}>
                        {new Date(n.createdAt).toLocaleDateString('ar-KW')} - {new Date(n.createdAt).toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {!n.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(n.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        color: '#64748b',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#4f46e5'
                        e.currentTarget.style.color = '#4f46e5'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#e2e8f0'
                        e.currentTarget.style.color = '#64748b'
                      }}
                    >
                      ✔️ مقروء
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
