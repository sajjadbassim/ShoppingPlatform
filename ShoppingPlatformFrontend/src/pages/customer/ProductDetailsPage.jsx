// src/pages/customer/ProductDetailsPage.jsx
import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Star, Heart, Share2, Truck, Shield, RotateCcw,
  Minus, Plus, ShoppingCart, Store, AlertCircle, Check,
  ThumbsUp, Flag, Trash2, MessageSquare, Send, Gift, Percent
} from 'lucide-react'
import Button from '../../components/common/Button'
import Breadcrumb from '../../components/common/Breadcrumb'
import ProductCard from '../../components/common/ProductCard'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/common/Tabs'
import { Skeleton } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useProduct, useProductsByCategory } from '../../hooks/useProducts'
import { useProductVariants } from '../../hooks/useVariants'
import { getAllProductImages } from '../../utils/imageHelper'
import { useCartStore } from '../../stores/cartStore'
import { useWishlistStore } from '../../stores/wishlistStore'
import { useAuthStore } from '../../stores/authStore'
import { variantsService } from '../../services/variantsService'
import { useProductReviews, useProductReviewSummary, useCreateReview, useDeleteReview, useMarkHelpful } from '../../hooks/useReviews'
import { useCustomerOrders } from '../../hooks/useOrders'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { reviewsService } from '../../services/reviewsService'


// ===========================
// ReviewSummary — ملخص التقييمات
// ===========================
const StarRating = ({ value, onChange, size = 24 }) => (
  <div className="flex gap-1">
    {[1,2,3,4,5].map(star => (
      <button
        key={star}
        type="button"
        onClick={() => onChange?.(star)}
        className={onChange ? 'cursor-pointer' : 'cursor-default'}
      >
        <Star
          size={size}
          className={star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
        />
      </button>
    ))}
  </div>
)

const ReviewSummary = ({ summary, isLoading }) => {
  if (isLoading) return <Skeleton className="h-32 w-full" />
  if (!summary) return null

  const avg = summary.averageRating ?? summary.average ?? 0
  const total = summary.totalReviews ?? summary.total ?? 0
  const dist = summary.ratingDistribution ?? summary.distribution ?? {}

  return (
    <div className="flex flex-col sm:flex-row gap-6 p-4 bg-gray-50 rounded-xl mb-6">
      {/* المتوسط */}
      <div className="text-center sm:w-36">
        <p className="text-5xl font-bold text-gray-900">{avg.toFixed(1)}</p>
        <StarRating value={Math.round(avg)} size={18} />
        <p className="text-sm text-gray-500 mt-1">{total} تقييم</p>
      </div>
      {/* التوزيع */}
      <div className="flex-1 space-y-1.5">
        {[5,4,3,2,1].map(star => {
          const count = dist[star] ?? dist[String(star)] ?? 0
          const pct = total > 0 ? (count / total) * 100 : 0
          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-4 text-gray-500">{star}</span>
              <Star size={13} className="text-yellow-400 fill-yellow-400" />
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div className="bg-yellow-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-gray-400 text-xs">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ===========================
// ReviewCard — بطاقة تقييم
// ===========================
const ReviewCard = ({ review, currentUserId, onDelete, onMarkHelpful }) => {
  const [showReport, setShowReport] = useState(false)

  return (
    <div className="border-b border-gray-100 pb-5 last:border-0">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm">
            {review.userName?.charAt(0) || review.userFullName?.charAt(0) || 'م'}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{review.userName || review.userFullName || 'مستخدم'}</p>
            <p className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString('ar-IQ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StarRating value={review.rating} size={14} />
          {review.isVerifiedPurchase && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ مشتري</span>
          )}
        </div>
      </div>

      {review.title && <p className="font-semibold text-gray-800 mb-1">{review.title}</p>}
      {review.body && <p className="text-gray-600 text-sm leading-relaxed">{review.body}</p>}

      {/* صور التقييم */}
      {review.images?.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {review.images.map((img, i) => (
            <img key={i} src={img.url || img} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 mt-3">
        <button
          onClick={() => onMarkHelpful(review.id, review.isHelpful)}
          className={`flex items-center gap-1 text-xs transition-colors ${review.isHelpful ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <ThumbsUp size={13} />
          <span>مفيد ({review.helpfulCount ?? 0})</span>
        </button>

        {currentUserId === review.userId ? (
          <button onClick={() => onDelete(review.id)} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600">
            <Trash2 size={13} />حذف
          </button>
        ) : (
          <button onClick={() => setShowReport(!showReport)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            <Flag size={13} />إبلاغ
          </button>
        )}
      </div>
    </div>
  )
}

// ===========================
// WriteReviewForm — نموذج كتابة تقييم
// ===========================
const WriteReviewForm = ({ productId, onSuccess }) => {
  const { success: showSuccess, error: showError } = useToast()
  const { isAuthenticated, user } = useAuthStore()
  const { mutateAsync: createReview, isPending } = useCreateReview()

  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [orderId, setOrderId] = useState('')
  const [showForm, setShowForm] = useState(false)

  // جلب طلبات العميل لاختيار الطلب المرتبط
  const { data: ordersData } = useCustomerOrders(user?.userId || user?.id)
  const customerOrders = (ordersData || [])
    .filter(o => o.status === 'DELIVERED' || o.status === 'Delivered')

  if (!isAuthenticated) return (
    <div className="text-center py-6 bg-gray-50 rounded-xl">
      <MessageSquare size={32} className="mx-auto mb-2 text-gray-300" />
      <p className="text-gray-500 text-sm">سجّل الدخول لكتابة تقييم</p>
    </div>
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (rating === 0) { showError('يرجى اختيار تقييم'); return }
    if (!orderId) { showError('يرجى اختيار الطلب'); return }

    try {
      const fd = reviewsService.buildFormData({ productId, orderId, rating, title, body })
      await createReview(fd)
      showSuccess('تم إضافة تقييمك بنجاح')
      setRating(0); setTitle(''); setBody(''); setOrderId('')
      setShowForm(false)
      onSuccess?.()
    } catch (err) {
      showError(err.message || 'فشل إضافة التقييم')
    }
  }

  if (!showForm) return (
    <button
      onClick={() => setShowForm(true)}
      className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 text-sm"
    >
      <MessageSquare size={16} />
      اكتب تقييمك
    </button>
  )

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-4 space-y-4">
      <h4 className="font-semibold text-gray-800">كتابة تقييم</h4>

      <div>
        <p className="text-sm text-gray-600 mb-2">تقييمك *</p>
        <StarRating value={rating} onChange={setRating} size={28} />
      </div>

      <div>
        <label className="text-sm text-gray-600 block mb-1">اختر الطلب *</label>
        {customerOrders.length === 0 ? (
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            يجب أن تكون قد استلمت طلباً يحتوي على هذا المنتج لكتابة تقييم
          </p>
        ) : (
          <select
            value={orderId}
            onChange={e => setOrderId(e.target.value)}
            className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary bg-white"
          >
            <option value="">اختر الطلب...</option>
            {customerOrders.map(o => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} — {new Date(o.createdAt).toLocaleDateString('ar-IQ')}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="text-sm text-gray-600 block mb-1">عنوان التقييم</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="ملخص تجربتك..."
          className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>

      <div>
        <label className="text-sm text-gray-600 block mb-1">تفاصيل التقييم</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="شارك تجربتك مع هذا المنتج..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none"
        />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
          إلغاء
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? '...' : <><Send size={14} />نشر التقييم</>}
        </button>
      </div>
    </form>
  )
}


// ===========================
// PromotionBadge — عرض الخصم
// ===========================
const PromotionBadge = ({ promotions }) => {
  if (!promotions?.length) return null
  return (
    <div className="space-y-2 mb-4">
      {promotions.map(promo => (
        <div key={promo.id} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <Gift size={15} className="text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">{promo.nameAr || promo.name}</p>
            <p className="text-xs text-red-500">
              خصم {promo.discountType === 'percentage'
                ? `${promo.discountValue}%`
                : `${Number(promo.discountValue).toLocaleString()} د.ع`
              }
              {promo.expiresAt && ` • ينتهي ${new Date(promo.expiresAt).toLocaleDateString('ar-IQ')}`}
            </p>
          </div>
          <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <Percent size={10} />
            {promo.discountType === 'percentage' ? promo.discountValue : 'خصم'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ===========================
// VariantSelector — مكون اختيار المتغيرات
// ===========================

const VariantSelector = ({ attributeOptions, selectedValues, onSelect, selectedVariant }) => {
  if (!attributeOptions?.length) return null

  return (
    <div className="space-y-4 mb-6">
      {attributeOptions.map(attr => (
        <div key={attr.attributeId}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-700">{attr.nameAr || attr.name}:</span>
            {selectedValues[attr.nameAr] && (
              <span className="text-sm text-primary font-medium">{selectedValues[attr.nameAr]}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {attr.values.map(val => {
              const isSelected = selectedValues[attr.nameAr] === val.valueAr
              const isUnavailable = !val.available

              return (
                <button
                  key={val.id}
                  onClick={() => !isUnavailable && onSelect(attr.nameAr, val.valueAr)}
                  disabled={isUnavailable}
                  className={`
                    relative px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all
                    ${isSelected
                      ? 'border-primary bg-primary text-white'
                      : isUnavailable
                        ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                        : 'border-gray-300 hover:border-primary hover:text-primary'
                    }
                  `}
                >
                  {val.valueAr || val.value}
                  {isSelected && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <Check size={10} className="text-white" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* تنبيه إذا لم يختر المستخدم كل الصفات */}
      {attributeOptions.length > 0 &&
        attributeOptions.some(attr => !selectedValues[attr.nameAr]) && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          ⚠️ يرجى اختيار {attributeOptions.filter(a => !selectedValues[a.nameAr]).map(a => a.nameAr).join(' و ')}
        </p>
      )}
    </div>
  )
}

// ===========================
// Main Page
// ===========================

const ProductDetailsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { success, error: showError } = useToast()

  const { isAuthenticated } = useAuthStore()
  const { addItem: addToCart, isLoading: cartLoading } = useCartStore()
  const { toggleItem: toggleWishlist, isInWishlist } = useWishlistStore()

  const { data: product, isLoading, isError, error } = useProduct(id)
  const { data: relatedProducts } = useProductsByCategory(product?.categoryId)

  // ===== Variants =====
  const { data: variants = [], isLoading: variantsLoading } = useProductVariants(id)
  const hasVariants = variantsService.hasVariants(variants)
  const attributeOptions = useMemo(() => variantsService.buildAttributeOptions(variants), [variants])
  const totalAttributeCount = attributeOptions.length

  const [selectedValues, setSelectedValues] = useState({}) // { 'اللون': 'أحمر', 'الحجم': 'L' }

  // ===== Promotions =====
  const { data: promotions = [] } = useQuery({
    queryKey: ['product-promotions', id],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.PROMOTIONS.BY_PRODUCT(id))
      const data = r.data.data || r.data
      return Array.isArray(data) ? data : []
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })

  // ===== Reviews =====
  const { user } = useAuthStore()
  const [reviewsPage, setReviewsPage] = useState(1)
  const [reviewsSort, setReviewsSort] = useState('newest')
  const { data: reviewsData, isLoading: reviewsLoading, refetch: refetchReviews } = useProductReviews({
    ProductId: id,
    SortBy: reviewsSort,
    PageNumber: reviewsPage,
    PageSize: 5,
  })
  const { data: reviewSummary, isLoading: summaryLoading } = useProductReviewSummary(id)
  const { mutateAsync: deleteReview } = useDeleteReview()
  const { mutateAsync: markHelpful } = useMarkHelpful()

  const reviews = reviewsData?.items ?? reviewsData?.reviews ?? (Array.isArray(reviewsData) ? reviewsData : [])
  const reviewsTotalPages = reviewsData?.totalPages ?? 1

  const handleDeleteReview = async (reviewId) => {
    try { await deleteReview(reviewId); refetchReviews() } catch {}
  }
  const handleMarkHelpful = async (reviewId, isHelpful) => {
    try { await markHelpful({ id: reviewId, isHelpful }); refetchReviews() } catch {}
  }
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)

  // الـ variant المختار حالياً
  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null
    const selectedCount = Object.keys(selectedValues).length
    if (selectedCount < totalAttributeCount) return null
    return variantsService.findMatchingVariant(variants, selectedValues)
  }, [variants, selectedValues, hasVariants, totalAttributeCount])

  // هل اكتمل الاختيار؟
  const isVariantFullySelected = !hasVariants || (
    Object.keys(selectedValues).length === totalAttributeCount
  )

  // السعر النهائي
  const finalPrice = product
    ? variantsService.getFinalPrice(product.price, selectedVariant)
    : 0

  // الكمية المتاحة
  const availableStock = selectedVariant
    ? selectedVariant.stockQuantity
    : (product?.stockQuantity || 0)

  // التوفر:
  // - بدون variants: يعتمد على المنتج مباشرة
  // - مع variants قبل الاختيار: يعتمد على المنتج (isAvailable) حتى يكتمل الاختيار
  // - مع variants بعد الاختيار: يعتمد على الـ variant المختار
  const productIsAvailable = product?.isAvailable && product?.stockQuantity > 0
  const isAvailable = !hasVariants
    ? productIsAvailable
    : isVariantFullySelected
      ? (selectedVariant ? selectedVariant.isAvailable && selectedVariant.stockQuantity > 0 : false)
      : productIsAvailable  // قبل الاختيار — استخدم حالة المنتج الأساسي

  const handleSelectAttribute = (attrNameAr, valueAr) => {
    setSelectedValues(prev => ({ ...prev, [attrNameAr]: valueAr }))
    setQuantity(1) // إعادة الكمية عند تغيير الاختيار
  }

  // ===== Handlers =====
  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      showError('يجب تسجيل الدخول أولاً')
      navigate('/login', { state: { from: `/products/${id}` } })
      return
    }
    if (hasVariants && !isVariantFullySelected) {
      showError('يرجى اختيار جميع الخيارات أولاً')
      return
    }
    if (hasVariants && !selectedVariant) {
      showError('هذه التشكيلة غير متوفرة')
      return
    }
    try {
      // ✅ مرر variantId إذا تم الاختيار
      await addToCart(product.id, quantity, selectedVariant?.id || null)
      success('تمت الإضافة للسلة')
    } catch (err) {
      showError(err.message || 'فشل إضافة المنتج للسلة')
    }
  }

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      showError('يجب تسجيل الدخول أولاً')
      navigate('/login', { state: { from: `/products/${id}` } })
      return
    }
    if (hasVariants && !isVariantFullySelected) {
      showError('يرجى اختيار جميع الخيارات أولاً')
      return
    }
    try {
      await addToCart(product.id, quantity, selectedVariant?.id || null)
      navigate('/checkout')
    } catch (err) {
      showError(err.message || 'حدث خطأ')
    }
  }

  const handleToggleWishlist = async () => {
    try {
      await toggleWishlist(id)
      success('تمت الإضافة للمفضلة')
    } catch {
      showError('فشلت العملية')
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: product.nameAr || product.name, url }) } catch {}
    } else {
      navigator.clipboard.writeText(url)
      success('تم نسخ الرابط')
    }
  }

  // ===== Loading =====
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container-main py-6">
          <Skeleton className="h-6 w-64 mb-6" />
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <Skeleton className="aspect-square rounded-lg mb-4" />
                <div className="flex gap-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="w-20 h-20 rounded-lg" />)}
                </div>
              </div>
              <div>
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-8 w-full mb-4" />
                <Skeleton className="h-6 w-48 mb-4" />
                <Skeleton className="h-12 w-64 mb-4" />
                <Skeleton className="h-24 w-full mb-6" />
                <div className="flex gap-3">
                  <Skeleton className="h-12 flex-1" />
                  <Skeleton className="h-12 flex-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ===== Error =====
  if (isError || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">المنتج غير موجود</h2>
          <p className="text-gray-600 mb-4">{error?.message || 'لم نتمكن من العثور على هذا المنتج'}</p>
          <Button variant="primary" onClick={() => navigate('/products')}>تصفح المنتجات</Button>
        </div>
      </div>
    )
  }

  const images = getAllProductImages(product)
  const isWishlisted = isInWishlist(product.id)
  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0

  const filteredRelatedProducts = (relatedProducts || [])
    .filter(p => p.id !== product.id)
    .slice(0, 4)

  const breadcrumbItems = [
    { label: 'المنتجات', path: '/products' },
    { label: product.nameAr || product.name },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* ===== Images ===== */}
            <div>
              {/* صورة الـ variant المختار إن وُجدت */}
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                <img
                  src={selectedVariant?.imageUrl || images[selectedImage] || ''}
                  alt={product.nameAr || product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = '' }}
                />
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                        i === selectedImage ? 'border-primary' : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ===== Info ===== */}
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
            {(product.vendorName || product.vendor?.name) && (
              <Link
                to={`/stores/${product.vendorId || product.vendor?.id}`}
                className="text-sm text-primary hover:underline flex items-center gap-1 mb-2"
              >
                <Store size={14} />
                {product.vendorName || product.vendor?.name}
              </Link>
            )}
                  <h1 className="text-2xl font-bold text-gray-900">{product.nameAr || product.name}</h1>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleToggleWishlist}
                    className={`p-2 rounded-full border transition-colors ${
                      isWishlisted ? 'bg-red-500 text-white border-red-500' : 'border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
                  </button>
                  <button onClick={handleShare} className="p-2 rounded-full border border-gray-300 hover:bg-gray-100">
                    <Share2 size={20} />
                  </button>
                </div>
              </div>

              {/* Rating */}
              {product.rating > 0 && (
                <div className="flex items-center gap-1 mb-4">
                  <Star size={18} className="text-yellow-400 fill-yellow-400" />
                  <span className="font-medium">{product.rating.toFixed(1)}</span>
                  <span className="text-gray-500">({product.reviewsCount || 0} تقييم)</span>
                </div>
              )}

              {/* ✅ العروض والخصومات */}
              <PromotionBadge promotions={promotions} />

              {/* Price */}
              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-3xl font-bold text-primary">
                  {finalPrice.toLocaleString()} د.ع
                </span>
                {discount > 0 && (
                  <>
                    <span className="text-lg text-gray-400 line-through">
                      {product.originalPrice.toLocaleString()} د.ع
                    </span>
                    <span className="px-2 py-1 bg-red-500 text-white text-sm font-medium rounded">
                      -{discount}%
                    </span>
                  </>
                )}
                {selectedVariant?.priceAdjustment !== 0 && selectedVariant?.priceAdjustment && (
                  <span className="text-sm text-gray-500">
                    ({selectedVariant.priceAdjustment > 0 ? '+' : ''}{selectedVariant.priceAdjustment.toLocaleString()} د.ع)
                  </span>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <p className="text-gray-600 mb-6">{product.description}</p>
              )}

              {/* ===== Variant Selector ===== */}
              {variantsLoading ? (
                <div className="space-y-3 mb-6">
                  <Skeleton className="h-4 w-24" />
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-16 rounded-lg" />
                    <Skeleton className="h-9 w-16 rounded-lg" />
                    <Skeleton className="h-9 w-16 rounded-lg" />
                  </div>
                </div>
              ) : (
                <VariantSelector
                  attributeOptions={attributeOptions}
                  selectedValues={selectedValues}
                  onSelect={handleSelectAttribute}
                  selectedVariant={selectedVariant}
                />
              )}

              {/* Stock Status */}
              <div className="flex items-center gap-2 mb-4">
                {isAvailable ? (
                  <>
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-green-600 text-sm">
                      متوفر ({availableStock} قطعة)
                    </span>
                  </>
                ) : hasVariants && !isVariantFullySelected ? (
                  <>
                    <span className="w-2 h-2 bg-gray-300 rounded-full" />
                    <span className="text-gray-400 text-sm">اختر الخيارات لمعرفة التوفر</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-red-600 text-sm">غير متوفر</span>
                  </>
                )}
              </div>

              {/* Quantity */}
              {isAvailable && (
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-gray-700">الكمية:</span>
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="p-2 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      <Minus size={18} />
                    </button>
                    <span className="w-12 text-center font-medium">{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => Math.min(availableStock, q + 1))}
                      disabled={quantity >= availableStock}
                      className="p-2 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mb-6">
                <Button
                  variant="primary"
                  size="lg"
                  icon={ShoppingCart}
                  className="flex-1"
                  onClick={handleAddToCart}
                  loading={cartLoading}
                  disabled={!isAvailable}
                >
                  إضافة للسلة
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={handleBuyNow}
                  disabled={!isAvailable}
                >
                  شراء الآن
                </Button>
              </div>

              {/* Features */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <Truck size={24} className="mx-auto text-primary mb-2" />
                  <p className="text-sm font-medium">توصيل سريع</p>
                  <p className="text-xs text-gray-500">خلال 24 ساعة</p>
                </div>
                <div className="text-center">
                  <Shield size={24} className="mx-auto text-primary mb-2" />
                  <p className="text-sm font-medium">ضمان الجودة</p>
                  <p className="text-xs text-gray-500">منتجات أصلية</p>
                </div>
                <div className="text-center">
                  <RotateCcw size={24} className="mx-auto text-primary mb-2" />
                  <p className="text-sm font-medium">إرجاع سهل</p>
                  <p className="text-xs text-gray-500">خلال 14 يوم</p>
                </div>
              </div>

              {product.sku && (
                <p className="text-sm text-gray-500 mt-4">
                  رمز المنتج: <span className="font-mono">{selectedVariant?.sku || product.sku}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <Tabs defaultValue="description">
            <TabsList>
              <TabsTrigger value="description">الوصف</TabsTrigger>
              <TabsTrigger value="specs">المواصفات</TabsTrigger>
              {hasVariants && <TabsTrigger value="variants">التشكيلات ({variants.length})</TabsTrigger>}

            </TabsList>

            <TabsContent value="description" className="mt-6">
              <div className="prose prose-sm max-w-none">
                {product.description || 'لا يوجد وصف متاح لهذا المنتج.'}
              </div>
            </TabsContent>

            <TabsContent value="specs" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {product.sku && (
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-500">رمز المنتج</span>
                    <span className="font-medium font-mono">{product.sku}</span>
                  </div>
                )}
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-500">التوفر</span>
                  <span className={`font-medium ${product.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                    {product.isAvailable ? 'متوفر' : 'غير متوفر'}
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-500">الكمية المتاحة</span>
                  <span className="font-medium">{product.stockQuantity || 0}</span>
                </div>
              </div>
            </TabsContent>

            {hasVariants && (
              <TabsContent value="variants" className="mt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">SKU</th>
                        {attributeOptions.map(attr => (
                          <th key={attr.attributeId} className="px-4 py-3 text-right font-semibold text-gray-700">
                            {attr.nameAr || attr.name}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">السعر</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">الكمية</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">التوفر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {variants.map(v => (
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-gray-600">{v.sku || '—'}</td>
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
                            {variantsService.getFinalPrice(product.price, v).toLocaleString()} د.ع
                          </td>
                          <td className="px-4 py-3 text-gray-700">{v.stockQuantity}</td>
                          <td className="px-4 py-3">
                            {v.isAvailable && v.stockQuantity > 0 ? (
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">متوفر</span>
                            ) : (
                              <span className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded-full">نفد</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* ===== Reviews Section ===== */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Star size={20} className="text-yellow-400 fill-yellow-400" />
              التقييمات
              {reviewSummary?.totalReviews > 0 && (
                <span className="text-sm font-normal text-gray-500">({reviewSummary.totalReviews})</span>
              )}
            </h2>
            <select
              value={reviewsSort}
              onChange={e => { setReviewsSort(e.target.value); setReviewsPage(1) }}
              className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="newest">الأحدث</option>
              <option value="highest">الأعلى تقييماً</option>
              <option value="lowest">الأقل تقييماً</option>
              <option value="helpful">الأكثر إفادة</option>
            </select>
          </div>

          <ReviewSummary summary={reviewSummary} isLoading={summaryLoading} />

          {/* Write Review */}
          <div className="mb-6">
            <WriteReviewForm productId={id} onSuccess={refetchReviews} />
          </div>

          {/* Reviews List */}
          {reviewsLoading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Star size={40} className="mx-auto mb-3 opacity-30" />
              <p>لا توجد تقييمات بعد</p>
              <p className="text-xs mt-1">كن أول من يقيّم هذا المنتج</p>
            </div>
          ) : (
            <div className="space-y-5">
              {reviews.map(review => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  currentUserId={user?.userId || user?.id}
                  onDelete={handleDeleteReview}
                  onMarkHelpful={handleMarkHelpful}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {reviewsTotalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: reviewsTotalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setReviewsPage(page)}
                  className={`w-8 h-8 rounded-lg text-sm ${
                    page === reviewsPage ? 'bg-primary text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Related Products */}
        {filteredRelatedProducts.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">منتجات مشابهة</h2>
            <div className="product-grid">
              {filteredRelatedProducts.map(p => (
                <ProductCard
                  key={p.id}
                  product={{
                    id: p.id,
                    name: p.nameAr || p.name,
                    image: p.images?.[0]?.url || p.primaryImageUrl || '',
                    price: p.price,
                    originalPrice: p.originalPrice,
                    rating: p.rating || 0,
                    reviewsCount: p.reviewsCount || 0,
                    storeName: p.vendor?.name || p.vendorName,
                    inStock: p.isAvailable && p.stockQuantity > 0,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductDetailsPage