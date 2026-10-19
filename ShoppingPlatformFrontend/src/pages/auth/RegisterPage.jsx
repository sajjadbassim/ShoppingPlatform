import { useState } from 'react'
import { GoogleSignInSection } from '../../components/auth/GoogleSignIn'
import { getReferral, clearReferral } from '../../utils/referral'
import AccountExistsHint, { isAccountExistsMessage } from '../../components/auth/AccountExistsHint'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, User, Store, ChevronLeft, AlertCircle } from 'lucide-react'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { useToast } from '../../components/common/Toast'
import { ConfirmModal } from '../../components/common/Modal'
import { useAuthStore } from '../../stores'
import { normalizeIraqiPhone } from '../../utils/phone'
import { authService } from '../../services/authService'
import PhoneCodeForm from '../../components/auth/PhoneCodeForm'

// البائع: يُنشأ حسابه كزبون ثم يُكمل بيانات متجره في /open-store
const ROLE_HOME = { ADMIN: '/admin', OPS: '/operations', DRIVER: '/driver' }

const RegisterPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { success } = useToast()
  const { register, login, isLoading, error: authError, clearError } = useAuthStore()

  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [askOpenStore, setAskOpenStore] = useState(false)   // زبون مسجّل اختار «بائع» وأدخل كلمة مروره الصحيحة
  // الخطوات: 1 المعلومات ← 2 رمز واتساب لتأكيد الرقم ← 3 كلمة المرور
  const [codeSent, setCodeSent] = useState(null)           // { phone, devCode }
  const [verification, setVerification] = useState(null)   // { phone, token } — رمز إثبات ملكية الرقم
  const [sendingCode, setSendingCode] = useState(false)
  const [formData, setFormData] = useState({
    accountType: 'customer',
    fullName: '', email: '', phone: '', password: '', confirmPassword: '',
    agreeTerms: false,
    referralCode: getReferral(),   // من رابط دعوة صديق، ويمكن كتابته يدوياً
  })
  const [errors, setErrors] = useState({})

  // الصفحة التي جاء منها الزائر (مثلاً صفحة منتج) — يعود إليها بعد إنشاء الحساب
  const from = location.state?.from && !['/login', '/register'].includes(location.state.from) ? location.state.from : '/'
  const phone = normalizeIraqiPhone(formData.phone) ?? formData.phone.replace(/\s/g, '')

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
    else if (!normalizeIraqiPhone(formData.phone))
      e.phone = 'رقم الهاتف غير صحيح (مثال: 07701234567)'
    if (!formData.email.trim())
      e.email = 'البريد الإلكتروني مطلوب'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()))
      e.email = 'البريد الإلكتروني غير صحيح'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // التالي من الخطوة 1: رقم مؤكَّد مسبقاً (رجع ليعدّل اسمه) ← كلمة المرور مباشرة، وإلا نرسل الرمز
  const goToVerify = async () => {
    if (!validateStep1()) return
    if (verification?.phone === phone) { setStep(3); return }
    setSendingCode(true)
    try {
      setCodeSent({ phone, devCode: await authService.sendPhoneCode(phone) })
      setStep(2)
    } catch (err) {
      setErrors({ phone: err.message || 'تعذّر إرسال رمز التحقق' })
    } finally {
      setSendingCode(false)
    }
  }

  // انتهت صلاحية رمز الإثبات (30 دقيقة) — نعيده لتأكيد الرقم من جديد
  const handleNotVerified = (message) => {
    if (!message?.includes('أكّد رقم هاتفك')) return false
    setVerification(null)
    setStep(1)
    return true
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

  const account = () => ({
    phone,
    password: formData.password,
    fullName: formData.fullName.trim(),
    email: formData.email.trim().toLowerCase(),
    referralCode: formData.referralCode.trim() || undefined,
    phoneVerificationToken: verification?.token,
  })

  const handleCustomerSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep2()) return
    try {
      await register(account())
      clearReferral()
      success('تم إنشاء الحساب بنجاح! 🎉')
      navigate(from, { replace: true })
    } catch (err) {
      // الخطأ يظهر في المربع أعلى النموذج (authError من المتجر) — بلا إشعار مكرر
      handleNotVerified(err.message)
    }
  }

  // الرقم أو البريد مسجّل: نجرّب الدخول بالرقم وكلمة المرور المدخلة. صاحب الحساب وحده يعرفها،
  // فلا نكشف لغيره أن الرقم مسجّل — كلمة مرور خاطئة تُبقي الرسالة المحايدة كما هي
  const continueExistingAccount = async (neutralMessage) => {
    try {
      const { user } = await login({ identifier: phone, password: formData.password })
      if (user.role === 'CUSTOMER') setAskOpenStore(true)
      else if (user.role === 'VENDOR') {
        success('لديك متجر مسبقاً')
        navigate('/vendor', { replace: true })
      } else navigate(ROLE_HOME[user.role] || '/', { replace: true })
    } catch {
      useAuthStore.setState({ error: neutralMessage })
    }
  }

  const handleVendorSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep2()) return
    setSubmitting(true)
    try {
      await register(account())
      clearReferral()
      success('تم إنشاء حسابك — بقيت بيانات المتجر')
      navigate('/open-store', { replace: true })
    } catch (err) {
      if (isAccountExistsMessage(err.message)) await continueExistingAccount(err.message)
      else handleNotVerified(err.message)
      // غير ذلك: الخطأ يظهر في المربع أعلى النموذج
    } finally {
      setSubmitting(false)
    }
  }

  const progressPct = Math.round((step / 3) * 100)

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/10 flex overflow-x-clip">
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
      <div className="flex-1 min-w-0 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md min-w-0">
          <div className="text-center mb-6">
            <Link to="/">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <span className="text-white font-bold text-2xl">و</span>
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">إنشاء حساب جديد</h1>
          </div>

          <div className="mb-5">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>الخطوة {step} من 3</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full">
              <div className="h-1.5 bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-7">
            {isAccountExistsMessage(authError) ? (
              <AccountExistsHint message={authError} identifier={phone} className="mb-4" />
            ) : authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{authError}</p>
              </div>
            )}

            {/* ===== Step 1 ===== */}
            {step === 1 && (
              <div className="space-y-4">
                {formData.accountType === 'customer' && (
                  <div className="space-y-3">
                    <GoogleSignInSection text="signup_with" redirectTo={from} />
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                      <div className="relative flex justify-center text-xs"><span className="px-3 bg-white text-gray-400">أو أنشئ حساباً برقم هاتفك</span></div>
                    </div>
                  </div>
                )}
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

                <Input label="الاسم الكامل" name="fullName" value={formData.fullName}
                  onChange={handleChange} error={errors.fullName} placeholder="أحمد محمد" required />

                <Input label="رقم الهاتف" name="phone" type="tel"
                  value={formData.phone} onChange={handleChange} error={errors.phone}
                  placeholder="07XX XXX XXXX" dir="ltr" required />

                <Input label="البريد الإلكتروني" name="email" type="email"
                  value={formData.email} onChange={handleChange} error={errors.email}
                  placeholder="example@email.com" dir="ltr" required />

                <Input label="رمز دعوة صديق (اختياري)" name="referralCode"
                  value={formData.referralCode} onChange={handleChange}
                  placeholder="ABC2345" dir="ltr" maxLength={16}
                  hint="تحصل أنت وصديقك على نقاط عند تسليم أول طلب لك" />

                {formData.accountType === 'vendor' && (
                  <p className="text-xs text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Store size={14} className="flex-shrink-0" />
                    بعد إنشاء الحساب تنتقل مباشرة لإدخال بيانات متجرك
                  </p>
                )}

                <Button type="button" variant="primary" size="lg" fullWidth
                  loading={sendingCode} disabled={sendingCode} onClick={goToVerify}>
                  التالي <ChevronLeft size={18} />
                </Button>
              </div>
            )}

            {/* ===== Step 2: تأكيد الرقم برمز واتساب ===== */}
            {step === 2 && codeSent && (
              <div className="space-y-4">
                <h2 className="font-bold text-gray-900">تأكيد رقم الهاتف</h2>
                <PhoneCodeForm phone={codeSent.phone} initialDevCode={codeSent.devCode}
                  onVerified={(token) => { setVerification({ phone: codeSent.phone, token }); setStep(3) }}
                  onChangePhone={() => setStep(1)} />
              </div>
            )}

            {/* ===== Step 3: كلمة المرور ===== */}
            {step === 3 && (
              <form onSubmit={formData.accountType === 'customer' ? handleCustomerSubmit : handleVendorSubmit}>
                <div className="space-y-4">
                  <h2 className="font-bold text-gray-900">كلمة المرور</h2>

                  <div className="relative">
                    <Input label="كلمة المرور" name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password} onChange={handleChange}
                      error={errors.password} placeholder="••••••••" dir="ltr" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
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

                  <Input label="تأكيد كلمة المرور" name="confirmPassword" type={showPassword ? 'text' : 'password'}
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
                      {formData.accountType === 'vendor' ? 'التالي: بيانات المتجر' : 'إنشاء الحساب'}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            <p className="text-center mt-5 text-gray-500 text-sm">
              لديك حساب بالفعل؟{' '}
              <Link to="/login" state={{ from }} className="text-primary font-semibold hover:underline">تسجيل الدخول</Link>
            </p>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={askOpenStore}
        type="info"
        title="حسابك مسجّل كعميل"
        message="هل تريد إنشاء متجرك الآن؟"
        confirmText="نعم"
        cancelText="لا"
        onConfirm={() => navigate('/open-store', { replace: true })}
        onClose={() => navigate(from, { replace: true })}
      />
    </div>
  )
}

export default RegisterPage