'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()
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
        errMsg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      }
      setError(errMsg || 'فشل تسجيل الدخول، تحقق من البيانات')
    }
  }

  return (
    <div
      className="relative flex items-center justify-center p-4"
      style={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #CAF0F8 0%, #90E0EF 45%, #0077B6 100%)',
        fontFamily: 'var(--font-cairo), sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Decorative Art Elements to give frosted glass visibility */}
      <div 
        className="absolute w-[500px] h-[500px] rounded-full opacity-35 blur-3xl"
        style={{
          top: '-15%',
          left: '10%',
          background: 'radial-gradient(circle, #00B4D8, transparent 75%)',
        }}
      />
      <div 
        className="absolute w-[500px] h-[500px] rounded-full opacity-40 blur-3xl"
        style={{
          bottom: '-15%',
          right: '5%',
          background: 'radial-gradient(circle, #90E0EF, transparent 75%)',
        }}
      />

      {/* Main Glassmorphic Card */}
      <div
        className="w-full relative z-10 flex flex-col justify-between"
        style={{
          width: '100%',
          maxWidth: '430px',
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.6)',
          borderRadius: '30px',
          boxShadow: '0 25px 60px -12px rgba(3, 4, 94, 0.14)',
          padding: '28px 24px',
          direction: 'rtl',
          boxSizing: 'border-box',
        }}
      >
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center" style={{ marginBottom: '15px' }}>
          <img
            src="/warshatak_logo.png"
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              marginBottom: '10px',
              objectFit: 'cover',
            }}
            alt="Warshatak Logo"
          />
          <h2 className="text-xl font-black text-[#03045E]" style={{ margin: '0 0 3px 0' }}>
            تسجيل الدخول للنظام 🔐
          </h2>
          <p className="text-[10px] text-[#0077B6] font-bold" style={{ margin: 0 }}>
            نظام إدارة الكراج الذكي والسحابي Warshatak
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div 
            className="rounded-2xl text-[11px] font-bold flex items-center gap-2 text-red-700"
            style={{
              padding: '8px 12px',
              marginBottom: '12px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5" style={{ width: '100%' }}>
          
          <div style={{ marginBottom: '12px' }}>
            <label 
              className="block text-[11px] font-extrabold text-[#03045E]"
              style={{ marginBottom: '6px', paddingRight: '6px' }}
            >
              البريد الإلكتروني
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
                fontSize: '12px',
                fontWeight: '600',
                padding: '11px 18px',
                borderRadius: '9999px',
                border: '1px solid rgba(3, 4, 94, 0.15)',
                background: 'rgba(255, 255, 255, 0.8)',
                outline: 'none',
                color: '#03045E',
                boxSizing: 'border-box',
                transition: 'all 0.2s',
              }}
              className="focus:bg-white focus:border-[#0077B6] focus:ring-4 focus:ring-[#0077B6]/10"
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label 
              className="block text-[11px] font-extrabold text-[#03045E]"
              style={{ marginBottom: '6px', paddingRight: '6px' }}
            >
              كلمة المرور
            </label>
            <div className="relative" style={{ width: '100%', position: 'relative' }}>
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  fontSize: '12px',
                  fontWeight: '600',
                  padding: '11px 18px',
                  paddingLeft: '45px', // Space for the eye icon inside the input
                  borderRadius: '9999px',
                  border: '1px solid rgba(3, 4, 94, 0.15)',
                  background: 'rgba(255, 255, 255, 0.8)',
                  outline: 'none',
                  color: '#03045E',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s',
                }}
                className="focus:bg-white focus:border-[#0077B6] focus:ring-4 focus:ring-[#0077B6]/10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  zIndex: 10,
                  padding: '4px',
                  margin: 0,
                  fontSize: '13px',
                }}
              >
                {showPass ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          {/* Centered / Sakura style Pay Button */}
          <div className="flex justify-center" style={{ marginTop: '18px', marginBottom: '18px' }}>
            <button
              id="login-btn"
              type="submit"
              disabled={isLoading}
              style={{
                padding: '10px 32px',
                borderRadius: '9999px',
                background: '#03045E',
                color: '#ffffff',
                border: 'none',
                outline: 'none',
                fontWeight: '900',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 8px 20px rgba(3, 4, 94, 0.2)',
                alignSelf: 'center',
              }}
              className="hover:bg-[#0077B6] hover:-translate-y-0.5 active:translate-y-0"
            >
              {isLoading ? (
                <span className="flex items-center gap-2 justify-center">
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري التحقق...
                </span>
              ) : (
                'دخول للنظام ←'
              )}
            </button>
          </div>
        </form>



        {/* Footer Link */}
        <div className="text-center pt-3 border-t border-white/20" style={{ marginTop: '5px' }}>
          <span className="text-[11px] text-[#03045E] font-bold">
            هل أنت كراج جديد؟{' '}
            <Link
              href="/register"
              className="text-[#0077B6] hover:text-[#03045E] transition-colors font-black underline underline-offset-4"
            >
              سجل معنا الآن مجاناً
            </Link>
          </span>
        </div>

      </div>
    </div>
  )
}
