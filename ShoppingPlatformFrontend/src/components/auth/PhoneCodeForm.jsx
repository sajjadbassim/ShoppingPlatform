// تأكيد ملكية رقم الهاتف برمز واتساب — لإنشاء الحساب ولإضافة رقم لحساب Google
// الرمز يُرسل قبل عرض هذا النموذج (sendPhoneCode)، وهنا: إدخاله، التحقق، وإعادة الإرسال بعد دقيقة
import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import Button from '../common/Button'
import Input from '../common/Input'
import { authService } from '../../services/authService'

const RESEND_SECONDS = 60

// بيئة التطوير فقط: الخادم يعيد الرمز لأن مفتاح Wevlix التجريبي لا يرسل رسالة حقيقية
export const DevCodeHint = ({ code, onUse }) => code ? (
  <div className="p-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 text-sm text-amber-800 flex items-center justify-between gap-2">
    <span>رمز التجربة (التطوير فقط): <b dir="ltr" className="font-mono tracking-widest">{code}</b></span>
    {onUse && <button type="button" onClick={() => onUse(code)} className="text-primary font-medium hover:underline">استخدمه</button>}
  </div>
) : null

const PhoneCodeForm = ({ phone, initialDevCode = '', onVerified, onChangePhone, submitText = 'تأكيد الرقم' }) => {
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState(initialDevCode)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const verify = async (e) => {
    e?.preventDefault()
    if (!/^\d{6}$/.test(code)) { setError('أدخل الرمز المكوّن من 6 أرقام'); return }
    setBusy(true)
    try {
      onVerified(await authService.verifyPhoneCode(phone, code))
    } catch (err) {
      setError(err.message || 'رمز التحقق غير صحيح')
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setError('')
    try {
      setDevCode(await authService.sendPhoneCode(phone))
      setCode('')
      setWait(RESEND_SECONDS)
    } catch (err) {
      setError(err.message || 'تعذّر إرسال الرمز')
    }
  }

  return (
    <form onSubmit={verify} className="space-y-4" noValidate>
      <p className="text-sm text-gray-600">
        أرسلنا رمزاً من 6 أرقام إلى واتساب على الرقم <b dir="ltr">{phone}</b>
      </p>
      <DevCodeHint code={devCode} onUse={(c) => { setCode(c); setError('') }} />
      <Input label="رمز التحقق" name="code" inputMode="numeric" autoComplete="one-time-code"
        value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
        error={error} placeholder="000000" icon={KeyRound} dir="ltr" maxLength={6} autoFocus />
      <Button type="submit" variant="primary" size="lg" fullWidth loading={busy} disabled={busy}>
        {submitText}
      </Button>
      <div className="flex items-center justify-between text-sm">
        {onChangePhone
          ? <button type="button" onClick={onChangePhone} className="text-gray-500 hover:text-primary">تغيير الرقم</button>
          : <span />}
        {wait > 0
          ? <span className="text-gray-400">إعادة الإرسال بعد {wait} ث</span>
          : <button type="button" onClick={resend} className="text-primary font-medium hover:underline">إعادة إرسال الرمز</button>}
      </div>
    </form>
  )
}

export default PhoneCodeForm
