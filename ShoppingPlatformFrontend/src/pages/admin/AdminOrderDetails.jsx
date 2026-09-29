// src/pages/admin/AdminOrderDetails.jsx
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Package, User, MapPin, Phone, CreditCard,
  Store, Truck, Clock, CheckCircle, XCircle, RefreshCw,
  ShoppingBag, Calendar, Hash, AlertCircle,
} from 'lucide-react'
import { Skeleton } from '../../components/common/Loading'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { getImageUrl } from '../../utils/imageHelper'

// ===========================
// Helpers
// ===========================

const STATUS_CONFIG = {
  PENDING_CONFIRMATION: { label: 'قيد الانتظار',  color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock        },
  CONFIRMED:            { label: 'مؤكد',           color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: CheckCircle  },
  PARTIALLY_CONFIRMED:  { label: 'مؤكد جزئياً',   color: 'bg-cyan-100 text-cyan-700 border-cyan-200',       icon: CheckCircle  },
  PREPARING:            { label: 'قيد التحضير',   color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Package      },
  OUT_FOR_DELIVERY:     { label: 'قيد التوصيل',   color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Truck        },
  DELIVERED:            { label: 'تم التوصيل',    color: 'bg-green-100 text-green-700 border-green-200',    icon: CheckCircle  },
  CANCELLED:            { label: 'ملغي',           color: 'bg-red-100 text-red-600 border-red-200',          icon: XCircle      },
}

const StatusBadge = ({ status, size = 'md' }) => {
  const s = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-600 border-gray-200', icon: Clock }
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1.5 border font-medium rounded-full ${s.color} ${
      size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
    }`}>
      <Icon size={size === 'lg' ? 15 : 12} />
      {s.label}
    </span>
  )
}

const InfoRow = ({ icon: Icon, label, value, dir }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
    <Icon size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900" dir={dir}>{value || '—'}</p>
    </div>
  </div>
)

// ===========================
// Main Page
// ===========================

const AdminOrderDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['admin-order-detail', id],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.ORDERS.BY_ID(id))
      return r.data.data || r.data
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })

  const { data: tracking, isLoading: trackingLoading } = useQuery({
    queryKey: ['admin-order-tracking', id],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.ORDERS.TRACKING(id))
      return r.data.data || r.data
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  })

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    </div>
  )

  if (!order) return (
    <div className="text-center py-16 text-gray-400">
      <AlertCircle size={48} className="mx-auto mb-4 opacity-30" />
      <p>لم يتم العثور على الطلب</p>
    </div>
  )

  const totalItems = order.subOrders?.flatMap(s => s.items || []).length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/orders')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowRight size={18} />
            <span className="text-sm">العودة للطلبات</span>
          </button>
          <div className="h-5 w-px bg-gray-300" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">#{order.orderNumber}</h1>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <Calendar size={12} />
              {new Date(order.createdAt).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} size="lg" />
          <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={15} className="text-gray-400" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ===== العمود الرئيسي ===== */}
        <div className="lg:col-span-2 space-y-5">

          {/* الطلبات الفرعية */}
          {order.subOrders?.map(sub => (
            <div key={sub.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Sub Header */}
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Store size={15} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{sub.vendorNameAr || sub.vendorName}</p>
                    <p className="text-xs text-gray-400">#{sub.subOrderNumber}</p>
                  </div>
                </div>
                <StatusBadge status={sub.status} />
              </div>

              {/* Items */}
              <div className="divide-y divide-gray-100">
                {sub.items?.map(item => (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                      {item.productImageUrl
                        ? <img src={getImageUrl(item.productImageUrl) || item.productImageUrl}
                            alt="" className="w-full h-full object-cover"
                            onError={e => e.target.style.display='none'} />
                        : <Package size={20} className="m-auto text-gray-300 mt-3" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{item.productNameAr || item.productName}</p>
                      {item.variantAttributes?.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {item.variantAttributes.map((a, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                              {a.attributeNameAr}: {a.valueAr}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {item.unitPrice.toLocaleString()} د.ع × {item.quantity}
                      </p>
                    </div>
                    <p className="font-bold text-gray-900 text-sm flex-shrink-0">
                      {item.subtotal.toLocaleString()} د.ع
                    </p>
                  </div>
                ))}
              </div>

              {/* Sub Footer */}
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="text-xs text-gray-500 space-y-0.5">
                  {sub.driverName && (
                    <p className="flex items-center gap-1"><Truck size={11} />السائق: {sub.driverName}</p>
                  )}
                  {sub.cancellationReason && (
                    <p className="flex items-center gap-1 text-red-500">
                      <XCircle size={11} />سبب الإلغاء: {sub.cancellationReason}
                    </p>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-xs text-gray-400">المجموع</p>
                  <p className="font-bold text-gray-900">{sub.total.toLocaleString()} د.ع</p>
                </div>
              </div>
            </div>
          ))}

          {/* ملاحظات */}
          {order.customerNotes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-yellow-700 mb-1">ملاحظات العميل</p>
              <p className="text-sm text-yellow-800">{order.customerNotes}</p>
            </div>
          )}

          {/* ===== تتبع الطلب ===== */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
              <Truck size={16} className="text-primary" />
              تتبع الطلب
            </h3>

            {trackingLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : tracking?.timeline ? (
              <div className="relative">
                {/* Main Timeline */}
                <div className="space-y-0">
                  {tracking.timeline.map((step, i) => {
                    const isLast = i === tracking.timeline.length - 1
                    return (
                      <div key={step.status} className="flex gap-3">
                        {/* Line + Dot */}
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            step.isCurrent
                              ? 'bg-primary border-primary text-white'
                              : step.isCompleted
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'bg-white border-gray-200 text-gray-300'
                          }`}>
                            {step.isCompleted && !step.isCurrent
                              ? <CheckCircle size={14} />
                              : step.isCurrent
                              ? <Clock size={14} />
                              : <div className="w-2 h-2 rounded-full bg-current" />
                            }
                          </div>
                          {!isLast && (
                            <div className={`w-0.5 h-8 mt-1 ${step.isCompleted ? 'bg-green-300' : 'bg-gray-200'}`} />
                          )}
                        </div>
                        {/* Content */}
                        <div className={`pb-4 flex-1 min-w-0 ${isLast ? '' : ''}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm font-medium ${
                              step.isCurrent ? 'text-primary' : step.isCompleted ? 'text-green-700' : 'text-gray-400'
                            }`}>
                              {step.statusAr}
                              {step.isCurrent && <span className="mr-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">الحالي</span>}
                            </p>
                            {step.occurredAt && (
                              <span className="text-xs text-gray-400 flex-shrink-0">
                                {new Date(step.occurredAt).toLocaleString('ar-IQ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Sub Orders Tracking */}
                {tracking.subOrders?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-3">تتبع الطلبات الفرعية</p>
                    <div className="space-y-3">
                      {tracking.subOrders.map(sub => {
                        const currentStep = sub.timeline?.find(s => s.isCurrent) || sub.timeline?.[0]
                        const completedCount = sub.timeline?.filter(s => s.isCompleted).length || 0
                        const totalSteps = sub.timeline?.length || 1
                        const pct = Math.round((completedCount / totalSteps) * 100)
                        return (
                          <div key={sub.subOrderId} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="text-xs font-medium text-gray-800">{sub.vendorName}</p>
                                <p className="text-xs text-gray-400">#{sub.subOrderNumber}</p>
                              </div>
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {currentStep?.statusAr || sub.status}
                              </span>
                            </div>
                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div className="bg-primary h-1.5 rounded-full transition-all"
                                style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-xs text-gray-400">{completedCount}/{totalSteps} خطوات</span>
                              {sub.driver && (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Truck size={10} />{sub.driver.name}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {tracking.estimatedDelivery && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                    <Clock size={14} className="text-primary" />
                    <span>التسليم المتوقع: {new Date(tracking.estimatedDelivery).toLocaleDateString('ar-IQ')}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-4">لا توجد بيانات تتبع</p>
            )}
          </div>






        </div>

        {/* ===== العمود الجانبي ===== */}
        <div className="space-y-5">

          {/* ملخص الطلب */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Hash size={16} className="text-primary" />ملخص الطلب
            </h3>
            <div className="space-y-2.5">
              {[
                { label: 'عدد المنتجات', value: `${totalItems} منتج` },
                { label: 'عدد المتاجر',  value: `${order.subOrders?.length ?? 0} متجر` },
                { label: 'المجموع الفرعي', value: `${(order.subtotal||0).toLocaleString()} د.ع` },
                { label: 'رسوم التوصيل',  value: `${(order.deliveryFees||0).toLocaleString()} د.ع` },
                ...(order.discountAmount > 0 ? [{ label: 'الخصم', value: `-${order.discountAmount.toLocaleString()} د.ع`, red: true }] : []),
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span className={row.red ? 'text-green-600 font-medium' : 'text-gray-900'}>{row.value}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base pt-3 border-t border-gray-200">
                <span>الإجمالي</span>
                <span className="text-primary">{order.totalAmount.toLocaleString()} د.ع</span>
              </div>
            </div>

            {/* Payment */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CreditCard size={14} className="text-gray-400" />
                  <span>{order.paymentMethod === 'COD' ? 'الدفع عند الاستلام' : order.paymentMethod}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {order.paymentStatus === 'PAID' ? 'مدفوع' : 'معلق'}
                </span>
              </div>
              {order.couponCode && (
                <p className="text-xs text-gray-400 mt-1.5">كوبون: <span className="font-mono text-primary">{order.couponCode}</span></p>
              )}
            </div>
          </div>

          {/* معلومات العميل */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <User size={16} className="text-primary" />معلومات العميل
            </h3>
            <InfoRow icon={User}  label="الاسم"   value={order.customerName} />
            <InfoRow icon={Phone} label="الهاتف"  value={order.customerPhone} dir="ltr" />
            <InfoRow icon={MapPin} label="عنوان التوصيل" value={order.deliveryAddress} />
            {order.deliveryPhone !== order.customerPhone && (
              <InfoRow icon={Phone} label="هاتف التوصيل" value={order.deliveryPhone} dir="ltr" />
            )}
          </div>

          {/* إحصائيات الطلبات الفرعية */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <ShoppingBag size={16} className="text-primary" />الطلبات الفرعية
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'الإجمالي',  value: order.totalSubOrders,     color: 'text-gray-900'  },
                { label: 'مؤكدة',    value: order.confirmedSubOrders,  color: 'text-green-600' },
                { label: 'ملغية',    value: order.cancelledSubOrders,  color: 'text-red-500'   },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-lg py-2">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminOrderDetails