import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, X, Upload, Plus, Trash2, Info, ArrowRight } from 'lucide-react'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { Toggle } from '../../components/common/FormControls'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { useCategories } from '../../hooks/useCategories'
import { useProduct } from '../../hooks/useProducts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPostForm, apiPutForm } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'
import VendorVariantsManager from '../../components/vendor/VendorVariantsManager'

// ===========================
// Mutations — multipart/form-data
// ===========================

const useCreateProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fd) => {
      const r = await apiPostForm(API_ENDPOINTS.PRODUCTS.BASE, fd)
      return r.data.data || r.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor-products'] }),
  })
}

const useUpdateProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, fd }) => {
      const r = await apiPutForm(API_ENDPOINTS.PRODUCTS.BY_ID(id), fd)
      return r.data.data || r.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor-products'] }),
  })
}

// ===========================
// Main Component
// ===========================

const VendorProductForm = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const { user } = useAuthStore()
  const vendorId  = user?.vendorId || user?.id
  const isEditing = Boolean(id)
  const queryClient = useQueryClient()

  const [savedProductId, setSavedProductId] = useState(isEditing ? id : null)

  const { data: existing, isLoading: productLoading } = useProduct(id)
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories()
  const categories = (categoriesData || []).filter(c => !c.parentId)

  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const isSaving = createMutation.isPending || updateMutation.isPending

  const [form, setForm] = useState({
    Name:          '',
    NameAr:        '',
    Description:   '',
    Price:         '',
    OriginalPrice: '',
    Sku:           '',
    StockQuantity: '0',
    CategoryId:    '',
    IsActive:      true,
    IsAvailable:   true,
  })
  const [newImages,     setNewImages]     = useState([])  // { file, preview }
  const [existingImages, setExistingImages] = useState([]) // { id, imageUrl }
  const [errors, setErrors] = useState({})

  // ✅ تعبئة النموذج عند التعديل
  useEffect(() => {
    if (existing && isEditing) {
      setForm({
        Name:          existing.name          || '',
        NameAr:        existing.nameAr        || '',
        Description:   existing.description   || '',
        Price:         existing.price?.toString() || '',
        OriginalPrice: existing.originalPrice?.toString() || '',
        Sku:           existing.sku           || '',
        StockQuantity: existing.stockQuantity?.toString() || '0',
        CategoryId:    existing.categoryId    || '',
        IsActive:      existing.isActive      ?? true,
        IsAvailable:   existing.isAvailable   ?? true,
      })
      // ✅ الصور الموجودة
      const imgs = existing.images || []
      const sorted = [...imgs].sort((a, b) => {
        if (a.isPrimary) return -1
        if (b.isPrimary) return 1
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
      })
      setExistingImages(sorted)
    }
  }, [existing, isEditing])

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files)
    const imgs = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setNewImages(prev => [...prev, ...imgs])
  }

  const buildFd = () => {
    const fd = new FormData()
    if (!isEditing) fd.append('VendorId', vendorId)
    fd.append('Name',          form.Name          || form.NameAr)
    fd.append('NameAr',        form.NameAr)
    fd.append('Description',   form.Description   || '-')
    fd.append('Price',         String(Number(form.Price) || 0))
    if (form.OriginalPrice) fd.append('OriginalPrice', String(Number(form.OriginalPrice)))
    if (form.Sku)           fd.append('Sku',           form.Sku)
    fd.append('StockQuantity', String(Number(form.StockQuantity) || 0))
    if (form.CategoryId)    fd.append('CategoryId',    form.CategoryId)
    fd.append('IsActive',      String(form.IsActive))
    fd.append('IsAvailable',   String(form.IsAvailable))
    // ✅ POST = 'Images', PUT = 'NewImages'
    newImages.forEach(img => fd.append(isEditing ? 'NewImages' : 'Images', img.file))
    return fd
  }

  const validate = () => {
    const e = {}
    if (!form.NameAr.trim())         e.NameAr    = 'الاسم العربي مطلوب'
    if (!form.Price || isNaN(Number(form.Price))) e.Price = 'السعر مطلوب'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!validate()) return
    try {
      const fd = buildFd()
      if (isEditing) {
        await updateMutation.mutateAsync({ id, fd })
        success('تم تحديث المنتج بنجاح ✅')
        setSavedProductId(id)
        setNewImages([])
      } else {
        const result = await createMutation.mutateAsync(fd)
        const newId = result?.id || result?.data?.id
        success('تم إضافة المنتج ✅ — يمكنك الآن إضافة المتغيرات')
        if (newId) setSavedProductId(newId)
        else navigate('/vendor/products')
      }
    } catch (err) {
      showError(err.message || 'فشل حفظ المنتج')
    }
  }

  const inputCls = "w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary bg-white"

  if (isEditing && productLoading) return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'تعديل المنتج' : 'إضافة منتج جديد'}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isEditing ? 'تحديث معلومات المنتج' : 'أدخل معلومات المنتج الجديد'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/vendor/products')}>
            <X size={16} className="ml-1" />إلغاء
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={isSaving}>
            <Save size={16} className="ml-1" />
            {isEditing ? 'حفظ التغييرات' : 'إضافة المنتج'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">

          {/* Basic Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-900 mb-4">المعلومات الأساسية</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">الاسم العربي *</label>
                  <input value={form.NameAr} onChange={e => setForm({...form, NameAr: e.target.value})}
                    className={inputCls} placeholder="مثال: آيفون 15" />
                  {errors.NameAr && <p className="text-xs text-red-500 mt-1">{errors.NameAr}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">English Name</label>
                  <input value={form.Name} onChange={e => setForm({...form, Name: e.target.value})}
                    className={inputCls} placeholder="iPhone 15" dir="ltr" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">الوصف</label>
                <textarea value={form.Description} onChange={e => setForm({...form, Description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary"
                  rows={3} placeholder="وصف تفصيلي للمنتج..." />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-900 mb-4">التسعير والمخزون</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">السعر * (د.ع)</label>
                <input type="number" value={form.Price} onChange={e => setForm({...form, Price: e.target.value})}
                  className={inputCls} placeholder="0" />
                {errors.Price && <p className="text-xs text-red-500 mt-1">{errors.Price}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">السعر الأصلي</label>
                <input type="number" value={form.OriginalPrice} onChange={e => setForm({...form, OriginalPrice: e.target.value})}
                  className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">الكمية</label>
                <input type="number" min="0" value={form.StockQuantity}
                  onChange={e => setForm({...form, StockQuantity: e.target.value})}
                  className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">SKU</label>
                <input value={form.Sku} onChange={e => setForm({...form, Sku: e.target.value})}
                  className={inputCls} placeholder="SKU-001" dir="ltr" />
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-900 mb-4">صور المنتج</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {/* Existing images */}
              {existingImages.map((img, i) => (
                <div key={img.id} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group">
                  <img src={getImageUrl(img.imageUrl)} alt=""
                    className="w-full h-full object-cover"
                    onError={e => e.target.style.display='none'} />
                  {img.isPrimary && (
                    <span className="absolute bottom-1 right-1 text-xs bg-primary text-white px-1 rounded">رئيسية</span>
                  )}
                </div>
              ))}
              {/* New images */}
              {newImages.map((img, i) => (
                <div key={i} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button type="button"
                    onClick={() => setNewImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100">
                    <X size={10} />
                  </button>
                  <span className="absolute bottom-1 right-1 text-xs bg-blue-500 text-white px-1 rounded">جديدة</span>
                </div>
              ))}
              {/* Upload */}
              <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                <Upload size={20} className="text-gray-400" />
                <span className="text-xs text-gray-400">رفع</span>
                <input type="file" accept="image/*" multiple onChange={handleImageAdd} className="hidden" />
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <Info size={12} />صور بأبعاد 1000×1000 بكسل أو أكبر
            </p>
          </div>

          {/* Variants Manager */}
          {savedProductId && (
            <VendorVariantsManager
              productId={savedProductId}
              basePrice={Number(form.Price) || 0}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-900 mb-4">الحالة</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.IsActive}
                  onChange={e => setForm({...form, IsActive: e.target.checked})}
                  className="w-4 h-4 accent-primary" />
                <div>
                  <p className="text-sm font-medium">منتج نشط</p>
                  <p className="text-xs text-gray-400">يظهر في متجرك</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.IsAvailable}
                  onChange={e => setForm({...form, IsAvailable: e.target.checked})}
                  className="w-4 h-4 accent-primary" />
                <div>
                  <p className="text-sm font-medium">متاح للبيع</p>
                  <p className="text-xs text-gray-400">يمكن إضافته للسلة</p>
                </div>
              </label>
            </div>
          </div>

          {/* Category */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-bold text-gray-900 mb-3">الفئة</h2>
            {categoriesLoading ? (
              <Skeleton className="h-10" />
            ) : (
              <select value={form.CategoryId}
                onChange={e => setForm({...form, CategoryId: e.target.value})}
                className={inputCls}>
                <option value="">— اختر الفئة —</option>
                {(categoriesData || []).map(c => (
                  <option key={c.id} value={c.id}>{c.nameAr || c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Hint */}
          {!savedProductId && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <p className="text-sm text-blue-700 flex items-start gap-2">
                <Info size={15} className="flex-shrink-0 mt-0.5" />
                بعد حفظ المنتج ستتمكن من إضافة المتغيرات (الألوان، الأحجام...)
              </p>
            </div>
          )}

          {savedProductId && (
            <Button variant="ghost" fullWidth onClick={() => navigate('/vendor/products')}>
              <ArrowRight size={15} className="ml-1" />العودة للمنتجات
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default VendorProductForm