// src/components/vendor/VendorVariantsManager.jsx
// أضف هذا الـ component داخل VendorProductForm.jsx بعد حفظ المنتج
// الاستخدام: <VendorVariantsManager productId={savedProductId} />

import { useState } from 'react'
import { Plus, Trash2, Edit, ChevronDown, ChevronUp, Save, X, Package } from 'lucide-react'
import Button from '../common/Button'
import Input from '../common/Input'
import { useToast } from '../common/Toast'
import { Skeleton } from '../common/Loading'
import {
  useProductVariants,
  useProductAttributes,
  useCreateVariant,
  useUpdateVariant,
  useDeleteVariant,
  useCreateAttribute,
  useDeleteAttribute,
  useAddAttributeValue,
  useDeleteAttributeValue,
} from '../../hooks/useVariants'
import { variantsService } from '../../services/variantsService'

// ===========================
// Attribute Manager
// ===========================

const AttributeManager = ({ productId }) => {
  const { success, error: toastError } = useToast()
  const { data: attributes = [], isLoading } = useProductAttributes(productId)

  const { mutateAsync: createAttr, isPending: creatingAttr } = useCreateAttribute(productId)
  const { mutateAsync: deleteAttr, isPending: deletingAttr } = useDeleteAttribute(productId)
  const { mutateAsync: addValue, isPending: addingValue } = useAddAttributeValue(productId)
  const { mutateAsync: deleteValue } = useDeleteAttributeValue(productId)

  const [newAttrName, setNewAttrName] = useState('')
  const [newAttrNameAr, setNewAttrNameAr] = useState('')
  const [newAttrValues, setNewAttrValues] = useState([{ value: '', valueAr: '' }])
  const [showNewAttrForm, setShowNewAttrForm] = useState(false)
  const [expandedAttr, setExpandedAttr] = useState(null)
  const [newValueForms, setNewValueForms] = useState({}) // { attributeId: { value, valueAr } }

  const handleCreateAttribute = async () => {
    if (!newAttrNameAr.trim()) { toastError('أدخل اسم الصفة بالعربي'); return }
    const validValues = newAttrValues.filter(v => v.valueAr.trim())
    try {
      await createAttr({
        name: newAttrName || newAttrNameAr,
        nameAr: newAttrNameAr,
        values: validValues.map(v => ({ value: v.value || v.valueAr, valueAr: v.valueAr })),
      })
      success('تم إضافة الصفة بنجاح')
      setNewAttrName('')
      setNewAttrNameAr('')
      setNewAttrValues([{ value: '', valueAr: '' }])
      setShowNewAttrForm(false)
    } catch (err) {
      toastError(err.message || 'فشل إضافة الصفة')
    }
  }

  const handleAddValue = async (attributeId) => {
    const form = newValueForms[attributeId]
    if (!form?.valueAr?.trim()) { toastError('أدخل القيمة بالعربي'); return }
    try {
      await addValue({
        attributeId,
        data: { value: form.value || form.valueAr, valueAr: form.valueAr },
      })
      success('تم إضافة القيمة')
      setNewValueForms(prev => ({ ...prev, [attributeId]: { value: '', valueAr: '' } }))
    } catch (err) {
      toastError(err.message || 'فشل إضافة القيمة')
    }
  }

  if (isLoading) return (
    <div className="space-y-3">
      {[1, 2].map(i => <Skeleton key={i} className="h-14" />)}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">الصفات (اللون، الحجم، إلخ)</h3>
        <Button variant="outline" size="sm" onClick={() => setShowNewAttrForm(!showNewAttrForm)}>
          <Plus size={16} className="ml-1" />
          صفة جديدة
        </Button>
      </div>

      {/* New Attribute Form */}
      {showNewAttrForm && (
        <div className="border border-dashed border-primary rounded-xl p-4 bg-primary/5 space-y-3">
          <p className="text-sm font-semibold text-primary">إضافة صفة جديدة</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="الاسم بالعربي *"
              value={newAttrNameAr}
              onChange={e => setNewAttrNameAr(e.target.value)}
              placeholder="مثال: اللون"
            />
            <Input
              label="الاسم بالإنجليزي"
              value={newAttrName}
              onChange={e => setNewAttrName(e.target.value)}
              placeholder="مثال: Color"
            />
          </div>

          {/* Values */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">القيم:</p>
            {newAttrValues.map((v, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="القيمة بالعربي *"
                  value={v.valueAr}
                  onChange={e => {
                    const updated = [...newAttrValues]
                    updated[i] = { ...updated[i], valueAr: e.target.value }
                    setNewAttrValues(updated)
                  }}
                />
                <Input
                  placeholder="بالإنجليزي"
                  value={v.value}
                  onChange={e => {
                    const updated = [...newAttrValues]
                    updated[i] = { ...updated[i], value: e.target.value }
                    setNewAttrValues(updated)
                  }}
                />
                {newAttrValues.length > 1 && (
                  <button
                    onClick={() => setNewAttrValues(prev => prev.filter((_, j) => j !== i))}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNewAttrValues(prev => [...prev, { value: '', valueAr: '' }])}
            >
              <Plus size={14} className="ml-1" />إضافة قيمة
            </Button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowNewAttrForm(false)}>إلغاء</Button>
            <Button variant="primary" size="sm" loading={creatingAttr} onClick={handleCreateAttribute}>حفظ</Button>
          </div>
        </div>
      )}

      {/* Existing Attributes */}
      {attributes.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">لا توجد صفات بعد</p>
      ) : (
        attributes.map(attr => (
          <div key={attr.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <div
              className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
              onClick={() => setExpandedAttr(expandedAttr === attr.id ? null : attr.id)}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">{attr.nameAr}</span>
                <span className="text-xs text-gray-400">({attr.values?.length || 0} قيمة)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={e => {
                    e.stopPropagation()
                    if (confirm(`هل تريد حذف صفة "${attr.nameAr}"؟`))
                      deleteAttr(attr.id).then(() => success('تم حذف الصفة')).catch(() => toastError('فشل الحذف'))
                  }}
                  className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={14} />
                </button>
                {expandedAttr === attr.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {expandedAttr === attr.id && (
              <div className="p-3 space-y-3">
                {/* Values List */}
                <div className="flex flex-wrap gap-2">
                  {(attr.values || []).map(val => (
                    <div key={val.id} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-full text-sm">
                      <span>{val.valueAr}</span>
                      <button
                        onClick={() =>
                          deleteValue({ attributeId: attr.id, valueId: val.id })
                            .then(() => success('تم حذف القيمة'))
                            .catch(() => toastError('فشل الحذف'))
                        }
                        className="text-red-400 hover:text-red-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Value Form */}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <Input
                    placeholder="قيمة جديدة بالعربي"
                    value={newValueForms[attr.id]?.valueAr || ''}
                    onChange={e => setNewValueForms(prev => ({
                      ...prev,
                      [attr.id]: { ...(prev[attr.id] || {}), valueAr: e.target.value }
                    }))}
                  />
                  <Input
                    placeholder="بالإنجليزي"
                    value={newValueForms[attr.id]?.value || ''}
                    onChange={e => setNewValueForms(prev => ({
                      ...prev,
                      [attr.id]: { ...(prev[attr.id] || {}), value: e.target.value }
                    }))}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    loading={addingValue}
                    onClick={() => handleAddValue(attr.id)}
                  >
                    إضافة
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ===========================
// Variant Form
// ===========================

const VariantForm = ({ productId, attributes, onClose, existingVariant = null }) => {
  const { success, error: toastError } = useToast()
  const { mutateAsync: createVariant, isPending: creating } = useCreateVariant(productId)
  const { mutateAsync: updateVariant, isPending: updating } = useUpdateVariant(productId)

  const [form, setForm] = useState({
    sku: existingVariant?.sku || '',
    priceAdjustment: existingVariant?.priceAdjustment ?? 0,
    stockQuantity: existingVariant?.stockQuantity ?? 0,
    isAvailable: existingVariant?.isAvailable ?? true,
    imageUrl: existingVariant?.imageUrl || '',
    attributeValueIds: (existingVariant?.attributes || existingVariant?.attributeValues || []).map(av => av.valueId ?? av.id) || [],
  })

  const toggleValueId = (id) => {
    setForm(prev => ({
      ...prev,
      attributeValueIds: prev.attributeValueIds.includes(id)
        ? prev.attributeValueIds.filter(v => v !== id)
        : [...prev.attributeValueIds, id],
    }))
  }

  const handleSubmit = async () => {
    try {
      if (existingVariant) {
        const { attributeValueIds, ...updateData } = form
        await updateVariant({ variantId: existingVariant.id, data: updateData })
        success('تم تعديل المتغير')
      } else {
        await createVariant(form)
        success('تم إضافة المتغير')
      }
      onClose()
    } catch (err) {
      toastError(err.message || 'فشل الحفظ')
    }
  }

  return (
    <div className="space-y-4 p-4 border border-dashed border-gray-300 rounded-xl bg-gray-50">
      <p className="font-semibold text-gray-700">
        {existingVariant ? 'تعديل متغير' : 'إضافة متغير جديد'}
      </p>

      {/* Attribute Values Selection */}
      {!existingVariant && attributes.map(attr => (
        <div key={attr.id}>
          <p className="text-sm font-medium text-gray-600 mb-2">{attr.nameAr} *</p>
          <div className="flex flex-wrap gap-2">
            {(attr.values || []).map(val => (
              <button
                key={val.id}
                onClick={() => toggleValueId(val.id)}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  form.attributeValueIds.includes(val.id)
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-300 hover:border-primary'
                }`}
              >
                {val.valueAr}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="SKU"
          value={form.sku}
          onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
          placeholder="رمز المنتج"
        />
        <Input
          label="فرق السعر (د.ع)"
          type="number"
          value={form.priceAdjustment}
          onChange={e => setForm(p => ({ ...p, priceAdjustment: Number(e.target.value) }))}
          placeholder="0"
        />
        <Input
          label="الكمية المتاحة"
          type="number"
          value={form.stockQuantity}
          onChange={e => setForm(p => ({ ...p, stockQuantity: Number(e.target.value) }))}
          placeholder="0"
        />
        <Input
          label="رابط الصورة"
          value={form.imageUrl}
          onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))}
          placeholder="https://..."
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isAvailable}
          onChange={e => setForm(p => ({ ...p, isAvailable: e.target.checked }))}
          className="w-4 h-4 accent-primary"
        />
        <span className="text-sm text-gray-700">متاح للبيع</span>
      </label>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
        <Button variant="primary" size="sm" loading={creating || updating} onClick={handleSubmit}>
          <Save size={14} className="ml-1" />
          {existingVariant ? 'تعديل' : 'إضافة'}
        </Button>
      </div>
    </div>
  )
}

// ===========================
// Variants List
// ===========================

const VariantsList = ({ productId, basePrice }) => {
  const { success, error: toastError } = useToast()
  const { data: variants = [], isLoading } = useProductVariants(productId)
  const { data: attributes = [] } = useProductAttributes(productId)
  const { mutateAsync: deleteVariant } = useDeleteVariant(productId)

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const attributeOptions = variantsService.buildAttributeOptions(variants)

  if (isLoading) return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">
          المتغيرات ({variants.length})
        </h3>
        <Button variant="outline" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={16} className="ml-1" />
          متغير جديد
        </Button>
      </div>

      {showAddForm && (
        <VariantForm
          productId={productId}
          attributes={attributes}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {variants.length === 0 && !showAddForm ? (
        <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <Package size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">لا توجد متغيرات بعد</p>
          <p className="text-xs mt-1">أضف الصفات أولاً ثم أنشئ المتغيرات</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-right font-semibold text-gray-600">SKU</th>
                {attributeOptions.map(attr => (
                  <th key={attr.attributeId} className="px-4 py-3 text-right font-semibold text-gray-600">
                    {attr.nameAr}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold text-gray-600">السعر</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">الكمية</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">الحالة</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {variants.map(v => (
                <>
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-500">{v.sku || '—'}</td>
                    {attributeOptions.map(attr => {
                      const attrs = v.attributes || v.attributeValues || []
                      const av = attrs.find(a =>
                        (a.attributeId ?? a.attribute?.id) === attr.attributeId
                      )
                      return (
                        <td key={attr.attributeId} className="px-4 py-3 text-gray-700">
                          {av?.valueAr || av?.value || '—'}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 font-medium text-primary">
                      {variantsService.getFinalPrice(basePrice, v).toLocaleString()} د.ع
                      {v.priceAdjustment !== 0 && (
                        <span className="text-xs text-gray-400 block">
                          ({v.priceAdjustment > 0 ? '+' : ''}{v.priceAdjustment.toLocaleString()})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{v.stockQuantity}</td>
                    <td className="px-4 py-3">
                      {v.isAvailable ? (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">متاح</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded-full">موقوف</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingId(editingId === v.id ? null : v.id)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('هل تريد حذف هذا المتغير؟'))
                              deleteVariant(v.id)
                                .then(() => success('تم حذف المتغير'))
                                .catch(() => toastError('فشل الحذف'))
                          }}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === v.id && (
                    <tr key={`edit-${v.id}`}>
                      <td colSpan={attributeOptions.length + 5} className="px-4 py-3">
                        <VariantForm
                          productId={productId}
                          attributes={attributes}
                          existingVariant={v}
                          onClose={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ===========================
// Main Export
// ===========================

/**
 * الاستخدام في VendorProductForm.jsx:
 *
 * import VendorVariantsManager from '../../components/vendor/VendorVariantsManager'
 *
 * // بعد حفظ المنتج وعندك productId:
 * {savedProductId && (
 *   <VendorVariantsManager productId={savedProductId} basePrice={form.price} />
 * )}
 */
const VendorVariantsManager = ({ productId, basePrice = 0 }) => {
  const [activeTab, setActiveTab] = useState('attributes')

  if (!productId) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="font-bold text-gray-900">إدارة المتغيرات</h2>
        <p className="text-sm text-gray-500 mt-1">
          أضف الصفات أولاً (اللون، الحجم، إلخ) ثم أنشئ المتغيرات
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'attributes', label: 'الصفات' },
          { key: 'variants', label: 'المتغيرات' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'attributes' ? (
          <AttributeManager productId={productId} />
        ) : (
          <VariantsList productId={productId} basePrice={basePrice} />
        )}
      </div>
    </div>
  )
}

export default VendorVariantsManager