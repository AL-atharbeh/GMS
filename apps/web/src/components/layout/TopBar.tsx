'use client'

import { useAuthStore } from '@/lib/stores/authStore'
import { useEffect, useState, useRef } from 'react'
import api from '@/lib/api'
import Link from 'next/link'

interface TopBarProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

interface InAppNotification {
  id: string
  title: string
  body: string
  type: string
  sourceType: string
  isRead: boolean
  createdAt: string
}

export default function TopBar({ title, subtitle, actions }: TopBarProps) {
  const { tenant } = useAuthStore()
  
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
    
    // Refresh notifications every 60 seconds
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data.data || [])
    } catch (err) {
      console.error('Error fetching notifications:', err)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      )
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length
  const recentNotifications = notifications.slice(0, 5)

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: '#f5f6fa',
        borderBottom: '1px solid #eeeff4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        height: 64,
        flexShrink: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Left: Title */}
      <div style={{ textAlign: 'right' }}>
        <h1
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: '#111827',
            margin: 0,
            letterSpacing: '-0.3px',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 11.5, color: '#9ca3af', margin: '2px 0 0', fontWeight: 600 }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }} ref={dropdownRef}>
        {actions}

        {/* Trial Badge */}
        {tenant?.status === 'TRIAL' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 8,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              fontSize: 11.5,
              fontWeight: 700,
              color: '#b45309',
            }}
          >
            <span>🟡</span>
            <span>
              تجريبي — {tenant.trialEndsAt ? Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86400000) : 14} يوم
            </span>
          </div>
        )}

        {/* Notifications Icon Button */}
        <button
          onClick={() => setShowDropdown(prev => !prev)}
          style={{
            position: 'relative',
            width: 38,
            height: 38,
            borderRadius: 10,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: showDropdown ? '#4f46e5' : '#6b7280',
            transition: 'all 0.15s ease',
            outline: 'none',
            boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#d1d5db'
            e.currentTarget.style.background = '#f9fafb'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#e5e7eb'
            e.currentTarget.style.background = '#ffffff'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          
          {/* Badge */}
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -5,
                right: -5,
                background: '#ef4444',
                color: '#ffffff',
                fontSize: 10,
                fontWeight: 800,
                borderRadius: 50,
                minWidth: 17,
                height: 17,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #f5f6fa',
                padding: '0 3px',
                boxSizing: 'border-box',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              width: 320,
              background: '#ffffff',
              border: '1px solid #eeeff4',
              borderRadius: 16,
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
              overflow: 'hidden',
              zIndex: 100,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>الإشعارات ({unreadCount})</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
                >
                  تعيين الكل كمقروء
                </button>
              )}
            </div>

            {/* List */}
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {recentNotifications.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
                  <span style={{ fontSize: 24, display: 'block', marginBottom: 6 }}>🔔</span>
                  لا توجد إشعارات حالية.
                </div>
              ) : (
                recentNotifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => handleMarkAsRead(n.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: n.isRead ? 'transparent' : '#f0f3ff50',
                      transition: 'background 0.15s ease',
                      position: 'relative',
                      textAlign: 'right',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = n.isRead ? 'transparent' : '#f0f3ff50'}
                  >
                    {/* Unread indicator dot */}
                    {!n.isRead && (
                      <span
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: 18,
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#4f46e5',
                        }}
                      />
                    )}
                    <div style={{ paddingRight: !n.isRead ? 12 : 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: n.isRead ? 600 : 800, color: '#1e293b', marginBottom: 2 }}>{n.title}</div>
                      <p style={{ margin: 0, fontSize: 11.5, color: '#64748b', lineHeight: 1.5 }}>{n.body}</p>
                      <span style={{ fontSize: 9.5, color: '#94a3b8', display: 'block', marginTop: 4 }}>
                        {new Date(n.createdAt).toLocaleDateString('ar-KW')} {new Date(n.createdAt).toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: 10, borderTop: '1px solid #f1f5f9', background: '#f8fafc', textAlign: 'center' }}>
              <Link
                href="/notifications"
                onClick={() => setShowDropdown(false)}
                style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5', textDecoration: 'none', display: 'block' }}
              >
                مشاهدة جميع الإشعارات 🔗
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
