// src/pages/vendor/VendorProducts.jsx
// إدارة منتجات المتجر: فلاتر بالأرقام، إظهار/إخفاء ومخزون مباشرة من القائمة، وإجراءات جماعية
import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Search, MoreVertical, Edit, Trash2, Eye, EyeOff, Package, RefreshCw, AlertCircle,
  Minus, Check, X, ArrowUpDown, CheckSquare,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Button from '../../components/common/Button'
import { Toggle } from '../../components/common/FormControls'
import { ConfirmModal } from '../../components/common/Modal'
import Dropdown from '../../components/common/Dropdown'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import productService from '../../services/productService'
import { getImageUrl } from '../../utils/imageHelper'

const LOW_STOCK = 10
const PAGE_SIZE = 20

const useVendorProducts = (vendorId) => useQuery({
  queryKey: ['vendor-products', vendorId],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.PRODUCTS.BY_VENDOR(vendorId))
    const data = r.data.data || r.data
    return Array.isArray(data) ? data : data?.items || []
  },
  enabled: !!vendorId,
  staleTime: 2 * 60 * 1000,
})

const productImage = (p) => {
  if (p.primaryImageUrl) return getImageUrl(p.primaryImageUrl)
  const img = p.images?.find(i => i.isPrimary) || p.images?.[0]
  return img ? getImageUrl(img.imageUrl) : null
}

const stockTone = (qty) =>
  qty === 0 ? 'text-red-600 bg-red-50' : qty < LOW_STOCK ? 'text-amber-700 bg-amber-50' : 'text-gray-700 bg-gray-100'

const SORTS = [
  { key: 'newest', label: 'الأحدث' },
  { key: 'name', label: 'الاسم' },
  { key: 'price_desc', label: 'الأعلى سعراً' },
  { key: 'price_asc', label: 'الأقل سعراً' },
  { key: 'stock_asc', label: 'المخزون الأقل' },
]

// ===========================
// تعديل المخزون مباشرة: −/+ أو كتابة الرقم
// ===========================
const StockEditor = ({ product, onSave, saving }) => {
  const qty = product.stockQuantity ?? 0
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(qty)
  const inputRef = useRef(null)
  useEffect(() => { if (!editing) setValue(qty) }, [qty, editing])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const commit = (next) => {
    const n = Math.max(0, Math.floor(Number(next)))
    setEditing(false)
    if (Number.isFinite(n) && n !== qty) onSave(n)
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <button onClick={() => setValue(v => Math.max(0, Number(v) - 1))} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center" aria-label="إنقاص"><Minus size={14} /></button>
        <input ref={inputRef} type="number" min="0" inputMode="numeric" value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(value); if (e.key === 'Escape') setEditing(false) }}
          className="w-14 h-7 text-center text-sm font-bold border border-primary rounded-lg focus:outline-none" />
        <button onClick={() => setValue(v => Number(v) + 1)} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center" aria-label="زيادة"><Plus size={14} /></button>
        <button onClick={() => commit(value)} className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center" aria-label="حفظ"><Check size={14} /></button>
        <button onClick={() => setEditing(false)} className="w-7 h-7 rounded-lg text-gray-400 flex items-center justify-center" aria-label="إلغاء"><X size={14} /></button>
      </span>
    )
  }
  return (
    <button onClick={() => setEditing(true)} disabled={saving} title="تعديل المخزون"
      className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-bold hover:ring-1 hover:ring-gray-300 disabled:opacity-50 ${stockTone(qty)}`}>
      {saving ? <RefreshCw size={12} className="animate-spin" /> : null}
      {qty === 0 ? 'نفذ' : `${qty} قطعة`}
      <Edit size={11} className="opacity-50" />
    </button>
  )
}

// ===========================
// صف منتج
// ===========================
const ProductRow = ({ product: p, selected, selecting, onSelect, onToggleActive, onStock, busy, actions }) => {
  const img = productImage(p)
  const hidden = !p.isActive
  const discount = p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0
  return (
    <div className={`flex items-center gap-3 p-3 sm:p-4 transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-gray-50'}`}>
      {selecting && (
        <input type="checkbox" checked={selected} onChange={onSelect} aria-label="تحديد"
          className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0" />
      )}
      <Link to={`/vendor/products/${p.id}/edit`} className="relative w-16 h-16 sm:w-14 sm:h-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
        {img ? <img src={img} alt="" loading="lazy" className={`w-full h-full object-cover ${hidden ? 'opacity-50 grayscale' : ''}`} onError={e => { e.currentTarget.style.display = 'none' }} />
          : <Package size={22} className="absolute inset-0 m-auto text-gray-300" />}
        {discount > 0 && <span className="absolute bottom-0 inset-x-0 text-center bg-rose-500 text-white text-[10px] font-bold">-{discount}%</span>}
      </Link>

      <div className="flex-1 min-w-0 sm:grid sm:grid-cols-[1fr_8rem_8rem] sm:items-center sm:gap-4">
        <div className="min-w-0">
          <Link to={`/vendor/products/${p.id}/edit`} className={`block font-medium truncate hover:text-primary ${hidden ? 'text-gray-400' : 'text-gray-900'}`}>
            {p.nameAr || p.name}
          </Link>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {p.categoryNameAr || p.categoryName || 'بدون فئة'}{p.sku && <span className="font-mono"> · {p.sku}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1.5 sm:mt-0 sm:block">
          <p className="font-bold text-gray-900 text-sm">{(p.price || 0).toLocaleString()} <span className="text-xs font-normal text-gray-500">د.ع</span></p>
          {discount > 0 && <p className="text-[11px] text-gray-400 line-through">{p.originalPrice.toLocaleString()}</p>}
        </div>
        <div className="mt-1.5 sm:mt-0">
          <StockEditor product={p} onSave={onStock} saving={busy === 'stock'} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 flex-shrink-0">
        <span className="flex flex-col items-center gap-0.5" title={hidden ? 'مخفي عن الزبائن' : 'ظاهر في المتجر'}>
          <Toggle size="sm" checked={!hidden} disabled={busy === 'active'} onChange={onToggleActive} />
          <span className={`text-[10px] font-medium ${hidden ? 'text-gray-400' : 'text-green-600'}`}>{hidden ? 'مخفي' : 'ظاهر'}</span>
        </span>
        <Dropdown
          trigger={<button className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center" aria-label="المزيد"><MoreVertical size={16} className="text-gray-500" /></button>}
          items={actions} align="left" />
      </div>
    </div>
  )
}

// ===========================
// الصفحة
// ===========================
const VendorProducts = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { success, error: showError } = useToast()
  const { user } = useAuthStore()
  const vendorId = user?.vendorId || user?.id

  const { data: products = [], isLoading, isError, error, refetch, isFetching } = useVendorProducts(vendorId)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState({})            // { [id]: 'stock' | 'active' }
  const [toDelete, setToDelete] = useState(null)  // منتج واحد أو 'bulk'
  const [deleting, setDeleting] = useState(false)

  const counts = useMemo(() => ({
    all: products.length,
    visible: products.filter(p => p.isActive).length,
    hidden: products.filter(p => !p.isActive).length,
    low: products.filter(p => (p.stockQuantity ?? 0) > 0 && (p.stockQuantity ?? 0) < LOW_STOCK).length,
    out: products.filter(p => (p.stockQuantity ?? 0) === 0).length,
  }), [products])

  const FILTERS = [
    { key: 'all', label: 'الكل' },
    { key: 'visible', label: 'ظاهر' },
    { key: 'hidden', label: 'مخفي' },
    { key: 'low', label: 'مخزون منخفض', tone: 'amber' },
    { key: 'out', label: 'نفذ', tone: 'red' },
  ]

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = products.filter(p => {
      const qty = p.stockQuantity ?? 0
      const okFilter =
        filter === 'visible' ? p.isActive :
        filter === 'hidden' ? !p.isActive :
        filter === 'low' ? qty > 0 && qty < LOW_STOCK :
        filter === 'out' ? qty === 0 : true
      const okSearch = !q || (p.nameAr || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
      return okFilter && okSearch
    })
    const byName = (a, b) => (a.nameAr || a.name || '').localeCompare(b.nameAr || b.name || '', 'ar')
    const sorters = {
      newest: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      name: byName,
      price_desc: (a, b) => (b.price || 0) - (a.price || 0),
      price_asc: (a, b) => (a.price || 0) - (b.price || 0),
      stock_asc: (a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0),
    }
    return [...matches].sort(sorters[sort])
  }, [products, search, filter, sort])

  const shown = list.slice(0, limit)

  // تحديث منتج واحد في القائمة المخزّنة بدل إعادة جلب الكل
  const patchLocal = (id, patch) =>
    queryClient.setQueryData(['vendor-products', vendorId], (old = []) => old.map(p => p.id === id ? { ...p, ...patch } : p))

  const run = async (id, kind, fn, patch, okMsg) => {
    setBusy(b => ({ ...b, [id]: kind }))
    try {
      await fn()
      patchLocal(id, patch)
      if (okMsg) success(okMsg)
    } catch (err) {
      showError(err.message || 'تعذّر حفظ التغيير')
    } finally {
      setBusy(b => { const n = { ...b }; delete n[id]; return n })
    }
  }

  const toggleActive = (p) => run(p.id, 'active',
    () => productService.update(p.id, { IsActive: !p.isActive }),
    { isActive: !p.isActive },
    p.isActive ? 'أُخفي المنتج عن الزبائن' : 'أصبح المنتج ظاهراً في المتجر')

  const saveStock = (p, qty) => run(p.id, 'stock',
    () => productService.updateStock(p.id, qty),
    { stockQuantity: qty }, 'تم تحديث المخزون')

  // ===== الإجراءات الجماعية =====
  const exitSelect = () => { setSelecting(false); setSelected([]) }
  const bulkSetActive = async (isActive) => {
    const targets = products.filter(p => selected.includes(p.id) && p.isActive !== isActive)
    const results = await Promise.allSettled(targets.map(p => productService.update(p.id, { IsActive: isActive }).then(() => patchLocal(p.id, { isActive }))))
    const failed = results.filter(r => r.status === 'rejected').length
    if (failed) showError(`تعذّر تحديث ${failed} منتج`)
    else success(isActive ? `تم إظهار ${targets.length} منتج` : `تم إخفاء ${targets.length} منتج`)
    exitSelect()
  }

  const confirmDelete = async () => {
    setDeleting(true)
    const ids = toDelete === 'bulk' ? selected : [toDelete.id]
    const results = await Promise.allSettled(ids.map(id => productService.delete(id)))
    const done = ids.filter((_, i) => results[i].status === 'fulfilled')
    queryClient.setQueryData(['vendor-products', vendorId], (old = []) => old.filter(p => !done.includes(p.id)))
    setDeleting(false)
    setToDelete(null)
    if (done.length < ids.length) showError(`تعذّر حذف ${ids.length - done.length} منتج`)
    else success(ids.length > 1 ? `تم حذف ${ids.length} منتجات` : 'تم حذف المنتج')
    exitSelect()
  }

  const actionsFor = (p) => [
    { label: 'تعديل', icon: Edit, onClick: () => navigate(`/vendor/products/${p.id}/edit`) },
    { label: 'عرض في المتجر', icon: Eye, onClick: () => window.open(`/products/${p.id}`, '_blank') },
    { divider: true },
    { label: 'حذف', icon: Trash2, danger: true, onClick: () => setToDelete(p) },
  ]

  if (isError) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">المنتجات</h1>
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-700">{error?.message || 'فشل تحميل المنتجات'}</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>إعادة المحاولة</Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      {/* العنوان */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">المنتجات</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {counts.all} منتج
            {counts.out > 0 && <span className="text-red-600"> · {counts.out} نفذ مخزونها</span>}
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} aria-label="تحديث"
          className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center">
          <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
        </button>
        <Link to="/vendor/products/new"
          className="hidden sm:inline-flex h-11 px-5 rounded-full bg-primary text-white font-bold items-center gap-2 shadow-md shadow-primary/25 hover:bg-primary/90">
          <Plus size={18} />إضافة منتج
        </Link>
      </div>

      {/* الفلاتر بالأرقام */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
        {FILTERS.map(f => {
          const active = filter === f.key
          const alert = f.tone && counts[f.key] > 0
          return (
            <button key={f.key} onClick={() => { setFilter(f.key); setLimit(PAGE_SIZE) }}
              className={`h-9 px-3.5 rounded-full text-sm font-medium whitespace-nowrap inline-flex items-center gap-1.5 border transition-colors ${
                active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
              {f.label}
              <span className={`text-[11px] min-w-5 px-1.5 rounded-full ${active ? 'bg-white/20' :
                alert ? (f.tone === 'red' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700') : 'bg-gray-100 text-gray-500'}`}>
                {counts[f.key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* البحث والترتيب والتحديد */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setLimit(PAGE_SIZE) }}
            placeholder="ابحث بالاسم أو SKU..."
            className="w-full h-10 pr-9 pl-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <label className="relative">
          <ArrowUpDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select value={sort} onChange={e => setSort(e.target.value)} aria-label="الترتيب"
            className="h-10 pr-8 pl-3 bg-white border border-gray-200 rounded-xl text-sm appearance-none">
            {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <button onClick={() => selecting ? exitSelect() : setSelecting(true)}
          className={`h-10 px-3 rounded-xl border text-sm font-medium inline-flex items-center gap-1.5 ${selecting ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-gray-200 text-gray-700'}`}>
          <CheckSquare size={16} /><span className="hidden sm:inline">{selecting ? 'إلغاء التحديد' : 'تحديد'}</span>
        </button>
      </div>

      {/* القائمة */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="w-14 h-14 rounded-xl" />
              <div className="flex-1"><Skeleton className="h-4 w-40 mb-2" /><Skeleton className="h-3 w-24" /></div>
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-14 px-6 text-center">
          <span className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center"><Package size={30} className="text-primary" /></span>
          <p className="mt-4 font-bold text-gray-900">أضف أول منتج لمتجرك</p>
          <p className="text-sm text-gray-500 mt-1">صورة، اسم، سعر وكمية — وسيظهر مباشرة للزبائن</p>
          <Link to="/vendor/products/new" className="mt-5 inline-flex h-11 px-6 rounded-full bg-primary text-white font-bold items-center gap-2">
            <Plus size={18} />إضافة منتج
          </Link>
        </div>
      ) : list.length === 0 ? (
        <p className="text-center text-sm text-gray-500 bg-white rounded-2xl border border-gray-200 py-10">لا توجد منتجات مطابقة</p>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* رأس الأعمدة — الشاشات الكبيرة */}
            <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500">
              {selecting && (
                <input type="checkbox" aria-label="تحديد الكل"
                  checked={shown.length > 0 && shown.every(p => selected.includes(p.id))}
                  onChange={e => setSelected(e.target.checked ? shown.map(p => p.id) : [])}
                  className="w-5 h-5 rounded border-gray-300 text-primary" />
              )}
              <span className="w-14" />
              <span className="flex-1 grid grid-cols-[1fr_8rem_8rem] gap-4"><span>المنتج</span><span>السعر</span><span>المخزون</span></span>
              <span className="w-[5.5rem] text-center">في المتجر</span>
            </div>
            <div className="divide-y divide-gray-100">
              {shown.map(p => (
                <ProductRow key={p.id} product={p}
                  selecting={selecting} selected={selected.includes(p.id)}
                  onSelect={() => setSelected(s => s.includes(p.id) ? s.filter(i => i !== p.id) : [...s, p.id])}
                  onToggleActive={() => toggleActive(p)}
                  onStock={(qty) => saveStock(p, qty)}
                  busy={busy[p.id]} actions={actionsFor(p)} />
              ))}
            </div>
          </div>
          {list.length > shown.length && (
            <button onClick={() => setLimit(l => l + PAGE_SIZE)}
              className="w-full h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
              عرض المزيد ({list.length - shown.length})
            </button>
          )}
        </>
      )}

      {/* شريط الإجراءات الجماعية */}
      {selecting && selected.length > 0 && (
        <div className="fixed bottom-4 inset-x-4 lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-[34rem] z-40 flex items-center gap-2 p-2 pr-4 rounded-2xl bg-gray-900 text-white shadow-2xl">
          <span className="flex-1 text-sm font-bold">{selected.length} محدد</span>
          <button onClick={() => bulkSetActive(true)} className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-sm inline-flex items-center gap-1.5"><Eye size={15} />إظهار</button>
          <button onClick={() => bulkSetActive(false)} className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-sm inline-flex items-center gap-1.5"><EyeOff size={15} />إخفاء</button>
          <button onClick={() => setToDelete('bulk')} className="h-9 px-3 rounded-xl bg-red-500 hover:bg-red-600 text-sm inline-flex items-center gap-1.5"><Trash2 size={15} />حذف</button>
        </div>
      )}

      {/* زر الإضافة العائم — الهاتف */}
      {!selecting && (
        <Link to="/vendor/products/new" aria-label="إضافة منتج"
          className="sm:hidden fixed bottom-5 left-5 z-30 h-14 pl-6 pr-5 rounded-full bg-gradient-to-l from-primary to-indigo-500 text-white font-bold inline-flex items-center gap-2 shadow-xl shadow-primary/40 active:scale-95 transition-transform">
          <Plus size={22} strokeWidth={2.5} />منتج جديد
        </Link>
      )}

      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title={toDelete === 'bulk' ? `حذف ${selected.length} منتج` : 'حذف المنتج'}
        message={toDelete === 'bulk'
          ? 'سيتم حذف المنتجات المحددة نهائياً. لإيقافها مؤقتاً استخدم «إخفاء» بدلاً من ذلك.'
          : `هل تريد حذف «${toDelete?.nameAr || toDelete?.name}» نهائياً؟ لإيقافه مؤقتاً يكفي إخفاؤه.`}
        confirmText="حذف" type="danger" loading={deleting}
      />
    </div>
  )
}

export default VendorProducts
