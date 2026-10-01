// src/pages/company/CareersPage.jsx
import { useEffect, useState } from 'react'
import {
  Briefcase, MapPin, Clock, ChevronDown, Send,
  TrendingUp, Users, Coffee, GraduationCap,
} from 'lucide-react'
import Breadcrumb from '../../components/common/Breadcrumb'
import { jobs, CONTACT } from './companyContent'

const benefits = [
  { icon: TrendingUp, title: 'فرص للتطور', text: 'مسار وظيفي واضح وفرص ترقية حسب الأداء.' },
  { icon: GraduationCap, title: 'تدريب مستمر', text: 'دورات وورش عمل لتطوير مهاراتك.' },
  { icon: Users, title: 'فريق متعاون', text: 'بيئة عمل شبابية قائمة على الاحترام والتعاون.' },
  { icon: Coffee, title: 'بيئة مريحة', text: 'مكان عمل مريح ومرونة في أوقات العمل لبعض الوظائف.' },
]

const applyHref = (job) => {
  const subject = job ? `طلب توظيف: ${job.title}` : 'طلب توظيف عام'
  const body = 'الاسم:\nرقم الهاتف:\nنبذة مختصرة عن خبراتك:\n\n(يرجى إرفاق السيرة الذاتية)'
  return `mailto:${CONTACT.careersEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

const CareersPage = () => {
  const departments = ['الكل', ...new Set(jobs.map((j) => j.department))]
  const [department, setDepartment] = useState('الكل')
  const [openJob, setOpenJob] = useState(null)

  useEffect(() => {
    document.title = 'الوظائف | واسط التجارية'
  }, [])

  const filteredJobs = department === 'الكل' ? jobs : jobs.filter((j) => j.department === department)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="container-main py-6">
          <Breadcrumb items={[{ label: 'الشركة', path: '/about' }, { label: 'الوظائف' }]} className="mb-8" />
          <div className="max-w-2xl mx-auto text-center pb-6">
            <span className="badge-primary">انضم إلينا</span>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mt-4">اصنع مستقبل التسوق معنا</h1>
            <p className="text-lg mt-4 leading-8">
              نبحث عن أشخاص طموحين يشاركوننا شغف تقديم أفضل تجربة تسوق إلكتروني في العراق.
            </p>
          </div>
        </div>
      </div>

      <div className="container-main py-10 space-y-12">
        {/* المزايا */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">لماذا تعمل معنا؟</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b) => (
              <div key={b.title} className="card p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-primary-light text-primary flex items-center justify-center mx-auto mb-4">
                  <b.icon size={26} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{b.title}</h3>
                <p className="text-sm leading-6">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* الوظائف المتاحة */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              الوظائف المتاحة <span className="text-gray-400 text-lg">({filteredJobs.length})</span>
            </h2>
            <div className="flex gap-2 overflow-x-auto">
              {departments.map((d) => (
                <button
                  key={d}
                  onClick={() => setDepartment(d)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    department === d ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredJobs.map((job) => {
              const isOpen = openJob === job.id
              return (
                <div key={job.id} className="card overflow-hidden">
                  <button
                    onClick={() => setOpenJob(isOpen ? null : job.id)}
                    className="w-full p-5 flex items-center gap-4 text-right"
                    aria-expanded={isOpen}
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
                      <Briefcase size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900">{job.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                        <span>{job.department}</span>
                        <span className="flex items-center gap-1"><Clock size={14} />{job.type}</span>
                        <span className="flex items-center gap-1"><MapPin size={14} />{job.location}</span>
                      </div>
                    </div>
                    <ChevronDown size={20} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                      <p className="mb-4 leading-7">{job.description}</p>
                      <h4 className="font-semibold text-gray-900 mb-2">المتطلبات</h4>
                      <ul className="space-y-2 mb-5">
                        {job.requirements.map((r) => (
                          <li key={r} className="flex items-start gap-3 text-gray-600">
                            <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                      <a href={applyHref(job)} className="btn-primary btn-md gap-2 text-white hover:text-white">
                        <Send size={16} />
                        قدّم الآن
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* تقديم عام */}
        <section className="card p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">لم تجد الوظيفة المناسبة؟</h2>
          <p className="mb-5">
            أرسل سيرتك الذاتية إلى <span dir="ltr" className="font-medium text-gray-900">{CONTACT.careersEmail}</span> وسنتواصل معك عند توفر فرصة تناسبك.
          </p>
          <a href={applyHref(null)} className="btn-outline btn-md gap-2">
            <Send size={16} />
            أرسل سيرتك الذاتية
          </a>
        </section>
      </div>
    </div>
  )
}

export default CareersPage
