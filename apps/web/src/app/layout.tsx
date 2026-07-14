import type { Metadata } from 'next'
import './globals.css'
import ImpersonationBanner from '@/components/layout/ImpersonationBanner'

export const metadata: Metadata = {
  title: {
    default: 'Warshatak — نظام إدارة الكراجات',
    template: '%s | Warshatak',
  },
  description: 'منصة SaaS متكاملة لإدارة ورش السيارات — من الاستلام إلى التسليم',
  keywords: ['garage management', 'workshop system', 'car service', 'إدارة كراج', 'ورشة سيارات'],
  authors: [{ name: 'Warshatak Platform' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'ar_KW',
    title: 'Warshatak — نظام إدارة الكراجات',
    description: 'منصة SaaS متكاملة لإدارة ورش السيارات',
    siteName: 'Warshatak',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  themeColor: '#0a0f1e',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Warshatak فني" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function(err) {
                  console.log('SW registration failed:', err);
                });
              });
            }
          `
        }} />
      </head>
      <body suppressHydrationWarning>
        <ImpersonationBanner />
        {children}
      </body>
    </html>
  )
}

