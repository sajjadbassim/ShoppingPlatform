// بطاقة تفعيل إشعارات الدفع على هذا الجهاز — تختفي بعد التفعيل أو الإخفاء
import { useEffect, useState } from 'react'
import { BellRing, X, Smartphone } from 'lucide-react'
import { useToast } from './Toast'
import { enablePush, isPushActive, needsInstallForPush, pushPermission, pushSupported } from '../../utils/push'
import { apiPost } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'

const DISMISS_KEY = 'push-prompt-dismissed'

const PushPrompt = ({ text = 'فعّل الإشعارات لتصلك التحديثات حتى والتطبيق مغلق', dismissible = true, className = '' }) => {
  const { success, error: showError } = useToast()
  const [state, setState] = useState('checking') // checking | hidden | ask | install | busy
  const permission = pushPermission()

  useEffect(() => {
    let dismissed = false
    try { dismissed = dismissible && localStorage.getItem(DISMISS_KEY) === '1' } catch { /* */ }
    if (dismissed || permission === 'denied') { setState('hidden'); return }
    if (needsInstallForPush()) { setState('install'); return }
    if (!pushSupported()) { setState('hidden'); return }
    isPushActive().then(active => setState(active ? 'hidden' : 'ask'))
  }, [permission, dismissible])

  if (state === 'hidden' || state === 'checking') return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* */ }
    setState('hidden')
  }

  const enable = async () => {
    setState('busy')
    try {
      await enablePush()
      success('تم تفعيل الإشعارات على هذا الجهاز')
      setState('hidden')
    } catch (e) {
      showError(e.message || 'تعذّر تفعيل الإشعارات')
      setState(pushPermission() === 'denied' ? 'hidden' : 'ask')
    }
  }

  const install = state === 'install'
  return (
    <div className={`rounded-2xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-3 ${className}`}>
      <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        {install ? <Smartphone size={20} /> : <BellRing size={20} />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900">{install ? 'الإشعارات على الآيفون' : 'إشعارات فورية'}</p>
        <p className="text-xs text-gray-600">
          {install ? 'أضف التطبيق للشاشة الرئيسية (زر المشاركة ← «إضافة إلى الشاشة الرئيسية») ثم افتحه من الأيقونة لتفعيل الإشعارات' : text}
        </p>
      </div>
      {!install && (
        <button type="button" onClick={enable} disabled={state === 'busy'}
          className="h-9 px-4 rounded-full bg-primary text-white text-sm font-bold whitespace-nowrap disabled:opacity-60">
          {state === 'busy' ? '...' : 'تفعيل'}
        </button>
      )}
      {dismissible && (
        <button type="button" onClick={dismiss} aria-label="إخفاء" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 flex-shrink-0">
          <X size={16} />
        </button>
      )}
    </div>
  )
}

// صف في الإعدادات: حالة إشعارات هذا الجهاز، تفعيلها، وإرسال إشعار تجريبي
export const PushDeviceRow = () => {
  const { success, error: showError } = useToast()
  const [active, setActive] = useState(null)
  const [busy, setBusy] = useState(false)
  const permission = pushPermission()

  useEffect(() => { isPushActive().then(setActive) }, [])

  const enable = async () => {
    setBusy(true)
    try { await enablePush(); setActive(true); success('تم تفعيل الإشعارات على هذا الجهاز') }
    catch (e) { showError(e.message || 'تعذّر التفعيل') }
    finally { setBusy(false) }
  }

  const test = async () => {
    setBusy(true)
    try { await apiPost(API_ENDPOINTS.PUSH.TEST); success('أُرسل — سيصلك خلال ثوانٍ (جرّب إطفاء الشاشة)') }
    catch (e) { showError(e.message || 'تعذّر الإرسال') }
    finally { setBusy(false) }
  }

  let subtitle, action = null
  if (needsInstallForPush()) subtitle = 'على الآيفون: أضف التطبيق للشاشة الرئيسية ثم افتحه من الأيقونة'
  else if (!pushSupported()) subtitle = 'هذا المتصفح لا يدعم الإشعارات'
  else if (permission === 'denied') subtitle = 'محظورة — فعّلها من إعدادات المتصفح لهذا الموقع'
  else if (active) {
    subtitle = 'مفعّلة — تصلك التحديثات والتطبيق مغلق'
    action = <button type="button" onClick={test} disabled={busy} className="h-8 px-3 rounded-full border border-gray-300 text-xs font-bold text-gray-700 disabled:opacity-60">تجربة</button>
  } else if (active === false) {
    subtitle = 'غير مفعّلة على هذا الجهاز'
    action = <button type="button" onClick={enable} disabled={busy} className="h-8 px-3 rounded-full bg-primary text-white text-xs font-bold disabled:opacity-60">{busy ? '...' : 'تفعيل'}</button>
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-green-50 text-green-600' : 'bg-indigo-50 text-indigo-600'}`}>
        <BellRing size={18} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-gray-900">إشعارات هذا الجهاز</span>
        {subtitle && <span className="block text-xs text-gray-500 mt-0.5">{subtitle}</span>}
      </span>
      {action}
    </div>
  )
}

export default PushPrompt
