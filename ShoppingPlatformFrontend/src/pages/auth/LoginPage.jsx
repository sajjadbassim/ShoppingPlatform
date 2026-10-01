import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, User, Lock, AlertCircle } from 'lucide-react'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores'
import { GoogleSignInSection } from '../../components/auth/GoogleSignIn'

const LoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { success, error } = useToast()
  
  // Zustand Store
  const { login, isLoading, error: authError, clearError } = useAuthStore()
  
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    identifier: location.state?.identifier || '',   // قادم من رسالة «إذا كان لديك حساب»
    password: '',
    remember: false,
  })
  const [errors, setErrors] = useState({})

  // المسار الذي جاء منه المستخدم
  const from = location.state?.from || '/'

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // مسح الأخطاء عند الكتابة
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
    if (authError) {
      clearError()
    }
  }

  const validate = () => {
    const newErrors = {}
    
    // الدخول برقم الهاتف أو بالبريد الإلكتروني
    const id = formData.identifier.trim()
    if (!id) {
      newErrors.identifier = 'أدخل رقم الهاتف أو البريد الإلكتروني'
    } else if (id.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) newErrors.identifier = 'البريد الإلكتروني غير صحيح'
    } else if (!/^(\+964|00964|964|0)?7\d{9}$/.test(id.replace(/[\s-]/g, ''))) {
      newErrors.identifier = 'رقم الهاتف غير صحيح (مثال: 07701234567)'
    }
    
    // التحقق من كلمة المرور
    if (!formData.password) {
      newErrors.password = 'كلمة المرور مطلوبة'
    } else if (formData.password.length < 6) {
      newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    try {
      const result = await login({
        identifier: formData.identifier.includes('@')
          ? formData.identifier.trim()
          : formData.identifier.replace(/[\s-]/g, ''),
        password: formData.password,
      })

      success('تم تسجيل الدخول بنجاح')
      
      // ✅ التوجيه حسب دور المستخدم (حسب ما يرجعه API)
      const roleRedirects = {
        ADMIN: '/admin',
        VENDOR: '/vendor',
        OPS: '/operations',
        DRIVER: '/driver',
        CUSTOMER: from !== '/login' ? from : '/',
      }
      
      const redirectPath = roleRedirects[result.user?.role] || '/'
      navigate(redirectPath, { replace: true })
      
    } catch (err) {
      error(err.message || 'فشل تسجيل الدخول')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/10 flex overflow-x-clip">
      {/* Left Side - Form */}
      <div className="flex-1 min-w-0 flex items-center justify-center p-6">
        <div className="w-full max-w-md min-w-0">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-block">
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-hover rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-white font-bold text-4xl">و</span>
              </div>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">مرحباً بعودتك</h1>
            <p className="text-gray-600 mt-2">سجّل دخولك للوصول إلى حسابك</p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* رسالة الخطأ العامة */}
            {authError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-700 text-sm font-medium">فشل تسجيل الدخول</p>
                  <p className="text-red-600 text-sm mt-1">{authError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="رقم الهاتف أو البريد الإلكتروني"
                name="identifier"
                type="text"
                value={formData.identifier}
                onChange={handleChange}
                error={errors.identifier}
                placeholder="07XX XXX XXXX / name@email.com"
                icon={User}
                dir="ltr"
                autoComplete="username"
              />

              <div className="relative">
                <Input
                  label="كلمة المرور"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  error={errors.password}
                  placeholder="••••••••"
                  icon={Lock}
                  dir="ltr"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-9 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={formData.remember}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-600">تذكرني</span>
                </label>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                  نسيت كلمة المرور؟
                </Link>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoading}
                disabled={isLoading}
              >
                تسجيل الدخول
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">أو</span>
              </div>
            </div>

            {/* الدخول بـ Google (للزبائن) */}
            <GoogleSignInSection redirectTo={from !== '/login' ? from : '/'} />

            {/* Register Link */}
            <p className="text-center mt-6 text-gray-600">
              ليس لديك حساب؟{' '}
              <Link to="/register" className="text-primary font-semibold hover:underline">
                إنشاء حساب جديد
              </Link>
            </p>
          </div>

          {/* Footer */}
          <p className="text-center mt-6 text-sm text-gray-500">
            بتسجيل دخولك، أنت توافق على{' '}
            <Link to="/terms" className="text-primary hover:underline">شروط الاستخدام</Link>
            {' '}و{' '}
            <Link to="/privacy" className="text-primary hover:underline">سياسة الخصوصية</Link>
          </p>
        </div>
      </div>

      {/* Right Side - Image/Info (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary-hover items-center justify-center p-12">
        <div className="max-w-lg text-white text-center">
          <h2 className="text-4xl font-bold mb-6">منصة واسط التجارية</h2>
          <p className="text-xl opacity-90 mb-8">
            أكبر منصة للتجارة الإلكترونية في العراق
          </p>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-4xl font-bold">500+</p>
              <p className="opacity-80">متجر</p>
            </div>
            <div>
              <p className="text-4xl font-bold">10K+</p>
              <p className="opacity-80">منتج</p>
            </div>
            <div>
              <p className="text-4xl font-bold">50K+</p>
              <p className="opacity-80">عميل</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage