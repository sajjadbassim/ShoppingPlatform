import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Phone, ArrowRight, CheckCircle, KeyRound, Lock } from 'lucide-react'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { useToast } from '../../components/common/Toast'
import { authService } from '../../services/authService'

const PHONE_REGEX = /^(\+964|0)7[3-9]\d{8}$/

const ForgotPasswordPage = () => {
  const navigate = useNavigate()
  const { error: showError, success: showSuccess } = useToast()

  const [step, setStep] = useState(1) // 1: هاتف، 2: رمز التحقق، 3: كلمة مرور جديدة، 4: نجاح
  const [loading, setLoading] = useState(false)

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldError, setFieldError] = useState('')

  const handleSendCode = async (e) => {
    e.preventDefault()
    setFieldError('')

    if (!phone) {
      setFieldError('رقم الهاتف مطلوب')
      return
    }
    if (!PHONE_REGEX.test(phone.replace(/\s/g, ''))) {
      setFieldError('رقم الهاتف غير صحيح')
      return
    }

    setLoading(true)
    try {
      await authService.forgotPassword(phone)
      setStep(2)
    } catch (err) {
      showError(err.response?.data?.message || 'تعذّر إرسال رمز التحقق')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setFieldError('')

    if (!code || code.length !== 6) {
      setFieldError('أدخل رمز التحقق المكوّن من 6 أرقام')
      return
    }

    setLoading(true)
    try {
      const token = await authService.verifyResetOtp(phone, code)
      setResetToken(token)
      setStep(3)
    } catch (err) {
      showError(err.response?.data?.message || 'رمز التحقق غير صحيح')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setFieldError('')

    if (!newPassword || newPassword.length < 6) {
      setFieldError('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    if (newPassword !== confirmPassword) {
      setFieldError('كلمتا المرور غير متطابقتين')
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword(resetToken, newPassword)
      showSuccess('تم تغيير كلمة المرور بنجاح')
      setStep(4)
    } catch (err) {
      showError(err.response?.data?.message || 'تعذّر تغيير كلمة المرور')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/10 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {step !== 4 && (
          <div className="text-center mb-8">
            <Link to="/" className="inline-block">
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-hover rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-white font-bold text-4xl">و</span>
              </div>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">نسيت كلمة المرور؟</h1>
            <p className="text-gray-600 mt-2">
              {step === 1 && 'أدخل رقم هاتفك وسنرسل لك رمز التحقق'}
              {step === 2 && 'أدخل رمز التحقق المُرسل إلى هاتفك'}
              {step === 3 && 'أدخل كلمة المرور الجديدة'}
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSendCode} className="space-y-5">
              <Input
                label="رقم الهاتف"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setFieldError('') }}
                error={fieldError}
                placeholder="07XX XXX XXXX"
                icon={Phone}
                dir="ltr"
              />
              <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                إرسال رمز التحقق
              </Button>
            </form>
            <Link to="/login" className="flex items-center justify-center gap-2 mt-6 text-gray-600 hover:text-primary">
              <ArrowRight size={18} />
              العودة لتسجيل الدخول
            </Link>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <Input
                label="رمز التحقق"
                name="code"
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setFieldError('') }}
                error={fieldError}
                placeholder="000000"
                icon={KeyRound}
                dir="ltr"
                maxLength={6}
              />
              <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                تحقق
              </Button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-sm text-gray-500 hover:text-primary"
              >
                تغيير رقم الهاتف
              </button>
            </form>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleResetPassword} className="space-y-5">
              <Input
                label="كلمة المرور الجديدة"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setFieldError('') }}
                error={fieldError}
                icon={Lock}
                dir="ltr"
              />
              <Input
                label="تأكيد كلمة المرور"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setFieldError('') }}
                icon={Lock}
                dir="ltr"
              />
              <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                تغيير كلمة المرور
              </Button>
            </form>
          </div>
        )}

        {step === 4 && (
          <div className="w-full max-w-md text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">تم تغيير كلمة المرور</h1>
            <p className="text-gray-600 mb-8">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة</p>
            <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/login')}>
              تسجيل الدخول
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ForgotPasswordPage
