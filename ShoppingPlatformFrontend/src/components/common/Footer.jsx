import { Link } from 'react-router-dom'
import { Facebook, Twitter, Instagram, Youtube, Mail, Phone, MapPin } from 'lucide-react'

const Footer = () => {
  const currentYear = new Date().getFullYear()

  const footerLinks = {
    company: [
      { label: 'من نحن', path: '/about' },
      { label: 'تواصل معنا', path: '/contact' },
      { label: 'الوظائف', path: '/careers' },
      { label: 'المدونة', path: '/blog' },
    ],
    support: [
      { label: 'مركز المساعدة', path: '/help' },
      { label: 'سياسة الإرجاع', path: '/returns' },
      { label: 'الشحن والتوصيل', path: '/shipping' },
      { label: 'طرق الدفع', path: '/payment-methods' },
    ],
    legal: [
      { label: 'الشروط والأحكام', path: '/terms' },
      { label: 'سياسة الخصوصية', path: '/privacy' },
      { label: 'سياسة الاستخدام', path: '/usage-policy' },
    ],
  }

  const socialLinks = [
    { icon: Facebook, url: '#', label: 'Facebook' },
    { icon: Twitter, url: '#', label: 'Twitter' },
    { icon: Instagram, url: '#', label: 'Instagram' },
    { icon: Youtube, url: '#', label: 'Youtube' },
  ]

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main Footer */}
      <div className="container-main py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand & Contact */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-2xl">و</span>
              </div>
              <div>
                <h2 className="font-display font-bold text-xl text-white">واسط التجارية</h2>
                <p className="text-sm text-gray-400">منصة التسوق الإلكتروني</p>
              </div>
            </Link>
            
            <p className="text-gray-400 mb-6 max-w-sm">
              منصة واسط التجارية - وجهتك الأولى للتسوق الإلكتروني. نوفر لك تجربة تسوق فريدة مع أفضل المنتجات وأسرع التوصيل.
            </p>

            {/* Contact Info */}
            <div className="space-y-3">
              <a href="tel:+96812345678" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors">
                <Phone size={18} />
                <span dir="ltr">+968 1234 5678</span>
              </a>
              <a href="mailto:support@wasit.com" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors">
                <Mail size={18} />
                <span>support@wasit.com</span>
              </a>
              <div className="flex items-center gap-3 text-gray-400">
                <MapPin size={18} />
                <span>واسط، العراق</span>
              </div>
            </div>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="font-display font-semibold text-white mb-4">الشركة</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.path}>
                  <Link 
                    to={link.path}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="font-display font-semibold text-white mb-4">الدعم</h3>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.path}>
                  <Link 
                    to={link.path}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-display font-semibold text-white mb-4">القانونية</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.path}>
                  <Link 
                    to={link.path}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Social Links */}
            <div className="mt-6">
              <h4 className="font-semibold text-white mb-3">تابعنا</h4>
              <div className="flex items-center gap-3">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-gray-800 hover:bg-primary rounded-full flex items-center justify-center transition-colors"
                    aria-label={social.label}
                  >
                    <social.icon size={18} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="container-main py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            © {currentYear} منصة واسط التجارية. جميع الحقوق محفوظة.
          </p>
          
          {/* Payment Methods */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 ml-2">طرق الدفع:</span>
            <div className="flex items-center gap-2">
              <div className="w-10 h-6 bg-gray-800 rounded flex items-center justify-center text-xs font-medium">VISA</div>
              <div className="w-10 h-6 bg-gray-800 rounded flex items-center justify-center text-xs font-medium">MC</div>
              <div className="w-10 h-6 bg-gray-800 rounded flex items-center justify-center text-xs font-medium">مدى</div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
