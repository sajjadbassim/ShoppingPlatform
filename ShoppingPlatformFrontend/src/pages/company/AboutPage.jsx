// src/pages/company/AboutPage.jsx
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Target, Eye, ShieldCheck, Truck, Store, Gift,
  HeartHandshake, Sparkles, Users, ArrowLeft,
} from 'lucide-react'
import Breadcrumb from '../../components/common/Breadcrumb'

const features = [
  { icon: Store, title: 'متاجر متنوعة', text: 'مئات المنتجات من متاجر محلية موثوقة في مكان واحد.' },
  { icon: Truck, title: 'توصيل سريع', text: 'فريق توصيل خاص يتابع طلبك حتى باب منزلك.' },
  { icon: ShieldCheck, title: 'تسوق آمن', text: 'دفع آمن وحماية كاملة لبياناتك الشخصية.' },
  { icon: Gift, title: 'النقاط التشجيعية', text: 'اجمع النقاط مع كل طلب واستبدلها بخصومات.' },
]

const values = [
  { icon: HeartHandshake, title: 'الثقة', text: 'نبني علاقة طويلة مع عملائنا وبائعينا قائمة على الشفافية والمصداقية.' },
  { icon: Sparkles, title: 'الجودة', text: 'نحرص على أن تكون كل تجربة على المنصة مميزة، من التصفح حتى الاستلام.' },
  { icon: Users, title: 'دعم المجتمع', text: 'نمكّن التجار المحليين من الوصول إلى عملاء أكثر وتنمية أعمالهم.' },
]

const AboutPage = () => {
  useEffect(() => {
    document.title = 'من نحن | واسط التجارية'
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="container-main py-6">
          <Breadcrumb items={[{ label: 'الشركة' }, { label: 'من نحن' }]} className="mb-8" />
          <div className="max-w-3xl mx-auto text-center pb-6">
            <span className="badge-primary">من نحن</span>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mt-4">
              منصة واسط التجارية
            </h1>
            <p className="text-lg mt-4 leading-8">
              منصة تسوق إلكتروني عراقية انطلقت من محافظة واسط، تجمع بين العملاء والمتاجر المحلية
              في سوق رقمي واحد، لنقدّم تجربة تسوق سهلة وآمنة وتوصيلاً سريعاً إلى باب منزلك.
            </p>
          </div>
        </div>
      </div>

      <div className="container-main py-10 space-y-12">
        {/* الرسالة والرؤية */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6 lg:p-8">
            <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center mb-4">
              <Target size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">رسالتنا</h2>
            <p className="leading-8">
              تسهيل وصول الجميع إلى المنتجات التي يحتاجونها بأفضل الأسعار، ودعم التجار المحليين
              بأدوات رقمية تساعدهم على النمو والوصول إلى شريحة أوسع من العملاء.
            </p>
          </div>
          <div className="card p-6 lg:p-8">
            <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center mb-4">
              <Eye size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">رؤيتنا</h2>
            <p className="leading-8">
              أن نكون الوجهة الأولى للتسوق الإلكتروني في العراق، والمنصة الأكثر ثقة لدى العملاء
              والبائعين على حد سواء.
            </p>
          </div>
        </div>

        {/* لماذا نحن */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">لماذا واسط التجارية؟</h2>
          <p className="text-center mb-8">كل ما تحتاجه لتجربة تسوق متكاملة</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-primary-light text-primary flex items-center justify-center mx-auto mb-4">
                  <f.icon size={26} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm leading-6">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* القيم */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">قيمنا</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {values.map((v) => (
              <div key={v.title} className="card p-6 flex items-start gap-4">
                <div className="w-11 h-11 rounded-lg bg-primary text-white flex items-center justify-center flex-shrink-0">
                  <v.icon size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{v.title}</h3>
                  <p className="text-sm leading-6">{v.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* دعوة */}
        <section className="rounded-2xl bg-primary text-white p-8 lg:p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">ابدأ رحلة التسوق معنا</h2>
          <p className="text-primary-100 mb-6">تصفح آلاف المنتجات من المتاجر المحلية المفضلة لديك</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/products" className="btn btn-lg bg-white text-primary hover:bg-gray-100 hover:text-primary gap-2">
              تسوق الآن
              <ArrowLeft size={18} />
            </Link>
            <Link to="/contact" className="btn btn-lg border-2 border-white text-white hover:bg-white/10 hover:text-white">
              تواصل معنا
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AboutPage
