// src/pages/admin/AdminCoupons.jsx
import { useState } from 'react'
import {
  Tag, Plus, Edit2, Trash2, RefreshCw, Check, X,
  Percent, DollarSign, Calendar, AlertCircle, Gift,
} from 'lucide-react'
import Button from '../../components/common/Button'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

// ===========================
// Helpers
// ===========================

const fmt = {
  date: (d) => d ? new Date(d).toLocaleDateString('ar-IQ') : '—',
  price: (n) => n != null ? `${Number(n).toLocaleString()} د.ع` : '—',
}

const DiscountBadge = ({ type, value }) => (
  <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
    {type === 'percentage' ? <><Percent size={11} />{value}%</> : <><DollarSign size={11} />{Number(value).toLocaleString()}</>}
  </span>
)

const StatusBadge = ({ active }) => (
  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
    active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
  }`}>
    {active ? <><Check size={11} />نشط</> : <><X size={11} />معطل</>}
  </span>
)

// ===========================
// Coupon Form Modal
// ===========================

const CouponModal = ({ coupon, onClose, onSaved }) => {
  const { success: showSuccess, error: showError } = useToast()
  const isEdit = !!coupon?.id

  // جلب المتاجر والفئات
  const { data: vendorsData } = useQuery({
    queryKey: ['admin-vendors-list'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.VENDORS.PAGED, { pageSize: 100 })
      return r.data.data || r.data
    },
    staleTime: 10 * 60 * 1000,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['admin-categories-list'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.CATEGORIES.BASE)
      return r.data.data || r.data
    },
    staleTime: 10 * 60 * 1000,
  })

  const vendors    = Array.isArray(vendorsData)    ? vendorsData    : (vendorsData?.items    ?? [])
  const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.items ?? [])

  const [form, setForm] = useState({
    code:             coupon?.code             ?? '',
    description:      coupon?.description      ?? '',
    discountType:     coupon?.discountType      ?? 'fixed',
    discountValue:    coupon?.discountValue     ?? '',
    minOrderAmount:   coupon?.minOrderAmount    ?? '',
    maxDiscountAmount:coupon?.maxDiscountAmount ?? '',
    usageLimit:       coupon?.usageLimit        ?? '',
    userUsageLimit:   coupon?.userUsageLimit    ?? 1,
    vendorId:         coupon?.vendorId          ?? '',
    categoryId:       coupon?.categoryId        ?? '',
    isActive:         coupon?.isActive          ?? true,
    startsAt:         coupon?.startsAt          ? coupon.startsAt.slice(0,10) : '',
    expiresAt:        coupon?.expiresAt         ? coupon.expiresAt.slice(0,10) : '',
  })

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: async (data) => {
      if (isEdit) {
        const r = await apiPut(API_ENDPOINTS.COUPONS.BY_ID(coupon.id), data)
        return r.data.data || r.data
      } else {
        const r = await apiPost(API_ENDPOINTS.COUPONS.BASE, data)
        return r.data.data || r.data
      }
    },
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.code.trim() || !form.discountValue) {
      showError('يرجى ملء الحقول المطلوبة')
      return
    }
    try {
      const payload = {
        ...form,
        discountValue:     Number(form.discountValue),
        // ✅ عند الإنشاء: MinOrderAmount غير قابل لل null بالباك اند (decimal غير nullable) لذا نرسل 0 كقيمة افتراضية.
        // عند التعديل: null تعني "لا تغيير" بالباك اند (UpdateCouponDto.MinOrderAmount قابل لل null)، فنُبقيها null.
        minOrderAmount:    form.minOrderAmount    ? Number(form.minOrderAmount)    : (isEdit ? null : 0),
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
        usageLimit:        form.usageLimit        ? Number(form.usageLimit)        : null,
        userUsageLimit:    form.userUsageLimit     ? Number(form.userUsageLimit)    : 1,
        vendorId:          form.vendorId   || null,
        categoryId:        form.categoryId || null,
        startsAt:          form.startsAt   || null,
        expiresAt:         form.expiresAt  || null,
      }
      if (isEdit) delete payload.code
      await save(payload)
      showSuccess(isEdit ? 'تم تعديل الكوبون' : 'تم إنشاء الكوبون')
      onSaved()
    } catch (err) {
      showError(err.message || 'فشلت العملية')
    }
  }

  const F = ({ label, required, children }) => (
    <div>
      <label className="text-sm text-gray-600 block mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
      {children}
    </div>
  )

  const inputCls = "w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-2xl w-full max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-lg">{isEdit ? 'تعديل كوبون' : 'إنشاء كوبون جديد'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!isEdit && (
              <F label="كود الكوبون" required>
                <input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})}
                  className={inputCls} placeholder="SUMMER20" dir="ltr" />
              </F>
            )}

            <F label="نوع الخصم" required>
              <select value={form.discountType} onChange={e => setForm({...form, discountType: e.target.value})} className={inputCls}>
                <option value="fixed">مبلغ ثابت (د.ع)</option>
                <option value="percentage">نسبة مئوية (%)</option>
              </select>
            </F>

            <F label={form.discountType === 'percentage' ? 'نسبة الخصم (%)' : 'مبلغ الخصم (د.ع)'} required>
              <input type="number" value={form.discountValue} onChange={e => setForm({...form, discountValue: e.target.value})}
                className={inputCls} min="0" />
            </F>

            <F label="الحد الأدنى للطلب (د.ع)">
              <input type="number" value={form.minOrderAmount} onChange={e => setForm({...form, minOrderAmount: e.target.value})}
                className={inputCls} min="0" placeholder="0" />
            </F>

            <F label="أقصى خصم (د.ع)">
              <input type="number" value={form.maxDiscountAmount} onChange={e => setForm({...form, maxDiscountAmount: e.target.value})}
                className={inputCls} min="0" />
            </F>

            <F label="حد الاستخدام الكلي">
              <input type="number" value={form.usageLimit} onChange={e => setForm({...form, usageLimit: e.target.value})}
                className={inputCls} min="1" placeholder="غير محدود" />
            </F>

            <F label="حد الاستخدام لكل مستخدم">
              <input type="number" value={form.userUsageLimit} onChange={e => setForm({...form, userUsageLimit: e.target.value})}
                className={inputCls} min="1" />
            </F>

            <F label="تاريخ البداية">
              <input type="date" value={form.startsAt} onChange={e => setForm({...form, startsAt: e.target.value})} className={inputCls} />
            </F>

            <F label="تاريخ الانتهاء">
              <input type="date" value={form.expiresAt} onChange={e => setForm({...form, expiresAt: e.target.value})} className={inputCls} />
            </F>

            <F label="تخصيص لمتجر">
              <select value={form.vendorId} onChange={e => setForm({...form, vendorId: e.target.value})} className={inputCls}>
                <option value="">الكل (بدون تخصيص)</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.nameAr || v.name}</option>)}
              </select>
            </F>

            <F label="تخصيص لفئة">
              <select value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} className={inputCls}>
                <option value="">الكل (بدون تخصيص)</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr || c.name}</option>)}
              </select>
            </F>
          </div>

          <F label="الوصف">
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary" rows={2} />
          </F>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})}
              className="w-4 h-4 accent-primary" />
            <span className="text-sm text-gray-700">كوبون نشط</span>
          </label>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth type="button" onClick={onClose}>إلغاء</Button>
            <Button variant="primary" fullWidth type="submit" loading={isPending}>
              {isEdit ? 'حفظ التعديلات' : 'إنشاء الكوبون'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===========================
// Promotion Form Modal
// ===========================

const PromotionModal = ({ promo, onClose, onSaved }) => {
  const { success: showSuccess, error: showError } = useToast()
  const isEdit = !!promo?.id

  const [form, setForm] = useState({
    name:             promo?.name             ?? '',
    nameAr:           promo?.nameAr           ?? '',
    description:      promo?.description      ?? '',
    targetType:       promo?.targetType        ?? 'product',
    targetId:         promo?.targetId          ?? '',
    discountType:     promo?.discountType      ?? 'percentage',
    discountValue:    promo?.discountValue     ?? '',
    maxDiscountAmount:promo?.maxDiscountAmount ?? '',
    isActive:         promo?.isActive          ?? true,
    startsAt:         promo?.startsAt          ? promo.startsAt.slice(0,10) : '',
    expiresAt:        promo?.expiresAt         ? promo.expiresAt.slice(0,10) : '',
  })

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: async (data) => {
      if (isEdit) {
        const r = await apiPut(API_ENDPOINTS.PROMOTIONS.BY_ID(promo.id), data)
        return r.data.data || r.data
      } else {
        const r = await apiPost(API_ENDPOINTS.PROMOTIONS.BASE, data)
        return r.data.data || r.data
      }
    },
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.discountValue) {
      showError('يرجى ملء الحقول المطلوبة')
      return
    }
    try {
      const payload = {
        ...form,
        discountValue:     Number(form.discountValue),
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
        targetId:          form.targetId || null,
        startsAt:          form.startsAt  || null,
        expiresAt:         form.expiresAt || null,
      }
      await save(payload)
      showSuccess(isEdit ? 'تم تعديل العرض' : 'تم إنشاء العرض')
      onSaved()
    } catch (err) {
      showError(err.message || 'فشلت العملية')
    }
  }

  const inputCls = "w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
  const F = ({ label, required, children }) => (
    <div>
      <label className="text-sm text-gray-600 block mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
      {children}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-2xl w-full max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-lg">{isEdit ? 'تعديل عرض' : 'إنشاء عرض جديد'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="الاسم (عربي)" required>
              <input value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} className={inputCls} />
            </F>
            <F label="الاسم (إنجليزي)" required>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputCls} dir="ltr" />
            </F>

            <F label="نوع الهدف">
              <select value={form.targetType} onChange={e => setForm({...form, targetType: e.target.value})} className={inputCls}>
                <option value="product">منتج</option>
                <option value="category">فئة</option>
                <option value="vendor">متجر</option>
                <option value="all">الكل</option>
              </select>
            </F>

            <F label="معرف الهدف (ID)">
              <input value={form.targetId} onChange={e => setForm({...form, targetId: e.target.value})}
                className={inputCls} placeholder="اختياري" dir="ltr" />
            </F>

            <F label="نوع الخصم" required>
              <select value={form.discountType} onChange={e => setForm({...form, discountType: e.target.value})} className={inputCls}>
                <option value="percentage">نسبة مئوية (%)</option>
                <option value="fixed">مبلغ ثابت (د.ع)</option>
              </select>
            </F>

            <F label={form.discountType === 'percentage' ? 'نسبة الخصم (%)' : 'مبلغ الخصم (د.ع)'} required>
              <input type="number" value={form.discountValue} onChange={e => setForm({...form, discountValue: e.target.value})}
                className={inputCls} min="0" />
            </F>

            <F label="أقصى خصم (د.ع)">
              <input type="number" value={form.maxDiscountAmount} onChange={e => setForm({...form, maxDiscountAmount: e.target.value})}
                className={inputCls} min="0" />
            </F>

            <F label="تاريخ البداية">
              <input type="date" value={form.startsAt} onChange={e => setForm({...form, startsAt: e.target.value})} className={inputCls} />
            </F>

            <F label="تاريخ الانتهاء">
              <input type="date" value={form.expiresAt} onChange={e => setForm({...form, expiresAt: e.target.value})} className={inputCls} />
            </F>
          </div>

          <F label="الوصف">
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary" rows={2} />
          </F>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})}
              className="w-4 h-4 accent-primary" />
            <span className="text-sm text-gray-700">عرض نشط</span>
          </label>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth type="button" onClick={onClose}>إلغاء</Button>
            <Button variant="primary" fullWidth type="submit" loading={isPending}>
              {isEdit ? 'حفظ التعديلات' : 'إنشاء العرض'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===========================
// Coupons Tab
// ===========================

const CouponsTab = () => {
  const { success: showSuccess, error: showError } = useToast()
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null) // null | 'create' | coupon object

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.COUPONS.PAGED, { pageSize: 50 })
      return r.data.data || r.data
    },
    staleTime: 2 * 60 * 1000,
  })

  const { mutateAsync: deleteCoupon } = useMutation({
    mutationFn: (id) => apiDelete(API_ENDPOINTS.COUPONS.BY_ID(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }),
  })

  const coupons = Array.isArray(data) ? data : (data?.items ?? [])

  const handleDelete = async (id) => {
    if (!confirm('هل تريد حذف هذا الكوبون؟')) return
    try {
      await deleteCoupon(id)
      showSuccess('تم حذف الكوبون')
    } catch (err) {
      showError(err.message || 'فشل الحذف')
    }
  }

  const handleSaved = () => {
    setModal(null)
    queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{coupons.length} كوبون</p>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={15} className="text-gray-400" />
          </button>
          <Button variant="primary" size="sm" onClick={() => setModal('create')}>
            <Plus size={15} className="ml-1" />إنشاء كوبون
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Tag size={40} className="mx-auto mb-3 opacity-30" />
          <p>لا توجد كوبونات</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['الكود', 'الخصم', 'الحد الأدنى', 'الاستخدام', 'الانتهاء', 'الحالة', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-right font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-mono font-bold text-gray-900">{c.code}</p>
                    {c.description && <p className="text-xs text-gray-400 truncate max-w-32">{c.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <DiscountBadge type={c.discountType} value={c.discountValue} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.minOrderAmount ? fmt.price(c.minOrderAmount) : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.usageCount ?? 0}{c.usageLimit ? `/${c.usageLimit}` : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.isExpired
                      ? <span className="text-red-500 text-xs">منتهي</span>
                      : fmt.date(c.expiresAt)
                    }
                  </td>
                  <td className="px-4 py-3"><StatusBadge active={c.isActive && !c.isExpired} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setModal(c)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <CouponModal
          coupon={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

// ===========================
// Promotions Tab
// ===========================

const PromotionsTab = () => {
  const { success: showSuccess, error: showError } = useToast()
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-promotions'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.PROMOTIONS.PAGED, { pageSize: 50 })
      return r.data.data || r.data
    },
    staleTime: 2 * 60 * 1000,
  })

  const { mutateAsync: deletePromo } = useMutation({
    mutationFn: (id) => apiDelete(API_ENDPOINTS.PROMOTIONS.BY_ID(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-promotions'] }),
  })

  const promos = Array.isArray(data) ? data : (data?.items ?? [])

  const handleDelete = async (id) => {
    if (!confirm('هل تريد حذف هذا العرض؟')) return
    try {
      await deletePromo(id)
      showSuccess('تم حذف العرض')
    } catch (err) {
      showError(err.message || 'فشل الحذف')
    }
  }

  const handleSaved = () => {
    setModal(null)
    queryClient.invalidateQueries({ queryKey: ['admin-promotions'] })
  }

  const targetTypeLabel = { product: 'منتج', category: 'فئة', vendor: 'متجر', all: 'الكل' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{promos.length} عرض</p>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={15} className="text-gray-400" />
          </button>
          <Button variant="primary" size="sm" onClick={() => setModal('create')}>
            <Plus size={15} className="ml-1" />إنشاء عرض
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : promos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Gift size={40} className="mx-auto mb-3 opacity-30" />
          <p>لا توجد عروض</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['العرض', 'الخصم', 'الهدف', 'التاريخ', 'الحالة', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-right font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {promos.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.nameAr || p.name}</p>
                    {p.description && <p className="text-xs text-gray-400 truncate max-w-40">{p.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <DiscountBadge type={p.discountType} value={p.discountValue} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {targetTypeLabel[p.targetType] || p.targetType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    <div>{fmt.date(p.startsAt)}</div>
                    <div>{fmt.date(p.expiresAt)}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge active={p.isActive} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setModal(p)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <PromotionModal
          promo={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

// ===========================
// Main Component
// ===========================

const AdminCoupons = () => {
  const [activeTab, setActiveTab] = useState('coupons')

  const tabs = [
    { key: 'coupons',    label: 'الكوبونات',  icon: Tag  },
    { key: 'promotions', label: 'العروض',      icon: Gift },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">الكوبونات والعروض</h1>
        <p className="text-gray-500 mt-1">إدارة كوبونات الخصم والعروض الترويجية</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-primary text-primary bg-primary/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'coupons'    && <CouponsTab />}
          {activeTab === 'promotions' && <PromotionsTab />}
        </div>
      </div>
    </div>
  )
}

export default AdminCoupons