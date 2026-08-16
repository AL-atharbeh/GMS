'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useLanguageStore } from '@/lib/stores/languageStore'
import { useT } from '@/lib/i18n'
import LanguageToggle from '@/components/layout/LanguageToggle'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()
  const { lang } = useLanguageStore()
  const t = useT()
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  // Strictly lock html & body scroll when on the login page to guarantee NO scrolling
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow
    const originalHtmlOverflow = document.documentElement.style.overflow
    const originalBodyHeight = document.body.style.height
    const originalHtmlHeight = document.documentElement.style.height

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.height = '100vh'
    document.documentElement.style.height = '100vh'

    return () => {
      document.body.style.overflow = originalBodyOverflow || 'unset'
      document.documentElement.style.overflow = originalHtmlOverflow || 'unset'
      document.body.style.height = originalBodyHeight || 'unset'
      document.documentElement.style.height = originalHtmlHeight || 'unset'
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(form.email, form.password)
      router.push('/dashboard')
    } catch (err: any) {
      let errMsg = err?.response?.data?.message
      if (errMsg === 'Invalid email or password') {
        errMsg = t('login.invalidCreds')
      }
      setError(errMsg || t('login.genericError'))
    }
  }

  return (
    <div
      dir={dir}
      style={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        display: 'flex',
        fontFamily: 'var(--font-cairo), sans-serif',
        boxSizing: 'border-box',
        background: '#f5f7fb',
      }}
    >
      {/* Brand Panel */}
      <div
        style={{
          flex: '0 0 44%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 44px',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(160deg, #03045E 0%, #0077B6 65%, #00B4D8 100%)',
          color: '#fff',
        }}
        className="hidden md:flex"
      >
        <div
          style={{
            position: 'absolute',
            width: 420,
            height: 420,
            borderRadius: '50%',
            top: -140,
            insetInlineEnd: -140,
            background: 'radial-gradient(circle, rgba(144,224,239,0.35), transparent 70%)',
            filter: 'blur(10px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 320,
            height: 320,
            borderRadius: '50%',
            bottom: -100,
            insetInlineStart: -100,
            background: 'radial-gradient(circle, rgba(0,180,216,0.3), transparent 70%)',
            filter: 'blur(10px)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="/warshatak_logo.png"
            style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }}
            alt="Warshatak"
          />
          <span style={{ fontSize: 20, fontWeight: 900 }}>Warshatak</span>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.35, margin: '0 0 14px 0' }}>
            {lang === 'ar' ? 'أدر ورشتك بذكاء، من الاستلام إلى التسليم' : 'Run your workshop smarter — from intake to delivery'}
          </h1>
          <p style={{ fontSize: 13.5, opacity: 0.85, lineHeight: 1.8, margin: 0, maxWidth: 380 }}>
            {lang === 'ar'
              ? 'منصة سحابية متكاملة لإدارة طلبات الخدمة، الفنيين، المخزون، والفواتير في مكان واحد.'
              : 'One cloud platform to manage work orders, technicians, inventory, and invoicing.'}
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 1, fontSize: 11, opacity: 0.6 }}>
          © {new Date().getFullYear()} Warshatak
        </div>
      </div>

      {/* Form Panel */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: 20, insetInlineEnd: 24 }}>
          <LanguageToggle />
        </div>

        <div style={{ width: '100%', maxWidth: 360 }}>
          <div className="flex md:hidden" style={{ alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <img
              src="/warshatak_logo.png"
              style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }}
              alt="Warshatak"
            />
            <span style={{ fontSize: 17, fontWeight: 900, color: '#03045E' }}>Warshatak</span>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#03045E', margin: '0 0 4px 0' }}>
            {t('login.title')}
          </h2>
          <p style={{ fontSize: 12, color: '#0077B6', fontWeight: 700, margin: '0 0 28px 0' }}>
            {t('login.subtitle')}
          </p>

          {error && (
            <div
              style={{
                borderRadius: 14,
                fontSize: 11.5,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#b91c1c',
                padding: '10px 14px',
                marginBottom: 16,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  fontWeight: 800,
                  color: '#03045E',
                  marginBottom: 6,
                }}
              >
                {t('login.email')}
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="example@garage.com"
                required
                style={{
                  width: '100%',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1.5px solid #e2e8f0',
                  background: '#f8fafc',
                  outline: 'none',
                  color: '#03045E',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s',
                }}
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  fontWeight: 800,
                  color: '#03045E',
                  marginBottom: 6,
                }}
              >
                {t('login.password')}
              </label>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '12px 44px 12px 16px',
                    borderRadius: 12,
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    outline: 'none',
                    color: '#03045E',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s',
                  }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    insetInlineEnd: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: 4,
                  }}
                >
                  {showPass ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            <button
              id="login-btn"
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #03045E, #0077B6)',
                color: '#fff',
                border: 'none',
                outline: 'none',
                fontWeight: 800,
                fontSize: 13.5,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.75 : 1,
                boxShadow: '0 10px 24px rgba(3, 4, 94, 0.22)',
                transition: 'all 0.2s',
              }}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg className="animate-spin" style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('login.loading')}
                </span>
              ) : (
                t('login.submit')
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
