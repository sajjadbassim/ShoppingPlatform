// src/pages/customer/ReturnsPage.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  RotateCcw, Plus, X, Package, AlertCircle,
  Clock, Check, ChevronLeft, Upload, Trash2,
} from 'lucide-react'
import Breadcrumb from '../../components/common/Breadcrumb'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPostForm } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { useAuthStore } from '../../stores/authStore'
import { useCustomerOrders } from '../../hooks/useOrders'

// ===========================
// Helpers
// ===========================

const statusConfig = {
  PENDING:   { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-700', icon: Clock  },
  APPROVED:  { label: 'مقبول',        color: 'bg-green-100 text-green-700',   icon: Check  },
  REJECTED:  { label: 'مرفوض',        color: 'bg-red-100 text-red-600',       icon: X      },
  COMPLETED: { label: 'مكتمل',        color: 'bg-blue-100 text-blue-700',     icon: Check  },
}

const StatusBadge = ({ status }) => {
  const s = statusConfig[status?.toUpperCase()] || statusConfig.PENDING
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${s.color}`}>
      <Icon size={11} />{s.label}
    </span>
  )
}

// ===========================
// New Return Form
// ===========================

const NewReturnForm = ({ onClose, onSuccess }) => {
  const { success: showSuccess, error: showError } = useToast()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [orderId, setOrderId]   = useState('')
  const [reason, setReason]     = useState('')
  const [details, setDetails]   = useState('')
  // كل بند يشير إلى بند الطلب نفسه (orderItemId) حتى يُعرف المتغير المُرجَع بدقة
  const [items, setItems]       = useState([{ orderItemId: '', quantity: 1 }])
  const [images, setImages]     = useState([])

  // جلب الطلبات المُسلَّمة
  const { data: ordersData } = useCustomerOrders(user?.userId || user?.id)
  const deliveredOrders = (ordersData || []).filter(o =>
    o.status === 'DELIVERED' || o.status === 'Delivered'
  )

  // جلب منتجات الطلب المختار
// جلب تفاصيل الطلب المختار (يحتوي على items)
const { data: orderDetails } = useQuery({
  queryKey: ['order-details', orderId],
  queryFn: async () => {
    const r = await apiGet(API_ENDPOINTS.ORDERS.BY_ID(orderId))
    return r.data.data || r.data
  },
  enabled: !!orderId,
  staleTime: 5 * 60 * 1000,
})

const orderItems = orderDetails?.subOrders?.flatMap(s => s.items || []) || []
  const { mutateAsync: createReturn, isPending } = useMutation({
    mutationFn: async (formData) => {
      const r = await apiPostForm(API_ENDPOINTS.RETURNS.BASE, formData)
      return r.data.data || r.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-returns'] }),
  })

  const handleAddItem = () => setItems(prev => [...prev, { orderItemId: '', quantity: 1 }])
  const handleRemoveItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const handleItemChange = (i, field, value) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  }

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files)
    setImages(prev => [...prev, ...files].slice(0, 5))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!orderId) { showError('يرجى اختيار الطلب'); return }
    if (!reason.trim()) { showError('يرجى إدخال سبب الإرجاع'); return }
    if (items.some(i => !i.orderItemId)) { showError('يرجى اختيار المنتجات'); return }

    try {
      const fd = new FormData()
      fd.append('OrderId', orderId)
      fd.append('Reason', reason)
      if (details) fd.append('Details', details)
      // ✅ صيغة الحقول المفهرسة التي يربطها ASP.NET مع [FromForm] (سلسلة JSON لا تُربط بقائمة)
      items.forEach((i, idx) => {
        const orderItem = orderItems.find(oi => oi.id === i.orderItemId)
        fd.append(`Items[${idx}].ProductId`, orderItem?.productId || '')
        if (orderItem?.variantId) fd.append(`Items[${idx}].VariantId`, orderItem.variantId)
        fd.append(`Items[${idx}].Quantity`, String(Number(i.quantity)))
      })
      images.forEach(img => fd.append('Images', img))

      await createReturn(fd)
      showSuccess('تم تقديم طلب الإرجاع بنجاح')
      onSuccess?.()
      onClose()
    } catch (err) {
      showError(err.message || 'فشل تقديم طلب الإرجاع')
    }
  }

  const inputCls = "w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <RotateCcw size={18} className="text-primary" />
            طلب إرجاع جديد
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* اختيار الطلب */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">الطلب *</label>
            {deliveredOrders.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                لا توجد طلبات مُسلَّمة يمكن إرجاعها
              </p>
            ) : (
              <select value={orderId} onChange={e => { setOrderId(e.target.value); setItems([{ orderItemId: '', quantity: 1 }]) }}
                className={inputCls}>
                <option value="">اختر الطلب...</option>
                {deliveredOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} — {new Date(o.createdAt).toLocaleDateString('ar-IQ')}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* سبب الإرجاع */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">سبب الإرجاع *</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className={inputCls}>
              <option value="">اختر السبب...</option>
              <option value="defective">منتج معيب أو تالف</option>
              <option value="wrong_item">منتج خاطئ</option>
              <option value="not_as_described">لا يطابق الوصف</option>
              <option value="changed_mind">غيّرت رأيي</option>
              <option value="other">سبب آخر</option>
            </select>
          </div>

          {/* تفاصيل إضافية */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">تفاصيل إضافية</label>
            <textarea value={details} onChange={e => setDetails(e.target.value)}
              placeholder="اشرح المشكلة بالتفصيل..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary" />
          </div>

          {/* المنتجات */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">المنتجات *</label>
              <button type="button" onClick={handleAddItem}
                className="text-xs text-primary flex items-center gap-1 hover:underline">
                <Plus size={13} />إضافة منتج
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <select value={item.orderItemId}
                    onChange={e => handleItemChange(i, 'orderItemId', e.target.value)}
                    className="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary">
                    <option value="">اختر المنتج...</option>
                    {orderItems.map(oi => (
                      <option key={oi.id} value={oi.id}>
                        {oi.productNameAr || oi.productName}
                        {oi.variantSku ? ` (${oi.variantSku})` : ''}
                      </option>
                    ))}
                  </select>
                  <input type="number" min="1"
                    value={item.quantity}
                    onChange={e => handleItemChange(i, 'quantity', e.target.value)}
                    className="w-16 h-9 px-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-primary" />
                  {items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(i)}
                      className="text-red-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* صور */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              صور (اختياري — حتى 5 صور)
            </label>
            <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-primary transition-colors">
              <Upload size={16} className="text-gray-400" />
              <span className="text-sm text-gray-500">اضغط لرفع صور</span>
              <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
            {images.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(img)} alt=""
                      className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
                    <button type="button"
                      onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              إلغاء
            </button>
            <button type="submit" disabled={isPending || deliveredOrders.length === 0}
              className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {isPending ? 'جاري الإرسال...' : 'تقديم طلب الإرجاع'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===========================
// Return Card
// ===========================

const ReturnCard = ({ ret }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-gray-900">طلب إرجاع #{ret.returnNumber || ret.id?.slice(0,8)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(ret.createdAt).toLocaleDateString('ar-IQ')}
          </p>
        </div>
        <StatusBadge status={ret.status} />
      </div>

      <div className="space-y-1 mb-3">
        <p className="text-sm text-gray-600">
          <span className="font-medium">الطلب الأصلي:</span> #{ret.orderNumber || '—'}
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-medium">السبب:</span> {ret.reasonAr || ret.reason}
        </p>
        {ret.details && (
          <p className="text-sm text-gray-500">{ret.details}</p>
        )}
      </div>

      {/* المنتجات */}
      {ret.items?.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-1">
          {ret.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Package size={13} className="text-gray-400" />
              <span className="text-gray-700">{item.productNameAr || item.productName}</span>
              <span className="text-gray-400">× {item.quantity}</span>
            </div>
          ))}
        </div>
      )}

      {/* رفض */}
      {ret.status?.toUpperCase() === 'REJECTED' && ret.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600">{ret.rejectionReason}</p>
        </div>
      )}
    </div>
  )
}

// ===========================
// Main Page
// ===========================

const ReturnsPage = () => {
  const [showForm, setShowForm] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-returns'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.RETURNS.MY)
      return r.data.data || r.data
    },
    staleTime: 2 * 60 * 1000,
  })

  const returns = Array.isArray(data) ? data : (data?.items ?? [])

  const breadcrumbItems = [
    { label: 'حسابي', path: '/profile' },
    { label: 'طلبات الإرجاع' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">طلبات الإرجاع</h1>
            <p className="text-gray-500 text-sm mt-1">تتبع وإدارة طلبات إرجاع منتجاتك</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            طلب إرجاع جديد
          </button>
        </div>

        {/* سياسة الإرجاع */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-700">سياسة الإرجاع</p>
            <p className="text-xs text-blue-600 mt-0.5">
              يمكنك إرجاع المنتجات خلال 14 يوم من تاريخ الاستلام. يجب أن يكون المنتج في حالته الأصلية.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : returns.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <RotateCcw size={48} className="mx-auto mb-4 text-gray-300" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">لا توجد طلبات إرجاع</h2>
            <p className="text-gray-500 text-sm mb-6">لم تقدم أي طلب إرجاع حتى الآن</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90"
            >
              تقديم طلب إرجاع
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {returns.map(ret => (
              <ReturnCard key={ret.id} ret={ret} />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <NewReturnForm
          onClose={() => setShowForm(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  )
}

export default ReturnsPage