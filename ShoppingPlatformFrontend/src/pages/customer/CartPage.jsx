import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, Tag, Truck, AlertCircle, Store, Package } from 'lucide-react'
import Button from '../../components/common/Button'
import Breadcrumb from '../../components/common/Breadcrumb'
import EmptyState from '../../components/common/EmptyState'
import { Spinner } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useCartStore } from '../../stores/cartStore'
import { useAuthStore } from '../../stores/authStore'
import { useCouponStore } from '../../stores/couponStore'
import { getImageUrl } from '../../utils/imageHelper'
import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { apiPost } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

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
  const totalDeliveryFees = cartData?.totalDeliveryFees || 0
  const totalAmount = cartData?.totalAmount || 0

  // ✅ استعادة الكوبون المحفوظ من صفحة إتمام الشراء (أو زيارة سابقة) تلقائياً
  useEffect(() => {
    if (savedCouponCode && !appliedCoupon && subtotal > 0) {
      applyCoupon(savedCouponCode, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCouponCode, subtotal])

  const discount = appliedCoupon?.discountAmount ?? 0
  const total = totalAmount - discount

  const breadcrumbItems = [{ label: 'سلة التسوق' }]

  if (isLoading && !cartData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container-main py-6">
          <Breadcrumb items={breadcrumbItems} className="mb-6" />
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <EmptyState
              type="cart"
              title="سلة التسوق فارغة"
              description="لم تقم بإضافة أي منتجات للسلة بعد"
              action={
                <Button variant="primary" onClick={() => navigate('/products')}>
                  <ShoppingBag size={18} className="ml-2" />
                  تصفح المنتجات
                </Button>
              }
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />

        {warnings.length > 0 && (
          <div className="mb-4 space-y-2">
            {warnings.map((warning, index) => (
              <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">{warning}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4">
            {vendorsSummary.map((vendor) => (
              <div key={vendor.vendorId} className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Store className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">
                          {vendor.vendorNameAr || vendor.vendorName}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Package size={14} />{vendor.itemsCount} منتج
                          </span>
                          <span className="flex items-center gap-1">
                            <Truck size={14} />{vendor.deliveryFee.toLocaleString()} د.ع
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-gray-500">المجموع</p>
                      <p className="font-bold text-gray-900">{vendor.subtotal.toLocaleString()} د.ع</p>
                    </div>
                  </div>
                  {!vendor.meetsMinimum && vendor.minOrderAmount > 0 && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      ⚠️ الحد الأدنى للطلب: {vendor.minOrderAmount.toLocaleString()} د.ع
                    </div>
                  )}
                </div>

                <div className="divide-y divide-gray-200">
                  {vendor.items.map(item => {
                    const itemKey = item.variantId || item.productId
                    return (
                      <div key={itemKey} className="p-4 flex gap-4">
                        <Link
                          to={`/products/${item.productId}`}
                          className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0"
                        >
                          <img
                            src={getImageUrl(item.productImage) || '/placeholder-product.png'}
                            alt={item.productNameAr || item.productName}
                            className="w-full h-full object-cover"
                          />
                        </Link>

                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/products/${item.productId}`}
                            className="font-medium text-gray-900 hover:text-primary line-clamp-2"
                          >
                            {item.productNameAr || item.productName}
                          </Link>

                          {/* ✅ عرض الـ variant المختار */}
                          <VariantBadges
                            variantAttributes={item.variantAttributes}
                            variantSku={item.variantSku}
                          />

                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-bold text-primary">
                              {(item.price || 0).toLocaleString()} د.ع
                            </span>
                            {item.originalPrice && item.price !== item.originalPrice && (
                              <span className="text-sm text-gray-400 line-through">
                                {item.originalPrice.toLocaleString()} د.ع
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center border border-gray-300 rounded-lg">
                              <button
                                onClick={() => handleUpdateQuantity(item, item.quantity - 1)}
                                disabled={item.quantity <= 1 || updatingItems[itemKey]}
                                className="p-1.5 hover:bg-gray-100 disabled:opacity-50"
                              >
                                <Minus size={16} />
                              </button>
                              <span className="w-10 text-center text-sm font-medium">
                                {updatingItems[itemKey] ? <Spinner size="sm" /> : item.quantity}
                              </span>
                              <button
                                onClick={() => handleUpdateQuantity(item, item.quantity + 1)}
                                disabled={updatingItems[itemKey]}
                                className="p-1.5 hover:bg-gray-100 disabled:opacity-50"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                            <button
                              onClick={() => handleRemoveItem(item.productId)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="hidden sm:block text-left">
                          <p className="font-bold text-gray-900">
                            {(item.subtotal || (item.price * item.quantity)).toLocaleString()} د.ع
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between">
              <Link to="/products" className="inline-flex items-center gap-2 text-primary hover:underline">
                <ShoppingBag size={18} />متابعة التسوق
              </Link>
              <button
                onClick={async () => {
                  if (confirm('هل أنت متأكد من إفراغ السلة؟')) {
                    await clearCart()
                    success('تم إفراغ السلة')
                  }
                }}
                className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
              >
                <Trash2 size={16} />إفراغ السلة
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="w-full lg:w-96">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-24">
              <h2 className="text-lg font-bold mb-4">ملخص الطلب</h2>

              <div className="mb-4">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700">
                      <Tag size={18} />
                      <span className="font-medium">{appliedCoupon.code}</span>
                    </div>
                    <button onClick={removeCoupon} className="text-red-500 hover:underline text-sm">إزالة</button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="كود الخصم"
                        value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value); setCouponError('') }}
                        onKeyPress={(e) => e.key === 'Enter' && applyCoupon()}
                        className="flex-1 h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                      <Button variant="outline" size="sm" onClick={() => applyCoupon()} disabled={couponLoading || !couponCode.trim()}>
                        {couponLoading ? '...' : 'تطبيق'}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                        <AlertCircle size={12} />{couponError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 py-4 border-t border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>المجموع الفرعي</span>
                  <span>{subtotal.toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center gap-1"><Truck size={16} />رسوم التوصيل</span>
                  <span>{totalDeliveryFees.toLocaleString()} د.ع</span>
                </div>
                {vendorsSummary.length > 1 && (
                  <div className="pr-4 space-y-1">
                    {vendorsSummary.map(vendor => (
                      <div key={vendor.vendorId} className="flex justify-between text-sm text-gray-500">
                        <span>• {vendor.vendorNameAr}</span>
                        <span>{vendor.deliveryFee.toLocaleString()} د.ع</span>
                      </div>
                    ))}
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>الخصم</span>
                    <span>-{discount.toLocaleString()} د.ع</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between py-4 border-t border-gray-200">
                <span className="text-lg font-bold">الإجمالي</span>
                <span className="text-lg font-bold text-primary">{total.toLocaleString()} د.ع</span>
              </div>

              <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/checkout')}>
                إتمام الشراء
                <ArrowLeft size={18} className="mr-2" />
              </Button>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 text-center">🔒 جميع المعاملات آمنة ومشفرة</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CartPage