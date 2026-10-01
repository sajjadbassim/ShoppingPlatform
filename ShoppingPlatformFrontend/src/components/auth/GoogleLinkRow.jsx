// صف «حساب Google» في إعدادات الزبون: ربط/فصل الدخول بـ Google
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'
import { apiGet, apiPost, apiDelete } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { GoogleButton, GOOGLE_CLIENT_ID } from './GoogleSignIn'

const GoogleLogo = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

const GoogleLinkRow = () => {
  const { success, error: showError } = useToast()
  const qc = useQueryClient()
  const [linking, setLinking] = useState(false)
  const [busy, setBusy] = useState(false)
  const { data: status } = useQuery({
    queryKey: ['google-status'],
    queryFn: async () => { const r = await apiGet(API_ENDPOINTS.AUTH.GOOGLE_STATUS); return r.data?.data ?? r.data },
  })

  if (!GOOGLE_CLIENT_ID || !status?.canLink) return null

  const link = async (credential) => {
    try {
      await apiPost(API_ENDPOINTS.AUTH.GOOGLE_LINK, { credential })
      success('تم ربط حساب Google — يمكنك الدخول به من الآن')
      setLinking(false)
      qc.invalidateQueries({ queryKey: ['google-status'] })
    } catch (e) { showError(e.message || 'تعذّر الربط') }
  }

  const unlink = async () => {
    if (!confirm('فصل حساب Google؟ ستدخل برقم هاتفك وكلمة المرور فقط.')) return
    setBusy(true)
    try {
      await apiDelete(API_ENDPOINTS.AUTH.GOOGLE_LINK)
      success('تم فصل حساب Google')
      qc.invalidateQueries({ queryKey: ['google-status'] })
    } catch (e) { showError(e.message || 'تعذّر الفصل') }
    finally { setBusy(false) }
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0"><GoogleLogo /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-gray-900">حساب Google</span>
          <span className="block text-xs text-gray-500 mt-0.5 truncate">
            {status.linked
              ? <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={12} /> مربوط <span dir="ltr">{status.googleEmail}</span></span>
              : 'اربطه لتدخل بضغطة واحدة'}
          </span>
        </span>
        {status.linked ? (
          <button type="button" onClick={unlink} disabled={busy || !status.hasPassword}
            title={!status.hasPassword ? 'أضف كلمة مرور أولاً من «نسيت كلمة المرور»' : undefined}
            className="h-8 px-3 rounded-full border border-gray-300 text-xs font-bold text-gray-700 disabled:opacity-50">فصل</button>
        ) : (
          <button type="button" onClick={() => setLinking(true)}
            className="h-8 px-3 rounded-full bg-primary text-white text-xs font-bold">ربط</button>
        )}
      </div>
      {status.linked && !status.hasPassword && (
        <p className="px-4 pb-3 -mt-1 text-[11px] text-gray-400">حسابك أُنشئ بـ Google — لإضافة كلمة مرور استخدم «نسيت كلمة المرور» برقم هاتفك.</p>
      )}

      <Modal isOpen={linking} onClose={() => setLinking(false)} title="ربط حساب Google" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">اختر حساب Google الذي تريد الدخول به. سيبقى دخولك برقم الهاتف وكلمة المرور يعمل أيضاً.</p>
          {linking && <GoogleButton onCredential={link} text="signin_with" />}
        </div>
      </Modal>
    </>
  )
}

export default GoogleLinkRow
