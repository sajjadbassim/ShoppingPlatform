// src/pages/vendor/VendorProductForm.jsx
// إضافة/تعديل منتج: الصور أولاً، ثم الاسم والفئة، ثم السعر والكمية — وزر حفظ ثابت في الأسفل على الهاتف
import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  Save, X, ImagePlus, Star, Trash2, Info, ArrowRight, Minus, Plus, ChevronDown, RefreshCw, CheckCircle2,
} from 'lucide-react'
import { Toggle } from '../../components/common/FormControls'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { useCategories } from '../../hooks/useCategories'
import { useProduct } from '../../hooks/useProducts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPostForm, apiPutForm, apiDelete, apiPatch } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'
import VendorVariantsManager from '../../components/vendor/VendorVariantsManager'

const MAX_IMAGES = 5

const Section = ({ title, hint, children, className = '' }) => (
  <section className={`bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 ${className}`}>
    <div className="mb-3">
      <p className="text-base font-bold text-gray-900">{title}</p>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
    {children}
  </section>
)

const Field = ({ label, required, error, children, hint }) => (
  <label className="block">
    <span className="block text-sm font-medium text-gray-700 mb-1.5">{label}{required && <span className="text-red-500"> *</span>}</span>
    {children}
    {error ? <span className="block text-xs text-red-500 mt-1">{error}</span> : hint ? <span className="block text-xs text-gray-400 mt-1">{hint}</span> : null}
  </label>
)

const inputCls = (err) =>
  `w-full h-11 px-3 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 ${err ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-primary/25 focus:border-primary'}`

const VendorProductForm = () => {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { success, error: showError } = useToast()
  const { user } = useAuthStore()
  const vendorId = user?.vendorId || user?.id
  const isEditing = Boolean(id)
  const justCreated = searchParams.get('new') === '1'

  const { data: existing, isLoading: productLoading } = useProduct(id)
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories()

  const [form, setForm] = useState({
    Name: '', NameAr: '', Description: '', Price: '', OriginalPrice: '', Sku: '',
    StockQuantity: '1', CategoryId: '', IsActive: true, IsAvailable: true,
  })
  const set = (patch) => setForm(f => ({ ...f, ...patch }))
  const [newImages, setNewImages] = useState([])          // { file, preview }
  const [existingImages, setExistingImages] = useState([]) // من الخادم
  const [errors, setErrors] = useState({})
  const [showMore, setShowMore] = useState(false)
  const [imageBusy, setImageBusy] = useState(null)

  useEffect(() => {
    if (!existing || !isEditing) return
    setForm({
      Name: existing.name || '',
      NameAr: existing.nameAr || '',
      Description: existing.description && existing.description !== '-' ? existing.description : '',
      // القيم المخزّنة لا المعروضة للزبون (السعر بعد العرض) — وإلا ينقص السعر الحقيقي بقيمة العرض عند الحفظ
      Price: (existing.regularPrice ?? existing.price)?.toString() || '',
      OriginalPrice: (existing.regularOriginalPrice !== undefined ? existing.regularOriginalPrice : existing.originalPrice)?.toString() || '',
      Sku: existing.sku || '',
      StockQuantity: (existing.regularStockQuantity ?? existing.stockQuantity)?.toString() || '0',
      CategoryId: existing.categoryId || '',
      IsActive: existing.isActive ?? true,
      IsAvailable: existing.regularIsAvailable ?? existing.isAvailable ?? true,
    })
    setExistingImages([...(existing.images || [])].sort((a, b) =>
      a.isPrimary ? -1 : b.isPrimary ? 1 : (a.displayOrder ?? 0) - (b.displayOrder ?? 0)))
    if (existing.name || existing.sku) setShowMore(true)
  }, [existing, isEditing])

  // تحرير روابط المعاينة عند الخروج
  useEffect(() => () => newImages.forEach(i => URL.revokeObjectURL(i.preview)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const imageCount = existingImages.length + newImages.length
  const price = Number(form.Price) || 0
  const original = Number(form.OriginalPrice) || 0
  const discount = original > price && price > 0 ? Math.round((1 - price / original) * 100) : 0

  const handleImageAdd = (e) => {
    const room = MAX_IMAGES - imageCount
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'))
    if (files.length > room) showError(`الحد الأقصى ${MAX_IMAGES} صور للمنتج`)
    setNewImages(prev => [...prev, ...files.slice(0, Math.max(0, room)).map(f => ({ file: f, preview: URL.createObjectURL(f) }))])
    e.target.value = ''
  }

  const removeNewImage = (i) => setNewImages(prev => {
    URL.revokeObjectURL(prev[i].preview)
    return prev.filter((_, j) => j !== i)
  })

  const deleteExistingImage = async (img) => {
    if (!confirm('حذف هذه الصورة؟')) return
    setImageBusy(img.id)
    try {
      await apiDelete(API_ENDPOINTS.PRODUCTS.DELETE_IMAGE(img.id))
      setExistingImages(prev => prev.filter(i => i.id !== img.id))
      queryClient.invalidateQueries({ queryKey: ['vendor-products'] })
    } catch (err) { showError(err.message || 'تعذّر حذف الصورة') }
    finally { setImageBusy(null) }
  }

  const makePrimary = async (img) => {
    setImageBusy(img.id)
    try {
      await apiPatch(API_ENDPOINTS.PRODUCTS.SET_PRIMARY_IMAGE(id, img.id))
      setExistingImages(prev => [{ ...img, isPrimary: true }, ...prev.filter(i => i.id !== img.id).map(i => ({ ...i, isPrimary: false }))])
      queryClient.invalidateQueries({ queryKey: ['vendor-products'] })
    } catch (err) { showError(err.message || 'تعذّر تعيين الصورة الرئيسية') }
    finally { setImageBusy(null) }
  }

  const buildFd = () => {
    const fd = new FormData()
    if (!isEditing) fd.append('VendorId', vendorId)
    fd.append('Name', form.Name.trim() || form.NameAr.trim())
    fd.append('NameAr', form.NameAr.trim())
    fd.append('Description', form.Description.trim() || '-')
    fd.append('Price', String(price))
    if (form.OriginalPrice) fd.append('OriginalPrice', String(original))
    else if (isEditing) fd.append('ClearOriginalPrice', 'true') // مسح السعر قبل الخصم
    if (form.Sku.trim()) fd.append('Sku', form.Sku.trim())
    fd.append('StockQuantity', String(Math.max(0, Number(form.StockQuantity) || 0)))
    if (form.CategoryId) fd.append('CategoryId', form.CategoryId)
    else if (isEditing) fd.append('ClearCategory', 'true')
    fd.append('IsActive', String(form.IsActive))
    fd.append('IsAvailable', String(form.IsAvailable))
    // الإنشاء يستقبل 'Images' والتعديل 'NewImages'
    newImages.forEach(img => fd.append(isEditing ? 'NewImages' : 'Images', img.file))
    return fd
  }

  const validate = () => {
    const e = {}
    if (!form.NameAr.trim()) e.NameAr = 'اكتب اسم المنتج'
    if (!price) e.Price = 'اكتب سعر البيع'
    if (form.OriginalPrice && original <= price) e.OriginalPrice = 'يجب أن يكون أعلى من سعر البيع ليظهر كخصم'
    if (!isEditing && imageCount === 0) e.images = 'أضف صورة واحدة على الأقل — المنتجات بصور تُباع أكثر'
    setErrors(e)
    if (Object.keys(e).length) window.scrollTo({ top: 0, behavior: 'smooth' })
    return Object.keys(e).length === 0
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = isEditing
        ? await apiPutForm(API_ENDPOINTS.PRODUCTS.BY_ID(id), buildFd())
        : await apiPostForm(API_ENDPOINTS.PRODUCTS.BASE, buildFd())
      return r.data.data || r.data
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-products'] })
      if (isEditing) {
        queryClient.invalidateQueries({ queryKey: ['products'] })
        success('تم حفظ التغييرات ✅')
        setNewImages([])
        if (saved?.images) setExistingImages([...saved.images].sort((a, b) => a.isPrimary ? -1 : b.isPrimary ? 1 : 0))
        return
      }
      // بعد الإنشاء ننتقل لوضع التعديل حتى لا يُنشئ الحفظ التالي نسخة مكررة، وتظهر المتغيرات
      if (saved?.id) navigate(`/vendor/products/${saved.id}/edit?new=1`, { replace: true })
      else { success('تمت إضافة المنتج ✅'); navigate('/vendor/products') }
    },
    onError: (err) => showError(err.message || 'فشل حفظ المنتج'),
  })

  const submit = () => {
    if (validate()) saveMutation.mutate()
  }
  const saving = saveMutation.isPending

  if (isEditing && productLoading) return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  )

  const saveLabel = isEditing ? 'حفظ التغييرات' : 'إضافة المنتج'

  return (
    <div className="max-w-5xl mx-auto pb-28 lg:pb-6">
      {/* العنوان */}
      <div className="flex items-center gap-3 mb-4">
        <Link to="/vendor/products" aria-label="رجوع" className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center flex-shrink-0">
          <ArrowRight size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{isEditing ? (form.NameAr || 'تعديل المنتج') : 'منتج جديد'}</h1>
          <p className="text-xs text-gray-500">{isEditing ? 'عدّل ما تريد ثم احفظ' : 'الحقول المطلوبة: الصورة، الاسم، السعر'}</p>
        </div>
        <button type="button" onClick={submit} disabled={saving}
          className="hidden lg:inline-flex h-11 px-6 rounded-full bg-primary text-white font-bold items-center gap-2 shadow-md shadow-primary/25 disabled:opacity-60">
          {saving ? <RefreshCw size={17} className="animate-spin" /> : <Save size={17} />}{saveLabel}
        </button>
      </div>

      {justCreated && (
        <div className="mb-4 flex items-start gap-3 p-4 rounded-2xl bg-green-50 border border-green-200">
          <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-bold text-green-800">تمت إضافة المنتج وهو الآن في متجرك</p>
            <p className="text-green-700 mt-0.5">إن كان له مقاسات أو ألوان، أضفها من قسم «المتغيرات» بالأسفل.</p>
          </div>
          <Link to="/vendor/products/new" className="text-sm font-bold text-green-800 whitespace-nowrap underline">+ منتج آخر</Link>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_20rem] gap-4 items-start">
        <div className="space-y-4">
          {/* الصور */}
          <Section title="الصور" hint={`حتى ${MAX_IMAGES} صور — الأولى هي التي تظهر في المتجر`}>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {existingImages.map(img => (
                <div key={img.id} className={`relative aspect-square rounded-xl overflow-hidden product-media ${img.isPrimary ? 'ring-2 ring-primary' : ''}`}>
                  <img src={getImageUrl(img.imageUrl)} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />
                  {imageBusy === img.id && <span className="absolute inset-0 bg-white/60 flex items-center justify-center"><RefreshCw size={18} className="animate-spin text-primary" /></span>}
                  {img.isPrimary
                    ? <span className="absolute bottom-1 right-1 text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-md">الرئيسية</span>
                    : <button type="button" onClick={() => makePrimary(img)} title="اجعلها الرئيسية"
                        className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center"><Star size={14} className="text-amber-500" /></button>}
                  <button type="button" onClick={() => deleteExistingImage(img)} aria-label="حذف الصورة"
                    className="absolute top-1 left-1 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center"><Trash2 size={13} className="text-red-500" /></button>
                </div>
              ))}
              {newImages.map((img, i) => (
                <div key={img.preview} className={`relative aspect-square rounded-xl overflow-hidden product-media ${existingImages.length === 0 && i === 0 ? 'ring-2 ring-primary' : ''}`}>
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  {existingImages.length === 0 && i === 0 && <span className="absolute bottom-1 right-1 text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-md">الرئيسية</span>}
                  {isEditing && <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-md">جديدة</span>}
                  <button type="button" onClick={() => removeNewImage(i)} aria-label="إزالة"
                    className="absolute top-1 left-1 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center"><X size={14} /></button>
                </div>
              ))}
              {imageCount < MAX_IMAGES && (
                <label className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                  errors.images ? 'border-red-300 bg-red-50/50' : 'border-gray-300 hover:border-primary hover:bg-primary/5'} ${imageCount === 0 ? 'col-span-3 sm:col-span-2 aspect-auto h-32' : ''}`}>
                  <ImagePlus size={imageCount === 0 ? 28 : 22} className="text-primary" />
                  <span className="text-xs font-medium text-gray-600">{imageCount === 0 ? 'أضف صور المنتج' : 'إضافة'}</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageAdd} className="hidden" />
                </label>
              )}
            </div>
            {errors.images && <p className="text-xs text-red-500 mt-2">{errors.images}</p>}
          </Section>

          {/* المعلومات */}
          <Section title="المعلومات">
            <div className="space-y-3.5">
              <Field label="اسم المنتج" required error={errors.NameAr}>
                <input value={form.NameAr} onChange={e => set({ NameAr: e.target.value })} className={inputCls(errors.NameAr)} placeholder="مثال: آيفون 15 برو 256GB" />
              </Field>
              <Field label="الفئة" hint="تساعد الزبائن على إيجاد منتجك">
                {categoriesLoading ? <Skeleton className="h-11 rounded-xl" /> : (
                  <select value={form.CategoryId} onChange={e => set({ CategoryId: e.target.value })} className={inputCls()}>
                    <option value="">اختر الفئة</option>
                    {(categoriesData || []).map(c => <option key={c.id} value={c.id}>{c.parentId ? '— ' : ''}{c.nameAr || c.name}</option>)}
                  </select>
                )}
              </Field>
              <Field label="الوصف">
                <textarea value={form.Description} onChange={e => set({ Description: e.target.value })} rows={4}
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
                  placeholder="المواصفات، المقاسات، الضمان، طريقة الاستخدام..." />
              </Field>
            </div>
          </Section>

          {/* السعر والكمية */}
          <Section title="السعر والكمية">
            <div className="grid grid-cols-2 gap-3">
              <Field label="سعر البيع (د.ع)" required error={errors.Price}>
                <input type="number" inputMode="numeric" min="0" value={form.Price} onChange={e => set({ Price: e.target.value })} className={inputCls(errors.Price)} placeholder="0" />
              </Field>
              <Field label="السعر قبل الخصم" error={errors.OriginalPrice} hint={discount ? null : 'اختياري'}>
                <div className="relative">
                  <input type="number" inputMode="numeric" min="0" value={form.OriginalPrice} onChange={e => set({ OriginalPrice: e.target.value })} className={inputCls(errors.OriginalPrice)} placeholder="0" />
                  {discount > 0 && <span className="absolute left-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[11px] font-bold">-{discount}%</span>}
                </div>
              </Field>
            </div>
            <div className="mt-3.5">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">الكمية المتوفرة</span>
              <div className="inline-flex items-center rounded-xl border border-gray-200 overflow-hidden">
                <button type="button" onClick={() => set({ StockQuantity: String(Math.max(0, (Number(form.StockQuantity) || 0) - 1)) })} className="w-11 h-11 flex items-center justify-center hover:bg-gray-50" aria-label="إنقاص"><Minus size={16} /></button>
                <input type="number" inputMode="numeric" min="0" value={form.StockQuantity} onChange={e => set({ StockQuantity: e.target.value })}
                  className="w-20 h-11 text-center font-bold border-x border-gray-200 focus:outline-none" aria-label="الكمية" />
                <button type="button" onClick={() => set({ StockQuantity: String((Number(form.StockQuantity) || 0) + 1) })} className="w-11 h-11 flex items-center justify-center hover:bg-gray-50" aria-label="زيادة"><Plus size={16} /></button>
              </div>
            </div>

            {/* خيارات إضافية */}
            <button type="button" onClick={() => setShowMore(v => !v)} className="mt-4 text-sm text-primary font-medium inline-flex items-center gap-1">
              خيارات إضافية (الاسم بالإنجليزية، SKU)
              <ChevronDown size={16} className={`transition-transform ${showMore ? 'rotate-180' : ''}`} />
            </button>
            {showMore && (
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <Field label="الاسم بالإنجليزية">
                  <input value={form.Name} onChange={e => set({ Name: e.target.value })} className={inputCls()} placeholder="iPhone 15 Pro" dir="ltr" />
                </Field>
                <Field label="رمز المنتج SKU" hint="لتنظيم مخزونك">
                  <input value={form.Sku} onChange={e => set({ Sku: e.target.value })} className={inputCls()} placeholder="IP15-256" dir="ltr" />
                </Field>
              </div>
            )}
          </Section>

          {/* المتغيرات — بعد الحفظ */}
          {isEditing ? (
            <VendorVariantsManager productId={id} basePrice={price} />
          ) : (
            <p className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-2xl p-3.5">
              <Info size={16} className="flex-shrink-0 mt-0.5" />
              للمقاسات أو الألوان: احفظ المنتج أولاً، ثم أضفها من قسم «المتغيرات».
            </p>
          )}
        </div>

        {/* الظهور — جانبي على الكمبيوتر */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <Section title="الظهور">
            <div className="divide-y divide-gray-100 -my-1">
              {[
                { key: 'IsActive', title: 'ظاهر في المتجر', desc: 'عند الإيقاف يختفي عن الزبائن ويبقى محفوظاً' },
                { key: 'IsAvailable', title: 'متاح للشراء', desc: 'عند الإيقاف يظهر بدون زر «أضف للسلة»' },
              ].map(t => (
                <label key={t.key} className="flex items-center gap-3 py-3 cursor-pointer">
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-gray-900">{t.title}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">{t.desc}</span>
                  </span>
                  <Toggle checked={form[t.key]} onChange={e => set({ [t.key]: e.target.checked })} />
                </label>
              ))}
            </div>
          </Section>
          {isEditing && (
            <Link to={`/products/${id}`} target="_blank" className="block text-center text-sm text-gray-500 hover:text-primary">عرض المنتج كما يراه الزبون ↗</Link>
          )}
        </div>
      </div>

      {/* شريط الحفظ الثابت — الهاتف والأجهزة اللوحية */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2">
        <button type="button" onClick={() => navigate('/vendor/products')} className="h-12 px-5 rounded-xl border border-gray-200 font-bold text-gray-700">إلغاء</button>
        <button type="button" onClick={submit} disabled={saving}
          className="flex-1 h-12 rounded-xl bg-primary text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}{saveLabel}
        </button>
      </div>
    </div>
  )
}

export default VendorProductForm
