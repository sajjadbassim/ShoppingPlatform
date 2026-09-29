// src/pages/admin/AdminCategories.jsx
import { useState } from 'react'
import {
  Plus, Edit, MoreVertical, FolderOpen,
  ChevronDown, ChevronRight, Eye, EyeOff, RefreshCw,
  Upload, X, ImageIcon,
} from 'lucide-react'
import Button from '../../components/common/Button'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { ConfirmModal } from '../../components/common/Modal'
import Dropdown from '../../components/common/Dropdown'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPostForm, apiPutForm, apiDelete } from '../../api/axios'
import { getImageUrl } from '../../utils/imageHelper'
import { API_ENDPOINTS } from '../../api/endpoints'

// ===========================
// Hooks
// ===========================

const useCategories = () => useQuery({
  queryKey: ['categories-admin'],
  queryFn: async () => {
    // ✅ onlyActive=false لجلب الكل (نشطة + مخفية)
    const r = await apiGet(API_ENDPOINTS.CATEGORIES.BASE, { onlyActive: false })
    return r.data.data || r.data
  },
  staleTime: 2 * 60 * 1000,
})

const useCreateCategory = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fd) => {
      const r = await apiPostForm(API_ENDPOINTS.CATEGORIES.BASE, fd)
      return r.data.data || r.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories-admin'] }),
  })
}

const useUpdateCategory = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, fd }) => {
      const r = await apiPutForm(API_ENDPOINTS.CATEGORIES.BY_ID(id), fd)
      return r.data.data || r.data
    },
    onSuccess: (updated) => {
      // ✅ تحديث الـ cache مباشرة بدل الانتظار لإعادة الجلب
      queryClient.setQueryData(['categories-admin'], (old) => {
        if (!Array.isArray(old)) return old
        return old.map(c => c.id === updated?.id ? updated : c)
      })
      queryClient.invalidateQueries({ queryKey: ['categories-admin'] })
    },
  })
}

const useDeleteCategory = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const r = await apiDelete(API_ENDPOINTS.CATEGORIES.BY_ID(id))
      return { ...r.data, _id: id }
    },
    // ✅ تحديث الـ cache فوراً بعكس isActive
    onSuccess: (result) => {
      queryClient.setQueryData(['categories-admin'], (old) => {
        if (!Array.isArray(old)) return old
        return old.map(c => c.id === result._id ? { ...c, isActive: !c.isActive } : c)
      })
      queryClient.invalidateQueries({ queryKey: ['categories-admin'] })
    },
  })
}

// ===========================
// Category Form Modal
// ===========================

const CategoryModal = ({ category, parentId, categories, onClose, onSaved }) => {
  const { success, error: showError } = useToast()
  const isEdit = !!category?.id

  const [form, setForm] = useState({
    Name:         category?.name         ?? '',
    NameAr:       category?.nameAr       ?? '',
    Description:  category?.description  ?? '',
    DisplayOrder: category?.displayOrder ?? (categories.length + 1),
    IsActive:     category?.isActive     ?? true,
    ParentId:     category?.parentId     ?? parentId ?? '',
  })
  const [iconFile, setIconFile]       = useState(null)
  const [iconPreview, setIconPreview] = useState(category?.iconUrl ? getImageUrl(category.iconUrl) : null)

  const createMutation = useCreateCategory()
  const deleteMutation = useDeleteCategory()
  const updateMutation = useUpdateCategory()
  const isPending = createMutation.isPending || updateMutation.isPending

  const handleIconChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIconFile(file)
    setIconPreview(URL.createObjectURL(file))
  }

  const buildFd = () => {
    const fd = new FormData()
    fd.append('Name',         form.Name)
    fd.append('NameAr',       form.NameAr)
    fd.append('Description',  form.Description || form.NameAr || form.Name || '-')
    fd.append('DisplayOrder', String(Number(form.DisplayOrder) || 0))
    fd.append('IsActive',     String(form.IsActive))
    if (form.ParentId) fd.append('ParentId', form.ParentId)
    // POST = 'Icon', PUT = 'NewIcon'
    if (iconFile) fd.append(isEdit ? 'NewIcon' : 'Icon', iconFile)
    return fd
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.NameAr.trim()) { showError('يرجى إدخال الاسم العربي'); return }
    if (!form.Name.trim())   { showError('يرجى إدخال الاسم الإنجليزي'); return }
    // ✅ الباك اند يرفض إنشاء فئة بدون أيقونة (CategoryCreateDto.Icon غير nullable) لذا نتحقق هنا
    // بدل ترك الطلب يفشل بخطأ 400 غامض. عند التعديل الأيقونة اختيارية فعلاً (NewIcon nullable).
    if (!isEdit && !iconFile) { showError('يرجى رفع أيقونة للفئة (مطلوبة عند الإنشاء)'); return }
    try {
      const fd = buildFd()
      if (isEdit) {
        await updateMutation.mutateAsync({ id: category.id, fd })
        success('تم تحديث الفئة بنجاح')
      } else {
        await createMutation.mutateAsync(fd)
        success('تم إضافة الفئة بنجاح')
      }
      onSaved()
      onClose()
    } catch (err) {
      showError(err.message || 'فشل حفظ الفئة')
    }
  }

  const inputCls = "w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-bold text-lg">{isEdit ? 'تعديل الفئة' : 'إضافة فئة جديدة'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Icon */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              أيقونة الفئة {!isEdit && <span className="text-red-500">*</span>}
            </label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 flex-shrink-0">
                {iconPreview
                  ? <img src={iconPreview} alt="" className="w-full h-full object-cover" />
                  : <ImageIcon size={24} className="text-gray-300" />
                }
              </div>
              <div className="space-y-1">
                <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  <Upload size={14} />رفع صورة
                  <input type="file" accept="image/*" onChange={handleIconChange} className="hidden" />
                </label>
                {iconFile && (
                  <p className="text-xs text-gray-400">{iconFile.name}</p>
                )}
              </div>
            </div>
          </div>

          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">الاسم العربي *</label>
              <input value={form.NameAr} onChange={e => setForm({...form, NameAr: e.target.value})}
                className={inputCls} placeholder="إلكترونيات" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">English Name *</label>
              <input value={form.Name} onChange={e => setForm({...form, Name: e.target.value})}
                className={inputCls} placeholder="Electronics" dir="ltr" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">الوصف (اختياري)</label>
            <textarea value={form.Description} onChange={e => setForm({...form, Description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary"
              rows={2} placeholder="وصف مختصر" />
          </div>

          {/* Parent + Order */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">الفئة الرئيسية</label>
              <select value={form.ParentId} onChange={e => setForm({...form, ParentId: e.target.value})}
                className={inputCls}>
                <option value="">— فئة رئيسية —</option>
                {categories.filter(c => !c.parentId && c.id !== category?.id).map(c => (
                  <option key={c.id} value={c.id}>{c.nameAr || c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">ترتيب العرض</label>
              <input type="number" min="0" value={form.DisplayOrder}
                onChange={e => setForm({...form, DisplayOrder: e.target.value})}
                className={inputCls} />
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <input type="checkbox" checked={form.IsActive}
              onChange={e => setForm({...form, IsActive: e.target.checked})}
              className="w-4 h-4 accent-primary" />
            <div>
              <p className="text-sm font-medium text-gray-800">فئة نشطة</p>
              <p className="text-xs text-gray-500">تظهر للمستخدمين عند التفعيل</p>
            </div>
          </label>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth type="button" onClick={onClose}>إلغاء</Button>
            <Button variant="primary" fullWidth type="submit" loading={isPending}>
              {isEdit ? 'حفظ التعديلات' : 'إضافة الفئة'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===========================
// Category Row
// ===========================

const CategoryRow = ({ category, categories, onEdit, onDelete, onToggle, isChild = false }) => {
  const [expanded, setExpanded] = useState(false)
  const children = categories.filter(c => c.parentId === category.id)

  const actions = [
    { label: 'تعديل', icon: Edit, onClick: () => onEdit(category, null) },
    ...(!isChild ? [{ label: 'إضافة فئة فرعية', icon: Plus, onClick: () => onEdit(null, category.id) }] : []),
    { divider: true },
    {
      label: category.isActive ? 'تعطيل الفئة' : 'تفعيل الفئة',
      icon: category.isActive ? EyeOff : Eye,
      onClick: () => onDelete(category),
      danger: category.isActive,
    },
  ]

  return (
    <>
      <tr className={`hover:bg-gray-50 transition-colors ${isChild ? 'bg-gray-50/40' : ''}`}>
        <td className="px-4 py-3">
          <div className={`flex items-center gap-3 ${isChild ? 'pr-10' : ''}`}>
            {!isChild && children.length > 0 ? (
              <button type="button" onClick={() => setExpanded(!expanded)}
                className="p-1 hover:bg-gray-200 rounded flex-shrink-0">
                {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
            ) : <span className="w-6 flex-shrink-0" />}

            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {category.iconUrl
                ? <img src={getImageUrl(category.iconUrl)} alt="" className="w-full h-full object-cover"
                    onError={e => { e.target.style.display='none' }} />
                : <FolderOpen size={18} className="text-gray-400" />
              }
            </div>

            <div>
              <p className="font-medium text-gray-900 text-sm">{category.nameAr || category.name}</p>
              {category.nameAr && category.name && (
                <p className="text-xs text-gray-400">{category.name}</p>
              )}
            </div>
          </div>
        </td>

        <td className="px-4 py-3 text-center text-sm text-gray-600">{category.productsCount ?? 0}</td>

        <td className="px-4 py-3 text-center">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
            category.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${category.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
            {category.isActive ? 'نشطة' : 'مخفية'}
          </span>
        </td>

        <td className="px-4 py-3 text-center text-sm text-gray-500">{category.displayOrder ?? '—'}</td>

        <td className="px-4 py-3">
          <Dropdown
            trigger={
              <button className="p-1.5 hover:bg-gray-100 rounded-lg">
                <MoreVertical size={16} className="text-gray-500" />
              </button>
            }
            items={actions}
            align="left"
          />
        </td>
      </tr>

      {expanded && children.map(child => (
        <CategoryRow key={child.id} category={child} categories={categories}
          onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} isChild />
      ))}
    </>
  )
}

// ===========================
// Main Component
// ===========================

const AdminCategories = () => {
  const { success, error: showError } = useToast()
  const queryClient = useQueryClient()

  const [modalState, setModalState] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data, isLoading, refetch } = useCategories()
  const deleteMutation = useDeleteCategory()
  const updateMutation = useUpdateCategory()

  const categories = Array.isArray(data) ? data : (data?.items ?? [])
  const roots      = categories.filter(c => !c.parentId)

  const handleToggle = async (category) => {
    try {
      const fd = new FormData()
      fd.append('Name',         category.name        || '')
      fd.append('NameAr',       category.nameAr      || '')
      fd.append('Description',  category.description || category.nameAr || category.name || '-')
      fd.append('DisplayOrder', String(category.displayOrder ?? 0))
      fd.append('IsActive',     String(!category.isActive))
      if (category.parentId) fd.append('ParentId', category.parentId)

      await updateMutation.mutateAsync({ id: category.id, fd })
      success(category.isActive ? 'تم إخفاء الفئة' : 'تم إظهار الفئة')
    } catch (err) {
      showError(err.message || 'فشل تحديث الفئة')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      success('تم تغيير حالة الفئة بنجاح')
      setDeleteTarget(null)
    } catch (err) {
      showError(err.message || 'فشل تعطيل الفئة')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الفئات</h1>
          <p className="text-gray-500 mt-1">{categories.length} فئة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="primary" onClick={() => setModalState({ category: null, parentId: null })}>
            <Plus size={16} className="ml-1" />إضافة فئة
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'فئات رئيسية', value: roots.length,                           color: 'text-gray-900'  },
          { label: 'فئات فرعية',  value: categories.filter(c => c.parentId).length, color: 'text-blue-600'  },
          { label: 'فئات نشطة',   value: categories.filter(c => c.isActive).length, color: 'text-green-600' },
          { label: 'فئات مخفية',  value: categories.filter(c => !c.isActive).length, color: 'text-gray-400' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1"><Skeleton className="h-4 w-32 mb-1" /><Skeleton className="h-3 w-20" /></div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="p-16 text-center">
            <FolderOpen size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">لا توجد فئات</p>
            <Button variant="primary" onClick={() => setModalState({ category: null, parentId: null })}>
              <Plus size={16} className="ml-1" />إضافة فئة
            </Button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الفئة</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">المنتجات</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">الحالة</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">الترتيب</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roots.map(cat => (
                <CategoryRow key={cat.id} category={cat} categories={categories}
                  onEdit={(cat, pid) => setModalState({ category: cat, parentId: pid })}
                  onDelete={setDeleteTarget}
                  onToggle={handleToggle}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalState !== null && (
        <CategoryModal
          category={modalState.category}
          parentId={modalState.parentId}
          categories={categories}
          onClose={() => setModalState(null)}
          onSaved={() => {}}
        />
      )}


      {/* Confirm Delete */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`${deleteTarget?.isActive ? "تعطيل" : "تفعيل"} الفئة`}
message={`هل أنت متأكد من ${deleteTarget?.isActive ? "تعطيل" : "تفعيل"} "${deleteTarget?.nameAr || deleteTarget?.name}"؟`}
        type="danger"
confirmText={deleteTarget?.isActive ? "تعطيل" : "تفعيل"}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}

export default AdminCategories