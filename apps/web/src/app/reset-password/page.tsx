'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isInvite, setIsInvite] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)

  // Password requirements state
  const isMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const doPasswordsMatch = password === confirmPassword && password !== ''

  const isPasswordValid = isMinLength && hasUppercase && hasLowercase && hasNumber && doPasswordsMatch

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      setEmail(params.get('email') || '')
      setIsInvite(params.get('invite') === 'true')
    }
  }, [])

  // Strictly lock html & body scroll when on the reset page to guarantee NO scrolling
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
    if (!isPasswordValid) return

    setError('')
    setIsLoading(true)

    try {
      await api.post('/auth/reset-password', {
        email,
        password,
      })
      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err: any) {
      let errMsg = err?.response?.data?.message
      if (errMsg === 'USER_NOT_FOUND') {
        errMsg = 'لم يتم العثور على حساب بهذا البريد الإلكتروني'
      }
      setError(errMsg || 'فشل تحديث كلمة المرور، يرجى المحاولة لاحقاً')
    } finally {
      setIsLoading(false)
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
      {/* Background Decorative Art Elements */}
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
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-base font-black text-white shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #03045E, #0077B6)',
              marginBottom: '10px',
            }}
          >
            G
          </div>
          <h2 className="text-xl font-black text-[#03045E]" style={{ margin: '0 0 3px 0' }}>
            {isInvite ? 'تفعيل الحساب وتعيين كلمة المرور 🔐' : 'إعادة تعيين كلمة المرور 🔑'}
          </h2>
          <p className="text-[10px] text-[#0077B6] font-bold" style={{ margin: 0 }}>
            {isInvite ? 'أهلاً بك في نظام إدارة الكراج GMS' : 'قم بكتابة كلمة مرور جديدة لحسابك'}
          </p>
        </div>

        {/* Success / Redirect Alert */}
        {success ? (
          <div 
            className="rounded-2xl text-[12px] font-bold text-green-800 text-center flex flex-col items-center justify-center py-6 gap-2"
            style={{
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              marginBottom: '12px',
            }}
          >
            <span className="text-2xl">🎉</span>
            <span>تم تعيين كلمة المرور بنجاح!</span>
            <span className="text-[10px] text-green-700/80 mt-1">جاري توجيهك لصفحة تسجيل الدخول...</span>
          </div>
        ) : (
          <>
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
            <form onSubmit={handleSubmit} className="space-y-3" style={{ width: '100%' }}>
              
              {/* Email (Readonly) */}
              <div style={{ marginBottom: '10px' }}>
                <label 
                  className="block text-[11px] font-extrabold text-[#03045E]"
                  style={{ marginBottom: '6px', paddingRight: '6px' }}
                >
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  style={{
                    width: '100%',
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '11px 18px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(3, 4, 94, 0.08)',
                    background: 'rgba(255, 255, 255, 0.5)',
                    outline: 'none',
                    color: '#8e9aaf',
                    boxSizing: 'border-box',
                    cursor: 'not-allowed',
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: '10px' }}>
                <label 
                  className="block text-[11px] font-extrabold text-[#03045E]"
                  style={{ marginBottom: '6px', paddingRight: '6px' }}
                >
                  كلمة المرور الجديدة
                </label>
                <div className="relative" style={{ width: '100%', position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      width: '100%',
                      fontSize: '12px',
                      fontWeight: '600',
                      padding: '11px 18px',
                      paddingLeft: '45px',
                      borderRadius: '9999px',
                      border: '1px solid rgba(3, 4, 94, 0.15)',
                      background: 'rgba(255, 255, 255, 0.8)',
                      outline: 'none',
                      color: '#03045E',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                    }}
                    className="focus:bg-white focus:border-[#0077B6] focus:ring-4 focus:ring-[#0077B6]/10"
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
                      fontSize: '13px',
                    }}
                  >
                    {showPass ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: '12px' }}>
                <label 
                  className="block text-[11px] font-extrabold text-[#03045E]"
                  style={{ marginBottom: '6px', paddingRight: '6px' }}
                >
                  تأكيد كلمة المرور الجديدة
                </label>
                <div className="relative" style={{ width: '100%', position: 'relative' }}>
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      width: '100%',
                      fontSize: '12px',
                      fontWeight: '600',
                      padding: '11px 18px',
                      paddingLeft: '45px',
                      borderRadius: '9999px',
                      border: '1px solid rgba(3, 4, 94, 0.15)',
                      background: 'rgba(255, 255, 255, 0.8)',
                      outline: 'none',
                      color: '#03045E',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                    }}
                    className="focus:bg-white focus:border-[#0077B6] focus:ring-4 focus:ring-[#0077B6]/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
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
                      fontSize: '13px',
                    }}
                  >
                    {showConfirmPass ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              {/* Password strength checklist */}
              <div 
                style={{ 
                  padding: '10px 14px', 
                  borderRadius: '16px', 
                  background: 'rgba(255, 255, 255, 0.25)', 
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  marginBottom: '14px',
                }}
              >
                <span className="block text-[10px] font-extrabold text-[#03045E] mb-1.5">
                  شروط كلمة المرور:
                </span>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[9px] font-bold text-[#03045E]">
                  <div className="flex items-center gap-1">
                    <span>{isMinLength ? '🟢' : '⚪'}</span>
                    <span>8 خانات على الأقل</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>{hasUppercase ? '🟢' : '⚪'}</span>
                    <span>حرف كبير (A-Z)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>{hasLowercase ? '🟢' : '⚪'}</span>
                    <span>حرف صغير (a-z)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>{hasNumber ? '🟢' : '⚪'}</span>
                    <span>رقم واحد على الأقل</span>
                  </div>
                  <div className="flex items-center gap-1 col-span-2">
                    <span>{doPasswordsMatch ? '🟢' : '⚪'}</span>
                    <span>كلمتا المرور متطابقتان</span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center" style={{ marginTop: '14px' }}>
                <button
                  type="submit"
                  disabled={isLoading || !isPasswordValid}
                  style={{
                    padding: '10px 32px',
                    borderRadius: '9999px',
                    background: isPasswordValid ? '#03045E' : '#8e9aaf',
                    color: '#ffffff',
                    border: 'none',
                    outline: 'none',
                    fontWeight: '900',
                    fontSize: '12px',
                    cursor: isPasswordValid && !isLoading ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    boxShadow: isPasswordValid ? '0 8px 20px rgba(3, 4, 94, 0.2)' : 'none',
                    alignSelf: 'center',
                  }}
                  className={isPasswordValid ? 'hover:bg-[#0077B6] hover:-translate-y-0.5 active:translate-y-0' : ''}
                >
                  {isLoading ? 'جاري الحفظ...' : 'حفظ كلمة المرور وتفعيل الحساب ←'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* Footer Link */}
        <div className="text-center pt-3 border-t border-white/20" style={{ marginTop: '12px' }}>
          <span className="text-[11px] text-[#03045E] font-bold">
            <Link
              href="/login"
              className="text-[#0077B6] hover:text-[#03045E] transition-colors font-black underline underline-offset-4"
            >
              العودة لصفحة تسجيل الدخول
            </Link>
          </span>
        </div>

      </div>
    </div>
  )
}
