import { useParams, Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
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
import { useOrderByNumber, useCancelOrder, useOrderTracking, useInvoice, useOrderRatingStatus, useCreateOrderRating, useRateOrderStores } from '../../hooks/useOrders'
import { getImageUrl } from '../../utils/imageHelper'
import { useCartStore } from '../../stores/cartStore'
import { useState, useEffect } from 'react'
import { orderService } from '../../services'
import { CustomerDeliveredIn } from '../../components/common/OrderTiming'


// ===========================
// StarPicker — اختيار النجوم
// ===========================
const StarPicker = ({ value, onChange, label, size = 24 }) => (
  <div>
    {label && <p className="text-sm text-gray-600 mb-1">{label}</p>}
    <div className="flex gap-1">
      {[1,2,3,4,5].map(star => (
        <button
          key={star}
          type="button"
          aria-label={`${star} نجوم`}
          onClick={() => onChange(star === value ? 0 : star)}
          className="p-0.5 transition-transform active:scale-90"
        >
          <Star size={size} className={star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
        </button>
      ))}
    </div>
  </div>
)

const STAR_WORDS = ['', 'سيئ', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز']

// ===========================
// OrderRatingForm — تقييم الطلب بزر واحد
// كل شيء اختياري: يرسل ما اختاره الزبون فقط (التجربة، أو المتاجر، أو كليهما)
// ===========================
const OrderRatingForm = ({ order, onSuccess }) => {
  const { success: showSuccess, error: showError } = useToast()
  const { data: ratingStatus } = useOrderRatingStatus(order?.id)
  const { mutateAsync: createRating, isPending: savingExperience } = useCreateOrderRating()
  const { mutateAsync: rateStores, isPending: savingStores } = useRateOrderStores()

  const [deliveryRating, setDeliveryRating] = useState(0)
  const [speedRating, setSpeedRating] = useState(0)
  const [packagingRating, setPackagingRating] = useState(0)
  const [wouldRecommend, setWouldRecommend] = useState(true)
  const [deliveryComment, setDeliveryComment] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [storeStars, setStoreStars] = useState({}) // subOrderId → نجوم المتجر
  const [driverStars, setDriverStars] = useState({}) // driverId → نجوم السائق

  const experienceDone = !!(ratingStatus?.hasRated || ratingStatus?.isRated)
  const ratedIds = ratingStatus?.ratedSubOrderIds || []
  const subOrders = order?.subOrders || []
  const pendingStores = subOrders.filter(s => !ratedIds.includes(s.id))
  const ratedStores = subOrders.filter(s => ratedIds.includes(s.id))

  // السائق يُقيَّم مرة واحدة حتى لو أوصل من أكثر من متجر
  const ratedDriverIds = ratingStatus?.ratedDriverIds || []
  const drivers = [...new Map(subOrders.filter(s => s.driverId).map(s => [s.driverId, { id: s.driverId, name: s.driverName }])).values()]
  const pendingDrivers = drivers.filter(d => !ratedDriverIds.includes(d.id))

  if (experienceDone && pendingStores.length === 0 && pendingDrivers.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle className="text-green-500 w-5 h-5 flex-shrink-0" />
        <p className="text-green-700 text-sm font-medium">شكراً! لقد قيّمت هذا الطلب</p>
      </div>
    )
  }

  const readyStores = pendingStores
    .filter(s => storeStars[s.id] > 0)
    .map(s => ({ subOrderId: s.id, vendorRating: storeStars[s.id] }))
  const readyDrivers = pendingDrivers
    .filter(d => driverStars[d.id] > 0)
    .map(d => ({ driverId: d.id, rating: driverStars[d.id] }))
  const rateExperience = !experienceDone && deliveryRating > 0
  const canSubmit = rateExperience || readyStores.length > 0 || readyDrivers.length > 0
  const isPending = savingExperience || savingStores

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    try {
      // طلب واحد في الحالتين: التجربة تحمل معها المتاجر المختارة إن وُجدت
      if (rateExperience) {
        await createRating({
          orderId: order.id,
          data: {
            deliveryRating,
            speedRating: speedRating || null,
            packagingRating: packagingRating || null,
            wouldRecommend,
            deliveryComment,
            subOrderRatings: readyStores,
            driverRatings: readyDrivers,
          }
        })
      } else {
        await rateStores({ orderId: order.id, data: { subOrderRatings: readyStores, driverRatings: readyDrivers } })
      }
      showSuccess('شكراً على تقييمك!')
      setStoreStars({})
      setDriverStars({})
      onSuccess?.()
    } catch (err) {
      showError(err.message || 'فشل إرسال التقييم')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-5 sm:p-6 space-y-5">
      <h2 className="font-bold text-lg flex items-center gap-2">
        <Star size={20} className="text-yellow-400 fill-yellow-400" />
        كيف كانت تجربتك؟
      </h2>

      {/* تجربة التوصيل: نجوم كبيرة، والتفاصيل مطوية */}
      {experienceDone ? (
        <p className="text-sm text-green-700 flex items-center gap-2">
          <CheckCircle size={16} /> قيّمت تجربة التوصيل
        </p>
      ) : (
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-600">التوصيل</p>
          <div className="flex justify-center">
            <StarPicker value={deliveryRating} onChange={setDeliveryRating} size={36} />
          </div>
          <p className="text-sm font-medium text-gray-700 h-5">{STAR_WORDS[deliveryRating]}</p>

          {deliveryRating > 0 && !showDetails && (
            <button type="button" onClick={() => setShowDetails(true)} className="text-sm text-primary font-medium">
              + أضف تفاصيل (اختياري)
            </button>
          )}
          {deliveryRating > 0 && showDetails && (
            <div className="text-right space-y-4 p-4 bg-gray-50 rounded-xl">
              <div className="grid grid-cols-2 gap-3">
                <StarPicker label="سرعة التوصيل" value={speedRating} onChange={setSpeedRating} size={20} />
                <StarPicker label="التغليف" value={packagingRating} onChange={setPackagingRating} size={20} />
              </div>
              <textarea
                value={deliveryComment}
                onChange={e => setDeliveryComment(e.target.value)}
                placeholder="ملاحظة عن التوصيل…"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <label className="flex items-center gap-2 cursor-pointer">
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
            </div>
          )}
        </div>
      )}

      {/* المتاجر: صف واحد لكل متجر */}
      {pendingStores.length > 0 && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm text-gray-600">{pendingStores.length > 1 ? 'المتاجر' : 'المتجر'}</p>
          {pendingStores.map(sub => (
            <div key={sub.id} className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-800 truncate">{sub.vendorNameAr || sub.vendorName}</p>
              <StarPicker value={storeStars[sub.id] || 0} onChange={v => setStoreStars(p => ({ ...p, [sub.id]: v }))} size={22} />
            </div>
          ))}
          {ratedStores.length > 0 && (
            <p className="text-xs text-green-700 flex items-center gap-1">
              <CheckCircle size={12} /> تم تقييم: {ratedStores.map(s => s.vendorNameAr || s.vendorName).join('، ')}
            </p>
          )}
        </div>
      )}

      {/* السائق: مرة واحدة لكل سائق */}
      {pendingDrivers.length > 0 && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm text-gray-600">{pendingDrivers.length > 1 ? 'السائقون' : 'السائق'}</p>
          {pendingDrivers.map(d => (
            <div key={d.id} className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-800 truncate">{d.name || 'السائق'}</p>
              <StarPicker value={driverStars[d.id] || 0} onChange={v => setDriverStars(p => ({ ...p, [d.id]: v }))} size={22} />
            </div>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !canSubmit}
        className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'جاري الإرسال...' : 'إرسال التقييم'}
      </button>
      {!canSubmit && (
        <p className="text-xs text-gray-500 text-center -mt-2">اختر النجوم لما تريد تقييمه فقط</p>
      )}
    </form>
  )
}

const OrderDetailsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { success, error } = useToast()

  const isSuccess = searchParams.get('success') === 'true'
  const { hash } = useLocation()

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

  // الانتقال لقسم التتبع عند القدوم من زر "تتبع الطلب" (#order-tracking) بعد تحميل الطلب
  useEffect(() => {
    if (hash !== '#order-tracking' || !order) return
    const t = setTimeout(() => document.getElementById('order-tracking')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    return () => clearTimeout(t)
  }, [hash, order])

  // السلة (لإعادة الطلب)
  const { addItem: addToCart } = useCartStore()


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
        {/* شاشة تأكيد الطلب — تظهر مرة واحدة بعد إتمام الشراء */}
        {isSuccess && (
          <div className="mb-6 bg-white rounded-2xl border border-green-200 overflow-hidden">
            <div className="bg-gradient-to-b from-green-50 to-white px-5 pt-8 pb-5 text-center">
              <div className="relative w-20 h-20 mx-auto mb-4">
                <span className="absolute inset-0 rounded-full bg-green-400/30 motion-safe:animate-soft-ping" aria-hidden="true" />
                <span className="relative w-20 h-20 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-500/30">
                  <CheckCircle className="w-10 h-10" />
                </span>
              </div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">تم استلام طلبك بنجاح! 🎉</h1>
              <p className="text-sm text-gray-600 mt-2">شكراً لتسوقك من واسط. سنتواصل معك قريباً لتأكيد الطلب.</p>

              <div className="mt-5 grid grid-cols-2 gap-2 max-w-sm mx-auto text-right">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">رقم الطلب</p>
                  <p className="font-bold text-gray-900 mt-0.5" dir="ltr">#{order.orderNumber}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">المبلغ عند الاستلام</p>
                  <p className="font-bold text-primary mt-0.5">{total.toLocaleString()} د.ع</p>
                </div>
              </div>

              <p className="mt-4 text-xs text-gray-500">💵 الدفع نقداً عند الاستلام • ⭐ تُضاف نقاطك التشجيعية بعد التوصيل</p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-4 border-t border-gray-100">
              <a href="#order-tracking"
                className="h-11 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center">
                تتبع الطلب
              </a>
              <Link to="/products"
                className="h-11 rounded-full border border-gray-300 text-gray-800 text-sm font-bold flex items-center justify-center">
                متابعة التسوق
              </Link>
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
                  {order.status === 'DELIVERED' && <CustomerDeliveredIn orderId={order.id} />}
                </div>
                <StatusBadge status={order.status} />
              </div>
            </div>

            {order.status === 'DELIVERY_FAILED' && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 flex items-start gap-3">
                <AlertCircle className="text-orange-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-orange-900">تعذّر تسليم طلبك</p>
                  <p className="text-sm text-orange-800 mt-0.5">لم يتمكن السائق من تسليم الطلب. سيتواصل معك فريقنا لإعادة المحاولة أو إلغاء الطلب.</p>
                </div>
              </div>
            )}

            {/* ✅ Timeline — يعرض بيانات الـ API أو الـ fallback */}
            {order.status !== 'CANCELLED' && order.status !== 'DELIVERY_FAILED' && (
              <div id="order-tracking" className="bg-white rounded-lg border border-gray-200 p-6 scroll-mt-24">
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