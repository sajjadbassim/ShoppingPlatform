// src/pages/vendor/VendorPromotions.jsx
// عروض المتجر وكوبوناته: خصم على منتج أو على المتجر كله، وكوبونات تُحسب على مشتريات المتجر فقط
import { useState } from 'react'
import { Plus, Tag, Ticket, Pencil, Trash2, RefreshCw, Store, Package, Copy } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Modal, { ConfirmModal } from '../../components/common/Modal'
import { Skeleton } from '../../components/common/Loading'
import { Toggle } from '../../components/common/FormControls'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { apiGet, apiPost, apiPut, apiDelete } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

const money = (n) => `${(n ?? 0).toLocaleString('en-US')} د.ع`
const discountText = (x) => x.discountType === 'percentage'
  ? `${x.discountValue}%${x.maxDiscountAmount ? ` (حتى ${money(x.maxDiscountAmount)})` : ''}`
  : money(x.discountValue)
const dateText = (d) => d ? new Date(d).toLocaleDateString('ar-IQ-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }) : null
// قيمة input[type=date] ← ISO بداية/نهاية اليوم بتوقيت الجهاز
const toIso = (day, endOfDay = false) => day ? new Date(`${day}T${endOfDay ? '23:59:59' : '00:00:00'}`).toISOString() : null
const toDay = (iso) => iso ? new Date(iso).toLocaleDateString('en-CA') : ''

const inputCls = 'w-full h-11 px-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary'
const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
  </label>
)

const DiscountFields = ({ form, set }) => (
  <div className="grid grid-cols-2 gap-3">
    <Field label="نوع الخصم">
      <select value={form.discountType} onChange={e => set({ discountType: e.target.value })} className={inputCls}>
        <option value="percentage">نسبة مئوية %</option>
        <option value="fixed">مبلغ ثابت (د.ع)</option>
      </select>
    </Field>
    <Field label={form.discountType === 'percentage' ? 'النسبة %' : 'المبلغ (د.ع)'}>
      <input type="number" min="0" value={form.discountValue} onChange={e => set({ discountValue: e.target.value })} className={inputCls} />
    </Field>
    {form.discountType === 'percentage' && (
      <Field label="سقف الخصم (اختياري)" hint="أقصى مبلغ يُخصم">
        <input type="number" min="0" value={form.maxDiscountAmount} onChange={e => set({ maxDiscountAmount: e.target.value })} className={inputCls} />
      </Field>
    )}
  </div>
)

const DateFields = ({ form, set }) => (
  <div className="grid grid-cols-2 gap-3">
    <Field label="يبدأ (اختياري)"><input type="date" value={form.startsAt} onChange={e => set({ startsAt: e.target.value })} className={inputCls} /></Field>
    <Field label="ينتهي (اختياري)"><input type="date" value={form.expiresAt} min={form.startsAt || undefined} onChange={e => set({ expiresAt: e.target.value })} className={inputCls} /></Field>
  </div>
)

// ===========================
// العروض
// ===========================
const PromotionModal = ({ promotion, products, onClose, onSave, saving }) => {
  const [form, setForm] = useState(() => ({
    name: promotion?.name || '',
    targetType: promotion?.targetType || 'vendor',
    productId: promotion?.targetType === 'product' ? promotion.targetId : '',
    discountType: promotion?.discountType || 'percentage',
    discountValue: promotion?.discountValue ?? '',
    maxDiscountAmount: promotion?.maxDiscountAmount ?? '',
    isActive: promotion?.isActive ?? true,
    startsAt: toDay(promotion?.startsAt),
    expiresAt: toDay(promotion?.expiresAt),
  }))
  const set = (patch) => setForm(f => ({ ...f, ...patch }))
  const submit = () => onSave({
    name: form.name.trim(),
    targetType: form.targetType,
    productId: form.targetType === 'product' ? form.productId : null,
    discountType: form.discountType,
    discountValue: Number(form.discountValue) || 0,
    maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
    isActive: form.isActive,
    startsAt: toIso(form.startsAt),
    expiresAt: toIso(form.expiresAt, true),
  })

  return (
    <Modal isOpen onClose={saving ? undefined : onClose} title={promotion ? 'تعديل العرض' : 'عرض جديد'} size="md">
      <div className="space-y-4">
        <Field label="اسم العرض" hint="يظهر لك فقط — مثل «تخفيضات العيد»">
          <input value={form.name} onChange={e => set({ name: e.target.value })} className={inputCls} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          {[{ key: 'vendor', label: 'كل منتجات المتجر', icon: Store }, { key: 'product', label: 'منتج محدد', icon: Package }].map(o => (
            <button key={o.key} type="button" onClick={() => set({ targetType: o.key })}
              className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-1.5 ${form.targetType === o.key ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-700'}`}>
              <o.icon size={16} />{o.label}
            </button>
          ))}
        </div>
        {form.targetType === 'product' && (
          <Field label="المنتج">
            <select value={form.productId} onChange={e => set({ productId: e.target.value })} className={inputCls}>
              <option value="">اختر منتجاً...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.nameAr || p.name}</option>)}
            </select>
          </Field>
        )}
        <DiscountFields form={form} set={set} />
        <DateFields form={form} set={set} />
        <label className="flex items-center justify-between text-sm"><span>العرض فعّال</span><Toggle checked={form.isActive} onChange={e => set({ isActive: e.target.checked })} /></label>
        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">الخصم يظهر للزبون على سعر المنتج مباشرة، وتتحمله أنت. عروض المنصة على منتج محدد أو فئة لها الأولوية على عرض المتجر كله.</p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="flex-1 h-11 rounded-xl border border-gray-200 font-bold text-gray-700">إلغاء</button>
          <button type="button" onClick={submit} disabled={saving || !form.name.trim() || !(Number(form.discountValue) > 0) || (form.targetType === 'product' && !form.productId)}
            className="flex-1 h-11 rounded-xl bg-primary text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <RefreshCw size={16} className="animate-spin" />}حفظ
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ===========================
// الكوبونات
// ===========================
const CouponModal = ({ coupon, onClose, onSave, saving }) => {
  const [form, setForm] = useState(() => ({
    code: coupon?.code || '',
    description: coupon?.description || '',
    discountType: coupon?.discountType || 'percentage',
    discountValue: coupon?.discountValue ?? '',
    maxDiscountAmount: coupon?.maxDiscountAmount ?? '',
    minOrderAmount: coupon?.minOrderAmount ?? 0,
    usageLimit: coupon?.usageLimit ?? '',
    userUsageLimit: coupon?.userUsageLimit ?? 1,
    isActive: coupon?.isActive ?? true,
    startsAt: toDay(coupon?.startsAt),
    expiresAt: toDay(coupon?.expiresAt),
  }))
  const set = (patch) => setForm(f => ({ ...f, ...patch }))
  const submit = () => onSave({
    ...(coupon ? {} : { code: form.code.trim().toUpperCase(), discountType: form.discountType }),
    description: form.description.trim() || null,
    discountValue: Number(form.discountValue) || 0,
    maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
    minOrderAmount: Number(form.minOrderAmount) || 0,
    usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
    userUsageLimit: Math.max(1, Number(form.userUsageLimit) || 1),
    isActive: form.isActive,
    startsAt: toIso(form.startsAt),
    expiresAt: toIso(form.expiresAt, true),
  })

  return (
    <Modal isOpen onClose={saving ? undefined : onClose} title={coupon ? `تعديل ${coupon.code}` : 'كوبون جديد'} size="md">
      <div className="space-y-4">
        {!coupon && (
          <Field label="كود الكوبون" hint="حروف إنجليزية وأرقام — مثل EID10">
            <input value={form.code} onChange={e => set({ code: e.target.value.replace(/\s/g, '').toUpperCase() })} className={`${inputCls} font-mono`} dir="ltr" autoFocus />
          </Field>
        )}
        <Field label="وصف (اختياري)"><input value={form.description} onChange={e => set({ description: e.target.value })} className={inputCls} /></Field>
        {coupon
          ? <p className="text-sm text-gray-600">نوع الخصم: {coupon.discountType === 'percentage' ? 'نسبة مئوية' : 'مبلغ ثابت'}</p>
          : null}
        <DiscountFields form={form} set={coupon ? (p) => set({ ...p, discountType: coupon.discountType }) : set} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="حد أدنى لمشترياتك"><input type="number" min="0" value={form.minOrderAmount} onChange={e => set({ minOrderAmount: e.target.value })} className={inputCls} /></Field>
          <Field label="عدد الاستخدامات" hint="فارغ = بلا حد"><input type="number" min="1" value={form.usageLimit} onChange={e => set({ usageLimit: e.target.value })} className={inputCls} /></Field>
          <Field label="لكل زبون"><input type="number" min="1" value={form.userUsageLimit} onChange={e => set({ userUsageLimit: e.target.value })} className={inputCls} /></Field>
        </div>
        <DateFields form={form} set={set} />
        <label className="flex items-center justify-between text-sm"><span>الكوبون فعّال</span><Toggle checked={form.isActive} onChange={e => set({ isActive: e.target.checked })} /></label>
        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">الخصم يُحسب على منتجات متجرك في السلة فقط (لا على منتجات المتاجر الأخرى)، ويُخصم من مستحقاتك.</p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="flex-1 h-11 rounded-xl border border-gray-200 font-bold text-gray-700">إلغاء</button>
          <button type="button" onClick={submit} disabled={saving || (!coupon && form.code.trim().length < 3) || !(Number(form.discountValue) > 0)}
            className="flex-1 h-11 rounded-xl bg-primary text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <RefreshCw size={16} className="animate-spin" />}حفظ
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ===========================
// الصفحة
// ===========================
const VendorPromotions = () => {
  const { user } = useAuthStore()
  const vendorId = user?.vendorId || user?.id
  const queryClient = useQueryClient()
  const { success, error: showError } = useToast()
  const [tab, setTab] = useState('promotions')
  const [editing, setEditing] = useState(null)   // { kind, item|null }
  const [deleting, setDeleting] = useState(null)

  const { data: promotions = [], isLoading: promosLoading } = useQuery({
    queryKey: ['vendor-promotions', vendorId],
    queryFn: async () => (await apiGet(API_ENDPOINTS.VENDOR_MARKETING.PROMOTIONS(vendorId))).data?.data || [],
    enabled: !!vendorId,
  })
  const { data: coupons = [], isLoading: couponsLoading } = useQuery({
    queryKey: ['vendor-coupons', vendorId],
    queryFn: async () => (await apiGet(API_ENDPOINTS.VENDOR_MARKETING.COUPONS(vendorId))).data?.data || [],
    enabled: !!vendorId,
  })
  const { data: products = [] } = useQuery({
    queryKey: ['vendor-products', vendorId],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.PRODUCTS.BY_VENDOR(vendorId), { includeHidden: true })
      const data = r.data.data || r.data
      return Array.isArray(data) ? data : data?.items || []
    },
    enabled: !!vendorId,
    staleTime: 2 * 60 * 1000,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['vendor-promotions', vendorId] })
    queryClient.invalidateQueries({ queryKey: ['vendor-coupons', vendorId] })
    queryClient.invalidateQueries({ queryKey: ['vendor-products', vendorId] })
  }

  const save = useMutation({
    mutationFn: ({ kind, item, body }) => {
      const base = kind === 'promotion' ? API_ENDPOINTS.VENDOR_MARKETING.PROMOTIONS(vendorId) : API_ENDPOINTS.VENDOR_MARKETING.COUPONS(vendorId)
      return item ? apiPut(`${base}/${item.id}`, body) : apiPost(base, body)
    },
    onSuccess: () => { success('تم الحفظ ✅'); setEditing(null); refresh() },
    onError: (err) => showError(err.message || 'تعذّر الحفظ'),
  })
  const remove = useMutation({
    mutationFn: ({ kind, item }) => apiDelete(`${kind === 'promotion' ? API_ENDPOINTS.VENDOR_MARKETING.PROMOTIONS(vendorId) : API_ENDPOINTS.VENDOR_MARKETING.COUPONS(vendorId)}/${item.id}`),
    onSuccess: (_, { kind }) => { success(kind === 'coupon' ? 'تم حذف الكوبون (أو إيقافه إن كان مستخدماً)' : 'تم حذف العرض'); setDeleting(null); refresh() },
    onError: (err) => showError(err.message || 'تعذّر الحذف'),
  })

  const loading = tab === 'promotions' ? promosLoading : couponsLoading
  const status = (x) => x.isRunning ?? (x.isActive && !x.isExpired && !x.isUsageLimitReached)

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">العروض والكوبونات</h1>
          <p className="text-sm text-gray-500 mt-0.5">خصومات على منتجاتك وكوبونات لزبائنك</p>
        </div>
        <button onClick={() => setEditing({ kind: tab === 'promotions' ? 'promotion' : 'coupon', item: null })}
          className="h-11 px-5 rounded-full bg-primary text-white font-bold inline-flex items-center gap-2 shadow-md shadow-primary/25">
          <Plus size={18} />{tab === 'promotions' ? 'عرض جديد' : 'كوبون جديد'}
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {[{ key: 'promotions', label: 'العروض', icon: Tag, n: promotions.length }, { key: 'coupons', label: 'الكوبونات', icon: Ticket, n: coupons.length }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-1.5 ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>
            <t.icon size={15} />{t.label}<span className="text-[11px] px-1.5 rounded-full bg-gray-100 text-gray-500">{t.n}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : tab === 'promotions' ? (
        promotions.length === 0 ? (
          <p className="text-center text-sm text-gray-500 bg-white rounded-2xl border border-dashed border-gray-300 py-12">لا توجد عروض بعد — أنشئ خصماً على منتج أو على متجرك كله</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {promotions.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-4">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status(p) ? 'bg-green-500' : 'bg-gray-300'}`} title={status(p) ? 'فعّال الآن' : 'غير فعّال الآن'} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{p.name}{!p.isOwn && <span className="mr-2 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">من المنصة</span>}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    خصم {discountText(p)} · {p.targetName || 'منتج'}
                    {(p.startsAt || p.expiresAt) && ` · ${dateText(p.startsAt) || '…'} — ${dateText(p.expiresAt) || '…'}`}
                  </p>
                </div>
                {p.isOwn && (
                  <>
                    <button onClick={() => setEditing({ kind: 'promotion', item: p })} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center" aria-label="تعديل"><Pencil size={15} /></button>
                    <button onClick={() => setDeleting({ kind: 'promotion', item: p })} className="w-9 h-9 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center" aria-label="حذف"><Trash2 size={15} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )
      ) : coupons.length === 0 ? (
        <p className="text-center text-sm text-gray-500 bg-white rounded-2xl border border-dashed border-gray-300 py-12">لا توجد كوبونات بعد — أنشئ كوداً ووزّعه على زبائنك</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {coupons.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-4">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status(c) ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 font-mono flex items-center gap-2" dir="ltr">
                  {c.code}
                  <button onClick={() => { navigator.clipboard?.writeText(c.code); success('نُسخ الكود') }} className="text-gray-400 hover:text-primary" aria-label="نسخ الكود"><Copy size={13} /></button>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  خصم {discountText(c)}{c.minOrderAmount > 0 && ` · حد أدنى ${money(c.minOrderAmount)}`} · استُخدم {c.usageCount}{c.usageLimit ? ` من ${c.usageLimit}` : ''} مرة
                  {c.expiresAt && ` · ينتهي ${dateText(c.expiresAt)}`}
                </p>
              </div>
              <button onClick={() => setEditing({ kind: 'coupon', item: c })} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center" aria-label="تعديل"><Pencil size={15} /></button>
              <button onClick={() => setDeleting({ kind: 'coupon', item: c })} className="w-9 h-9 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center" aria-label="حذف"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {editing?.kind === 'promotion' && (
        <PromotionModal promotion={editing.item} products={products} saving={save.isPending}
          onClose={() => setEditing(null)} onSave={(body) => save.mutate({ kind: 'promotion', item: editing.item, body })} />
      )}
      {editing?.kind === 'coupon' && (
        <CouponModal coupon={editing.item} saving={save.isPending}
          onClose={() => setEditing(null)} onSave={(body) => save.mutate({ kind: 'coupon', item: editing.item, body })} />
      )}
      <ConfirmModal isOpen={!!deleting} onClose={() => setDeleting(null)} loading={remove.isPending}
        onConfirm={() => remove.mutate(deleting)}
        title={deleting?.kind === 'coupon' ? `حذف الكوبون ${deleting?.item?.code}` : 'حذف العرض'}
        message={deleting?.kind === 'coupon' ? 'إن كان الكوبون قد استُخدم سيُوقف بدل حذفه حتى تبقى سجلات الطلبات سليمة.' : 'سيعود سعر المنتجات المشمولة لسعرها العادي.'}
        confirmText="حذف" type="danger" />
    </div>
  )
}

export default VendorPromotions
