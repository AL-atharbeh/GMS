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

  // ─── AI Assistant ───────────────────────────────────────────────────────
  'nav.aiSection': { ar: 'المساعد الذكي', en: 'AI Assistant' },
  'nav.assistant': { ar: 'وكيلي الذكي', en: 'My Assistant' },
  'nav.aiUsage': { ar: 'استهلاك المساعد', en: 'Assistant Usage' },

  'ai.title': { ar: 'وكيلك الذكي', en: 'Your Assistant' },
  'ai.subtitle': {
    ar: 'يشخّص الأعطال من سجلّ ورشتك، ويقترح الحل وقطع الغيار',
    en: 'Diagnoses faults from your own repair history and proposes the fix',
  },
  'ai.placeholder': {
    ar: 'اوصف العطل… مثال: السيارة تهتز على السرعات العالية',
    en: 'Describe the fault… e.g. the car shakes at high speed',
  },
  'ai.send': { ar: 'إرسال', en: 'Send' },
  'ai.thinking': { ar: 'يفكّر…', en: 'Thinking…' },
  'ai.newChat': { ar: 'محادثة جديدة', en: 'New chat' },
  'ai.conversations': { ar: 'محادثاتي', en: 'My chats' },
  'ai.deleteChat': { ar: 'حذف المحادثة', en: 'Delete chat' },
  'ai.close': { ar: 'إغلاق', en: 'Close' },
  'ai.openFull': { ar: 'فتح الصفحة الكاملة', en: 'Open full page' },
  'ai.noConversations': { ar: 'لا محادثات بعد', en: 'No chats yet' },
  'ai.emptyTitle': { ar: 'اسأل وكيلك', en: 'Ask your assistant' },
  'ai.emptyBody': {
    ar: 'يقرأ أوامر العمل والسيارات والمخزون لوحده. اوصف العطل وسيبحث في سجلّ ورشتك عن حالات مشابهة.',
    en: 'It reads your work orders, vehicles and stock on its own. Describe the fault and it will search your history for similar cases.',
  },
  'ai.toolsUsed': { ar: 'استخدم', en: 'Used' },
  'ai.confirmTitle': { ar: 'يطلب تأكيدك', en: 'Needs your confirmation' },
  'ai.confirmBody': {
    ar: 'لن يُنفَّذ شيء قبل موافقتك',
    en: 'Nothing happens until you approve',
  },
  'ai.approve': { ar: 'موافق، نفّذ', en: 'Approve' },
  'ai.reject': { ar: 'رفض', en: 'Reject' },
  'ai.executed': { ar: 'تم التنفيذ', en: 'Done' },
  'ai.rejected': { ar: 'مرفوض', en: 'Rejected' },
  'ai.failed': { ar: 'فشل التنفيذ', en: 'Failed' },
  'ai.notConfigured': {
    ar: 'المساعد غير مُهيّأ — مفتاح المزوّد غير مضاف بعد',
    en: 'Assistant not configured — the provider API key is missing',
  },
  'ai.disabled': { ar: 'المساعد معطّل', en: 'Assistant is disabled' },
  'ai.quotaExceeded': {
    ar: 'انتهت حصة هذا الشهر. رقّ خطة الاشتراك للمتابعة.',
    en: 'This month’s allowance is used up. Upgrade the plan to continue.',
  },
  'ai.quotaNear': {
    ar: 'اقتربت من نهاية حصة هذا الشهر',
    en: 'You are close to this month’s allowance',
  },
  'ai.error': { ar: 'تعذّر إرسال الرسالة', en: 'Could not send the message' },

  // ─── AI Usage dashboard ─────────────────────────────────────────────────
  'usage.title': { ar: 'استهلاك المساعد الذكي', en: 'AI Assistant Usage' },
  'usage.subtitle': {
    ar: 'التوكِنات المستهلكة والتكلفة لكل مستخدم',
    en: 'Tokens consumed and cost per user',
  },
  'usage.quotaUsed': { ar: 'المستهلك من الحصة', en: 'Quota used' },
  'usage.tokens': { ar: 'توكِن', en: 'tokens' },
  'usage.remaining': { ar: 'المتبقّي', en: 'Remaining' },
  'usage.requests': { ar: 'الطلبات', en: 'Requests' },
  'usage.cost': { ar: 'التكلفة', en: 'Cost' },
  'usage.inputTokens': { ar: 'توكِن مُدخَل', en: 'Input tokens' },
  'usage.outputTokens': { ar: 'توكِن مُخرَج', en: 'Output tokens' },
  'usage.byUser': { ar: 'حسب المستخدم', en: 'By user' },
  'usage.trend': { ar: 'الاستهلاك اليومي', en: 'Daily usage' },
  'usage.user': { ar: 'المستخدم', en: 'User' },
  'usage.role': { ar: 'الدور', en: 'Role' },
  'usage.noData': {
    ar: 'لا استهلاك مسجَّل في هذه الفترة',
    en: 'No usage recorded in this period',
  },
  'usage.period30': { ar: 'آخر 30 يوم', en: 'Last 30 days' },
  'usage.period7': { ar: 'آخر 7 أيام', en: 'Last 7 days' },
  'usage.period90': { ar: 'آخر 90 يوم', en: 'Last 90 days' },
  'usage.plan': { ar: 'الخطة', en: 'Plan' },
  'usage.garage': { ar: 'الورشة', en: 'Garage' },
  'usage.topUsers': { ar: 'أعلى المستهلكين', en: 'Top consumers' },
} as const

export type TranslationKey = keyof typeof translations

export function useT() {
  const lang = useLanguageStore((s) => s.lang)
  return (key: TranslationKey): string => translations[key][lang]
}
