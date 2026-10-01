// الدخول بـ Google (Google Identity Services): الزر الرسمي — أول دخول يُنشئ حساب زبون بلا هاتف،
// ويُطلب الهاتف عند أول إتمام طلب
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { apiPost } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import AccountExistsHint, { isAccountExistsMessage } from './AccountExistsHint'

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// تحميل مكتبة Google مرة واحدة
let gisPromise = null
export const loadGoogleIdentity = () => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.defer = true
      s.onload = () => resolve(window.google)
      s.onerror = () => { gisPromise = null; reject(new Error('تعذّر تحميل Google')) }
      document.head.appendChild(s)
    })
  }
  return gisPromise
}

// زر Google الرسمي — onCredential تستقبل بطاقة Google الموقّعة
// الزر داخل iframe من Google: نوحّد color-scheme حتى لا يرسم المتصفح خلفية بيضاء حوله في الوضع الداكن،
// ونرسمه بعرض الحقول نفسها، ونعيد رسمه عند تغيّر العرض أو المظهر.
export const GoogleButton = ({ onCredential, text = 'continue_with', className = '' }) => {
  const ref = useRef(null)        // مكان رسم Google
  const outerRef = useRef(null)   // إطار ثابت نقيس عرضه — لا يتأثر بعرض iframe Google
  const callbackRef = useRef(onCredential)
  callbackRef.current = onCredential
  const [failed, setFailed] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [width, setWidth] = useState(0)

  // المظهر (فاتح/داكن) يتغيّر من الإعدادات دون إعادة تحميل
  useEffect(() => {
    const html = document.documentElement
    const obs = new MutationObserver(() => setDark(html.classList.contains('dark')))
    obs.observe(html, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // عرض الإطار الخارجي — Google يقبل بين 200 و400 بكسل.
  // (قياس مكان الرسم نفسه يصنع حلقة: iframe Google أعرض من الزر بـ 20px فيتسع ويُعاد رسمه أعرض)
  useEffect(() => {
    if (!outerRef.current) return
    const ro = new ResizeObserver(([e]) => {
      const w = Math.floor(e.contentRect.width)
      setWidth(prev => (Math.abs(prev - w) > 4 ? w : prev))
    })
    ro.observe(outerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !width) return
    let cancelled = false
    loadGoogleIdentity().then((google) => {
      if (cancelled || !ref.current) return
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (res) => callbackRef.current?.(res.credential),
        ux_mode: 'popup',
        cancel_on_tap_outside: true,
      })
      ref.current.innerHTML = ''
      google.accounts.id.renderButton(ref.current, {
        type: 'standard',
        theme: dark ? 'filled_black' : 'outline',
        size: 'large',
        shape: 'rectangular',
        text,
        locale: 'ar',
        width: Math.max(200, Math.min(400, width)),
        logo_alignment: 'center',
      })
    }).catch(() => !cancelled && setFailed(true))
    return () => { cancelled = true }
  }, [text, dark, width])

  if (!GOOGLE_CLIENT_ID) return null
  if (failed) return <p className="text-xs text-center text-gray-400">تعذّر تحميل زر Google — تحقق من الإنترنت</p>
  return (
    // الإطار الخارجي: عرضه من الصفحة فقط، وما يزيد عنه يُقص فلا تتسع الصفحة
    <div ref={outerRef} className={`w-full min-w-0 overflow-hidden ${className}`}>
      <div ref={ref} className="google-btn flex justify-center min-h-[44px]" />
    </div>
  )
}

// البريد من بطاقة Google لتعبئة خانة الدخول فقط (التحقق الحقيقي يتم في الخادم)
const emailOf = (credential) => {
  try {
    const part = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(escape(atob(part)))).email || ''
  } catch { return '' }
}

const ROLE_HOME = { ADMIN: '/admin', VENDOR: '/vendor', OPS: '/operations', DRIVER: '/driver' }

// الزر + التوجيه — لصفحتي الدخول والتسجيل
export const GoogleSignInSection = ({ redirectTo = '/', text = 'continue_with' }) => {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const setSession = useAuthStore((s) => s.setSession)
  const [exists, setExists] = useState(null)   // البريد لحساب آخر: نعرض طريق الدخول بكلمة المرور

  const finish = (login) => {
    const user = setSession(login)
    success('تم تسجيل الدخول بنجاح')
    navigate(ROLE_HOME[user.role] || redirectTo, { replace: true })
  }

  const onCredential = async (credential) => {
    setExists(null)
    try {
      const res = await apiPost(API_ENDPOINTS.AUTH.GOOGLE, { credential })
      const data = res.data?.data ?? res.data
      finish(data.login)
    } catch (err) {
      if (isAccountExistsMessage(err.message)) setExists({ message: err.message, email: emailOf(credential) })
      else showError(err.message || 'تعذّر الدخول بـ Google')
    }
  }

  if (!GOOGLE_CLIENT_ID) return null
  return (
    <>
      <GoogleButton onCredential={onCredential} text={text} />
      {exists && <AccountExistsHint message={exists.message} identifier={exists.email} className="mt-3" />}
    </>
  )
}
