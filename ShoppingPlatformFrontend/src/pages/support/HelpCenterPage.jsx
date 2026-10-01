// src/pages/support/HelpCenterPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, ChevronDown, Package, Truck, RotateCcw, CreditCard,
  User, Gift, Store, MessageCircle, Mail, Phone, SearchX,
} from 'lucide-react'
import Breadcrumb from '../../components/common/Breadcrumb'
import { faqs, faqCategories } from './supportContent'
import { CONTACT } from '../company/companyContent'

const categoryIcons = {
  orders: Package,
  shipping: Truck,
  returns: RotateCcw,
  payment: CreditCard,
  account: User,
  points: Gift,
  vendors: Store,
}

const quickLinks = [
  { icon: Package, title: 'تتبع طلباتي', text: 'تابع حالة طلباتك وشحناتك', path: '/orders' },
  { icon: RotateCcw, title: 'طلب إرجاع', text: 'قدّم طلب إرجاع وتابع حالته', path: '/returns' },
  { icon: Truck, title: 'الشحن والتوصيل', text: 'الرسوم والمدة ومراحل الطلب', path: '/shipping' },
  { icon: CreditCard, title: 'طرق الدفع', text: 'الدفع عند الاستلام وزين كاش', path: '/payment-methods' },
]

// إزالة التشكيل وتوحيد الهمزات لتحسين البحث بالعربية
const normalize = (text) =>
  text
    .replace(/[ً-ْ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()

const HelpCenterPage = () => {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [openIndex, setOpenIndex] = useState(null)

  useEffect(() => {
    document.title = 'مركز المساعدة | واسط التجارية'
  }, [])

  const results = useMemo(() => {
    const q = normalize(query.trim())
    return faqs.filter((f) => {
      if (category !== 'all' && f.category !== category) return false
      if (!q) return true
      return normalize(f.q).includes(q) || normalize(f.a).includes(q)
    })
  }, [query, category])

  const selectCategory = (id) => {
    setCategory(id)
    setOpenIndex(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero مع البحث */}
      <div className="bg-white border-b border-gray-200">
        <div className="container-main py-6">
          <Breadcrumb items={[{ label: 'الدعم' }, { label: 'مركز المساعدة' }]} className="mb-8" />
          <div className="max-w-2xl mx-auto text-center pb-6">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">كيف يمكننا مساعدتك؟</h1>
            <p className="text-lg mt-3">ابحث في الأسئلة الشائعة أو تصفح المواضيع أدناه</p>
            <div className="relative mt-6">
              <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpenIndex(null) }}
                placeholder="اكتب سؤالك، مثلاً: الإرجاع، رسوم التوصيل..."
                className="input h-14 pr-12 text-base rounded-xl shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container-main py-10 space-y-10">
        {/* روابط سريعة */}
        {!query && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickLinks.map((l) => (
              <Link key={l.path} to={l.path} className="card p-5 flex items-center gap-4 group text-gray-800 hover:text-gray-800">
                <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                  <l.icon size={22} />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-base">{l.title}</h2>
                  <p className="text-sm text-gray-500">{l.text}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* الأسئلة الشائعة */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <div className="card p-4 lg:sticky lg:top-24">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">المواضيع</h2>
              <nav className="flex lg:flex-col gap-1 overflow-x-auto">
                {[{ id: 'all', title: 'جميع الأسئلة' }, ...faqCategories].map((c) => {
                  const Icon = categoryIcons[c.id] || MessageCircle
                  return (
                    <button
                      key={c.id}
                      onClick={() => selectCategory(c.id)}
                      className={`flex items-center gap-2 text-sm px-3 py-2 rounded whitespace-nowrap transition-colors ${
                        category === c.id
                          ? 'bg-primary-light text-primary font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon size={16} />
                      {c.title}
                    </button>
                  )
                })}
              </nav>
            </div>
          </aside>

          <main className="lg:col-span-3">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {query ? `نتائج البحث (${results.length})` : 'الأسئلة الشائعة'}
            </h2>

            {results.length === 0 ? (
              <div className="card p-10 text-center">
                <SearchX size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="font-semibold text-gray-900">لم نجد نتائج مطابقة</p>
                <p className="text-sm mt-1">جرّب كلمات أخرى أو تواصل مع فريق الدعم مباشرة</p>
              </div>
            ) : (
              <div className="card divide-y divide-gray-100">
                {results.map((f, i) => {
                  const isOpen = openIndex === i
                  return (
                    <div key={f.q}>
                      <button
                        onClick={() => setOpenIndex(isOpen ? null : i)}
                        className="w-full flex items-center justify-between gap-4 p-5 text-right"
                        aria-expanded={isOpen}
                      >
                        <span className={`font-medium ${isOpen ? 'text-primary' : 'text-gray-900'}`}>{f.q}</span>
                        <ChevronDown size={20} className={`text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && <p className="px-5 pb-5 -mt-1 leading-7">{f.a}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </main>
        </div>

        {/* التواصل */}
        <section className="rounded-2xl bg-primary text-white p-8 lg:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold text-white">لم تجد إجابة لسؤالك؟</h2>
              <p className="text-primary-100 mt-2">فريق خدمة العملاء متاح {CONTACT.workingHours}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/contact" className="btn btn-md bg-white text-primary hover:bg-gray-100 hover:text-primary gap-2">
                <MessageCircle size={18} />
                راسلنا
              </Link>
              <a href={`mailto:${CONTACT.email}`} className="btn btn-md border-2 border-white text-white hover:bg-white/10 hover:text-white gap-2">
                <Mail size={18} />
                البريد
              </a>
              <a href={CONTACT.phoneHref} className="btn btn-md border-2 border-white text-white hover:bg-white/10 hover:text-white gap-2">
                <Phone size={18} />
                <span dir="ltr">{CONTACT.phone}</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default HelpCenterPage
