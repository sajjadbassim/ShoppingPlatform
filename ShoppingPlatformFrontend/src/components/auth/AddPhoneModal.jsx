// إضافة رقم هاتف لحساب بلا هاتف (حسابات Google) — مطلوب قبل إتمام أول طلب
import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { apiPut } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { authService } from '../../services/authService'
import { normalizeIraqiPhone } from '../../utils/phone'
import PhoneCodeForm from './PhoneCodeForm'

const AddPhoneModal = ({ isOpen, onClose, onDone, initialPhone = '' }) => {
  const { success, error: showError } = useToast()
  const setSession = useAuthStore((s) => s.setSession)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [codeSent, setCodeSent] = useState(null)   // { phone, devCode } بعد إرسال الرمز

  useEffect(() => { if (isOpen) { setPhone(initialPhone || ''); setCodeSent(null) } }, [isOpen, initialPhone])

  const normalized = normalizeIraqiPhone(phone)

  // 1) إرسال رمز واتساب للرقم
  const sendCode = async (e) => {
    e.preventDefault()
    if (!normalized || busy) return
    setBusy(true)
    try {
      setCodeSent({ phone: normalized, devCode: await authService.sendPhoneCode(normalized) })
    } catch (err) {
      showError(err.message || 'تعذّر إرسال رمز التحقق')
    } finally {
      setBusy(false)
    }
  }

  // 2) الرمز صحيح ← حفظ الرقم برمز الإثبات
  const save = async (verificationToken) => {
    try {
      const res = await apiPut(API_ENDPOINTS.AUTH.ADD_PHONE, { phone: codeSent.phone, verificationToken })
      setSession(res.data?.data ?? res.data)
      success('تم حفظ رقم الهاتف')
      onDone?.()
    } catch (err) {
      showError(err.message || 'تعذّر حفظ رقم الهاتف')
      setCodeSent(null)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="أضف رقم هاتفك" size="sm">
      {codeSent ? (
        <PhoneCodeForm phone={codeSent.phone} initialDevCode={codeSent.devCode}
          onVerified={save} onChangePhone={() => setCodeSent(null)} submitText="تأكيد وحفظ" />
      ) : (
      <form onSubmit={sendCode} className="space-y-4">
        <p className="text-sm text-gray-600">
          نحتاج رقم هاتفك لإكمال الطلب — ليتواصل معك عامل التوصيل بخصوص طلباتك.
        </p>
        <Input label="رقم الهاتف" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="07XX XXX XXXX" dir="ltr" autoComplete="tel" autoFocus />
        <Button type="submit" variant="primary" fullWidth loading={busy} disabled={!normalized}>
          إرسال رمز التحقق
        </Button>
      </form>
      )}
    </Modal>
  )
}

export default AddPhoneModal
