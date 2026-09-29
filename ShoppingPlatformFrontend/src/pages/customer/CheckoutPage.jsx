import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, CreditCard, Truck, Check, ChevronLeft, AlertCircle, Tag, X, Star, Zap } from 'lucide-react'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { RadioGroup } from '../../components/common/FormControls'
import Breadcrumb from '../../components/common/Breadcrumb'
import EmptyState from '../../components/common/EmptyState'
import { Spinner } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useCartStore } from '../../stores/cartStore'
import { useAuthStore } from '../../stores/authStore'
import { useCouponStore } from '../../stores/couponStore'
import { useUserAddresses, useCreateAddress } from '../../hooks/useAddresses'
import { orderService } from '../../services'
import { apiPost, apiGet } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getImageUrl } from '../../utils/imageHelper'

// ✅ عرض الـ variant المختار
const VariantBadges = ({ variantAttributes }) => {
  if (!variantAttributes?.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {variantAttributes.map((attr, i) => (
        <span key={i} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
          {attr.attributeNameAr}: <span className="font-medium text-gray-700">{attr.valueAr}</span>
        </span>
      ))}
    </div>
  )
}

const CheckoutPage = () => {
  const navigate = useNavigate()
  const { success, error } = useToast()

  const { user, isAuthenticated } = useAuthStore()
  const {
    items: cartItems,
    cartData,         // ✅ استخدم cartData للحصول على الإجمالي الصحيح
    isLoading: cartLoading,
    clearLocalCart,
    fetchCart,
  } = useCartStore()

  const { data: savedAddresses, isLoading: addressesLoading } = useUserAddresses(user?.id)
  const createAddressMutation = useCreateAddress()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [useNewAddress, setUseNewAddress] = useState(true)

  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    city: '',
    area: '',
    street: '',
    building: '',
    notes: '',
    paymentMethod: 'cash',
    saveAddress: false,
  })

  const [errors, setErrors] = useState({})

  // ✅ كوبون الخصم (مشترك مع صفحة السلة عبر couponStore)
  const { code: savedCouponCode, setCode: setSavedCouponCode, clear: clearSavedCoupon } = useCouponStore()
  const [couponCode, setCouponCode]       = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponError, setCouponError]     = useState('')

  const { mutateAsync: validateCoupon, isPending: couponLoading } = useMutation({
    mutationFn: async (code) => {
      const r = await apiPost(API_ENDPOINTS.COUPONS.VALIDATE, { code, orderAmount: subtotal })
      return r.data.data || r.data
    },
  })

  const handleApplyCoupon = async (codeOverride, silent = false) => {
    const code = (codeOverride ?? couponCode).trim()
    if (!code) return
    setCouponError('')
    try {
      const result = await validateCoupon(code)
      setAppliedCoupon({ ...result, code })
      setSavedCouponCode(code)
    } catch (err) {
      setAppliedCoupon(null)
      if (silent) {
        // كوبون محفوظ من السلة لم يعد صالحاً — احذفه بصمت
        clearSavedCoupon()
      } else {
        setCouponError(err.message || 'الكوبون غير صالح')
      }
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError('')
    clearSavedCoupon()
  }

  // ✅ استخدم cartData للإجماليات الصحيحة من الباك
  const subtotal          = cartData?.subtotal          || cartItems.reduce((s, i) => s + (i.price * i.quantity), 0)
  const totalDeliveryFees = cartData?.totalDeliveryFees || 0

  // ✅ استعادة الكوبون المُطبَّق في السلة تلقائياً عند الوصول لإتمام الشراء
  useEffect(() => {
    if (savedCouponCode && !appliedCoupon && subtotal > 0) {
      handleApplyCoupon(savedCouponCode, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCouponCode, subtotal])

  // ✅ نقاط الولاء
  const [usePoints, setUsePoints]       = useState(false)
  const [pointsToRedeem, setPointsToRedeem] = useState(0)

  const { data: loyaltyAccount } = useQuery({
    queryKey: ['loyalty-account'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.LOYALTY.ACCOUNT)
      return r.data.data || r.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: pointsEstimate } = useQuery({
    queryKey: ['loyalty-estimate', subtotal],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.LOYALTY.ESTIMATE, { orderAmount: subtotal })
      return r.data.data || r.data
    },
    enabled: subtotal > 0,
    staleTime: 2 * 60 * 1000,
  })

  const { mutateAsync: redeemPoints } = useMutation({
    mutationFn: async ({ orderId, points }) => {
      const r = await apiPost(API_ENDPOINTS.LOYALTY.REDEEM, { orderId, points })
      return r.data.data || r.data
    },
  })

  const availablePoints = loyaltyAccount?.points ?? loyaltyAccount?.balance ?? 0
  const pointValue      = loyaltyAccount?.pointValue ?? 0.1
  const minRedemption   = pointsEstimate?.minRedemptionPoints ?? 100
  const maxPoints       = pointsEstimate?.maxRedeemablePoints ?? Math.min(availablePoints, Math.floor(subtotal / pointValue))
  const pointsDiscount  = usePoints ? Math.round(pointsToRedeem * pointValue) : 0
  const discountAmount  = appliedCoupon?.discountAmount ?? 0
  const totalAmount     = Math.max(0, (cartData?.totalAmount || (subtotal + totalDeliveryFees)) - discountAmount - pointsDiscount)

  // ✅ جلب السلة عند التحميل للحصول على variantAttributes
  useEffect(() => {
    if (isAuthenticated) {
      fetchCart().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: user.fullName || prev.fullName,
        phone: user.phone || prev.phone,
      }))
    }
  }, [user])

  useEffect(() => {
    if (savedAddresses?.length > 0 && !selectedAddressId) {
      setSelectedAddressId(savedAddresses[0].id)
      setUseNewAddress(false)
    }
  }, [savedAddresses])

  // ✅ استخدم vendorsSummary items لعرض variantAttributes
  const displayItems = cartData?.vendorsSummary
    ? cartData.vendorsSummary.flatMap(v => v.items)
    : cartItems

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }))
  }

  const validateAddress = () => {
    const newErrors = {}
    if (useNewAddress) {
      if (!formData.fullName.trim()) newErrors.fullName = 'الاسم مطلوب'
      if (!formData.phone.trim())    newErrors.phone    = 'رقم الهاتف مطلوب'
      if (!formData.city.trim())     newErrors.city     = 'المدينة مطلوبة'
      if (!formData.area.trim())     newErrors.area     = 'المنطقة مطلوبة'
      if (!formData.street.trim())   newErrors.street   = 'الشارع مطلوب'
    } else {
      if (!selectedAddressId) newErrors.address = 'اختر عنوان التوصيل'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNextStep = () => {
    if (step === 1 && !validateAddress()) return
    setStep(prev => prev + 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      let addressId = selectedAddressId

      if (useNewAddress) {
        const newAddress = {
          userId:          user?.userId || user?.id,
          label:           formData.fullName,
          streetAddress:   formData.street,
          city:            formData.city,
          area:            formData.area,
          buildingNumber:  formData.building || '',
          floorNumber:     '',
          apartmentNumber: '',
          phone:           formData.phone,
          notes:           formData.notes || '',
          isDefault:       formData.saveAddress,
        }
        const savedAddr = await createAddressMutation.mutateAsync(newAddress)
        addressId = savedAddr.id
      }

      const orderData = {
        addressId,
        customerNotes: formData.notes || '',
        couponCode: appliedCoupon?.code || undefined,
      }

      const response = await orderService.create(orderData)
      // ✅ استرداد النقاط إذا تم اختيارها
      if (usePoints && pointsToRedeem > 0 && response.id) {
        try {
          await redeemPoints({ orderId: response.id, points: pointsToRedeem })
        } catch {}
      }

      success('تم إنشاء الطلب بنجاح!')
      navigate(`/orders/${response.orderNumber || response.id}?success=true`)
      // ✅ الباك اند يُفرغ السلة فعلياً عند إنشاء الطلب — هنا فقط نُزامن الحالة المحلية
      clearLocalCart()
      clearSavedCoupon()
    } catch (err) {
      error(err.message || 'فشل إنشاء الطلب')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { num: 1, label: 'العنوان', icon: MapPin },
    { num: 2, label: 'الدفع',   icon: CreditCard },
    { num: 3, label: 'التأكيد', icon: Check },
  ]

  const breadcrumbItems = [{ label: 'السلة', path: '/cart' }, { label: 'إتمام الطلب' }]

  if (!isAuthenticated) {
    navigate('/login', { state: { from: '/checkout' } })
    return null
  }

  if (!cartLoading && (!cartItems || cartItems.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container-main py-6">
          <Breadcrumb items={breadcrumbItems} className="mb-6" />
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <EmptyState
              title="السلة فارغة"
              description="لا يمكنك إتمام الشراء بدون منتجات في السلة"
              action={<Button variant="primary" onClick={() => navigate('/products')}>تصفح المنتجات</Button>}
            />
          </div>
        </div>
      </div>
    )
  }

  const getSelectedAddressDisplay = () => {
    if (useNewAddress) {
      return {
        name:    formData.fullName,
        phone:   formData.phone,
        address: `${formData.city}، ${formData.area}، ${formData.street}${formData.building ? ` - ${formData.building}` : ''}`,
      }
    }
    const addr = savedAddresses?.find(a => a.id === selectedAddressId)
    return addr ? {
      name:    addr.label || 'العنوان',
      phone:   addr.phone,
      address: `${addr.city}، ${addr.area}، ${addr.streetAddress}`,
    } : null
  }

  const selectedAddressDisplay = getSelectedAddressDisplay()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />

        {/* Steps */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                step >= s.num ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                <s.icon size={18} />
                <span className="hidden sm:inline font-medium">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-12 h-1 mx-2 transition-colors ${step > s.num ? 'bg-primary' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Form */}
          <div className="flex-1">
            <form onSubmit={handleSubmit}>

              {/* Step 1: Address */}
              {step === 1 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <MapPin className="text-primary" />عنوان التوصيل
                  </h2>

                  {addressesLoading ? (
                    <div className="flex justify-center py-4"><Spinner /></div>
                  ) : savedAddresses?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-medium text-gray-700 mb-3">العناوين المحفوظة</h3>
                      <div className="space-y-2">
                        {savedAddresses.map(addr => (
                          <label key={addr.id} className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                            !useNewAddress && selectedAddressId === addr.id
                              ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                          }`}>
                            <input type="radio" name="savedAddress"
                              checked={!useNewAddress && selectedAddressId === addr.id}
                              onChange={() => { setUseNewAddress(false); setSelectedAddressId(addr.id) }}
                              className="mt-1"
                            />
                            <div>
                              <p className="font-medium">{addr.label || 'العنوان'}</p>
                              <p className="text-sm text-gray-600">{addr.phone}</p>
                              <p className="text-sm text-gray-500">{addr.city}، {addr.area}، {addr.streetAddress}</p>
                            </div>
                          </label>
                        ))}
                        <label className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                          useNewAddress ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                        }`}>
                          <input type="radio" name="savedAddress" checked={useNewAddress} onChange={() => setUseNewAddress(true)} />
                          <span className="font-medium">إضافة عنوان جديد</span>
                        </label>
                      </div>
                      {errors.address && <p className="text-red-500 text-sm mt-2">{errors.address}</p>}
                    </div>
                  )}

                  {(useNewAddress || !savedAddresses?.length) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input label="الاسم الكامل" name="fullName" value={formData.fullName} onChange={handleChange} error={errors.fullName} placeholder="أحمد محمد" required />
                      <Input label="رقم الهاتف" name="phone" type="tel" value={formData.phone} onChange={handleChange} error={errors.phone} placeholder="07XX XXX XXXX" dir="ltr" required />
                      <Input label="المدينة" name="city" value={formData.city} onChange={handleChange} error={errors.city} placeholder="بغداد" required />
                      <Input label="المنطقة" name="area" value={formData.area} onChange={handleChange} error={errors.area} placeholder="المنصور" required />
                      <Input label="الشارع" name="street" value={formData.street} onChange={handleChange} error={errors.street} placeholder="شارع 14 رمضان" required />
                      <Input label="رقم البناية (اختياري)" name="building" value={formData.building} onChange={handleChange} placeholder="بناية 5، شقة 3" />
                      <div className="md:col-span-2">
                        <Input label="ملاحظات التوصيل (اختياري)" name="notes" value={formData.notes} onChange={handleChange} placeholder="أي ملاحظات إضافية للتوصيل" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" name="saveAddress" checked={formData.saveAddress} onChange={handleChange} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                          <span className="text-sm text-gray-600">حفظ هذا العنوان للطلبات القادمة</span>
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <Button variant="primary" onClick={handleNextStep}>
                      التالي <ChevronLeft size={18} className="mr-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Payment */}
              {step === 2 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <CreditCard className="text-primary" />طريقة الدفع
                  </h2>
                  <RadioGroup
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={(val) => setFormData({ ...formData, paymentMethod: val })}
                    options={[
                      { value: 'cash',     label: '💵 الدفع عند الاستلام', description: 'ادفع نقداً عند استلام طلبك' },
                      { value: 'zaincash', label: '📱 زين كاش',             description: 'الدفع عبر محفظة زين كاش' },
                      { value: 'card',     label: '💳 بطاقة ائتمان',        description: 'فيزا أو ماستركارد' },
                    ]}
                  />
                  {formData.paymentMethod === 'card' && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-yellow-700 text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        الدفع بالبطاقة غير متاح حالياً، يرجى اختيار طريقة دفع أخرى
                      </p>
                    </div>
                  )}
                  <div className="mt-6 flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(1)}>السابق</Button>
                    <Button variant="primary" onClick={handleNextStep} disabled={formData.paymentMethod === 'card'}>
                      التالي <ChevronLeft size={18} className="mr-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Confirm */}
              {step === 3 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Check className="text-primary" />تأكيد الطلب
                  </h2>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium flex items-center gap-2">
                          <MapPin size={16} className="text-primary" />عنوان التوصيل
                        </h3>
                        <button type="button" onClick={() => setStep(1)} className="text-sm text-primary hover:underline">تعديل</button>
                      </div>
                      {selectedAddressDisplay && (
                        <>
                          <p className="text-gray-700 font-medium">{selectedAddressDisplay.name}</p>
                          <p className="text-gray-600 text-sm">{selectedAddressDisplay.phone}</p>
                          <p className="text-gray-600 text-sm">{selectedAddressDisplay.address}</p>
                        </>
                      )}
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium flex items-center gap-2">
                          <CreditCard size={16} className="text-primary" />طريقة الدفع
                        </h3>
                        <button type="button" onClick={() => setStep(2)} className="text-sm text-primary hover:underline">تعديل</button>
                      </div>
                      <p className="text-gray-600">
                        {formData.paymentMethod === 'cash'     && '💵 الدفع عند الاستلام'}
                        {formData.paymentMethod === 'zaincash' && '📱 زين كاش'}
                        {formData.paymentMethod === 'card'     && '💳 بطاقة ائتمان'}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-medium mb-2 flex items-center gap-2">
                        <Truck size={16} className="text-primary" />التوصيل المتوقع
                      </h3>
                      <p className="text-gray-600">خلال 2-3 أيام عمل</p>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(2)}>السابق</Button>
                    <Button variant="primary" type="submit" loading={loading} disabled={loading}>
                      تأكيد الطلب
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* ✅ Summary مع variantAttributes */}
          <div className="w-full lg:w-96">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-24">
              <h2 className="text-lg font-bold mb-4">ملخص الطلب</h2>

              <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
                {displayItems.map(item => (
                  <div key={item.variantId || item.productId || item.id} className="flex gap-3">
                    <img
                      src={getImageUrl(item.productImage || item.image) || '/placeholder-product.png'}
                      alt=""
                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">
                        {item.productNameAr || item.productName || item.name}
                      </p>
                      {/* ✅ عرض الـ variant */}
                      <VariantBadges variantAttributes={item.variantAttributes} />
                      <p className="text-xs text-gray-400 mt-0.5">الكمية: {item.quantity}</p>
                      <p className="text-sm font-bold text-primary">
                        {(item.subtotal || (item.price * item.quantity)).toLocaleString()} د.ع
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ✅ كوبون الخصم */}
              <div className="pt-3 border-t border-gray-200">
                {!appliedCoupon ? (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        value={couponCode}
                        onChange={e => { setCouponCode(e.target.value); setCouponError('') }}
                        placeholder="كود الخصم"
                        className="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon()}
                        disabled={couponLoading || !couponCode.trim()}
                        className="px-3 h-9 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
                      >
                        <Tag size={13} />{couponLoading ? '...' : 'تطبيق'}
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-red-500 text-xs flex items-center gap-1">
                        <AlertCircle size={12} />{couponError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-700">{appliedCoupon.code}</p>
                        <p className="text-xs text-green-600">خصم {discountAmount.toLocaleString()} د.ع</p>
                      </div>
                    </div>
                    <button type="button" onClick={handleRemoveCoupon} className="text-gray-400 hover:text-red-500">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* ✅ نقاط الولاء */}
              {availablePoints >= minRedemption && (
                <div className="pt-3 border-t border-gray-200">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Star size={15} className="text-yellow-400 fill-yellow-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">استخدام النقاط</p>
                        <p className="text-xs text-gray-400">لديك {availablePoints.toLocaleString()} نقطة</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={usePoints}
                      onChange={e => {
                        setUsePoints(e.target.checked)
                        setPointsToRedeem(e.target.checked ? maxPoints : 0)
                      }}
                      className="w-4 h-4 accent-primary"
                    />
                  </label>
                  {usePoints && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={minRedemption}
                          max={maxPoints}
                          step={minRedemption}
                          value={pointsToRedeem}
                          onChange={e => setPointsToRedeem(Number(e.target.value))}
                          className="flex-1 accent-primary"
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{pointsToRedeem.toLocaleString()} نقطة</span>
                        <span className="text-green-600 font-medium">خصم {pointsDiscount.toLocaleString()} د.ع</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ✅ إجماليات من cartData */}
              <div className="space-y-2 py-4 border-t border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>المجموع الفرعي</span>
                  <span>{subtotal.toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center gap-1">
                    <Truck size={14} />رسوم التوصيل
                  </span>
                  <span>{totalDeliveryFees.toLocaleString()} د.ع</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1"><Tag size={14} />خصم الكوبون</span>
                    <span>-{discountAmount.toLocaleString()} د.ع</span>
                  </div>
                )}
                {pointsDiscount > 0 && (
                  <div className="flex justify-between text-yellow-600">
                    <span className="flex items-center gap-1"><Star size={14} className="fill-yellow-400" />خصم النقاط</span>
                    <span>-{pointsDiscount.toLocaleString()} د.ع</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between py-4 border-t border-gray-200">
                <span className="text-lg font-bold">الإجمالي</span>
                <span className="text-lg font-bold text-primary">{totalAmount.toLocaleString()} د.ع</span>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-1">
                <p className="text-xs text-gray-500">🔒 جميع المعاملات آمنة ومشفرة</p>
                <p className="text-xs text-gray-500">📦 إمكانية الإرجاع خلال 14 يوم</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CheckoutPage