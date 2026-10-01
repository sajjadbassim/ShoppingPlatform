// إضافة رقم هاتف لحساب بلا هاتف (حسابات Google) — مطلوب قبل إتمام أول طلب
import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { apiPut } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

const AddPhoneModal = ({ isOpen, onClose, onDone, initialPhone = '' }) => {
  const { success, error: showError } = useToast()
  const setSession = useAuthStore((s) => s.setSession)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (isOpen) setPhone(initialPhone || '') }, [isOpen, initialPhone])

  const valid = /^(\+964|00964|964|0)?7\d{9}$/.test(phone.replace(/[\s-]/g, ''))

  const submit = async (e) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    try {
      const res = await apiPut(API_ENDPOINTS.AUTH.ADD_PHONE, { phone: phone.replace(/[\s-]/g, '') })
      setSession(res.data?.data ?? res.data)
      success('تم حفظ رقم الهاتف')
      onDone?.()
    } catch (err) {
      showError(err.message || 'تعذّر حفظ رقم الهاتف')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="أضف رقم هاتفك" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">
          نحتاج رقم هاتفك لإكمال الطلب — ليتواصل معك عامل التوصيل بخصوص طلباتك.
        </p>
        <Input label="رقم الهاتف" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="07XX XXX XXXX" dir="ltr" autoComplete="tel" autoFocus />
        <Button type="submit" variant="primary" fullWidth loading={busy} disabled={!valid}>
          حفظ ومتابعة
        </Button>
      </form>
    </Modal>
  )
}

export default AddPhoneModal
