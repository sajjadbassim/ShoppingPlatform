// src/pages/admin/AdminReturns.jsx
import { useState } from 'react'
import {
  RotateCcw, Check, X, RefreshCw, Package,
  AlertCircle, Clock, Eye, PackagePlus, PackageCheck, Info,
} from 'lucide-react'
import Button from '../../components/common/Button'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut, apiPost } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

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
// Review Modal
// ===========================

const ReviewModal = ({ ret, onClose, onSaved }) => {
  const { success: showSuccess, error: showError } = useToast()
  const [decision, setDecision]               = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  const { mutateAsync: reviewReturn, isPending } = useMutation({
    mutationFn: async (data) => {
      const r = await apiPut(API_ENDPOINTS.RETURNS.REVIEW(ret.id), data)
      return r.data.data || r.data
    },
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!decision) { showError('يرجى اختيار القرار'); return }
    if (decision === 'rejected' && !rejectionReason.trim()) {
      showError('يرجى إدخال سبب الرفض')
      return
    }
    try {
      await reviewReturn({ decision, rejectionReason: rejectionReason || undefined })
      showSuccess(decision === 'approved' ? 'تم قبول طلب الإرجاع' : 'تم رفض طلب الإرجاع')
      onSaved()
      onClose()
    } catch (err) {
      showError(err.message || 'فشلت العملية')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-md w-full max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-lg">مراجعة طلب الإرجاع</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-5">
          {/* معلومات الطلب */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">رقم الإرجاع</span>
              <span className="font-medium">#{ret.returnNumber || ret.id?.slice(0,8)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">العميل</span>
              <span className="font-medium">{ret.customerName || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">الطلب الأصلي</span>
              <span className="font-medium">#{ret.orderNumber || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">السبب</span>
              <span className="font-medium">{ret.reasonAr || ret.reason}</span>
            </div>
            {ret.details && (
              <p className="text-xs text-gray-500 pt-1 border-t border-gray-200">{ret.details}</p>
            )}
          </div>

          {/* المنتجات */}
          {ret.items?.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1">
              {ret.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Package size={13} className="text-gray-400" />
                  <span className="text-gray-700">{item.productNameAr || item.productName}</span>
                  <span className="text-gray-400">× {item.quantity}</span>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* القرار */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">القرار *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDecision('approved')}
                  className={`py-3 rounded-xl border-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    decision === 'approved'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <Check size={16} />قبول
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('rejected')}
                  className={`py-3 rounded-xl border-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    decision === 'rejected'
                      ? 'border-red-500 bg-red-50 text-red-600'
                      : 'border-gray-200 hover:border-red-300'
                  }`}
                >
                  <X size={16} />رفض
                </button>
              </div>
            </div>

            {/* تنبيه: القبول لا يعيد المخزون */}
            {decision === 'approved' && (
              <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  القبول لا يعيد الكمية إلى المخزون تلقائياً. بعد استلام البضاعة وفحصها،
                  استخدم زر <span className="font-semibold">"تحديث المخزون"</span> في قائمة الإرجاعات.
                </p>
              </div>
            )}

            {/* سبب الرفض */}
            {decision === 'rejected' && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">سبب الرفض *</label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="أدخل سبب الرفض..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" fullWidth type="button" onClick={onClose}>إلغاء</Button>
              <Button
                variant={decision === 'approved' ? 'primary' : 'danger'}
                fullWidth
                type="submit"
                loading={isPending}
                disabled={!decision}
              >
                تأكيد القرار
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ===========================
// Restock Modal
// ===========================

const canRestock = (ret) =>
  ['APPROVED', 'COMPLETED'].includes(ret.status?.toUpperCase()) && !ret.isRestocked

const RestockModal = ({ ret, onClose, onSaved }) => {
  const { success: showSuccess, error: showError } = useToast()

  const { mutateAsync: restock, isPending } = useMutation({
    mutationFn: async () => {
      const r = await apiPost(API_ENDPOINTS.RETURNS.RESTOCK(ret.id))
      return r.data.data || r.data
    },
  })

  const handleConfirm = async () => {
    try {
      await restock()
      showSuccess('تمت إعادة الكميات إلى المخزون')
      onSaved()
      onClose()
    } catch (err) {
      showError(err.message || 'فشل تحديث المخزون')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-md w-full max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <PackagePlus size={20} className="text-primary" />
            تحديث المخزون
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            ستُضاف الكميات التالية من الإرجاع
            <span className="font-semibold text-gray-900"> #{ret.returnNumber || ret.id?.slice(0,8)} </span>
            إلى المخزون:
          </p>

          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            {ret.items?.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-700">
                  <Package size={13} className="text-gray-400" />
                  {item.productNameAr || item.productName}
                </span>
                <span className="font-semibold text-green-600" dir="ltr">+{item.quantity}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              اضغط التأكيد فقط بعد <span className="font-semibold">استلام البضاعة وفحصها</span> والتأكد
              أنها صالحة للبيع. البضاعة التالفة لا تُعاد للمخزون.
              هذه العملية تتم <span className="font-semibold">مرة واحدة</span> ولا يمكن التراجع عنها.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" fullWidth onClick={onClose}>إلغاء</Button>
            <Button variant="primary" fullWidth onClick={handleConfirm} loading={isPending}>
              <PackagePlus size={15} className="ml-1" />
              تأكيد وإعادة للمخزون
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===========================
// Return Row
// ===========================

const ReturnRow = ({ ret, onReview, onRestock }) => (
  <tr className="hover:bg-gray-50">
    <td className="px-4 py-3 font-medium text-primary text-sm">
      #{ret.returnNumber || ret.id?.slice(0,8)}
    </td>
    <td className="px-4 py-3">
      <p className="text-sm text-gray-700">{ret.customerName || '—'}</p>
      {ret.customerPhone && (
        <p className="text-xs text-gray-400" dir="ltr">{ret.customerPhone}</p>
      )}
    </td>
    <td className="px-4 py-3 text-sm text-gray-500">#{ret.orderNumber || '—'}</td>
    <td className="px-4 py-3 text-sm text-gray-600 max-w-32 truncate">
      {ret.reasonAr || ret.reason}
    </td>
    <td className="px-4 py-3">
      <div className="flex flex-wrap gap-1">
        {ret.items?.slice(0,2).map((item, i) => (
          <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {item.productNameAr || item.productName}
          </span>
        ))}
        {ret.items?.length > 2 && (
          <span className="text-xs text-gray-400">+{ret.items.length - 2}</span>
        )}
      </div>
    </td>
    <td className="px-4 py-3 text-xs text-gray-400">
      {new Date(ret.createdAt).toLocaleDateString('ar-IQ')}
    </td>
    <td className="px-4 py-3"><StatusBadge status={ret.status} /></td>
    <td className="px-4 py-3">
      {ret.status?.toUpperCase() === 'PENDING' && (
        <Button variant="primary" size="sm" onClick={() => onReview(ret)}>
          <Eye size={13} className="ml-1" />مراجعة
        </Button>
      )}
      {canRestock(ret) && (
        <Button variant="outline" size="sm" onClick={() => onRestock(ret)}
          title="إعادة الكميات المرتجعة إلى المخزون بعد استلامها وفحصها">
          <PackagePlus size={13} className="ml-1" />تحديث المخزون
        </Button>
      )}
      {ret.isRestocked && (
        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full whitespace-nowrap"
          title={ret.restockedAt ? `بتاريخ ${new Date(ret.restockedAt).toLocaleDateString('ar-IQ')}` : undefined}>
          <PackageCheck size={12} />أُعيد للمخزون
        </span>
      )}
    </td>
  </tr>
)

// ===========================
// Main Component
// ===========================

const AdminReturns = () => {
  const queryClient = useQueryClient()
  const [selectedReturn, setSelectedReturn] = useState(null)
  const [restockTarget, setRestockTarget]   = useState(null)
  const [statusFilter, setStatusFilter]     = useState('')
  const [page, setPage]                     = useState(1)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-returns', statusFilter, page],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.RETURNS.PAGED, {
        status: statusFilter || undefined,
        pageNumber: page,
        pageSize: 15,
      })
      // الخادم يعيد { data: [...], pagination: { total, totalPages } }
      return { items: r.data?.data ?? [], totalPages: r.data?.pagination?.totalPages ?? 1 }
    },
    staleTime: 2 * 60 * 1000,
  })

  // التنبيهات من كل الإرجاعات — لا تتأثر بالفلتر أو الصفحة المعروضة
  const { data: alerts } = useQuery({
    queryKey: ['admin-returns', 'alerts'],
    queryFn: async () => {
      const [pendingRes, approvedRes, completedRes] = await Promise.all([
        apiGet(API_ENDPOINTS.RETURNS.PAGED, { status: 'PENDING', pageNumber: 1, pageSize: 1 }),
        apiGet(API_ENDPOINTS.RETURNS.PAGED, { status: 'APPROVED', pageNumber: 1, pageSize: 200 }),
        apiGet(API_ENDPOINTS.RETURNS.PAGED, { status: 'COMPLETED', pageNumber: 1, pageSize: 200 }),
      ])
      const done = [...(approvedRes.data?.data ?? []), ...(completedRes.data?.data ?? [])]
      return {
        pending: pendingRes.data?.pagination?.total ?? 0,
        awaitingRestock: done.filter(canRestock).length,
      }
    },
    staleTime: 60 * 1000,
  })

  const returns    = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const pending    = alerts?.pending ?? 0
  const awaitingRestock = alerts?.awaitingRestock ?? 0

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-returns'] })
    refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">طلبات الإرجاع</h1>
          <p className="text-gray-500 mt-1">مراجعة وإدارة طلبات إرجاع العملاء</p>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={16} className="text-gray-400" />
        </button>
      </div>

      {/* تنبيه الطلبات المعلقة */}
      {pending > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-yellow-500 flex-shrink-0" />
          <p className="text-sm text-yellow-700 font-medium">
            يوجد {pending} طلب إرجاع يحتاج مراجعة
          </p>
        </div>
      )}

      {/* تنبيه الإرجاعات المقبولة التي لم يُحدَّث مخزونها */}
      {awaitingRestock > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <PackagePlus size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800 font-medium">
              يوجد {awaitingRestock} إرجاع مقبول لم يُحدَّث مخزونه بعد
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              قبول الإرجاع لا يعيد الكمية تلقائياً — اضغط "تحديث المخزون" بعد استلام البضاعة والتأكد أنها صالحة للبيع.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Filters */}
        <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center gap-2 sm:gap-3 overflow-x-auto hide-scrollbar">
          {['', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'].map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                statusFilter === s
                  ? 'bg-primary text-white'
                  : 'border border-gray-200 text-gray-600 hover:border-primary'
              }`}
            >
              {s === ''          ? 'الكل' :
               s === 'PENDING'   ? 'قيد المراجعة' :
               s === 'APPROVED'  ? 'مقبول' :
               s === 'REJECTED'  ? 'مرفوض' : 'مكتمل'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <RotateCcw size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد طلبات إرجاع</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['رقم الإرجاع','العميل','الطلب','السبب','المنتجات','التاريخ','الحالة',''].map(h => (
                    <th key={h} className="px-4 py-3 text-right font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {returns.map(ret => (
                  <ReturnRow key={ret.id} ret={ret} onReview={setSelectedReturn} onRestock={setRestockTarget} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-200">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-sm ${
                  p === page ? 'bg-primary text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedReturn && (
        <ReviewModal
          ret={selectedReturn}
          onClose={() => setSelectedReturn(null)}
          onSaved={handleSaved}
        />
      )}

      {restockTarget && (
        <RestockModal
          ret={restockTarget}
          onClose={() => setRestockTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

export default AdminReturns