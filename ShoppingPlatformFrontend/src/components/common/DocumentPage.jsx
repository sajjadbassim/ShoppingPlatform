// src/components/common/DocumentPage.jsx
// صفحة وثيقة نصية مقسّمة إلى أقسام مع فهرس محتويات (تُستخدم للصفحات القانونية وصفحات الدعم)
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Mail, Phone, Printer, Info } from 'lucide-react'
import Breadcrumb from './Breadcrumb'
import { CONTACT } from '../../pages/company/companyContent'

const formatDate = (date) =>
  new Date(date).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' })

// أنواع الكتل: نص | { list: [] } | { note: '' }
const SectionContent = ({ content }) => (
  <div className="space-y-3">
    {content.map((block, i) => {
      if (typeof block === 'string') {
        return <p key={i} className="leading-8">{block}</p>
      }
      if (block.note) {
        return (
          <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-primary-light text-primary-700">
            <Info size={18} className="flex-shrink-0 mt-1" />
            <p className="leading-7 text-primary-700">{block.note}</p>
          </div>
        )
      }
      return (
        <ul key={i} className="space-y-2 pr-1">
          {block.list.map((item, j) => (
            <li key={j} className="flex items-start gap-3 text-gray-600 leading-7">
              <span className="mt-3 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )
    })}
  </div>
)

/**
 * @param {Object} documents - { key: { path, title, subtitle, icon, sections, action? } }
 * @param {string} docKey - مفتاح الوثيقة المعروضة
 * @param {Object} group - { label, path } عنصر المجموعة في مسار التنقل
 * @param {string} lastUpdated - تاريخ آخر تحديث
 */
const DocumentPage = ({ documents, docKey, group, lastUpdated }) => {
  const document = documents[docKey]
  const Icon = document.icon
  const [activeSection, setActiveSection] = useState(document.sections[0].id)

  useEffect(() => {
    window.document.title = `${document.title} | واسط التجارية`
    setActiveSection(document.sections[0].id)
  }, [docKey])

  // تمييز القسم الظاهر حالياً في فهرس المحتويات
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting)
        if (visible) setActiveSection(visible.target.id)
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    document.sections.forEach((s) => {
      const el = window.document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [docKey])

  const scrollToSection = (id) => {
    window.document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // لا نربط عنصر المجموعة إذا كان يشير إلى الصفحة الحالية
  const groupItem = { label: group.label, path: group.path === document.path ? undefined : group.path }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="container-main py-6">
          <Breadcrumb items={[groupItem, { label: document.title }]} className="mb-6" />

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
              <Icon size={28} />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{document.title}</h1>
              <p className="text-gray-500 mt-1">{document.subtitle}</p>
              {lastUpdated && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-3">
                  <Calendar size={16} />
                  <span>آخر تحديث: {formatDate(lastUpdated)}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => window.print()}
              className="btn-ghost btn-sm gap-2 hidden sm:inline-flex print:hidden"
            >
              <Printer size={16} />
              طباعة
            </button>
          </div>

          {/* التنقل بين وثائق المجموعة */}
          <div className="flex gap-2 mt-6 overflow-x-auto print:hidden">
            {Object.entries(documents).map(([key, d]) => {
              const TabIcon = d.icon
              const isActive = key === docKey
              return (
                <Link
                  key={key}
                  to={d.path}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-primary text-white hover:text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  <TabIcon size={16} />
                  {d.title}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="container-main py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* فهرس المحتويات */}
          <aside className="lg:col-span-1 print:hidden">
            <div className="card p-4 lg:sticky lg:top-24">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">محتويات الصفحة</h2>
              <nav className="space-y-1">
                {document.sections.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => scrollToSection(s.id)}
                    className={`w-full text-right text-sm px-3 py-2 rounded transition-colors ${
                      activeSection === s.id
                        ? 'bg-primary-light text-primary font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {i + 1}. {s.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* المحتوى */}
          <main className="lg:col-span-3 space-y-6">
            <div className="card p-6 lg:p-8 space-y-8">
              {document.sections.map((s, i) => (
                <section key={s.id} id={s.id} className="scroll-mt-24">
                  <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-3 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-primary-light text-primary text-sm flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    {s.title}
                  </h2>
                  <SectionContent content={s.content} />
                </section>
              ))}

              {document.action && (
                <div className="pt-2 print:hidden">
                  <Link to={document.action.path} className="btn-primary btn-md text-white hover:text-white">
                    {document.action.label}
                  </Link>
                </div>
              )}
            </div>

            {/* التواصل */}
            <div className="card p-6 print:hidden">
              <h2 className="text-lg font-bold text-gray-900 mb-2">هل لديك استفسار؟</h2>
              <p className="text-sm mb-4">
                إذا كانت لديك أي أسئلة حول {document.title}، لا تتردد في التواصل مع فريق الدعم.
              </p>
              <div className="flex flex-wrap gap-3">
                <a href={`mailto:${CONTACT.email}`} className="btn-primary btn-md gap-2 hover:text-white text-white">
                  <Mail size={18} />
                  {CONTACT.email}
                </a>
                <a href={CONTACT.phoneHref} className="btn-secondary btn-md gap-2">
                  <Phone size={18} />
                  <span dir="ltr">{CONTACT.phone}</span>
                </a>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default DocumentPage
