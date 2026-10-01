import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, CreditCard, Truck, Check, ChevronLeft, ChevronRight, ChevronDown, AlertCircle, Tag, X, Star } from 'lucide-react'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Breadcrumb from '../../components/common/Breadcrumb'
import EmptyState from '../../components/common/EmptyState'
import { Spinner } from '../../components/common/Loading'
import { useToast } from '../../components/common/Toast'
import { useCartStore } from '../../stores/cartStore'
import { useAuthStore } from '../../stores/authStore'
import { useCouponStore } from '../../stores/couponStore'
import { useUserAddresses, useCreateAddress, useUpdateAddress } from '../../hooks/useAddresses'
import Modal from '../../components/common/Modal'
import AddPhoneModal from '../../components/auth/AddPhoneModal'

// الخريطة (leaflet) تُحمَّل عند الحاجة فقط
const LocationPicker = lazy(() => import('../../components/common/LocationPicker'))
const MapFallback = () => <div className="h-60 rounded-2xl bg-gray-100 animate-pulse" />
const hasPin = (a) => a?.latitude != null && a?.longitude != null
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
  const updateAddressMutation = useUpdateAddress()
  const [pin, setPin] = useState(null)                 // دبوس العنوان الجديد
  const [pinFor, setPinFor] = useState(null)           // عنوان محفوظ نحدد موقعه الآن
  const [pinDraft, setPinDraft] = useState(null)

  const [step, setStep] = useState(1)
  const [phoneGate, setPhoneGate] = useState(false)    // حساب بلا هاتف (Google) — يُطلب قبل الطلب
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
  const [showItems, setShowItems] = useState(false)   // قائمة المنتجات في الملخص (الهاتف)
  const [showCoupon, setShowCoupon] = useState(false)

  // وقت دخول الخطوة الحالية — يمنع أن تتحول ضغطة مزدوجة على "التالي" إلى تأكيد للطلب
  const stepEnteredAt = useRef(0)
  useEffect(() => { stepEnteredAt.current = Date.now() }, [step])

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

  // ✅ النقاط التشجيعية
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

  const { data: loyaltySettings } = useQuery({
    queryKey: ['loyalty-settings'],
    queryFn: async () => {
      const r = await apiGet(API_ENDPOINTS.LOYALTY.SETTINGS)
      return r.data.data || r.data
    },
    staleTime: 10 * 60 * 1000,
  })

  const availablePoints = loyaltyAccount?.balance ?? 0
  const pointValue      = pointsEstimate?.pointValue ?? loyaltySettings?.pointValue ?? 0
  const minRedemption   = loyaltySettings?.minRedemptionPoints ?? 100
  const maxPoints       = pointsEstimate?.maxRedeemablePoints ?? 0   // الباك يعيد 0 إن كان الرصيد أقل من الحد الأدنى
  const pointsToEarn    = pointsEstimate?.pointsToEarn ?? 0
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
      if (!pin)                      newErrors.pin      = 'حدّد موقع منزلك على الخريطة ليصل السائق مباشرة'
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

  // إرسال النموذج (Enter) لا يُنشئ طلباً أبداً — فقط ينقل للخطوة التالية.
  // إنشاء الطلب يتم حصراً بزر "تأكيد الطلب" (placeOrder)، لأن تغيير نوع الزر إلى submit
  // أثناء الضغط على "التالي" كان يُرسل الطلب مباشرة عند الانتقال لخطوة المراجعة
  const handleSubmit = (e) => {
    e.preventDefault()
    if (step < 3) handleNextStep()
  }

  const placeOrder = async () => {
    if (loading || Date.now() - stepEnteredAt.current < 700) return
    if (!useAuthStore.getState().user?.phone) { setPhoneGate(true); return }
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
          latitude:        pin?.latitude,
          longitude:       pin?.longitude,
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
      if (err.message?.includes('أضف رقم هاتفك')) setPhoneGate(true)
      else error(err.message || 'فشل إنشاء الطلب')
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

  // زر الإجراء الرئيسي حسب الخطوة (يُستخدم في الشريط الثابت على الهاتف وداخل البطاقة على الحاسوب)
  const primaryAction = step === 1
    ? { label: 'التالي: طريقة الدفع', onClick: handleNextStep, type: 'button' }
    : step === 2
      ? { label: 'التالي: مراجعة الطلب', onClick: handleNextStep, type: 'button' }
      : { label: 'تأكيد الطلب', onClick: placeOrder, type: 'button' }

  const itemsCount = displayItems.reduce((sum, i) => sum + (i.quantity || 0), 0)

  const OptionCard = ({ selected, disabled, onClick, children }) => (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`w-full text-right flex items-start gap-3 p-4 rounded-2xl border-2 transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-gray-300'}`}>
      <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
        selected ? 'border-primary' : 'border-gray-300'}`}>
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
      </span>
      <span className="flex-1 min-w-0">{children}</span>
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-0">
      <form onSubmit={handleSubmit} className="container-main py-4 lg:py-6">
        <Breadcrumb items={breadcrumbItems} className="mb-6 hidden lg:block" />

        {/* الخطوات */}
        <div className="bg-white rounded-2xl border border-gray-200 px-4 py-4 mb-4">
          <div className="flex items-start">
            {steps.map((s, i) => {
              const done = step > s.num
              const current = step === s.num
              return (
                <div key={s.num} className="flex-1 flex items-start">
                  <button type="button" disabled={!done} onClick={() => done && setStep(s.num)}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 disabled:cursor-default">
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      done ? 'bg-green-500 text-white' : current ? 'bg-primary text-white ring-4 ring-primary/15' : 'bg-gray-100 text-gray-400'}`}>
                      {done ? <Check size={18} /> : <s.icon size={18} />}
                    </span>
                    <span className={`text-xs ${current ? 'font-bold text-gray-900' : done ? 'text-green-700' : 'text-gray-400'}`}>{s.label}</span>
                  </button>
                  {i < steps.length - 1 && (
                    <span className={`flex-1 h-0.5 mt-5 rounded-full ${step > s.num ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <div className="flex-1 min-w-0">

            {/* الخطوة 1: العنوان */}
            {step === 1 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <MapPin size={20} className="text-primary" />عنوان التوصيل
                </h2>

                {addressesLoading ? (
                  <div className="flex justify-center py-4"><Spinner /></div>
                ) : savedAddresses?.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {savedAddresses.map(addr => (
                      <OptionCard key={addr.id}
                        selected={!useNewAddress && selectedAddressId === addr.id}
                        onClick={() => { setUseNewAddress(false); setSelectedAddressId(addr.id); setErrors({}) }}>
                        <span className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{addr.label || 'العنوان'}</span>
                          {addr.isDefault && <span className="text-[11px] bg-primary text-white px-2 py-0.5 rounded-full">افتراضي</span>}
                        </span>
                        <span className="block text-sm text-gray-600 mt-0.5">
                          {[addr.city, addr.area, addr.streetAddress, addr.buildingNumber].filter(Boolean).join('، ')}
                        </span>
                        {addr.phone && <span className="block text-sm text-gray-500 mt-0.5 text-right" dir="ltr">{addr.phone}</span>}
                      </OptionCard>
                    ))}
                    {!useNewAddress && (() => {
                      const sel = savedAddresses.find(a => a.id === selectedAddressId)
                      return sel && !hasPin(sel) && (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 flex items-center gap-3">
                          <MapPin size={20} className="text-amber-600 flex-shrink-0" />
                          <p className="flex-1 text-sm text-amber-900">هذا العنوان بدون موقع على الخريطة — حدّده ليصل السائق إلى بابك مباشرة</p>
                          <button type="button" onClick={() => { setPinDraft(null); setPinFor(sel) }}
                            className="h-9 px-3 rounded-full bg-amber-600 text-white text-xs font-bold whitespace-nowrap">تحديد الموقع</button>
                        </div>
                      )
                    })()}
                    <OptionCard selected={useNewAddress} onClick={() => setUseNewAddress(true)}>
                      <span className="font-bold text-primary">+ إضافة عنوان جديد</span>
                    </OptionCard>
                    {errors.address && <p className="text-red-500 text-sm">{errors.address}</p>}
                  </div>
                )}

                {(useNewAddress || !savedAddresses?.length) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-gray-700 mb-1.5">موقع التوصيل على الخريطة <span className="text-red-500">*</span></p>
                      <Suspense fallback={<MapFallback />}>
                        <LocationPicker value={pin} onChange={(v) => { setPin(v); if (errors.pin) setErrors(e => ({ ...e, pin: null })) }} error={errors.pin} />
                      </Suspense>
                    </div>
                    <Input label="الاسم الكامل" name="fullName" value={formData.fullName} onChange={handleChange} error={errors.fullName} placeholder="أحمد محمد" required />
                    <Input label="رقم الهاتف" name="phone" type="tel" value={formData.phone} onChange={handleChange} error={errors.phone} placeholder="07XX XXX XXXX" dir="ltr" required />
                    <div className="grid grid-cols-2 gap-3 md:contents">
                      <Input label="المدينة" name="city" value={formData.city} onChange={handleChange} error={errors.city} placeholder="بغداد" required />
                      <Input label="المنطقة" name="area" value={formData.area} onChange={handleChange} error={errors.area} placeholder="المنصور" required />
                    </div>
                    <Input label="الشارع" name="street" value={formData.street} onChange={handleChange} error={errors.street} placeholder="شارع 14 رمضان" required />
                    <Input label="رقم البناية (اختياري)" name="building" value={formData.building} onChange={handleChange} placeholder="بناية 5، شقة 3" />
                    <label className="md:col-span-2 flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="saveAddress" checked={formData.saveAddress} onChange={handleChange} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                      <span className="text-sm text-gray-600">تعيينه كعنوان افتراضي للطلبات القادمة</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* الخطوة 2: الدفع */}
            {step === 2 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <CreditCard size={20} className="text-primary" />طريقة الدفع
                </h2>
                <div className="space-y-2">
                  <OptionCard selected={formData.paymentMethod === 'cash'} onClick={() => setFormData({ ...formData, paymentMethod: 'cash' })}>
                    <span className="flex items-center gap-2 font-bold text-gray-900">💵 الدفع عند الاستلام</span>
                    <span className="block text-sm text-gray-500 mt-0.5">ادفع نقداً للسائق عند استلام طلبك</span>
                  </OptionCard>
                  {[
                    { label: '📱 زين كاش', desc: 'الدفع عبر محفظة زين كاش' },
                    { label: '💳 بطاقة ائتمان', desc: 'فيزا أو ماستركارد' },
                  ].map(m => (
                    <OptionCard key={m.label} disabled>
                      <span className="flex items-center gap-2 font-bold text-gray-900">
                        {m.label}
                        <span className="text-[11px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">قريباً</span>
                      </span>
                      <span className="block text-sm text-gray-500 mt-0.5">{m.desc}</span>
                    </OptionCard>
                  ))}
                </div>
              </div>
            )}

            {/* الخطوة 3: المراجعة والتأكيد */}
            {step === 3 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Check size={20} className="text-primary" />مراجعة الطلب
                </h2>
                <div className="space-y-3">
                  <div className="p-3 lg:p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="text-sm font-bold flex items-center gap-2"><MapPin size={15} className="text-primary" />عنوان التوصيل</h3>
                      <button type="button" onClick={() => setStep(1)} className="text-sm text-primary font-medium">تعديل</button>
                    </div>
                    {selectedAddressDisplay && (
                      <>
                        <p className="text-sm text-gray-800 font-medium">{selectedAddressDisplay.name}</p>
                        <p className="text-sm text-gray-600">{selectedAddressDisplay.address}</p>
                        <p className="text-sm text-gray-500 text-right" dir="ltr">{selectedAddressDisplay.phone}</p>
                      </>
                    )}
                  </div>
                  <div className="p-3 lg:p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2 mb-1"><CreditCard size={15} className="text-primary" />طريقة الدفع</h3>
                      <p className="text-sm text-gray-600">💵 الدفع عند الاستلام</p>
                    </div>
                    <button type="button" onClick={() => setStep(2)} className="text-sm text-primary font-medium">تعديل</button>
                  </div>
                  <div className="p-3 lg:p-4 bg-gray-50 rounded-xl">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-1"><Truck size={15} className="text-primary" />التوصيل المتوقع</h3>
                    <p className="text-sm text-gray-600">خلال 2-3 أيام عمل</p>
                  </div>
                  {/* ملاحظات الطلب — متاحة لكل العناوين (كانت تظهر مع العنوان الجديد فقط) */}
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1.5">ملاحظات للطلب (اختياري)</label>
                    <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2}
                      placeholder="مثال: الاتصال قبل الوصول، أقرب نقطة دالة..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none" />
                  </div>
                </div>
              </div>
            )}

            {/* أزرار الخطوات — الحاسوب (على الهاتف في الشريط الثابت) */}
            <div className="hidden lg:flex justify-between mt-4">
              {step > 1 ? (
                <Button variant="ghost" type="button" onClick={() => setStep(step - 1)}>السابق</Button>
              ) : <span />}
              <Button variant="primary" type={primaryAction.type} onClick={primaryAction.onClick} loading={step === 3 && loading} disabled={loading}>
                {primaryAction.label}
              </Button>
            </div>
          </div>

          {/* ملخص الطلب */}
          <div className="w-full lg:w-96">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 lg:sticky lg:top-24">
              <button type="button" onClick={() => setShowItems(o => !o)}
                className="w-full flex items-center justify-between lg:cursor-default">
                <h2 className="text-base lg:text-lg font-bold">ملخص الطلب <span className="text-sm font-normal text-gray-500">({itemsCount} قطعة)</span></h2>
                <ChevronDown size={18} className={`lg:hidden text-gray-500 transition-transform ${showItems ? 'rotate-180' : ''}`} />
              </button>

              {/* المنتجات — مطوية على الهاتف */}
              <div className={`${showItems ? 'block' : 'hidden'} lg:block space-y-3 mt-3 max-h-72 overflow-y-auto`}>
                {displayItems.map(item => (
                  <div key={item.variantId || item.productId || item.id} className="flex gap-3">
                    <img
                      src={getImageUrl(item.productImage || item.image) || '/placeholder-product.png'}
                      alt=""
                      className="w-14 h-14 object-cover rounded-xl flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.productNameAr || item.productName || item.name}</p>
                      <VariantBadges variantAttributes={item.variantAttributes} />
                      <p className="flex justify-between text-xs text-gray-500 mt-0.5">
                        <span>الكمية: {item.quantity}</span>
                        <span className="font-bold text-gray-900">{(item.subtotal || (item.price * item.quantity)).toLocaleString()} د.ع</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* كوبون الخصم */}
              <div className="pt-3 mt-3 border-t border-gray-100">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-700">{appliedCoupon.code}</p>
                        <p className="text-xs text-green-600">خصم {discountAmount.toLocaleString()} د.ع</p>
                      </div>
                    </div>
                    <button type="button" onClick={handleRemoveCoupon} className="text-gray-400 hover:text-red-500" aria-label="إزالة الكوبون">
                      <X size={16} />
                    </button>
                  </div>
                ) : !showCoupon ? (
                  <button type="button" onClick={() => setShowCoupon(true)} className="flex items-center gap-2 text-sm text-primary font-medium">
                    <Tag size={15} />لديك كود خصم؟
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        value={couponCode}
                        autoFocus
                        onChange={e => { setCouponCode(e.target.value); setCouponError('') }}
                        placeholder="أدخل كود الخصم"
                        className="flex-1 min-w-0 h-10 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                      />
                      <button type="button" onClick={() => handleApplyCoupon()} disabled={couponLoading || !couponCode.trim()}
                        className="px-4 h-10 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:bg-gray-300 flex-shrink-0">
                        {couponLoading ? '...' : 'تطبيق'}
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12} />{couponError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* استخدام النقاط التشجيعية */}
              {maxPoints >= minRedemption && (
                <div className="pt-3 mt-3 border-t border-gray-100">
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <Star size={15} className="text-amber-500 fill-amber-400" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-gray-800">استخدم نقاطك التشجيعية</span>
                        <span className="block text-xs text-gray-500">لديك {availablePoints.toLocaleString()} نقطة</span>
                      </span>
                    </span>
                    <input type="checkbox" checked={usePoints}
                      onChange={e => { setUsePoints(e.target.checked); setPointsToRedeem(e.target.checked ? maxPoints : 0) }}
                      className="w-5 h-5 accent-primary" />
                  </label>
                  {usePoints && (
                    <div className="mt-2 space-y-1">
                      <input type="range" min={minRedemption} max={maxPoints} step={Math.max(1, Math.min(minRedemption, maxPoints))}
                        value={pointsToRedeem} onChange={e => setPointsToRedeem(Number(e.target.value))}
                        className="w-full accent-primary" />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{pointsToRedeem.toLocaleString()} نقطة</span>
                        <span className="text-green-600 font-medium">خصم {pointsDiscount.toLocaleString()} د.ع</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* الإجماليات */}
              <div className="space-y-2 py-3 mt-3 border-t border-gray-100 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>المجموع الفرعي</span><span>{subtotal.toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center gap-1"><Truck size={14} />رسوم التوصيل</span>
                  <span>{totalDeliveryFees.toLocaleString()} د.ع</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1"><Tag size={14} />خصم الكوبون</span>
                    <span>-{discountAmount.toLocaleString()} د.ع</span>
                  </div>
                )}
                {pointsDiscount > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span className="flex items-center gap-1"><Star size={14} className="fill-amber-400" />خصم النقاط</span>
                    <span>-{pointsDiscount.toLocaleString()} د.ع</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-baseline py-3 border-t border-gray-100">
                <span className="text-base lg:text-lg font-bold">الإجمالي</span>
                <span className="text-lg font-bold text-primary">{totalAmount.toLocaleString()} د.ع</span>
              </div>

              {pointsToEarn > 0 && (
                <p className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">
                  <Star size={15} className="flex-shrink-0 fill-amber-400 text-amber-400" />
                  ستكسب <span className="font-bold">{pointsToEarn.toLocaleString()} نقطة</span> بعد توصيل الطلب
                </p>
              )}

              <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
                <span>🔒 معاملات آمنة</span>
                <span>📦 إرجاع خلال 14 يوم</span>
              </div>
            </div>
          </div>
        </div>

        {/* الشريط الثابت — الهاتف */}
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
          <div className="h-16 px-4 flex items-center gap-3">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(step - 1)} aria-label="الخطوة السابقة"
                className="w-12 h-12 flex-shrink-0 rounded-full border border-gray-300 text-gray-700 flex items-center justify-center">
                <ChevronRight size={20} />
              </button>
            ) : (
              <div className="flex-shrink-0">
                <p className="text-[11px] text-gray-500 leading-none">الإجمالي</p>
                <p className="text-base font-bold text-gray-900 mt-1 whitespace-nowrap">{totalAmount.toLocaleString()} د.ع</p>
              </div>
            )}
            <button type={primaryAction.type} onClick={primaryAction.onClick} disabled={loading}
              className="flex-1 h-12 rounded-full bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-70">
              {step === 3 && loading ? <Spinner size="sm" /> : (
                <>
                  {primaryAction.label}
                  {step === 3 && <span className="font-normal opacity-90">• {totalAmount.toLocaleString()} د.ع</span>}
                  {step < 3 && <ChevronLeft size={18} />}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
      <AddPhoneModal isOpen={phoneGate} onClose={() => setPhoneGate(false)}
        initialPhone={useNewAddress ? formData.phone : (savedAddresses?.find(a => a.id === selectedAddressId)?.phone || formData.phone)}
        onDone={() => { setPhoneGate(false); stepEnteredAt.current = 0; setTimeout(placeOrder, 0) }} />

      <Modal isOpen={!!pinFor} onClose={() => setPinFor(null)} title="تحديد موقع العنوان" size="md">
        {pinFor && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{[pinFor.city, pinFor.area, pinFor.streetAddress].filter(Boolean).join('، ')}</p>
            <Suspense fallback={<MapFallback />}>
              <LocationPicker value={pinDraft} onChange={setPinDraft} height={300} />
            </Suspense>
            <Button variant="primary" fullWidth disabled={!pinDraft} loading={updateAddressMutation.isPending}
              onClick={async () => {
                try {
                  await updateAddressMutation.mutateAsync({ id: pinFor.id, addressData: {
                    label: pinFor.label || '', streetAddress: pinFor.streetAddress || '', city: pinFor.city || '', area: pinFor.area || '',
                    buildingNumber: pinFor.buildingNumber || '', floorNumber: pinFor.floorNumber || '', apartmentNumber: pinFor.apartmentNumber || '',
                    phone: pinFor.phone || '', notes: pinFor.notes || '', isDefault: !!pinFor.isDefault,
                    latitude: pinDraft.latitude, longitude: pinDraft.longitude,
                  } })
                  success('تم حفظ موقع العنوان')
                  setPinFor(null)
                } catch (err) { error(err.message || 'تعذّر حفظ الموقع') }
              }}>
              حفظ الموقع
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default CheckoutPage
