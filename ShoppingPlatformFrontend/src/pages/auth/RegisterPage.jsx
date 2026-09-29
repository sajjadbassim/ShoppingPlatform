import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, User, Phone, Store, ChevronLeft, AlertCircle, CheckCircle } from 'lucide-react'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores'
import { apiPostForm } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

const RegisterPage = () => {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const { register, isLoading, error: authError, clearError } = useAuthStore()

  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    accountType: 'customer',
    fullName: '', email: '', phone: '', password: '', confirmPassword: '',
    storeName: '', storeNameAr: '', storeDesc: '', storePhone: '', storeAddress: '',
    deliveryFee: '3000', minOrder: '5000', prepTime: '30',
    agreeTerms: false,
  })
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }))
    if (authError) clearError()
  }

  const validateStep1 = () => {
    const e = {}
    if (!formData.fullName.trim() || formData.fullName.trim().length < 3)
      e.fullName = 'الاسم يجب أن يكون 3 أحرف على الأقل'
    if (!formData.phone)
      e.phone = 'رقم الهاتف مطلوب'
    else if (!/^(07[3-9]\d{8})$/.test(formData.phone.replace(/\s/g, '')))
      e.phone = 'رقم الهاتف غير صحيح (مثال: 07701234567)'
    if (formData.accountType === 'vendor') {
      if (!formData.storeName.trim())    e.storeName    = 'اسم المتجر مطلوب'
      if (!formData.storeNameAr.trim())  e.storeNameAr  = 'اسم المتجر بالعربي مطلوب'
      if (!formData.storeAddress.trim()) e.storeAddress = 'العنوان مطلوب'
      if (!formData.storeDesc.trim())    e.storeDesc    = 'وصف المتجر مطلوب'
      if (!formData.deliveryFee)         e.deliveryFee  = 'رسوم التوصيل مطلوبة'
      if (!formData.minOrder)            e.minOrder     = 'الحد الأدنى للطلب مطلوب'
      if (!formData.prepTime)            e.prepTime     = 'وقت التحضير مطلوب'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep2 = () => {
    const e = {}
    if (!formData.password || formData.password.length < 6)
      e.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
    if (formData.password !== formData.confirmPassword)
      e.confirmPassword = 'كلمات المرور غير متطابقة'
    if (!formData.agreeTerms) e.agreeTerms = 'يجب الموافقة على الشروط والأحكام'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleCustomerSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep2()) return
    try {
      await register({
        phone: formData.phone.replace(/\s/g, ''),
        password: formData.password,
        fullName: formData.fullName.trim(),
        ...(formData.email ? { email: formData.email } : {}),
      })
      success('تم إنشاء الحساب بنجاح! 🎉')
      navigate('/', { replace: true })
    } catch (err) {
      showError(err.message || 'فشل إنشاء الحساب')
    }
  }

  const handleVendorSubmit = async () => {
    if (!validateStep2()) return
    setSubmitting(true)
    try {
      // 1. تسجيل الحساب
      await register({
        phone: formData.phone.replace(/\s/g, ''),
        password: formData.password,
        fullName: formData.fullName.trim(),
        ...(formData.email ? { email: formData.email } : {}),
      })

      // 2. إنشاء المتجر في try/catch منفصل
      try {
        const fd = new FormData()
        fd.append('Name',              formData.storeName.trim())
        fd.append('NameAr',            formData.storeNameAr.trim())
        fd.append('Phone',             formData.storePhone || formData.phone.replace(/\s/g, ''))
        fd.append('IsActive',          'false')
        fd.append('DeliveryFee',       formData.deliveryFee       || '3000')
        fd.append('MinOrderAmount',    formData.minOrder          || '5000')
        fd.append('EstimatedPrepTime', formData.prepTime          || '30')
        fd.append('Address',           formData.storeAddress      || '-')
        fd.append('Description',       formData.storeDesc         || '-')
        const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        const byteChars = atob(base64Png)
        const byteArr = new Uint8Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
        const pngBlob = new Blob([byteArr], { type: 'image/png' })
        fd.append('Logo', pngBlob, 'placeholder.png')
        await apiPostForm(API_ENDPOINTS.VENDORS.BASE, fd)
        setStep(3)
      } catch (vendorErr) {
        console.error('Vendor creation error:', vendorErr)
        showError('تم إنشاء حسابك ✅ لكن فشل إنشاء المتجر — يرجى التواصل مع الدعم')
        setTimeout(() => navigate('/', { replace: true }), 3000)
      }

    } catch (err) {
      showError(err.message || 'فشل إنشاء الحساب')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = "w-full h-11 px-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
  const progressPct = step === 3 ? 100 : (step / 2) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/10 flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/80 items-center justify-center p-12">
        <div className="max-w-lg text-white text-center">
          <h2 className="text-4xl font-bold mb-6">انضم إلى منصة واسط</h2>
          <p className="text-xl opacity-90 mb-8">ابدأ رحلتك في التجارة الإلكترونية اليوم</p>
          <div className="space-y-4 text-right">
            {[
              { icon: User,  title: 'للعملاء',  desc: 'تسوق من آلاف المنتجات بأفضل الأسعار' },
              { icon: Store, title: 'للبائعين', desc: 'أنشئ متجرك وابدأ البيع بعد الموافقة' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-4 bg-white/10 rounded-xl p-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Icon size={22} />
                </div>
                <div><p className="font-semibold">{title}</p><p className="text-sm opacity-80">{desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <Link to="/">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <span className="text-white font-bold text-2xl">و</span>
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">إنشاء حساب جديد</h1>
          </div>

          {step < 3 && (
            <div className="mb-5">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>الخطوة {step} من 2</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full">
                <div className="h-1.5 bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-xl p-7">
            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{authError}</p>
              </div>
            )}

            {/* ===== Step 1 ===== */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-bold text-gray-900">المعلومات الأساسية</h2>

                {/* نوع الحساب */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">نوع الحساب</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { type: 'customer', icon: User,  label: 'عميل',  desc: 'للتسوق والشراء' },
                      { type: 'vendor',   icon: Store, label: 'بائع',  desc: 'لإنشاء متجر'    },
                    ].map(({ type, icon: Icon, label, desc }) => (
                      <button key={type} type="button"
                        onClick={() => setFormData(p => ({ ...p, accountType: type }))}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                          formData.accountType === type
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <Icon size={26} className={`mx-auto mb-1.5 ${formData.accountType === type ? 'text-primary' : 'text-gray-400'}`} />
                        <p className={`font-medium text-sm ${formData.accountType === type ? 'text-primary' : 'text-gray-700'}`}>{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <Input label="الاسم الكامل *" name="fullName" value={formData.fullName}
                  onChange={handleChange} error={errors.fullName} placeholder="أحمد محمد" required />

                <Input label="رقم الهاتف *" name="phone" type="tel"
                  value={formData.phone} onChange={handleChange} error={errors.phone}
                  placeholder="07XX XXX XXXX" dir="ltr" required />

                <Input label="البريد الإلكتروني (اختياري)" name="email" type="email"
                  value={formData.email} onChange={handleChange} error={errors.email}
                  placeholder="example@email.com" dir="ltr" />

                {/* حقول المتجر — تظهر فقط للبائع */}
                {formData.accountType === 'vendor' && (
                  <div className="border border-primary/20 bg-primary/5 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-primary flex items-center gap-2">
                      <Store size={14} />بيانات المتجر
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">اسم المتجر (EN) *</label>
                        <input name="storeName" value={formData.storeName} onChange={handleChange}
                          placeholder="My Store" dir="ltr"
                          className={`${inputCls} ${errors.storeName ? 'border-red-400' : ''}`} />
                        {errors.storeName && <p className="text-xs text-red-500 mt-0.5">{errors.storeName}</p>}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">اسم المتجر (AR) *</label>
                        <input name="storeNameAr" value={formData.storeNameAr} onChange={handleChange}
                          placeholder="متجري"
                          className={`${inputCls} ${errors.storeNameAr ? 'border-red-400' : ''}`} />
                        {errors.storeNameAr && <p className="text-xs text-red-500 mt-0.5">{errors.storeNameAr}</p>}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">هاتف المتجر</label>
                      <input name="storePhone" value={formData.storePhone} onChange={handleChange}
                        placeholder={formData.phone || '07XX XXX XXXX'} dir="ltr" className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">العنوان *</label>
                      <input name="storeAddress" value={formData.storeAddress} onChange={handleChange}
                        placeholder="المدينة، الحي"
                        className={`${inputCls} ${errors.storeAddress ? 'border-red-400' : ''}`} />
                      {errors.storeAddress && <p className="text-xs text-red-500 mt-0.5">{errors.storeAddress}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">وصف المتجر *</label>
                      <textarea name="storeDesc" value={formData.storeDesc} onChange={handleChange}
                        placeholder="اكتب وصفاً مختصراً..." rows={2}
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary resize-none ${errors.storeDesc ? 'border-red-400' : 'border-gray-300'}`} />
                      {errors.storeDesc && <p className="text-xs text-red-500 mt-0.5">{errors.storeDesc}</p>}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { name: 'deliveryFee', label: 'رسوم التوصيل *', placeholder: '3000' },
                        { name: 'minOrder',    label: 'الحد الأدنى *',  placeholder: '5000' },
                        { name: 'prepTime',    label: 'وقت التحضير *',  placeholder: '30'   },
                      ].map(f => (
                        <div key={f.name}>
                          <label className="text-xs font-medium text-gray-700 block mb-1">{f.label}</label>
                          <input type="number" name={f.name} value={formData[f.name]}
                            onChange={handleChange} placeholder={f.placeholder}
                            className={`${inputCls} ${errors[f.name] ? 'border-red-400' : ''}`} />
                          {errors[f.name] && <p className="text-xs text-red-500 mt-0.5">{errors[f.name]}</p>}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      ⚠️ المتجر سيبقى غير نشط حتى مراجعته من الإدارة
                    </p>
                  </div>
                )}

                <Button type="button" variant="primary" size="lg" fullWidth
                  onClick={() => { if (validateStep1()) setStep(2) }}>
                  التالي <ChevronLeft size={18} />
                </Button>
              </div>
            )}

            {/* ===== Step 2 ===== */}
            {step === 2 && (
              <form onSubmit={formData.accountType === 'customer' ? handleCustomerSubmit : e => { e.preventDefault(); handleVendorSubmit() }}>
                <div className="space-y-4">
                  <h2 className="font-bold text-gray-900">كلمة المرور</h2>

                  <div className="relative">
                    <Input label="كلمة المرور *" name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password} onChange={handleChange}
                      error={errors.password} placeholder="••••••••" dir="ltr" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-9 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {formData.password && (
                    <div className="flex gap-1">
                      {[1,2,3,4].map(l => (
                        <div key={l} className={`h-1 flex-1 rounded-full transition-colors ${
                          formData.password.length >= l*3
                            ? formData.password.length >= 12 ? 'bg-green-500'
                            : formData.password.length >= 8  ? 'bg-yellow-500' : 'bg-red-500'
                            : 'bg-gray-200'
                        }`} />
                      ))}
                    </div>
                  )}

                  <Input label="تأكيد كلمة المرور *" name="confirmPassword" type="password"
                    value={formData.confirmPassword} onChange={handleChange}
                    error={errors.confirmPassword} placeholder="••••••••" dir="ltr" required />

                  <div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" name="agreeTerms" checked={formData.agreeTerms}
                        onChange={handleChange} className="w-4 h-4 mt-0.5 rounded border-gray-300 accent-primary" />
                      <span className="text-sm text-gray-600">
                        أوافق على{' '}
                        <Link to="/terms" className="text-primary hover:underline">شروط الاستخدام</Link>
                        {' '}و{' '}
                        <Link to="/privacy" className="text-primary hover:underline">سياسة الخصوصية</Link>
                      </span>
                    </label>
                    {errors.agreeTerms && <p className="text-red-500 text-xs mt-1">{errors.agreeTerms}</p>}
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>
                      السابق
                    </Button>
                    <Button type="submit" variant="primary" size="lg" fullWidth
                      loading={isLoading || submitting}>
                      {formData.accountType === 'vendor' ? 'إرسال الطلب' : 'إنشاء الحساب'}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* ===== Step 3: شاشة نجاح البائع ===== */}
            {step === 3 && (
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={40} className="text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">تم إرسال طلبك بنجاح! 🎉</h2>
                <p className="text-gray-600 mb-1">شكراً لانضمامك إلى منصة واسط</p>
                <p className="text-sm text-primary font-medium mb-6">
                  سنتواصل معك في أقرب وقت لتفعيل متجرك
                </p>
                <div className="bg-gray-50 rounded-xl p-4 mb-6 text-right space-y-2">
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="text-green-500">✓</span> تم إنشاء حسابك
                  </p>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="text-green-500">✓</span> تم استلام طلب المتجر
                  </p>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="text-amber-500">⏳</span> قيد المراجعة من الإدارة
                  </p>
                </div>
                <Button variant="primary" fullWidth onClick={() => navigate('/', { replace: true })}>
                  العودة للرئيسية
                </Button>
              </div>
            )}

            {step < 3 && (
              <p className="text-center mt-5 text-gray-500 text-sm">
                لديك حساب بالفعل؟{' '}
                <Link to="/login" className="text-primary font-semibold hover:underline">تسجيل الدخول</Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage