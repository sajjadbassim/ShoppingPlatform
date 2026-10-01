// src/pages/company/ContactPage.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin, Clock, Send, HelpCircle } from 'lucide-react'
import Breadcrumb from '../../components/common/Breadcrumb'
import { useToast } from '../../components/common/Toast'
import { useAuthStore } from '../../stores/authStore'
import { CONTACT } from './companyContent'

const subjects = [
  'استفسار عام',
  'مشكلة في طلب',
  'الإرجاع والاسترداد',
  'الدفع',
  'الانضمام كبائع',
  'اقتراح أو شكوى',
]

const contactCards = [
  { icon: Phone, title: 'الهاتف', value: CONTACT.phone, href: CONTACT.phoneHref, ltr: true },
  { icon: Mail, title: 'البريد الإلكتروني', value: CONTACT.email, href: `mailto:${CONTACT.email}` },
  { icon: MapPin, title: 'العنوان', value: CONTACT.address },
  { icon: Clock, title: 'ساعات العمل', value: CONTACT.workingHours },
]

const ContactPage = () => {
  const { user } = useAuthStore()
  const { success: showSuccess } = useToast()

  const [form, setForm] = useState({
    name: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || user?.phoneNumber || '',
    orderNumber: '',
    subject: subjects[0],
    message: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    document.title = 'تواصل معنا | واسط التجارية'
  }, [])

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((er) => ({ ...er, [field]: undefined }))
  }

  const validate = () => {
    const er = {}
    if (!form.name.trim()) er.name = 'الاسم مطلوب'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) er.email = 'البريد الإلكتروني غير صالح'
    if (form.message.trim().length < 10) er.message = 'يرجى كتابة رسالة لا تقل عن 10 أحرف'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  // لا توجد واجهة خلفية للرسائل حالياً، لذا نفتح برنامج البريد برسالة معبأة مسبقاً
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    const body = [
      `الاسم: ${form.name}`,
      `البريد الإلكتروني: ${form.email}`,
      form.phone ? `الهاتف: ${form.phone}` : null,
      form.orderNumber ? `رقم الطلب: ${form.orderNumber}` : null,
      '',
      form.message,
    ].filter((l) => l !== null).join('\n')

    window.location.href =
      `mailto:${CONTACT.email}?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(body)}`
    showSuccess('تم تجهيز رسالتك في برنامج البريد، يرجى إرسالها لإتمام التواصل')
  }

  const fieldClass = (field) => `input ${errors[field] ? 'input-error' : ''}`

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="container-main py-6">
          <Breadcrumb items={[{ label: 'الشركة', path: '/about' }, { label: 'تواصل معنا' }]} className="mb-6" />
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">تواصل معنا</h1>
          <p className="text-gray-500 mt-1">فريقنا جاهز للإجابة عن استفساراتك ومساعدتك في أي وقت</p>
        </div>
      </div>

      <div className="container-main py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* معلومات التواصل */}
          <div className="space-y-4">
            {contactCards.map((c) => {
              const inner = (
                <div className="card p-5 flex items-center gap-4 h-full">
                  <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
                    <c.icon size={22} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{c.title}</p>
                    <p className="font-semibold text-gray-900" dir={c.ltr ? 'ltr' : undefined}>{c.value}</p>
                  </div>
                </div>
              )
              return c.href ? (
                <a key={c.title} href={c.href} className="block">{inner}</a>
              ) : (
                <div key={c.title}>{inner}</div>
              )
            })}

            <div className="card p-5 bg-primary-light border-primary-100">
              <div className="flex items-start gap-3">
                <HelpCircle className="text-primary flex-shrink-0 mt-0.5" size={22} />
                <div>
                  <p className="font-semibold text-gray-900">لديك مشكلة في طلب؟</p>
                  <p className="text-sm mt-1">
                    يمكنك متابعة حالة طلبك من صفحة{' '}
                    <Link to="/orders" className="font-medium">طلباتي</Link>
                    {' '}أو تقديم طلب إرجاع من صفحة{' '}
                    <Link to="/returns" className="font-medium">طلبات الإرجاع</Link>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* النموذج */}
          <form onSubmit={handleSubmit} noValidate className="card p-6 lg:p-8 lg:col-span-2 space-y-5">
            <h2 className="text-xl font-bold text-gray-900">أرسل لنا رسالة</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label" htmlFor="name">الاسم الكامل *</label>
                <input id="name" className={fieldClass('name')} value={form.name} onChange={update('name')} />
                {errors.name && <p className="text-sm text-error mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="label" htmlFor="email">البريد الإلكتروني *</label>
                <input id="email" type="email" dir="ltr" className={fieldClass('email')} value={form.email} onChange={update('email')} />
                {errors.email && <p className="text-sm text-error mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="label" htmlFor="phone">رقم الهاتف</label>
                <input id="phone" type="tel" dir="ltr" className="input" value={form.phone} onChange={update('phone')} />
              </div>
              <div>
                <label className="label" htmlFor="orderNumber">رقم الطلب (اختياري)</label>
                <input id="orderNumber" dir="ltr" className="input" value={form.orderNumber} onChange={update('orderNumber')} />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="subject">الموضوع</label>
              <select id="subject" className="input" value={form.subject} onChange={update('subject')}>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="message">الرسالة *</label>
              <textarea
                id="message"
                rows={6}
                className={`${fieldClass('message')} h-auto py-3 resize-none`}
                placeholder="اكتب رسالتك هنا..."
                value={form.message}
                onChange={update('message')}
              />
              {errors.message && <p className="text-sm text-error mt-1">{errors.message}</p>}
            </div>

            <button type="submit" className="btn-primary btn-lg gap-2 w-full sm:w-auto">
              <Send size={18} />
              إرسال الرسالة
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ContactPage
