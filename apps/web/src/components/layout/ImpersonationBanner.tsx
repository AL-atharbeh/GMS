'use client'

import { useEffect, useState } from 'react'

export default function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [tenantName, setTenantName] = useState('')

  useEffect(() => {
    // Check local storage for impersonation tokens/flag
    const checkImpersonation = () => {
      if (typeof window !== 'undefined') {
        const originalToken = localStorage.getItem('originalAdminToken')
        const tenantDataStr = localStorage.getItem('tenant')
        if (originalToken && tenantDataStr) {
          try {
            const tenantObj = JSON.parse(tenantDataStr)
            setTenantName(tenantObj.nameAr || tenantObj.name || '')
            setIsImpersonating(true)
          } catch {
            setIsImpersonating(true)
          }
        } else {
          setIsImpersonating(false)
        }
      }
    }

    checkImpersonation()
    
    // Listen for custom events or storage updates to keep it in sync
    window.addEventListener('storage', checkImpersonation)
    return () => window.removeEventListener('storage', checkImpersonation)
  }, [])

  const handleExitImpersonation = () => {
    if (typeof window !== 'undefined') {
      const originalToken = localStorage.getItem('originalAdminToken')
      if (originalToken) {
        // Restore super admin token
        localStorage.setItem('accessToken', originalToken)
        localStorage.removeItem('originalAdminToken')
        localStorage.removeItem('isImpersonating')
        
        // Clear cached tenant info of the impersonated tenant
        localStorage.removeItem('tenant')
        localStorage.removeItem('user')
        localStorage.removeItem('branch')
        localStorage.removeItem('gms-auth')
        
        // Redirect back to Super Admin portal
        window.location.href = '/super-admin'
      }
    }
  }

  if (!isImpersonating) return null

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, #ea580c 0%, #dc2626 100%)',
        color: '#ffffff',
        padding: '10px 20px',
        fontSize: '13px',
        fontWeight: '700',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 99999,
        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
        direction: 'rtl',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'right' }}>
        <span style={{ fontSize: '16px' }}>👁️‍🗨️</span>
        <span>
          وضع المشاهدة النشط: أنت تتصفح حالياً حساب الكراج{' '}
          <strong style={{ color: '#fef08a', textDecoration: 'underline' }}>{tenantName}</strong>. 
          جميع العمليات التي تقوم بها موثقة في سجل التدقيق الأمني للمنصة.
        </span>
      </div>
      <button
        onClick={handleExitImpersonation}
        style={{
          background: '#ffffff',
          color: '#dc2626',
          border: 'none',
          borderRadius: '8px',
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: '800',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s',
          whiteSpace: 'nowrap',
          marginRight: '15px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#fef2f2'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#ffffff'
        }}
      >
        إنهاء المشاهدة والعودة للوحة الإدارة ↩️
      </button>
    </div>
  )
}
