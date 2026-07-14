'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useState, useEffect, useRef } from 'react'

// SVG Icons matching the reference image style
const Icons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  workOrders: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  vehicles: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/>
      <circle cx="7" cy="17" r="2"/>
      <circle cx="17" cy="17" r="2"/>
    </svg>
  ),
  customers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  appointments: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  inventory: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.5 4.27 9 5.15"/>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <path d="m3.3 7 8.7 5 8.7-5"/>
      <path d="M12 22V12"/>
    </svg>
  ),
  suppliers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
      <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/>
      <path d="M12 3v6"/>
    </svg>
  ),
  purchaseOrders: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1"/>
      <circle cx="19" cy="21" r="1"/>
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
    </svg>
  ),
  invoices: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  payments: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  reports: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  technicians: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M20 21a8 8 0 1 0-16 0"/>
    </svg>
  ),
  support: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  announcement: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  chevronLeft: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  chevronRight: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
}

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: '/dashboard', icon: 'dashboard', label: 'لوحة التحكم', roles: ['GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT'] },
      { href: '/technician-dashboard', icon: 'workOrders', label: 'مهامي اليومية', roles: ['TECHNICIAN'] },
    ],
  },
  {
    label: 'العمليات',
    items: [
      { href: '/work-orders', icon: 'workOrders', label: 'طلبات الخدمة', badge: null, roles: ['GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'] },
      { href: '/vehicles', icon: 'vehicles', label: 'السيارات', roles: ['GARAGE_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'] },
      { href: '/customers', icon: 'customers', label: 'العملاء', roles: ['GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT'] },
      { href: '/appointments', icon: 'appointments', label: 'المواعيد', roles: ['GARAGE_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'] },
    ],
  },
  {
    label: 'المخزون',
    items: [
      { href: '/inventory', icon: 'inventory', label: 'المخزون', roles: ['GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT'] },
      { href: '/suppliers', icon: 'suppliers', label: 'الموردون', roles: ['GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT'] },
      { href: '/purchase-orders', icon: 'purchaseOrders', label: 'طلبات الشراء', roles: ['GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT'] },
    ],
  },
  {
    label: 'المالية',
    items: [
      { href: '/invoices', icon: 'invoices', label: 'الفواتير', roles: ['GARAGE_OWNER', 'ACCOUNTANT'] },
      { href: '/payments', icon: 'payments', label: 'المدفوعات', roles: ['GARAGE_OWNER', 'ACCOUNTANT'] },
      { href: '/reports', icon: 'reports', label: 'التقارير', roles: ['GARAGE_OWNER', 'ACCOUNTANT'] },
    ],
  },
  {
    label: 'الفريق',
    items: [
      { href: '/technicians', icon: 'technicians', label: 'الفنيون', roles: ['GARAGE_OWNER', 'BRANCH_MANAGER'] },
      { href: '/users', icon: 'users', label: 'المستخدمون', roles: ['GARAGE_OWNER'] },
    ],
  },
  {
    label: 'الدعم',
    items: [
      { href: '/support', icon: 'support', label: 'الدعم الفني', roles: ['GARAGE_OWNER', 'BRANCH_MANAGER'] },
      { href: '/announcements', icon: 'announcement', label: 'إعلانات المنصة', roles: ['GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'] },
      { href: '/notifications', icon: 'announcement', label: 'الإشعارات', roles: ['GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'] },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const navRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  // Scroll preservation and active item auto-scrolling
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return

    // Restore scroll position from sessionStorage
    const savedScroll = sessionStorage.getItem('sidebar-scroll')
    if (savedScroll) {
      nav.scrollTop = parseInt(savedScroll, 10)
    } else {
      // Fallback: auto scroll active item into view
      const activeItem = nav.querySelector('.sidebar-nav-item.active')
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' })
      }
    }

    // Save scroll position on scroll
    const handleScroll = () => {
      sessionStorage.setItem('sidebar-scroll', nav.scrollTop.toString())
    }

    nav.addEventListener('scroll', handleScroll)
    return () => {
      nav.removeEventListener('scroll', handleScroll)
    }
  }, [pathname])

  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !user?.role || item.roles.includes(user.role)
    ),
  })).filter((group) => group.items.length > 0)

  const NavItem = ({ item }: { item: typeof NAV_GROUPS[0]['items'][0] }) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
    const icon = Icons[item.icon as keyof typeof Icons]

    return (
      <Link
        href={item.href}
        className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
        title={collapsed ? item.label : undefined}
        style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
      >
        {/* Icon */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            borderRadius: 10,
            background: isActive ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
            color: isActive ? '#4f46e5' : '#9ca3af',
            flexShrink: 0,
            transition: 'all 0.18s ease',
          }}
        >
          {icon}
        </span>

        {/* Label */}
        {!collapsed && (
          <span style={{ fontSize: 13.5, fontWeight: isActive ? 700 : 500 }}>
            {item.label}
          </span>
        )}

        {/* Tooltip when collapsed */}
        {collapsed && (
          <div
            style={{
              position: 'absolute',
              right: 'calc(100% + 12px)',
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#1f2937',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 8,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              opacity: 0,
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'opacity 0.15s ease',
            }}
            className="sidebar-tooltip"
          >
            {item.label}
          </div>
        )}
      </Link>
    )
  }

  return (
    <>
      <style>{`
        .sidebar-nav-item:hover .sidebar-tooltip { opacity: 1 !important; }
      `}</style>

      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''}`}
        style={{
          width: collapsed ? 72 : 240,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* ── Logo & Toggle ─────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: '20px 16px 16px',
            borderBottom: '1px solid #f3f4f6',
            flexShrink: 0,
          }}
        >
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src="/warshatak_logo.png"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  objectFit: 'cover',
                }}
                alt="Warshatak"
              />
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#111827',
                  letterSpacing: '-0.3px',
                  fontFamily: "'Almarai', system-ui",
                }}
              >
                Warshatak
              </span>
            </div>
          )}
          {collapsed && (
            <img
              src="/warshatak_logo.png"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                objectFit: 'cover',
              }}
              alt="Warshatak"
            />
          )}

          {/* Toggle button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#6b7280',
              flexShrink: 0,
              transition: 'all 0.15s ease',
              outline: 'none',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#374151'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#fff'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#6b7280'
            }}
          >
            {collapsed ? Icons.chevronRight : Icons.chevronLeft}
          </button>
        </div>

        {/* ── User Profile ──────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? '14px 0' : '14px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderBottom: '1px solid #f3f4f6',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 13,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>

          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#111827',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.name || 'المستخدم'}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
                {user?.role === 'GARAGE_OWNER' ? 'مالك الكراج' :
                 user?.role === 'BRANCH_MANAGER' ? 'مدير الفرع' :
                 user?.role === 'ACCOUNTANT' ? 'المحاسب' :
                 user?.role === 'RECEPTIONIST' ? 'موظف الاستقبال' : 'فني'}
              </div>
            </div>
          )}
        </div>

        <nav
          ref={navRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '12px 8px',
            scrollbarWidth: 'none',
          }}
        >
          {filteredGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 8 }}>
              {/* Section label */}
              {group.label && !collapsed && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#d1d5db',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '8px 12px 4px',
                    userSelect: 'none',
                  }}
                >
                  {group.label}
                </div>
              )}

              {/* Items */}
              {group.items.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </div>
          ))}
        </nav>

        {/* ── Bottom: Settings + Logout ─────────── */}
        <div
          style={{
            padding: '8px 8px 16px',
            borderTop: '1px solid #f3f4f6',
            flexShrink: 0,
          }}
        >
          {(!user?.role || user.role === 'GARAGE_OWNER') && (
            <Link
              href="/settings/garage"
              className={`sidebar-nav-item ${pathname.startsWith('/settings') ? 'active' : ''}`}
              style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
              title={collapsed ? 'الإعدادات' : undefined}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: pathname.startsWith('/settings') ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                  color: pathname.startsWith('/settings') ? '#4f46e5' : '#9ca3af',
                  flexShrink: 0,
                  transition: 'all 0.18s ease',
                }}
              >
                {Icons.settings}
              </span>
              {!collapsed && <span style={{ fontSize: 13.5, fontWeight: 500 }}>الإعدادات</span>}
            </Link>
          )}

          <button
            onClick={logout}
            className="sidebar-nav-item"
            style={{
              width: '100%',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: '#9ca3af',
            }}
            title={collapsed ? 'تسجيل خروج' : undefined}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af'
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: 10,
                flexShrink: 0,
                transition: 'all 0.18s ease',
              }}
            >
              {Icons.logout}
            </span>
            {!collapsed && <span style={{ fontSize: 13.5, fontWeight: 500 }}>تسجيل خروج</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
