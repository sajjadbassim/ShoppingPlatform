import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, Tag, Truck, AlertCircle, Store, Package, CheckCircle2, PiggyBank, Star, ShoppingCart, Heart, BadgePercent } from 'lucide-react'
import Button from '../../components/common/Button'
import Breadcrumb from '../../components/common/Breadcrumb'
import { Spinner } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useCartStore } from '../../stores/cartStore'
import { useWishlistStore } from '../../stores/wishlistStore'
import { useAuthStore } from '../../stores/authStore'
import { useCouponStore } from '../../stores/couponStore'
import { getImageUrl } from '../../utils/imageHelper'
import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { usePublicZones, vendorUsesZones } from '../../hooks/useDeliveryZones'

// ✅ مكون عرض الـ variant المختار
const VariantBadges = ({ variantAttributes, variantSku }) => {
  if (!variantAttributes?.length && !variantSku) return null
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {variantAttributes?.map((attr, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          <span className="text-gray-400">{attr.attributeNameAr}:</span>
          <span className="font-medium">{attr.valueAr}</span>
        </span>
      ))}
      {variantSku && (
        <span className="text-xs text-gray-400 font-mono">({variantSku})</span>
      )}
    </div>
  )
}

// ===========================
// السلة الفارغة: رسالة واضحة + طرق للبدء + اقتراحات منتجات
// ===========================
const useSuggestedProducts = () => {
  // نفس بيانات الصفحة الرئيسية (مخزّنة غالباً) — منتجات مميزة بلا تكرار
  const { data } = useQuery({
    queryKey: ['home'],
    queryFn: async () => { const r = await apiGet('/api/Home'); return r.data.data || r.data },
    staleTime: 5 * 60 * 1000,
  })
  const seen = new Set()
  return (data?.sections || [])
    .filter(sec => sec.isActive && sec.type !== 'top_vendors')
    .flatMap(sec => sec.data || [])
    .filter(p => p?.id && !seen.has(p.id) && seen.add(p.id))
    .slice(0, 10)
}

const SuggestedTile = ({ product: p }) => {
  const discount = p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0
  return (
    <Link to={`/products/${p.id}`}
      className="group flex-shrink-0 w-[42%] min-w-[150px] sm:w-auto sm:min-w-0 snap-start bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative aspect-square bg-gray-50">
        {p.primaryImageUrl && <img src={getImageUrl(p.primaryImageUrl)} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />}
        {discount > 0 && <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[11px] font-bold">-{discount}%</span>}
      </div>
      <div className="p-2.5">
        <p className="text-sm text-gray-800 line-clamp-2 min-h-[2.5rem]">{p.nameAr || p.name}</p>
        <p className="mt-1 text-sm font-bold text-primary">{p.price?.toLocaleString()} د.ع</p>
        {discount > 0 && <p className="text-[11px] text-gray-400 line-through">{p.originalPrice?.toLocaleString()} د.ع</p>}
      </div>
    </Link>
  )
}

const EmptyCart = ({ isAuthenticated }) => {
  const wishlistCount = useWishlistStore(s => s.items?.length || 0)
  const suggestions = useSuggestedProducts()

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-10">
      <div className="container-main py-6 space-y-8">
        <div className="relative overflow-hidden bg-white rounded-3xl border border-gray-100 px-6 py-10 lg:py-14 text-center">
          {/* زخرفة خفيفة */}
          <span className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-primary/5" aria-hidden="true" />
          <span className="absolute -bottom-20 -right-10 w-56 h-56 rounded-full bg-rose-500/5" aria-hidden="true" />

          {/* الرسم */}
          <div className="relative mx-auto w-32 h-32">
            <span className="absolute inset-0 rounded-full bg-primary/10" />
            <span className="absolute inset-4 rounded-full bg-primary/15 flex items-center justify-center">
              <ShoppingCart size={46} className="text-primary" strokeWidth={1.8} />
            </span>
            <span className="absolute -top-1 right-0 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center motion-safe:animate-bounce [animation-duration:2.4s]">
              <Tag size={16} className="text-rose-500" />
            </span>
            <span className="absolute bottom-1 -left-2 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center motion-safe:animate-bounce [animation-duration:3s] [animation-delay:.4s]">
              <Heart size={16} className="text-pink-500" />
            </span>
          </div>

          <h1 className="relative mt-6 text-xl lg:text-2xl font-bold text-gray-900">سلتك فارغة حالياً</h1>
          <p className="relative mt-2 text-sm text-gray-500 max-w-md mx-auto">
            أضف ما يعجبك من المنتجات وسيظهر هنا، ثم أكمل طلبك في أي وقت
          </p>

          <div className="relative mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 max-w-xs sm:max-w-none mx-auto">
            <Link to="/products"
              className="h-12 px-7 rounded-full bg-primary text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-primary/90 shadow-sm shadow-primary/30">
              <ShoppingBag size={18} />ابدأ التسوق
            </Link>
            <Link to="/products?hasDiscount=true"
              className="h-12 px-7 rounded-full border border-rose-200 text-rose-600 font-bold inline-flex items-center justify-center gap-2 hover:bg-rose-50">
              <BadgePercent size={18} />تصفح العروض
            </Link>
          </div>

          {wishlistCount > 0 && (
            <Link to="/wishlist"
              className="relative mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-50 text-pink-700 text-sm font-medium hover:bg-pink-100">
              <Heart size={15} fill="currentColor" />
              لديك {wishlistCount} {wishlistCount === 1 ? 'منتج' : 'منتجات'} في المفضلة
              <ArrowLeft size={15} />
            </Link>
          )}
          {!isAuthenticated && (
            <p className="relative mt-5 text-sm text-gray-500">
              أضفت منتجات من قبل؟ <Link to="/login" className="text-primary font-bold hover:underline">سجّل الدخول</Link> لاسترجاع سلتك
            </p>
          )}
        </div>

        {suggestions.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">قد يعجبك</h2>
              <Link to="/products" className="text-sm text-primary font-medium inline-flex items-center gap-1">عرض الكل<ArrowLeft size={15} /></Link>
            </div>
            <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-3 overflow-x-auto sm:overflow-visible snap-x hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              {suggestions.map(p => <SuggestedTile key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

const CartPage = () => {
  const navigate = useNavigate()
  const { success, error } = useToast()

  const { isAuthenticated } = useAuthStore()
  const {
    items: cartItems,
    isLoading,
    updateQuantity: updateCartQuantity,
    removeItem: removeCartItem,
    clearCart,
    fetchCart,
    cartData
  } = useCartStore()

  const { code: savedCouponCode, setCode: setSavedCouponCode, clear: clearSavedCoupon } = useCouponStore()
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponError, setCouponError] = useState('')
  const [updatingItems, setUpdatingItems] = useState({})
  const [showCoupon, setShowCoupon] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart().catch(err => console.error('❌ Error loading cart:', err))
    }
  }, [])

  // ✅ مرر variantId
  const handleUpdateQuantity = async (item, newQuantity) => {
    if (newQuantity < 1) return
    const itemKey = item.variantId || item.productId
    setUpdatingItems(prev => ({ ...prev, [itemKey]: true }))
    try {
      await updateCartQuantity(item.productId, newQuantity, item.variantId || null)
    } catch (err) {
      error('فشل تحديث الكمية')
    } finally {
      setUpdatingItems(prev => ({ ...prev, [itemKey]: false }))
    }
  }

  const handleRemoveItem = async (productId) => {
    try {
      await removeCartItem(productId)
      success('تم حذف المنتج من السلة')
    } catch (err) {
      error('فشل حذف المنتج')
    }
  }

  const { mutateAsync: validateCoupon, isPending: couponLoading } = useMutation({
    mutationFn: async (code) => {
      const r = await apiPost(API_ENDPOINTS.COUPONS.VALIDATE, { code, orderAmount: subtotal })
      return r.data.data || r.data
    },
  })

  const applyCoupon = async (codeOverride, silent = false) => {
    const code = (codeOverride ?? couponCode).trim()
    if (!code) return
    setCouponError('')
    try {
      const result = await validateCoupon(code)
      setAppliedCoupon({ ...result, code })
      setSavedCouponCode(code)
      if (!silent) success('تم تطبيق الكوبون بنجاح')
    } catch (err) {
      setAppliedCoupon(null)
      if (silent) {
        // كوبون محفوظ من زيارة سابقة لم يعد صالحاً — احذفه بصمت
        clearSavedCoupon()
      } else {
        setCouponError(err.message || 'كود الخصم غير صحيح')
      }
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError('')
    clearSavedCoupon()
  }

  const vendorsSummary = cartData?.vendorsSummary || []
  const warnings = cartData?.warnings || []
  const subtotal = cartData?.subtotal || 0
  // المتاجر التي تتبع مناطق التوصيل: رسومها تُعرف عند اختيار العنوان في إتمام الطلب
  const { data: zonesCfg } = usePublicZones()
  const byZone = (vendorId) => vendorUsesZones(zonesCfg, vendorId)
  const anyByZone = vendorsSummary.some(v => byZone(v.vendorId))
  const fixedFees = vendorsSummary.filter(v => !byZone(v.vendorId)).reduce((s, v) => s + (v.deliveryFee || 0), 0)
  const totalDeliveryFees = anyByZone ? fixedFees : (cartData?.totalDeliveryFees || 0)
  const totalAmount = anyByZone ? subtotal + fixedFees : (cartData?.totalAmount || 0)
  const feeText = (v) => byZone(v.vendorId) ? 'حسب منطقتك' : `${v.deliveryFee.toLocaleString()} د.ع`

  // ✅ استعادة الكوبون المحفوظ من صفحة إتمام الشراء (أو زيارة سابقة) تلقائياً
  useEffect(() => {
    if (savedCouponCode && !appliedCoupon && subtotal > 0) {
      applyCoupon(savedCouponCode, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCouponCode, subtotal])

  const discount = appliedCoupon?.discountAmount ?? 0
  const total = totalAmount - discount

  // عدد القطع، والتوفير من خصومات المنتجات
  const allItems = vendorsSummary.flatMap(v => v.items || [])
  const itemsCount = allItems.reduce((sum, i) => sum + (i.quantity || 0), 0) || cartItems?.length || 0
  const totalSavings = allItems.reduce((sum, i) =>
    sum + (i.originalPrice > i.price ? (i.originalPrice - i.price) * i.quantity : 0), 0)

  // تقدير النقاط التشجيعية التي سيكسبها هذا الطلب
  const { data: loyaltyEstimate } = useQuery({
    queryKey: ['loyalty-estimate', subtotal],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.LOYALTY.ESTIMATE, { orderAmount: subtotal })
      return r.data.data || r.data
    },
    enabled: isAuthenticated && subtotal > 0,
    staleTime: 60 * 1000,
  })
  const pointsToEarn = loyaltyEstimate?.pointsToEarn || 0

  const handleClearCart = async () => {
    if (!confirm('هل أنت متأكد من إفراغ السلة؟')) return
    try {
      await clearCart()
      success('تم إفراغ السلة')
    } catch {
      error('فشل إفراغ السلة')
    }
  }

  const breadcrumbItems = [{ label: 'سلة التسوق' }]

  if (isLoading && !cartData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!cartItems || cartItems.length === 0) {
    return <EmptyCart isAuthenticated={isAuthenticated} />
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-0">
      <div className="container-main py-4 lg:py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6 hidden lg:block" />

        {/* العنوان + إفراغ السلة */}
        <div className="flex items-center justify-between mb-3 lg:mb-4">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
            السلة
            <span className="min-w-[26px] h-[26px] px-2 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center">
              {itemsCount}
            </span>
          </h1>
          <button onClick={handleClearCart}
            className="h-9 px-3 rounded-full border border-red-200 text-red-500 text-sm flex items-center gap-1.5 hover:bg-red-50">
            <Trash2 size={15} />إفراغ السلة
          </button>
        </div>

        {warnings.length > 0 && (
          <div className="mb-3 space-y-2">
            {warnings.map((warning, index) => (
              <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">{warning}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <div className="flex-1 min-w-0 space-y-3 lg:space-y-4">
            {vendorsSummary.map((vendor) => {
              const remaining = Math.max(0, (vendor.minOrderAmount || 0) - (vendor.subtotal || 0))
              const progress = vendor.minOrderAmount > 0 ? Math.min(100, (vendor.subtotal / vendor.minOrderAmount) * 100) : 100
              return (
                <div key={vendor.vendorId} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {/* رأس المتجر */}
                  <div className="p-3 lg:p-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Store className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm lg:text-base truncate">
                          {vendor.vendorNameAr || vendor.vendorName}
                        </p>
                        <p className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Package size={12} />{vendor.itemsCount} منتج</span>
                          <span className="flex items-center gap-1"><Truck size={12} />توصيل {feeText(vendor)}</span>
                        </p>
                      </div>
                      <p className="font-bold text-gray-900 text-sm whitespace-nowrap">{vendor.subtotal.toLocaleString()} د.ع</p>
                    </div>

                    {/* الحد الأدنى للطلب */}
                    {vendor.minOrderAmount > 0 && (
                      vendor.meetsMinimum ? (
                        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-green-700">
                          <CheckCircle2 size={14} />وصلت للحد الأدنى للطلب من هذا المتجر
                        </p>
                      ) : (
                        <div className="mt-2.5">
                          <p className="text-xs text-amber-700">
                            أضف <span className="font-bold">{remaining.toLocaleString()} د.ع</span> للوصول للحد الأدنى ({vendor.minOrderAmount.toLocaleString()} د.ع)
                          </p>
                          <div className="mt-1.5 h-1.5 rounded-full bg-amber-100 overflow-hidden">
                            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {/* المنتجات */}
                  <div className="divide-y divide-gray-100">
                    {vendor.items.map(item => {
                      const itemKey = item.variantId || item.productId
                      const busy = updatingItems[itemKey]
                      const lineTotal = item.subtotal || (item.price * item.quantity)
                      return (
                        <div key={itemKey} className="p-3 lg:p-4 flex gap-3">
                          <Link to={`/products/${item.productId}`}
                            className="w-20 h-20 lg:w-24 lg:h-24 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                            <img
                              src={getImageUrl(item.productImage) || '/placeholder-product.png'}
                              alt={item.productNameAr || item.productName}
                              className="w-full h-full object-cover"
                            />
                          </Link>

                          <div className="flex-1 min-w-0 flex flex-col">
                            <Link to={`/products/${item.productId}`}
                              className="text-sm lg:text-base font-medium text-gray-900 hover:text-primary line-clamp-2 leading-snug">
                              {item.productNameAr || item.productName}
                            </Link>

                            <VariantBadges variantAttributes={item.variantAttributes} variantSku={item.variantSku} />

                            <div className="flex flex-wrap items-baseline gap-x-2 mt-1">
                              <span className="font-bold text-primary text-sm lg:text-base">{(item.price || 0).toLocaleString()} د.ع</span>
                              {item.originalPrice > item.price && (
                                <span className="text-xs text-gray-400 line-through">{item.originalPrice.toLocaleString()}</span>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 mt-auto pt-2">
                              {/* الكمية — زر الناقص يصبح حذفاً عندما تكون الكمية 1 */}
                              <div className="flex items-center h-9 border border-gray-200 rounded-full">
                                <button
                                  onClick={() => handleUpdateQuantity(item, item.quantity + 1)}
                                  disabled={busy}
                                  className="w-9 h-full flex items-center justify-center text-gray-700 disabled:opacity-50"
                                  aria-label="زيادة الكمية">
                                  <Plus size={16} />
                                </button>
                                <span className="w-8 text-center text-sm font-bold">
                                  {busy ? <Spinner size="sm" /> : item.quantity}
                                </span>
                                {item.quantity > 1 ? (
                                  <button onClick={() => handleUpdateQuantity(item, item.quantity - 1)} disabled={busy}
                                    className="w-9 h-full flex items-center justify-center text-gray-700 disabled:opacity-50"
                                    aria-label="إنقاص الكمية">
                                    <Minus size={16} />
                                  </button>
                                ) : (
                                  <button onClick={() => handleRemoveItem(item.productId)} disabled={busy}
                                    className="w-9 h-full flex items-center justify-center text-red-500 disabled:opacity-50"
                                    aria-label="حذف المنتج">
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                              <p className="text-sm font-bold text-gray-900 whitespace-nowrap">{lineTotal.toLocaleString()} د.ع</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <Link to="/products" className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:underline">
              <ShoppingBag size={16} />متابعة التسوق
            </Link>
          </div>

          {/* ملخص الطلب */}
          <div className="w-full lg:w-96">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:sticky lg:top-24">
              <h2 className="text-base lg:text-lg font-bold mb-3">ملخص الطلب</h2>

              {/* كود الخصم — مطوي حتى يُطلب */}
              <div className="mb-3">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-2 text-green-700">
                      <Tag size={16} />
                      <span className="font-medium text-sm">{appliedCoupon.code}</span>
                    </div>
                    <button onClick={removeCoupon} className="text-red-500 hover:underline text-sm">إزالة</button>
                  </div>
                ) : !showCoupon ? (
                  <button onClick={() => setShowCoupon(true)}
                    className="w-full flex items-center gap-2 text-sm text-primary font-medium py-1">
                    <Tag size={16} />لديك كود خصم؟
                  </button>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="أدخل كود الخصم"
                        value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value); setCouponError('') }}
                        onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                        className="flex-1 min-w-0 h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                      <button onClick={() => applyCoupon()} disabled={couponLoading || !couponCode.trim()}
                        className="h-10 px-4 rounded-xl bg-gray-900 text-white text-sm font-medium disabled:bg-gray-300">
                        {couponLoading ? '...' : 'تطبيق'}
                      </button>
                    </div>
                    {couponError && (
                      <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                        <AlertCircle size={12} />{couponError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2.5 py-3 border-t border-gray-100 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>المجموع الفرعي</span>
                  <span>{subtotal.toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center gap-1"><Truck size={15} />رسوم التوصيل</span>
                  <span>{anyByZone
                    ? (fixedFees > 0 ? `${fixedFees.toLocaleString()} د.ع + حسب منطقتك` : 'حسب منطقتك')
                    : `${totalDeliveryFees.toLocaleString()} د.ع`}</span>
                </div>
                {vendorsSummary.length > 1 && (
                  <div className="pr-4 space-y-1">
                    {vendorsSummary.map(vendor => (
                      <div key={vendor.vendorId} className="flex justify-between text-xs text-gray-500">
                        <span>• {vendor.vendorNameAr || vendor.vendorName}</span>
                        <span>{feeText(vendor)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>خصم الكوبون</span>
                    <span>-{discount.toLocaleString()} د.ع</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-baseline py-3 border-t border-gray-100">
                <span className="text-base lg:text-lg font-bold">الإجمالي{anyByZone && <span className="block text-[11px] font-normal text-gray-500">قبل رسوم توصيل منطقتك</span>}</span>
                <span className="text-lg font-bold text-primary">{total.toLocaleString()} د.ع</span>
              </div>

              {/* التوفير والنقاط */}
              {(totalSavings > 0 || pointsToEarn > 0) && (
                <div className="space-y-2 mb-3">
                  {totalSavings > 0 && (
                    <p className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2">
                      <PiggyBank size={16} className="flex-shrink-0" />
                      وفّرت <span className="font-bold">{totalSavings.toLocaleString()} د.ع</span> في هذا الطلب
                    </p>
                  )}
                  {pointsToEarn > 0 && (
                    <Link to="/loyalty" className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">
                      <Star size={16} className="flex-shrink-0 fill-amber-400 text-amber-400" />
                      ستكسب <span className="font-bold">{pointsToEarn.toLocaleString()} نقطة تشجيعية</span> من هذا الطلب
                    </Link>
                  )}
                </div>
              )}

              {/* زر الإتمام — على الهاتف في الشريط الثابت بالأسفل */}
              <div className="hidden lg:block">
                <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/checkout')}>
                  إتمام الشراء
                  <ArrowLeft size={18} className="mr-2" />
                </Button>
              </div>

              <p className="mt-3 text-xs text-gray-500 text-center">🔒 جميع المعاملات آمنة ومشفرة</p>
            </div>
          </div>
        </div>
      </div>

      {/* شريط الإتمام الثابت — الهاتف (مكان شريط التنقل السفلي) */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
        <div className="h-16 px-4 flex items-center gap-3">
          <div className="flex-shrink-0">
            <p className="text-[11px] text-gray-500 leading-none">الإجمالي</p>
            <p className="text-base font-bold text-gray-900 mt-1 whitespace-nowrap">{total.toLocaleString()} د.ع</p>
          </div>
          <button onClick={() => navigate('/checkout')}
            className="flex-1 h-12 rounded-full bg-primary text-white font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition">
            إتمام الطلب
            <ArrowLeft size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default CartPage
