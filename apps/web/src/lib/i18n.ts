import { useLanguageStore } from '@/lib/stores/languageStore'

export const translations = {
  // ─── Login ──────────────────────────────────────────────────────────────
  'login.title': { ar: 'تسجيل الدخول للنظام 🔐', en: 'Sign In 🔐' },
  'login.subtitle': { ar: 'نظام إدارة الكراج الذكي والسحابي Warshatak', en: 'Warshatak — Smart Cloud Garage Management' },
  'login.email': { ar: 'البريد الإلكتروني', en: 'Email' },
  'login.password': { ar: 'كلمة المرور', en: 'Password' },
  'login.submit': { ar: 'دخول للنظام ←', en: 'Sign In →' },
  'login.loading': { ar: 'جاري التحقق...', en: 'Signing in...' },
  'login.invalidCreds': { ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة', en: 'Invalid email or password' },
  'login.genericError': { ar: 'فشل تسجيل الدخول، تحقق من البيانات', en: 'Sign in failed, please check your details' },

  // ─── Sidebar / Nav ──────────────────────────────────────────────────────
  'nav.dashboard': { ar: 'لوحة التحكم', en: 'Dashboard' },
  'nav.myTasks': { ar: 'مهامي اليومية', en: 'My Tasks' },
  'nav.operations': { ar: 'العمليات', en: 'Operations' },
  'nav.workOrders': { ar: 'طلبات الخدمة', en: 'Work Orders' },
  'nav.vehicles': { ar: 'السيارات', en: 'Vehicles' },
  'nav.customers': { ar: 'العملاء', en: 'Customers' },
  'nav.appointments': { ar: 'المواعيد', en: 'Appointments' },
  'nav.inventorySection': { ar: 'المخزون', en: 'Inventory' },
  'nav.inventory': { ar: 'المخزون', en: 'Inventory' },
  'nav.suppliers': { ar: 'الموردون', en: 'Suppliers' },
  'nav.purchaseOrders': { ar: 'طلبات الشراء', en: 'Purchase Orders' },
  'nav.finance': { ar: 'المالية', en: 'Finance' },
  'nav.invoices': { ar: 'الفواتير', en: 'Invoices' },
  'nav.payments': { ar: 'المدفوعات', en: 'Payments' },
  'nav.reports': { ar: 'التقارير', en: 'Reports' },
  'nav.team': { ar: 'الفريق', en: 'Team' },
  'nav.technicians': { ar: 'الفنيون', en: 'Technicians' },
  'nav.users': { ar: 'المستخدمون', en: 'Users' },
  'nav.support_section': { ar: 'الدعم', en: 'Support' },
  'nav.support': { ar: 'الدعم الفني', en: 'Support' },
  'nav.announcements': { ar: 'إعلانات المنصة', en: 'Announcements' },
  'nav.notifications': { ar: 'الإشعارات', en: 'Notifications' },
  'nav.settings': { ar: 'الإعدادات', en: 'Settings' },
  'nav.logout': { ar: 'تسجيل خروج', en: 'Log Out' },

  // ─── Roles ──────────────────────────────────────────────────────────────
  'role.GARAGE_OWNER': { ar: 'مالك الكراج', en: 'Garage Owner' },
  'role.BRANCH_MANAGER': { ar: 'مدير الفرع', en: 'Branch Manager' },
  'role.ACCOUNTANT': { ar: 'المحاسب', en: 'Accountant' },
  'role.RECEPTIONIST': { ar: 'موظف الاستقبال', en: 'Receptionist' },
  'role.TECHNICIAN': { ar: 'فني', en: 'Technician' },
} as const

export type TranslationKey = keyof typeof translations

export function useT() {
  const lang = useLanguageStore((s) => s.lang)
  return (key: TranslationKey): string => translations[key][lang]
}
