// سجل النشاط — شاشة واحدة لكل الأدوار (عدا الزبون). الخادم يفرض نطاق كل دور:
// الأدمن الكل · العمليات فريقها · المتجر نشاطه وما فعلته الإدارة/العمليات بطلباته · السائق نشاطه
import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { History, LogIn, ShieldAlert, Search, RefreshCw, ChevronDown, Monitor, Trash2 } from 'lucide-react'
import { apiGet, apiDelete } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { ConfirmModal } from '../common/Modal'
import { useToast } from '../common/Toast'

const ROLE_AR = { ADMIN: 'الإدارة', OPS: 'العمليات', VENDOR: 'متجر', DRIVER: 'سائق' }
const ROLE_TONE = {
  ADMIN: 'bg-purple-50 text-purple-700', OPS: 'bg-blue-50 text-blue-700',
  VENDOR: 'bg-emerald-50 text-emerald-700', DRIVER: 'bg-amber-50 text-amber-700',
}

// أسماء الجداول والحقول الشائعة بالعربي — غير الموجود يظهر كما هو
const TYPE_AR = {
  Order: 'الطلب', SubOrder: 'جزء الطلب', SubOrderItem: 'قطعة في الطلب', Product: 'المنتج', ProductVariant: 'نسخة المنتج',
  ProductImage: 'صورة المنتج', Vendor: 'المتجر', User: 'المستخدم', Driver: 'السائق', Return: 'الإرجاع', ReturnItem: 'قطعة مرتجعة',
  ReturnTrip: 'رحلة الإرجاع', Coupon: 'الكوبون', Promotion: 'العرض', Category: 'الفئة', DeliveryZone: 'منطقة التوصيل',
  VendorLedgerEntry: 'حساب المتجر', DriverCashEntry: 'نقد السائق', DeliverySettings: 'إعدادات التوصيل', UserPreferences: 'الإعدادات',
  Review: 'التقييم', Banner: 'البانر', HomeSection: 'قسم الرئيسية', OrderStatusHistory: 'سجل حالة الطلب', LoyaltyTransaction: 'حركة نقاط',
}
const FIELD_AR = {
  Status: 'الحالة', Price: 'السعر', DiscountPrice: 'سعر الخصم', StockQuantity: 'المخزون', IsActive: 'مفعّل', Name: 'الاسم', NameAr: 'الاسم العربي',
  FullName: 'الاسم', Phone: 'الهاتف', Email: 'البريد', DeliveryFee: 'أجرة التوصيل', DriverId: 'السائق', Amount: 'المبلغ', Description: 'الوصف',
  CancellationReason: 'سبب الإلغاء', WorkStatus: 'حالة العمل', Role: 'الدور', IsAcceptingOrders: 'يستقبل الطلبات', MinOrderAmount: 'الحد الأدنى',
  RefundAmount: 'المبلغ المردود', PickupFeePayer: 'من يدفع أجرة الاستلام', RefusalFeePayerOverride: 'استثناء أجرة الرفض', Reason: 'السبب',
  Value: 'القيمة', Code: 'الرمز', Quantity: 'الكمية', TotalAmount: 'الإجمالي', PaymentStatus: 'حالة الدفع', IsHidden: 'مخفي',
}

const time = (d) => new Date(d).toLocaleString('ar-IQ-u-nu-latn', { timeZone: 'Asia/Baghdad', dateStyle: 'medium', timeStyle: 'short' })
const shortDevice = (ua) => {
  if (!ua) return null
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : ''
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ''
  return [br, os].filter(Boolean).join(' · ') || ua.slice(0, 40)
}

const PERIODS = [
  { key: 'today', label: 'اليوم', days: 0 },
  { key: '7', label: '7 أيام', days: 7 },
  { key: '30', label: '30 يوماً', days: 30 },
  { key: 'all', label: 'الكل', days: null },
]
const fromOf = (key) => {
  const p = PERIODS.find(x => x.key === key)
  if (!p || p.days == null) return undefined
  // بداية اليوم بتوقيت بغداد (UTC+3)
  const now = new Date()
  const baghdad = new Date(now.getTime() + 3 * 3600_000)
  baghdad.setUTCHours(0, 0, 0, 0)
  return new Date(baghdad.getTime() - 3 * 3600_000 - p.days * 86400_000).toISOString()
}

const Changes = ({ details }) => {
  if (!Array.isArray(details) || details.length === 0) return <p className="text-xs text-gray-400">لا تفاصيل تغيير</p>
  return (
    <div className="space-y-2">
      {details.map((e, i) => (
        <div key={i} className="rounded-lg bg-gray-50 p-2.5">
          <p className="text-xs font-bold text-gray-700 mb-1">
            {TYPE_AR[e.type] || e.type}{e.label ? ` · ${e.label}` : ''}
            <span className="font-normal text-gray-400"> — {e.state === 'Added' ? 'إضافة' : e.state === 'Deleted' ? 'حذف' : 'تعديل'}</span>
          </p>
          {e.changes?.length > 0 && (
            <ul className="space-y-0.5">
              {e.changes.slice(0, 20).map((c, j) => (
                <li key={j} className="text-xs text-gray-600 break-words">
                  <span className="text-gray-500">{FIELD_AR[c.p] || c.p}: </span>
                  {e.state === 'Modified' && <><span className="line-through text-red-500" dir="auto">{c.o ?? '—'}</span> ← </>}
                  <span className="text-green-700 font-medium" dir="auto">{c.n ?? '—'}</span>
                </li>
              ))}
              {e.changes.length > 20 && <li className="text-xs text-gray-400">+{e.changes.length - 20} حقلاً آخر</li>}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

const Row = ({ log, showRole }) => {
  const [open, setOpen] = useState(false)
  const failed = log.action === 'auth.login_failed'
  const Icon = failed ? ShieldAlert : log.kind === 'AUTH' ? LogIn : History
  const tone = failed ? 'bg-red-50 text-red-600' : log.kind === 'AUTH' ? 'bg-sky-50 text-sky-600' : 'bg-gray-100 text-gray-600'
  const expandable = !!log.details || !!log.ip || !!log.device
  return (
    <li className="py-3">
      <button type="button" onClick={() => expandable && setOpen(o => !o)} className="w-full flex items-start gap-3 text-right">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tone}`}><Icon size={17} /></span>
        <span className="flex-1 min-w-0">
          <span className={`block text-sm font-medium ${failed ? 'text-red-700' : 'text-gray-900'}`}>{log.summary}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs text-gray-500">
            {log.actorName && <span>{log.actorName}</span>}
            {showRole && <span className={`px-1.5 py-0.5 rounded ${ROLE_TONE[log.actorRole] || 'bg-gray-100'}`}>{ROLE_AR[log.actorRole] || log.actorRole}</span>}
            <span>{time(log.at)}</span>
          </span>
        </span>
        {expandable && <ChevronDown size={16} className={`text-gray-400 mt-2 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <div className="mt-2 mr-12 space-y-2">
          {log.details && <Changes details={log.details} />}
          {(log.ip || log.device) && (
            <p className="text-xs text-gray-400 flex items-center gap-1.5" dir="auto">
              <Monitor size={12} />{[shortDevice(log.device), log.ip].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

const Chips = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map(o => (
      <button key={o.key} type="button" onClick={() => onChange(o.key)}
        className={`h-8 px-3 rounded-full text-xs font-bold border ${value === o.key ? 'bg-primary text-white border-primary' : 'bg-white border-gray-200 text-gray-600'}`}>
        {o.label}
      </button>
    ))}
  </div>
)

// الأدمن: حذف كل ما هو أقدم من 30 يوماً (يبقى نشاط آخر 30 يوماً) بعد رسالة تأكيد
const PurgeButton = ({ retentionDays }) => {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [open, setOpen] = useState(false)
  const { mutate, isPending } = useMutation({
    mutationFn: async () => (await apiDelete(API_ENDPOINTS.ACTIVITY.PURGE_OLD)).data,
    onSuccess: (res) => {
      setOpen(false)
      success(res?.message || 'تم الحذف')
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (e) => error(e.message || 'تعذّر الحذف'),
  })
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100">
        <p className="text-xs text-gray-400 pt-2">يُحذف تلقائياً كل يوم ما مضى عليه أكثر من {retentionDays || 60} يوماً.</p>
        <button type="button" onClick={() => setOpen(true)}
          className="mt-2 h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-bold inline-flex items-center gap-1.5">
          <Trash2 size={14} />حذف الأقدم من 30 يوماً
        </button>
      </div>
      <ConfirmModal isOpen={open} onClose={() => !isPending && setOpen(false)} onConfirm={() => mutate()} loading={isPending}
        title="حذف سجلات النشاط القديمة"
        message="سيُحذف نهائياً كل نشاط ودخول أقدم من 30 يوماً، لكل الأدوار. يبقى نشاط آخر 30 يوماً فقط. لا يمكن التراجع عن هذا. متابعة؟"
        confirmText="نعم، احذف" cancelText="تراجع" />
    </>
  )
}

// role: دور المشاهد — يحدد الفلاتر المعروضة فقط (النطاق يفرضه الخادم). compact: نافذة السائق
const ActivityLogView = ({ role, compact = false }) => {
  const [kind, setKind] = useState('all')
  const [actorRole, setActorRole] = useState('all')
  const [period, setPeriod] = useState(compact ? 'all' : '7')
  const [mine, setMine] = useState(false)
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')

  const params = {
    pageSize: compact ? 20 : 30,
    kind: kind === 'auth' ? 'AUTH' : kind === 'action' ? 'ACTION' : undefined,
    failedLoginsOnly: kind === 'failed' || undefined,
    role: actorRole === 'all' ? undefined : actorRole,
    from: fromOf(period),
    mine: mine || undefined,
    search: term || undefined,
  }
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isFetching } = useInfiniteQuery({
    queryKey: ['activity', params],
    queryFn: async ({ pageParam }) => (await apiGet(API_ENDPOINTS.ACTIVITY.LIST, { ...params, page: pageParam })).data,
    initialPageParam: 1,
    getNextPageParam: (last) => last?.pagination && last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  })
  const items = data?.pages.flatMap(p => p.data || []) || []
  const total = data?.pages[0]?.pagination?.totalCount ?? 0
  // الأحدث أولاً (الخادم يرتّب بالوقت تنازلياً)
  // المتجر يرى أدواراً أخرى (ما فعلته الإدارة/العمليات بطلباته)، والأدمن يرى الكل
  const showRole = role === 'ADMIN' || role === 'VENDOR'

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
          <form onSubmit={e => { e.preventDefault(); setTerm(search.trim()) }} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث: رقم طلب، اسم منتج، اسم موظف..."
                className="w-full h-10 pr-9 pl-3 bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
            </div>
            <button type="button" onClick={() => refetch()} aria-label="تحديث" className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500">
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            </button>
          </form>
          <Chips value={kind} onChange={setKind} options={[
            { key: 'all', label: 'الكل' }, { key: 'action', label: 'الإجراءات' }, { key: 'auth', label: 'الدخول' }, { key: 'failed', label: 'دخول فاشل' },
          ]} />
          {role === 'ADMIN' && (
            <Chips value={actorRole} onChange={setActorRole} options={[
              { key: 'all', label: 'كل الأدوار' }, { key: 'ADMIN', label: 'الإدارة' }, { key: 'OPS', label: 'العمليات' },
              { key: 'VENDOR', label: 'المتاجر' }, { key: 'DRIVER', label: 'السائقون' },
            ]} />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Chips value={period} onChange={setPeriod} options={PERIODS} />
            {(role === 'ADMIN' || role === 'OPS' || role === 'VENDOR') && (
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} className="w-4 h-4 accent-primary" />
                نشاطي فقط
              </label>
            )}
          </div>
          {role === 'ADMIN' && <PurgeButton retentionDays={data?.pages[0]?.retentionDays} />}
        </div>
      )}

      <div className={compact ? '' : 'rounded-2xl bg-white border border-gray-200 px-4'}>
        {!compact && !isLoading && <p className="text-xs text-gray-400 pt-3">{total.toLocaleString('en-US')} سجل</p>}
        {isLoading ? (
          <div className="space-y-3 py-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />)}</div>
        ) : isError ? (
          <p className="text-sm text-red-500 py-6 text-center">تعذّر تحميل السجل</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">لا يوجد نشاط في هذه الفترة</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map(log => <Row key={log.id} log={log} showRole={showRole} />)}
          </ul>
        )}
        {hasNextPage && (
          <div className="py-3 flex justify-center">
            <button type="button" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
              className="h-9 px-5 rounded-lg border border-gray-200 text-sm font-bold text-gray-700 disabled:opacity-50">
              {isFetchingNextPage ? '...' : 'المزيد'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivityLogView
