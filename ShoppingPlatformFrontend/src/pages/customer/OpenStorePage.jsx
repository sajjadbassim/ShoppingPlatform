// افتح متجرك: طلب متجر من حساب زبون (بعد التسجيل كبائع، أو لاحقاً من قائمة الحساب)
// المتجر يبقى غير مفعّل حتى توافق الإدارة، وعندها يصبح الحساب VENDOR تلقائياً مع تجديد الجلسة
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Store, AlertCircle, CheckCircle } from 'lucide-react'
import Button from '../../components/common/Button'
import { Spinner } from '../../components/common/Loading'
import { useAuthStore } from '../../stores'
import { apiGet, apiPostForm } from '../../api/axios'
import { API_ENDPOINTS } from '../../api/endpoints'
import { normalizeIraqiPhone } from '../../utils/phone'

const NAME_ERROR = 'اسم المتجر'

const PendingRequest = ({ request, justSent }) => (
  <div className="text-center py-4">
    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <CheckCircle size={40} className="text-green-500" />
    </div>
    <h2 className="text-xl font-bold text-gray-900 mb-2">
      {justSent ? 'تم إرسال طلبك بنجاح! 🎉' : 'طلب متجرك قيد المراجعة'}
    </h2>
    <p className="text-gray-600 mb-1">{request.nameAr || request.name}</p>
    <p className="text-sm text-primary font-medium mb-6">سنتواصل معك في أقرب وقت لتفعيل متجرك</p>
    <div className="bg-gray-50 rounded-xl p-4 mb-6 text-right space-y-2">
      <p className="text-sm text-gray-600 flex items-center gap-2"><span className="text-green-500">✓</span> تم إنشاء حسابك</p>
      <p className="text-sm text-gray-600 flex items-center gap-2"><span className="text-green-500">✓</span> تم استلام طلب المتجر</p>
      <p className="text-sm text-gray-600 flex items-center gap-2"><span className="text-amber-500">⏳</span> قيد المراجعة من الإدارة</p>
    </div>
    <Link to="/" replace><Button variant="primary" fullWidth>العودة للرئيسية</Button></Link>
  </div>
)

const OpenStorePage = () => {
  const user = useAuthStore((s) => s.user)
  const [request, setRequest] = useState(undefined)   // undefined = يُحمَّل، null = لا طلب
  const [justSent, setJustSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({
    storeName: '', storeNameAr: '', storeDesc: '', storePhone: '', storeAddress: '',
    minOrder: '5000', prepTime: '30',
  })

  const isCustomer = user?.role === 'CUSTOMER'

  useEffect(() => {
    if (!isCustomer) return
    apiGet(API_ENDPOINTS.VENDORS.MY_REQUEST)
      .then((res) => setRequest(res.data?.data ?? null))
      .catch(() => setRequest(null))   // تعذّر التحقق: نعرض النموذج، والخادم يرفض الطلب المكرر
  }, [isCustomer])

  if (user?.role === 'VENDOR') return <Navigate to="/vendor" replace />
  if (!isCustomer) return <Navigate to="/" replace />

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    if (errors[name]) setErrors((p) => ({ ...p, [name]: null }))
    if (serverError) setServerError('')
  }

  const validate = () => {
    const e = {}
    if (!form.storeName.trim())    e.storeName    = 'اسم المتجر مطلوب'
    if (!form.storeNameAr.trim())  e.storeNameAr  = 'اسم المتجر بالعربي مطلوب'
    if (form.storePhone.trim() && !normalizeIraqiPhone(form.storePhone))
      e.storePhone = 'رقم الهاتف غير صحيح (مثال: 07701234567)'
    if (!form.storeAddress.trim()) e.storeAddress = 'العنوان مطلوب'
    if (!form.storeDesc.trim())    e.storeDesc    = 'وصف المتجر مطلوب'
    if (!(Number(form.minOrder) >= 0) || form.minOrder === '') e.minOrder = 'الحد الأدنى للطلب مطلوب'
    if (!(Number(form.prepTime) > 0))  e.prepTime = 'وقت التحضير مطلوب'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('Name',              form.storeName.trim())
      fd.append('NameAr',            form.storeNameAr.trim())
      fd.append('Phone',             normalizeIraqiPhone(form.storePhone) || user.phone || '')
      fd.append('IsActive',          'false')
      fd.append('MinOrderAmount',    form.minOrder)
      fd.append('EstimatedPrepTime', form.prepTime)
      fd.append('Address',           form.storeAddress.trim())
      fd.append('Description',       form.storeDesc.trim())
      // بلا شعار: يضيفه صاحب المتجر من إعدادات متجره بعد الموافقة (حتى ذلك يظهر رمز افتراضي)
      const res = await apiPostForm(API_ENDPOINTS.VENDORS.BASE, fd)
      setRequest(res.data?.data ?? { name: form.storeName, nameAr: form.storeNameAr })
      setJustSent(true)
    } catch (err) {
      const message = err.message || 'تعذّر إرسال الطلب، حاول مرة أخرى'
      setServerError(message)
      // «اسم المتجر غير متاح» — نعلّم خانتي الاسم
      if (message.includes(NAME_ERROR)) setErrors((p) => ({ ...p, storeName: ' ', storeNameAr: ' ' }))
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = (name) =>
    `w-full h-11 px-4 border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary ${errors[name] ? 'border-red-400' : 'border-gray-300'}`
  const fieldError = (name) => errors[name]?.trim() && <p className="text-xs text-red-500 mt-0.5">{errors[name]}</p>

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-7">
        {request === undefined ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : request ? (
          <PendingRequest request={request} justSent={justSent} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="text-center mb-2">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Store size={28} className="text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">افتح متجرك</h1>
              <p className="text-sm text-gray-500 mt-1">أدخل بيانات متجرك وسنراجع الطلب</p>
            </div>

            {serverError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2" role="alert">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{serverError}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">اسم المتجر (EN) *</label>
                <input name="storeName" value={form.storeName} onChange={handleChange}
                  placeholder="My Store" dir="ltr" className={inputCls('storeName')} />
                {fieldError('storeName')}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">اسم المتجر (AR) *</label>
                <input name="storeNameAr" value={form.storeNameAr} onChange={handleChange}
                  placeholder="متجري" className={inputCls('storeNameAr')} />
                {fieldError('storeNameAr')}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">هاتف المتجر</label>
              <input name="storePhone" type="tel" value={form.storePhone} onChange={handleChange}
                placeholder={user.phone || '07XX XXX XXXX'} dir="ltr" className={inputCls('storePhone')} />
              {fieldError('storePhone')}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">العنوان *</label>
              <input name="storeAddress" value={form.storeAddress} onChange={handleChange}
                placeholder="المدينة، الحي" className={inputCls('storeAddress')} />
              {fieldError('storeAddress')}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">وصف المتجر *</label>
              <textarea name="storeDesc" value={form.storeDesc} onChange={handleChange}
                placeholder="اكتب وصفاً مختصراً..." rows={2}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary resize-none ${errors.storeDesc ? 'border-red-400' : 'border-gray-300'}`} />
              {fieldError('storeDesc')}
            </div>
            {/* أجرة التوصيل تحددها الإدارة عند الموافقة على المتجر */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'minOrder', label: 'الحد الأدنى للطلب (د.ع) *', placeholder: '5000' },
                { name: 'prepTime', label: 'وقت التحضير (دقيقة) *',     placeholder: '30' },
              ].map((f) => (
                <div key={f.name}>
                  <label className="text-xs font-medium text-gray-700 block mb-1">{f.label}</label>
                  <input type="number" min="0" name={f.name} value={form[f.name]} onChange={handleChange}
                    placeholder={f.placeholder} className={inputCls(f.name)} />
                  {fieldError(f.name)}
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ المتجر سيبقى غير نشط حتى مراجعته من الإدارة
            </p>
            <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting} disabled={submitting}>
              إرسال الطلب
            </Button>
            <p className="text-center text-sm">
              <Link to="/" className="text-gray-500 hover:underline">لاحقاً</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

export default OpenStorePage
