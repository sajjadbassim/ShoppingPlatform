import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Package, MapPin, CreditCard, Phone, CheckCircle,
  AlertCircle, ArrowRight, X, FileText, ExternalLink,
  Star, ThumbsUp,
} from 'lucide-react'
import Breadcrumb from '../../components/common/Breadcrumb'
import { StatusBadge } from '../../components/common/Badge'
import Button from '../../components/common/Button'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useOrderByNumber, useCancelOrder, useOrderTracking, useInvoice, useOrderRatingStatus, useCreateOrderRating } from '../../hooks/useOrders'
import { getImageUrl } from '../../utils/imageHelper'
import { useCartStore } from '../../stores/cartStore'
import { useEffect, useState } from 'react'
import { orderService } from '../../services'


// ===========================
// StarPicker — اختيار النجوم
// ===========================
const StarPicker = ({ value, onChange, label }) => (
  <div>
    {label && <p className="text-sm text-gray-600 mb-1">{label}</p>}
    <div className="flex gap-1">
      {[1,2,3,4,5].map(star => (
        <button key={star} type="button" onClick={() => onChange(star)}>
          <Star size={24} className={star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
        </button>
      ))}
    </div>
  </div>
)

// ===========================
// OrderRatingForm — نموذج تقييم الطلب
// ===========================
const OrderRatingForm = ({ order, onSuccess }) => {
  const { success: showSuccess, error: showError } = useToast()
  const { mutateAsync: createRating, isPending } = useCreateOrderRating()
  const { data: ratingStatus } = useOrderRatingStatus(order?.id)

  const [deliveryRating, setDeliveryRating] = useState(0)
  const [speedRating, setSpeedRating] = useState(0)
  const [packagingRating, setPackagingRating] = useState(0)
  const [wouldRecommend, setWouldRecommend] = useState(true)
  const [deliveryComment, setDeliveryComment] = useState('')
  const [subRatings, setSubRatings] = useState(
    (order?.subOrders || []).map(sub => ({
      subOrderId: sub.id,
      vendorName: sub.vendorNameAr || sub.vendorName,
      vendorRating: 0,
      vendorComment: '',
      driverRating: 0,
    }))
  )

  // إذا تم التقييم مسبقاً
  if (ratingStatus?.hasRated || ratingStatus?.isRated) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle className="text-green-500 w-5 h-5 flex-shrink-0" />
        <p className="text-green-700 text-sm font-medium">شكراً! لقد قيّمت هذا الطلب مسبقاً</p>
      </div>
    )
  }

  const updateSubRating = (index, field, value) => {
    setSubRatings(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (deliveryRating === 0) { showError('يرجى تقييم التوصيل'); return }

    try {
      await createRating({
        orderId: order.id,
        data: {
          deliveryRating,
          speedRating: speedRating || deliveryRating,
          packagingRating: packagingRating || deliveryRating,
          wouldRecommend,
          deliveryComment,
          subOrderRatings: subRatings
            .filter(r => r.vendorRating > 0)
            .map(({ subOrderId, vendorRating, vendorComment, driverRating }) => ({
              subOrderId, vendorRating, vendorComment, driverRating: driverRating || 0
            }))
        }
      })
      showSuccess('شكراً على تقييمك!')
      onSuccess?.()
    } catch (err) {
      showError(err.message || 'فشل إرسال التقييم')
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
        <Star size={20} className="text-yellow-400 fill-yellow-400" />
        قيّم تجربتك
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* تقييم التوصيل */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl">
          <StarPicker label="تقييم التوصيل *" value={deliveryRating} onChange={setDeliveryRating} />
          <StarPicker label="سرعة التوصيل" value={speedRating} onChange={setSpeedRating} />
          <StarPicker label="التغليف" value={packagingRating} onChange={setPackagingRating} />
        </div>

        {/* ملاحظات */}
        <div>
          <label className="text-sm text-gray-600 block mb-1">ملاحظات التوصيل</label>
          <textarea
            value={deliveryComment}
            onChange={e => setDeliveryComment(e.target.value)}
            placeholder="كيف كانت تجربة التوصيل؟"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* هل توصي؟ */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={wouldRecommend}
            onChange={e => setWouldRecommend(e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          <span className="text-sm text-gray-700 flex items-center gap-1">
            <ThumbsUp size={15} className="text-primary" />
            أنصح بالشراء من هذه المتاجر
          </span>
        </label>

        {/* تقييم كل متجر */}
        {subRatings.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">تقييم المتاجر</p>
            {subRatings.map((sub, i) => (
              <div key={sub.subOrderId} className="border border-gray-200 rounded-xl p-3 space-y-3">
                <p className="text-sm font-medium text-gray-800">{sub.vendorName}</p>
                <div className="grid grid-cols-2 gap-3">
                  <StarPicker label="تقييم المتجر" value={sub.vendorRating} onChange={v => updateSubRating(i, 'vendorRating', v)} />
                  {sub.driverRating !== undefined && (
                    <StarPicker label="تقييم السائق" value={sub.driverRating} onChange={v => updateSubRating(i, 'driverRating', v)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || deliveryRating === 0}
          className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'جاري الإرسال...' : 'إرسال التقييم'}
        </button>
      </form>
    </div>
  )
}

const OrderDetailsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { success, error } = useToast()

  const isSuccess = searchParams.get('success') === 'true'

  // جلب تفاصيل الطلب
  const { data: orderResponse, isLoading, isError, error: orderError, refetch } = useOrderByNumber(id)
  const order = orderResponse?.data || orderResponse

  // ✅ جديد — جلب بيانات التتبع من الـ API (فقط إذا كان الطلب موجود)
  const { data: trackingData } = useOrderTracking(order?.id)

  // ✅ جديد — جلب بيانات الفاتورة (فقط إذا تم التوصيل)
  const { data: invoiceData, isLoading: invoiceLoading } = useInvoice(
    orderService.isDelivered(order?.status) ? order?.id : null
  )

  // ✅ جديد — إلغاء الطلب بـ API
  const { mutateAsync: cancelOrder } = useCancelOrder()
  const { mutateAsync: createRating } = useCreateOrderRating()

  // حالة Modal الإلغاء
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [cancellingOrder, setCancellingOrder] = useState(false)

  // السلة (لإعادة الطلب)
  const { addItem: addToCart } = useCartStore()

  // عرض رسالة النجاح
  useEffect(() => {
    if (isSuccess) {
      success('🎉 تم إنشاء طلبك بنجاح!')
    }
  }, [isSuccess, success])

  // ✅ دالة إلغاء الطلب — تستخدم API مباشرة
  const handleCancelOrder = () => {
    setShowCancelModal(true)
  }

  // ✅ تأكيد الإلغاء — يرسل للـ API
  const confirmCancelOrder = async () => {
    if (!cancellationReason.trim()) {
      error('يرجى إدخال سبب الإلغاء')
      return
    }

    setCancellingOrder(true)
    try {
      await cancelOrder({ orderId: order.id, reason: cancellationReason })
      success('تم إلغاء الطلب بنجاح')
      setShowCancelModal(false)
      setCancellationReason('')
      refetch()
    } catch (err) {
      error(err.message || 'فشل إلغاء الطلب')
    } finally {
      setCancellingOrder(false)
    }
  }

  // إعادة الطلب
  const handleReorder = async () => {
    try {
      const subOrders = order.subOrders || []
      const items = subOrders.flatMap(sub => sub.items || [])
      for (const item of items) {
        await addToCart(item.productId, item.quantity)
      }
      success('تمت إضافة المنتجات للسلة')
      navigate('/cart')
    } catch (err) {
      error('فشل إضافة المنتجات للسلة')
    }
  }

  // ✅ فتح الفاتورة في تاب جديد
  const handleViewInvoice = () => {
    if (invoiceData?.previewUrl) {
      window.open(invoiceData.previewUrl, '_blank')
    } else {
      navigate(`/orders/${order.orderNumber}/invoice`)
    }
  }

  const breadcrumbItems = [
    { label: 'طلباتي', path: '/orders' },
    { label: `طلب #${order?.orderNumber || id}` },
  ]

  // حالة التحميل
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container-main py-6">
          <Skeleton className="h-6 w-48 mb-6" />
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <Skeleton className="h-8 w-64 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex gap-4 mb-4">
                    <Skeleton className="w-4 h-4 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full lg:w-96 space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <Skeleton className="h-5 w-32 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // حالة الخطأ
  if (isError || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">الطلب غير موجود</h2>
          <p className="text-gray-600 mb-4">{orderError?.message || 'لم نتمكن من العثور على هذا الطلب'}</p>
          <Button variant="primary" onClick={() => navigate('/orders')}>
            العودة للطلبات
          </Button>
        </div>
      </div>
    )
  }

  // تجهيز البيانات
  const subOrders = order.subOrders || []
  const items = subOrders.flatMap(sub => sub.items || [])
  const shippingAddress = {
    name: order.customerName,
    phone: order.deliveryPhone,
    address: order.deliveryAddress,
  }
  const subtotal  = order.subtotal    || 0
  const shipping  = order.deliveryFees || 0
  const discount  = order.discountAmount || 0
  const total     = order.totalAmount  || 0

  // ✅ Timeline — يستخدم بيانات التتبع من الـ API إذا توفرت، وإلا يحسبها محلياً
  const getTimeline = () => {
    // إذا عندنا بيانات تتبع من الـ API
    if (trackingData?.steps?.length) {
      return trackingData.steps
    }

    // fallback: حساب محلي
    const statuses = [
      { key: 'PENDING_CONFIRMATION', label: 'تم استلام الطلب' },
      { key: 'CONFIRMED',            label: 'تم تأكيد الطلب' },
      { key: 'PREPARING',            label: 'قيد التحضير'    },
      { key: 'OUT_FOR_DELIVERY',     label: 'في الطريق'       },
      { key: 'DELIVERED',            label: 'تم التوصيل'     },
    ]

    const currentIndex = statuses.findIndex(
      s => s.key === order.status?.toUpperCase()
    )

    return statuses.map((status, index) => ({
      label: status.label,
      completed: index <= currentIndex,
      date: index <= currentIndex ? order.updatedAt || order.createdAt : '',
    }))
  }

  const timeline = getTimeline()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />

        {/* رسالة النجاح */}
        {isSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <div>
              <p className="font-medium text-green-800">تم إنشاء طلبك بنجاح!</p>
              <p className="text-sm text-green-600">سيتم التواصل معك قريباً لتأكيد الطلب</p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">

          {/* Main Content */}
          <div className="flex-1 space-y-6">

            {/* Header */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Package className="text-primary" />
                    طلب #{order.orderNumber}
                  </h1>
                  <p className="text-gray-500 mt-1">
                    تاريخ الطلب:{' '}
                    {new Date(order.createdAt).toLocaleDateString('ar-IQ', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>
            </div>

            {/* ✅ Timeline — يعرض بيانات الـ API أو الـ fallback */}
            {order.status !== 'CANCELLED' && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="font-bold text-lg mb-4">تتبع الطلب</h2>

                {/* معلومات السائق إذا توفرت من الـ API */}
                {trackingData?.driver && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Phone size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-blue-900">{trackingData.driver.name}</p>
                      <p className="text-sm text-blue-600" dir="ltr">{trackingData.driver.phone}</p>
                    </div>
                  </div>
                )}

                <div className="relative">
                  {timeline.map((step, i) => (
                    <div key={i} className="flex gap-4 pb-6 last:pb-0">
                      <div className="relative">
                        <div className={`w-4 h-4 rounded-full ${step.completed ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {i < timeline.length - 1 && (
                          <div className={`absolute top-4 right-1.5 w-1 h-full ${step.completed ? 'bg-green-500' : 'bg-gray-200'}`} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${step.completed ? 'text-gray-900' : 'text-gray-400'}`}>
                          {step.label || step.status}
                        </p>
                        {step.date && step.completed && (
                          <p className="text-sm text-gray-500">
                            {new Date(step.date).toLocaleDateString('ar-IQ')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="font-bold text-lg mb-4">المنتجات ({items.length})</h2>

              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>لا توجد منتجات في هذا الطلب</p>
                  <p className="text-sm mt-2">قد يكون الطلب قيد المعالجة أو تم إلغاؤه</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <div key={item.id || index} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={getImageUrl(item.productImageUrl) || '/placeholder-product.png'}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <Link
                          to={`/products/${item.productId}`}
                          className="font-medium text-gray-900 hover:text-primary"
                        >
                          {item.productNameAr || item.productName}
                        </Link>
                        <p className="text-sm text-gray-500">الكمية: {item.quantity}</p>
                        <p className="font-bold text-primary mt-1">
                          {(item.unitPrice || 0).toLocaleString()} د.ع
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-gray-900">
                          {(item.subtotal || 0).toLocaleString()} د.ع
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
                      {/* ===== Order Rating ===== */}
            {orderService.isDelivered(order.status) && (
              <OrderRatingForm order={order} onSuccess={refetch} />
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-96 space-y-6">

            {/* Shipping Address */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <MapPin size={18} className="text-primary" />
                عنوان التوصيل
              </h3>
              <div className="text-gray-600 space-y-1">
                <p className="font-medium text-gray-900">{shippingAddress.name}</p>
                <p className="flex items-center gap-1">
                  <Phone size={14} />
                  <span dir="ltr">{shippingAddress.phone}</span>
                </p>
                <p>{shippingAddress.address}</p>
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <CreditCard size={18} className="text-primary" />
                الدفع
              </h3>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">طريقة الدفع</span>
                <span>
                  {['COD', 'cash'].includes(order.paymentMethod)     && '💵 عند الاستلام'}
                  {['ZAINCASH', 'zaincash'].includes(order.paymentMethod) && '📱 زين كاش'}
                  {['CARD', 'card'].includes(order.paymentMethod)    && '💳 بطاقة'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">حالة الدفع</span>
                <StatusBadge status={order.paymentStatus || 'PENDING'} />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-bold mb-3">ملخص الطلب</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">المجموع الفرعي</span>
                  <span>{subtotal.toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">الشحن</span>
                  <span>{shipping === 0 ? 'مجاني' : `${shipping.toLocaleString()} د.ع`}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>الخصم</span>
                    <span>-{discount.toLocaleString()} د.ع</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between pt-3 mt-3 border-t border-gray-200">
                <span className="font-bold">الإجمالي</span>
                <span className="font-bold text-primary">{total.toLocaleString()} د.ع</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">

              {/* ✅ زر الفاتورة — يظهر فقط بعد التوصيل */}
              {orderService.isDelivered(order.status) && (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={handleViewInvoice}
                  loading={invoiceLoading}
                >
                  <FileText size={16} className="ml-1" />
                  <ExternalLink size={14} className="ml-1" />
                  عرض الفاتورة
                </Button>
              )}

              {/* إعادة الطلب */}
              {orderService.isDelivered(order.status) && (
                <Button variant="outline" fullWidth onClick={handleReorder}>
                  إعادة الطلب
                </Button>
              )}

              {/* ✅ إلغاء الطلب — يستخدم API مباشرة */}
              {orderService.canCancel(order.status) && (
                <Button variant="danger" fullWidth onClick={handleCancelOrder}>
                  إلغاء الطلب
                </Button>
              )}

              <Button variant="ghost" fullWidth onClick={() => navigate('/orders')}>
                <ArrowRight size={16} className="ml-1" />
                العودة للطلبات
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal الإلغاء */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
            <button
              onClick={() => { setShowCancelModal(false); setCancellationReason('') }}
              className="absolute top-4 left-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold mb-4">إلغاء الطلب</h3>
            <p className="text-gray-600 mb-4">يرجى إدخال سبب إلغاء الطلب:</p>

            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="مثال: غيرت رأيي، وجدت سعر أفضل، تأخر التوصيل..."
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-primary"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">{cancellationReason.length}/500 حرف</p>

            <div className="flex gap-3 mt-4">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => { setShowCancelModal(false); setCancellationReason('') }}
              >
                إغلاق
              </Button>
              <Button
                variant="danger"
                fullWidth
                onClick={confirmCancelOrder}
                loading={cancellingOrder}
                disabled={!cancellationReason.trim() || cancellingOrder}
              >
                تأكيد الإلغاء
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderDetailsPage