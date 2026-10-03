// src/pages/admin/AdminHomepage.jsx
import { useState } from 'react'
import {
  Plus, Edit, Trash2, MoreVertical, Image as ImageIcon, Upload, X,
  Info, RefreshCw, Eye, EyeOff, Search, Package, Store, LayoutGrid, Sparkles,
} from 'lucide-react'
import Button from '../../components/common/Button'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { ConfirmModal } from '../../components/common/Modal'
import { Tabs, TabsList, TabsTrigger } from '../../components/common/Tabs'
import Dropdown from '../../components/common/Dropdown'
import { getImageUrl } from '../../utils/imageHelper'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { useQuery } from '@tanstack/react-query'
import { useCategories } from '../../hooks/useCategories'
import { useVendors } from '../../hooks/useVendors'
import {
  useBannersAdmin, useCreateBanner, useUpdateBanner, useDeleteBanner,
  useSectionsAdmin, useCreateSection, useUpdateSection, useDeleteSection,
  useAddSectionItem, useRemoveSectionItem, useSetSectionBanner, useRemoveSectionBanner,
} from '../../hooks/useHome'

// ===========================
// Shared: Product Picker (بحث واختيار منتج)
// ===========================

const ProductPicker = ({ onSelect, excludeIds = [] }) => {
  const [term, setTerm] = useState('')

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['product-picker-search', term],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.PRODUCTS.UNIFIED_SEARCH, { term, maxResults: 8 })
      const data = r.data.data || r.data
      return data?.products || []
    },
    enabled: term.trim().length >= 2,
  })

  const filtered = results.filter(p => !excludeIds.includes(p.id))

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={term}
          onChange={e => setTerm(e.target.value)}
          placeholder="ابحث عن منتج بالاسم..."
          className="w-full h-10 pr-9 pl-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>
      {term.trim().length >= 2 && (
        <div className="mt-2 border border-gray-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
          {isFetching ? (
            <p className="p-3 text-xs text-gray-400 text-center">جارِ البحث...</p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-xs text-gray-400 text-center">لا توجد نتائج</p>
          ) : filtered.map(p => (
            <button key={p.id} type="button"
              onClick={() => { onSelect(p); setTerm('') }}
              className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 text-right">
              <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {p.primaryImageUrl
                  ? <img src={getImageUrl(p.primaryImageUrl)} alt="" className="w-full h-full object-cover" />
                  : <Package size={14} className="text-gray-400" />}
              </div>
              <span className="text-sm text-gray-800 truncate flex-1">{p.nameAr || p.name}</span>
              <span className="text-xs text-primary font-medium">{(p.price || 0).toLocaleString()} د.ع</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ===========================
// Banners Tab
// ===========================

const LINK_TYPE_LABELS = {
  '': 'بدون رابط (الصفحة الرئيسية للمنتجات)',
  url: 'رابط مخصص',
  category: 'تصنيف',
  vendor: 'متجر',
  product: 'منتج',
}

// مكان ظهور البانر: السلايدر العلوي أو أحد أقسام "بلوك بانرات"
const IMAGE_HINTS = {
  hero: <>المقاس المثالي: <span dir="ltr">1200×500</span> بكسل — صورة عريضة للسلايدر أعلى الصفحة الرئيسية</>,
  block: <>عريض <span dir="ltr">1200×560</span> للبانر الأول (أو الوحيد) في البلوك، ومربع <span dir="ltr">800×800</span> للبانرات المتجاورة — اكتب النص على الصورة نفسها</>,
}

const BannerModal = ({ banner, onClose, defaultSectionId = '' }) => {
  const { success, error: showError } = useToast()
  const isEdit = !!banner?.id
  const { data: categories = [] } = useCategories(true)
  const { data: vendors = [] } = useVendors(true)
  const { data: sectionsData } = useSectionsAdmin()
  const blockSections = (Array.isArray(sectionsData) ? sectionsData : []).filter(s => s.type === 'banners')

  const [form, setForm] = useState({
    Title: banner?.title || '',
    TitleAr: banner?.titleAr || '',
    Subtitle: banner?.subtitle || '',
    SubtitleAr: banner?.subtitleAr || '',
    LinkType: banner?.linkType || '',
    LinkUrl: banner?.linkUrl || '',
    LinkEntityId: banner?.linkEntityId || '',
    DisplayOrder: banner?.displayOrder ?? 0,
    IsActive: banner?.isActive ?? true,
    SectionId: banner?.sectionId || defaultSectionId || '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(banner?.imageUrl ? getImageUrl(banner.imageUrl) : null)
  const [pickedEntityName, setPickedEntityName] = useState('')

  const createMutation = useCreateBanner()
  const updateMutation = useUpdateBanner()
  const isPending = createMutation.isPending || updateMutation.isPending

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const buildFd = () => {
    const fd = new FormData()
    fd.append('Title', form.Title)
    fd.append('TitleAr', form.TitleAr || '')
    fd.append('Subtitle', form.Subtitle || '')
    fd.append('SubtitleAr', form.SubtitleAr || '')
    fd.append('DisplayOrder', String(Number(form.DisplayOrder) || 0))
    if (form.LinkType) {
      fd.append('LinkType', form.LinkType)
      if (form.LinkType === 'url') fd.append('LinkUrl', form.LinkUrl || '')
      else if (form.LinkEntityId) fd.append('LinkEntityId', form.LinkEntityId)
    } else if (isEdit) {
      // النص الفارغ يصل للخادم كـ null ويُتجاهل، لذا نرسل 'none' لمسح الرابط
      fd.append('LinkType', 'none')
    }
    if (isEdit) fd.append('IsActive', String(form.IsActive))
    if (form.SectionId) fd.append('SectionId', form.SectionId)
    else if (isEdit && banner?.sectionId) fd.append('MoveToHero', 'true')
    if (imageFile) fd.append('ImageFile', imageFile)
    return fd
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.Title.trim()) { showError('يرجى إدخال العنوان بالإنجليزية'); return }
    if (!isEdit && !imageFile) { showError('صورة البانر مطلوبة'); return }
    if (form.LinkType && form.LinkType !== 'url' && !form.LinkEntityId) { showError('يرجى اختيار الوجهة المرتبطة بالبانر'); return }
    try {
      const fd = buildFd()
      if (isEdit) {
        await updateMutation.mutateAsync({ id: banner.id, formData: fd })
        success('تم تحديث البانر بنجاح')
      } else {
        await createMutation.mutateAsync(fd)
        success('تم إنشاء البانر بنجاح')
      }
      onClose()
    } catch (err) {
      showError(err.message || 'فشل حفظ البانر')
    }
  }

  const inputCls = "w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"

  const entityOptions = form.LinkType === 'category' ? categories
    : form.LinkType === 'vendor' ? vendors
    : null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-xl w-full max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-lg">{isEdit ? 'تعديل البانر' : 'إضافة بانر جديد'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* مكان الظهور */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">مكان الظهور</label>
            <select value={form.SectionId} onChange={e => setForm({...form, SectionId: e.target.value})} className={inputCls}>
              <option value="">السلايدر العلوي</option>
              {blockSections.map(s => <option key={s.id} value={s.id}>بلوك: {s.titleAr || s.title}</option>)}
            </select>
            {blockSections.length === 0 && (
              <p className="text-xs text-gray-400 mt-1.5">لإظهار بانرات بين الأقسام أنشئ قسماً من نوع «بلوك بانرات» في تبويب الأقسام</p>
            )}
          </div>

          {/* Image */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              صورة البانر {!isEdit && <span className="text-red-500">*</span>}
            </label>
            <div className="w-full h-32 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 mb-2">
              {imagePreview
                ? <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                : <ImageIcon size={28} className="text-gray-300" />}
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <Upload size={14} />{imagePreview ? 'تغيير الصورة' : 'رفع صورة'}
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
            <p className="text-xs text-gray-400 mt-2 flex items-start gap-1.5 leading-relaxed">
              <Info size={12} className="flex-shrink-0 mt-0.5" /><span>{form.SectionId ? IMAGE_HINTS.block : IMAGE_HINTS.hero}</span>
            </p>
          </div>

          {/* Titles */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">العنوان بالعربي</label>
              <input value={form.TitleAr} onChange={e => setForm({...form, TitleAr: e.target.value})}
                className={inputCls} placeholder="مرحباً بك في واسط" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Title (English) *</label>
              <input value={form.Title} onChange={e => setForm({...form, Title: e.target.value})}
                className={inputCls} placeholder="Welcome" dir="ltr" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">الوصف الفرعي بالعربي</label>
              <input value={form.SubtitleAr} onChange={e => setForm({...form, SubtitleAr: e.target.value})}
                className={inputCls} placeholder="تسوّق من أفضل المتاجر" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Subtitle (English)</label>
              <input value={form.Subtitle} onChange={e => setForm({...form, Subtitle: e.target.value})}
                className={inputCls} dir="ltr" />
            </div>
          </div>

          {/* Link */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">وجهة الضغط على البانر</label>
            <select value={form.LinkType}
              onChange={e => setForm({...form, LinkType: e.target.value, LinkEntityId: '', LinkUrl: ''})}
              className={inputCls}>
              {Object.entries(LINK_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {form.LinkType === 'url' && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">الرابط</label>
              <input value={form.LinkUrl} onChange={e => setForm({...form, LinkUrl: e.target.value})}
                className={inputCls} placeholder="/products?hasDiscount=true" dir="ltr" />
            </div>
          )}

          {entityOptions && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                {form.LinkType === 'category' ? 'اختر التصنيف' : 'اختر المتجر'}
              </label>
              <select value={form.LinkEntityId} onChange={e => setForm({...form, LinkEntityId: e.target.value})}
                className={inputCls}>
                <option value="">— اختر —</option>
                {entityOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.nameAr || o.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.LinkType === 'product' && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">اختر المنتج</label>
              {pickedEntityName ? (
                <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg text-sm">
                  <span>{pickedEntityName}</span>
                  <button type="button" onClick={() => { setForm({...form, LinkEntityId: ''}); setPickedEntityName('') }}
                    className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                </div>
              ) : (
                <ProductPicker onSelect={(p) => { setForm({...form, LinkEntityId: p.id}); setPickedEntityName(p.nameAr || p.name) }} />
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">ترتيب العرض</label>
            <input type="number" min="0" value={form.DisplayOrder}
              onChange={e => setForm({...form, DisplayOrder: e.target.value})}
              className={inputCls} />
          </div>

          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <input type="checkbox" checked={form.IsActive}
                onChange={e => setForm({...form, IsActive: e.target.checked})}
                className="w-4 h-4 accent-primary" />
              <div>
                <p className="text-sm font-medium text-gray-800">بانر نشط</p>
                <p className="text-xs text-gray-500">يظهر في الصفحة الرئيسية عند التفعيل</p>
              </div>
            </label>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth type="button" onClick={onClose}>إلغاء</Button>
            <Button variant="primary" fullWidth type="submit" loading={isPending}>
              {isEdit ? 'حفظ التعديلات' : 'إضافة البانر'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

const BannersTab = () => {
  const { success, error: showError } = useToast()
  const { data, isLoading, refetch } = useBannersAdmin()
  const { data: sectionsData } = useSectionsAdmin()
  const sectionName = (id) => {
    const sec = (Array.isArray(sectionsData) ? sectionsData : []).find(x => x.id === id)
    return sec ? `بلوك: ${sec.titleAr || sec.title}` : 'بلوك بانرات'
  }
  const updateMutation = useUpdateBanner()
  const deleteMutation = useDeleteBanner()

  const [modalBanner, setModalBanner] = useState(undefined) // undefined = closed, null = create, obj = edit
  const [deleteTarget, setDeleteTarget] = useState(null)

  const banners = Array.isArray(data) ? [...data].sort((a, b) => a.displayOrder - b.displayOrder) : []

  const handleToggleActive = async (banner) => {
    try {
      const fd = new FormData()
      fd.append('IsActive', String(!banner.isActive))
      await updateMutation.mutateAsync({ id: banner.id, formData: fd })
      success(banner.isActive ? 'تم إخفاء البانر' : 'تم تفعيل البانر')
    } catch (err) {
      showError(err.message || 'فشل تحديث البانر')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      success('تم حذف البانر بنجاح')
      setDeleteTarget(null)
    } catch (err) {
      showError(err.message || 'فشل حذف البانر')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{banners.length} بانر — في السلايدر العلوي أو داخل أقسام «بلوك بانرات»</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="primary" onClick={() => setModalBanner(null)}>
            <Plus size={16} className="ml-1" /><span className="whitespace-nowrap">إضافة بانر</span>
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : banners.length === 0 ? (
          <div className="p-16 text-center">
            <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">لا توجد بانرات بعد</p>
            <Button variant="primary" onClick={() => setModalBanner(null)}>
              <Plus size={16} className="ml-1" />إضافة أول بانر
            </Button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">البانر</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">مكان الظهور</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">الوجهة</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">الترتيب</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">الحالة</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {banners.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <img src={getImageUrl(b.imageUrl)} alt="" className="w-full h-full object-cover" />
                      </div>
                      <p className="font-medium text-gray-900 text-sm">{b.titleAr || b.title}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${b.sectionId ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                      {b.sectionId ? sectionName(b.sectionId) : 'السلايدر العلوي'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">{LINK_TYPE_LABELS[b.linkType || ''] || b.linkType}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-500">{b.displayOrder}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${b.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {b.isActive ? 'نشط' : 'مخفي'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Dropdown
                      trigger={<button className="p-1.5 hover:bg-gray-100 rounded-lg"><MoreVertical size={16} className="text-gray-500" /></button>}
                      items={[
                        { label: 'تعديل', icon: Edit, onClick: () => setModalBanner(b) },
                        { label: b.isActive ? 'إخفاء' : 'تفعيل', icon: b.isActive ? EyeOff : Eye, onClick: () => handleToggleActive(b) },
                        { divider: true },
                        { label: 'حذف', icon: Trash2, onClick: () => setDeleteTarget(b), danger: true },
                      ]}
                      align="left"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalBanner !== undefined && (
        <BannerModal banner={modalBanner} onClose={() => setModalBanner(undefined)} />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="حذف البانر"
        message={`هل أنت متأكد من حذف بانر "${deleteTarget?.titleAr || deleteTarget?.title}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        type="danger"
        confirmText="حذف"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

// ===========================
// Sections Tab
// ===========================

const SECTION_TYPES = {
  featured_products: { label: 'منتجات مميزة (تلقائي)', icon: Sparkles },
  top_vendors: { label: 'متاجر مميزة (تلقائي)', icon: Store },
  top_categories: { label: 'تصنيفات مميزة (تلقائي)', icon: LayoutGrid },
  custom_products: { label: 'منتجات مختارة يدوياً', icon: Package },
  banners: { label: 'بلوك بانرات (صور إعلانية)', icon: ImageIcon },
}

// أقسام المنتجات يمكن أن يكون لها بانر رأس
const PRODUCT_SECTION_TYPES = ['featured_products', 'custom_products']

const SectionModal = ({ section, onClose }) => {
  const { success, error: showError } = useToast()
  const isEdit = !!section?.id
  const { data: categories = [] } = useCategories(true)
  const { data: vendors = [] } = useVendors(true)

  const [form, setForm] = useState({
    Type: section?.type || 'featured_products',
    Title: section?.title || '',
    TitleAr: section?.titleAr || '',
    Subtitle: section?.subtitle || '',
    SubtitleAr: section?.subtitleAr || '',
    MaxItems: section?.maxItems ?? 10,
    FilterCategoryId: section?.filterCategoryId || '',
    FilterVendorId: section?.filterVendorId || '',
    DisplayOrder: section?.displayOrder ?? 0,
    IsActive: section?.isActive ?? true,
  })
  // منتجات custom_products المختارة (عند الإنشاء فقط — عند التعديل تُدار عبر addSectionItem/removeSectionItem)
  const [pickedProducts, setPickedProducts] = useState(
    isEdit && section?.type === 'custom_products' ? (section?.data || []) : []
  )

  const createMutation = useCreateSection()
  const updateMutation = useUpdateSection()
  const addItemMutation = useAddSectionItem()
  const removeItemMutation = useRemoveSectionItem()
  const setBannerMutation = useSetSectionBanner()
  const removeBannerMutation = useRemoveSectionBanner()
  const isPending = createMutation.isPending || updateMutation.isPending || setBannerMutation.isPending

  // نسخة حيّة من القسم (لتحديث قائمة بانرات البلوك وصورة الرأس بعد الحفظ)
  const { data: liveSections } = useSectionsAdmin()
  const live = (Array.isArray(liveSections) ? liveSections : []).find(x => x.id === section?.id) || section

  // بانر رأس قسم المنتجات
  const [headerFile, setHeaderFile] = useState(null)
  const [headerPreview, setHeaderPreview] = useState(section?.bannerImageUrl ? getImageUrl(section.bannerImageUrl) : null)
  const [removeHeader, setRemoveHeader] = useState(false)
  const [bannerModal, setBannerModal] = useState(undefined)   // بانرات البلوك: undefined مغلق، null إضافة، كائن تعديل

  const saveHeaderBanner = async (sectionId) => {
    if (!PRODUCT_SECTION_TYPES.includes(form.Type)) return
    if (headerFile) await setBannerMutation.mutateAsync({ id: sectionId, file: headerFile })
    else if (removeHeader && section?.bannerImageUrl) await removeBannerMutation.mutateAsync(sectionId)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.Title.trim()) { showError('يرجى إدخال العنوان بالإنجليزية'); return }
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: section.id,
          dto: {
            title: form.Title,
            titleAr: form.TitleAr || null,
            subtitle: form.Subtitle || null,
            subtitleAr: form.SubtitleAr || null,
            maxItems: Number(form.MaxItems) || 10,
            isActive: form.IsActive,
            displayOrder: Number(form.DisplayOrder) || 0,
            filterCategoryId: form.FilterCategoryId || null,
            filterVendorId: form.FilterVendorId || null,
          },
        })
        await saveHeaderBanner(section.id)
        success('تم تحديث القسم بنجاح')
      } else {
        const created = await createMutation.mutateAsync({
          type: form.Type,
          title: form.Title,
          titleAr: form.TitleAr || null,
          subtitle: form.Subtitle || null,
          subtitleAr: form.SubtitleAr || null,
          maxItems: Number(form.MaxItems) || 10,
          filterCategoryId: form.Type === 'featured_products' ? (form.FilterCategoryId || null) : null,
          filterVendorId: form.Type === 'featured_products' ? (form.FilterVendorId || null) : null,
          displayOrder: Number(form.DisplayOrder) || 0,
          productIds: form.Type === 'custom_products' ? pickedProducts.map(p => p.id) : null,
        })
        if (created?.id) await saveHeaderBanner(created.id)
        success(form.Type === 'banners' ? 'تم إنشاء القسم — أضف بانراته من «تعديل» أو من تبويب البانرات' : 'تم إنشاء القسم بنجاح')
      }
      onClose()
    } catch (err) {
      showError(err.message || 'فشل حفظ القسم')
    }
  }

  const handleAddProductLive = async (product) => {
    if (isEdit) {
      try {
        await addItemMutation.mutateAsync({ sectionId: section.id, productId: product.id, displayOrder: pickedProducts.length })
        setPickedProducts(prev => [...prev, product])
        success('تمت إضافة المنتج للقسم')
      } catch (err) {
        showError(err.message || 'فشل إضافة المنتج')
      }
    } else {
      setPickedProducts(prev => [...prev, product])
    }
  }

  const handleRemoveProductLive = async (product) => {
    if (isEdit) {
      try {
        await removeItemMutation.mutateAsync({ sectionId: section.id, productId: product.id })
        setPickedProducts(prev => prev.filter(p => p.id !== product.id))
        success('تم حذف المنتج من القسم')
      } catch (err) {
        showError(err.message || 'فشل حذف المنتج')
      }
    } else {
      setPickedProducts(prev => prev.filter(p => p.id !== product.id))
    }
  }

  const inputCls = "w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-xl w-full max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-lg">{isEdit ? 'تعديل القسم' : 'إضافة قسم جديد'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">نوع القسم</label>
            <select value={form.Type} onChange={e => setForm({...form, Type: e.target.value})}
              className={inputCls} disabled={isEdit}>
              {Object.entries(SECTION_TYPES).map(([val, { label }]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
              <Info size={12} />
              {form.Type === 'custom_products'
                ? 'تختار المنتجات يدوياً بنفسك أدناه'
                : form.Type === 'banners'
                  ? 'صور إعلانية بين الأقسام: بانر واحد يظهر عريضاً، اثنان متجاوران، ثلاثة = عريض واثنان تحته'
                  : 'يُملأ تلقائياً بأحدث/أفضل البيانات المطابقة من قاعدة البيانات — لا حاجة لاختيار عناصر يدوياً'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">العنوان بالعربي</label>
              <input value={form.TitleAr} onChange={e => setForm({...form, TitleAr: e.target.value})}
                className={inputCls} placeholder="منتجات مميزة" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Title (English) *</label>
              <input value={form.Title} onChange={e => setForm({...form, Title: e.target.value})}
                className={inputCls} placeholder="Featured Products" dir="ltr" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">الوصف الفرعي بالعربي</label>
              <input value={form.SubtitleAr} onChange={e => setForm({...form, SubtitleAr: e.target.value})}
                className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Subtitle (English)</label>
              <input value={form.Subtitle} onChange={e => setForm({...form, Subtitle: e.target.value})}
                className={inputCls} dir="ltr" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {form.Type !== 'banners' && <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">أقصى عدد عناصر</label>
              <input type="number" min="1" max="50" value={form.MaxItems}
                onChange={e => setForm({...form, MaxItems: e.target.value})} className={inputCls} />
            </div>}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">ترتيب العرض</label>
              <input type="number" min="0" value={form.DisplayOrder}
                onChange={e => setForm({...form, DisplayOrder: e.target.value})} className={inputCls} />
            </div>
          </div>

          {form.Type === 'featured_products' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">تصفية حسب تصنيف (اختياري)</label>
                <select value={form.FilterCategoryId} onChange={e => setForm({...form, FilterCategoryId: e.target.value})} className={inputCls}>
                  <option value="">— كل التصنيفات —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr || c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">تصفية حسب متجر (اختياري)</label>
                <select value={form.FilterVendorId} onChange={e => setForm({...form, FilterVendorId: e.target.value})} className={inputCls}>
                  <option value="">— كل المتاجر —</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.nameAr || v.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {form.Type === 'custom_products' && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">المنتجات المختارة ({pickedProducts.length})</label>
              {pickedProducts.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {pickedProducts.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 border border-gray-200 rounded-lg text-sm">
                      <span className="truncate">{p.nameAr || p.name}</span>
                      <button type="button" onClick={() => handleRemoveProductLive(p)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <ProductPicker onSelect={handleAddProductLive} excludeIds={pickedProducts.map(p => p.id)} />
            </div>
          )}

          {/* بانر رأس قسم المنتجات */}
          {PRODUCT_SECTION_TYPES.includes(form.Type) && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">بانر رأس القسم (اختياري)</label>
              <div className="w-full h-28 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 mb-2">
                {headerPreview
                  ? <img src={headerPreview} alt="" className="w-full h-full object-cover" />
                  : <ImageIcon size={26} className="text-gray-300" />}
              </div>
              <div className="flex gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  <Upload size={14} />{headerPreview ? 'تغيير الصورة' : 'رفع صورة'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setHeaderFile(file); setHeaderPreview(URL.createObjectURL(file)); setRemoveHeader(false)
                  }} />
                </label>
                {headerPreview && (
                  <button type="button" onClick={() => { setHeaderFile(null); setHeaderPreview(null); setRemoveHeader(true) }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-red-500 hover:bg-red-50">إزالة</button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2 flex items-start gap-1.5 leading-relaxed">
                <Info size={12} className="flex-shrink-0 mt-0.5" />
                <span>يظهر أعلى القسم ويُكتب فوقه العنوان وزر «عرض المزيد». المقاس المثالي <span dir="ltr">1200×520</span> — اجعل صورة المنتج على اليسار واترك اليمين للعنوان</span>
              </p>
            </div>
          )}

          {/* بانرات البلوك */}
          {form.Type === 'banners' && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                بانرات القسم ({Array.isArray(live?.data) ? live.data.length : 0})
              </label>
              {isEdit ? (
                <>
                  {Array.isArray(live?.data) && live.data.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {live.data.map(b => (
                        <button key={b.id} type="button" onClick={() => setBannerModal(b)}
                          className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:ring-2 hover:ring-primary">
                          <img src={getImageUrl(b.imageUrl)} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setBannerModal(null)}>
                    <Plus size={14} className="ml-1" />إضافة بانر لهذا القسم
                  </Button>
                </>
              ) : (
                <p className="text-xs text-gray-400">احفظ القسم أولاً، ثم افتحه بـ«تعديل» لإضافة البانرات</p>
              )}
            </div>
          )}

          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <input type="checkbox" checked={form.IsActive}
                onChange={e => setForm({...form, IsActive: e.target.checked})}
                className="w-4 h-4 accent-primary" />
              <div>
                <p className="text-sm font-medium text-gray-800">قسم نشط</p>
                <p className="text-xs text-gray-500">يظهر في الصفحة الرئيسية عند التفعيل</p>
              </div>
            </label>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth type="button" onClick={onClose}>{isEdit ? 'إغلاق' : 'إلغاء'}</Button>
            <Button variant="primary" fullWidth type="submit" loading={isPending}>
              {isEdit ? 'حفظ التعديلات' : 'إضافة القسم'}
            </Button>
          </div>
        </form>
      </div>

      {bannerModal !== undefined && (
        <BannerModal banner={bannerModal} defaultSectionId={section?.id} onClose={() => setBannerModal(undefined)} />
      )}
    </div>
  )
}

const SectionsTab = () => {
  const { success, error: showError } = useToast()
  const { data, isLoading, refetch } = useSectionsAdmin()
  const updateMutation = useUpdateSection()
  const deleteMutation = useDeleteSection()

  const [modalSection, setModalSection] = useState(undefined)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const sections = Array.isArray(data) ? [...data].sort((a, b) => a.displayOrder - b.displayOrder) : []

  const handleToggleActive = async (section) => {
    try {
      await updateMutation.mutateAsync({ id: section.id, dto: { isActive: !section.isActive } })
      success(section.isActive ? 'تم إخفاء القسم' : 'تم تفعيل القسم')
    } catch (err) {
      showError(err.message || 'فشل تحديث القسم')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      success('تم حذف القسم بنجاح')
      setDeleteTarget(null)
    } catch (err) {
      showError(err.message || 'فشل حذف القسم')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{sections.length} قسم — تُعرض بين الفئات الشائعة وتذييل الصفحة الرئيسية</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="primary" onClick={() => setModalSection(null)}>
            <Plus size={16} className="ml-1" />إضافة قسم
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : sections.length === 0 ? (
          <div className="p-16 text-center">
            <LayoutGrid size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">لا توجد أقسام بعد</p>
            <Button variant="primary" onClick={() => setModalSection(null)}>
              <Plus size={16} className="ml-1" />إضافة أول قسم
            </Button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">القسم</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">النوع</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">العناصر الحالية</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">الترتيب</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">الحالة</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sections.map(s => {
                const TypeIcon = SECTION_TYPES[s.type]?.icon || LayoutGrid
                const itemCount = Array.isArray(s.data) ? s.data.length : 0
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-sm">{s.titleAr || s.title}</p>
                      {(s.subtitleAr || s.subtitle) && <p className="text-xs text-gray-400">{s.subtitleAr || s.subtitle}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                        <TypeIcon size={12} />{SECTION_TYPES[s.type]?.label.replace(' (تلقائي)', '') || s.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{itemCount} / {s.maxItems}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">{s.displayOrder}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {s.isActive ? 'نشط' : 'مخفي'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Dropdown
                        trigger={<button className="p-1.5 hover:bg-gray-100 rounded-lg"><MoreVertical size={16} className="text-gray-500" /></button>}
                        items={[
                          { label: 'تعديل', icon: Edit, onClick: () => setModalSection(s) },
                          { label: s.isActive ? 'إخفاء' : 'تفعيل', icon: s.isActive ? EyeOff : Eye, onClick: () => handleToggleActive(s) },
                          { divider: true },
                          { label: 'حذف', icon: Trash2, onClick: () => setDeleteTarget(s), danger: true },
                        ]}
                        align="left"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalSection !== undefined && (
        <SectionModal section={modalSection} onClose={() => setModalSection(undefined)} />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="حذف القسم"
        message={`هل أنت متأكد من حذف قسم "${deleteTarget?.titleAr || deleteTarget?.title}"؟ سيختفي من الصفحة الرئيسية فوراً.`}
        type="danger"
        confirmText="حذف"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

// ===========================
// Main Page
// ===========================

const AdminHomepage = () => {
  const [tab, setTab] = useState('banners')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">إدارة الصفحة الرئيسية</h1>
        <p className="text-gray-500 mt-1">التحكم بالبانرات وأقسام المحتوى المعروضة للزوار</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="border-b border-gray-200">
          <TabsList>
            <TabsTrigger value="banners">البانرات</TabsTrigger>
            <TabsTrigger value="sections">أقسام المحتوى</TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {tab === 'banners' ? <BannersTab /> : <SectionsTab />}
    </div>
  )
}

export default AdminHomepage
