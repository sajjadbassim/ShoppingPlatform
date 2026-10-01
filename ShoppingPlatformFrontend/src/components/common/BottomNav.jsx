import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  LayoutGrid,
  ShoppingBag,
  Heart,
  User,
  Package,
  Settings,
  LogOut,
  LayoutDashboard,
  Store,
  Clapperboard,
  ChevronLeft,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useCartStore } from '../../stores/cartStore'
import { useWishlistStore } from '../../stores/wishlistStore'
import { useToast } from './Toast'
import { getDashboardLink } from '../../utils/dashboardLink'

// المسارات التي تُعتبر ضمن تبويب "حسابي"
const ACCOUNT_PATHS = ['/profile', '/orders', '/wishlist', '/settings', '/loyalty', '/returns', '/notifications']


/**
 * زر تبويب: الأيقونة ممتلئة وداكنة عند التفعيل، ومحددة ورمادية عند عدمه
 */
const TabItem = ({ to, onClick, icon: Icon, label, active, badge }) => {
  const content = (
    <>
      <span className="relative">
        <Icon
          size={24}
          strokeWidth={active ? 2.2 : 1.7}
          fill={active ? 'currentColor' : 'none'}
          className={active ? 'text-gray-900' : 'text-gray-400'}
        />
        {badge > 0 && (
          <span className="absolute -top-1.5 -left-2 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className={`text-[11px] leading-none ${active ? 'font-bold text-gray-900' : 'font-medium text-gray-400'}`}>
        {label}
      </span>
    </>
  )

  const className = 'flex-1 flex flex-col items-center justify-center gap-1.5 h-full select-none [-webkit-tap-highlight-color:transparent]'

  return to
    ? <Link to={to} className={className} aria-current={active ? 'page' : undefined}>{content}</Link>
    : <button type="button" onClick={onClick} className={className}>{content}</button>
}

/**
 * زر الريلز: دائرة بارزة ملوّنة في منتصف الشريط، بأيقونة تهتز ونبض حولها
 * (الحركة تتوقف لمن فعّل تقليل الحركة في جهازه)
 */
const ReelsTab = ({ active }) => (
  <Link to="/reels" aria-current={active ? 'page' : undefined}
    className="flex-1 flex flex-col items-center justify-end gap-1 h-full pb-2 select-none [-webkit-tap-highlight-color:transparent]">
    <span className="relative -mt-7 w-14 h-14 rounded-full ring-4 ring-white shadow-lg shadow-rose-500/40 bg-gradient-to-tr from-fuchsia-600 via-rose-500 to-amber-400 flex items-center justify-center">
      <span className="absolute inset-0 -z-10 rounded-full bg-rose-500 motion-safe:animate-soft-ping" aria-hidden="true" />
      <Clapperboard size={26} strokeWidth={2.2} className="relative text-white motion-safe:animate-wiggle" />
    </span>
    <span className={`text-[11px] leading-none font-bold ${active ? 'text-rose-600' : 'text-rose-500'}`}>ريلز</span>
  </Link>
)

/**
 * شريط التنقل السفلي للهاتف + قائمة "حسابي" المنبثقة من الأسفل
 */
const BottomNav = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { success } = useToast()
  const { isAuthenticated, user, logout } = useAuthStore()
  const cartCount = useCartStore((s) => s.getItemsCount())
  const wishlistCount = useWishlistStore((s) => s.items.length)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { pathname } = location
  const dashboardLink = isAuthenticated ? getDashboardLink(user?.role) : null

  // إعلام بقية العناصر الثابتة في الأسفل (التنبيهات، إشعار التحديث) بوجود الشريط
  useEffect(() => {
    document.documentElement.classList.add('has-bottom-nav')
    return () => document.documentElement.classList.remove('has-bottom-nav')
  }, [])

  // إغلاق القائمة عند الانتقال لصفحة أخرى
  useEffect(() => {
    setSheetOpen(false)
  }, [pathname, location.search])

  // منع تمرير الصفحة خلف القائمة المفتوحة
  useEffect(() => {
    if (!sheetOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [sheetOpen])

  const handleLogout = () => {
    logout()
    success('تم تسجيل الخروج بنجاح')
    setSheetOpen(false)
    navigate('/')
  }

  // صفحات المنتج والسلة وإتمام الطلب تعرض شريط إجراء ثابتاً مكان التبويبات
  // (السلة الفارغة لا شريط إجراء فيها، فتبقى التبويبات ظاهرة)
  const isProductPage = /^\/products\/[^/]+\/?$/.test(pathname) || (pathname === '/cart' && cartCount > 0) || pathname === '/checkout'
  const accountActive = sheetOpen || ACCOUNT_PATHS.some((p) => pathname.startsWith(p))

  const sheetLinks = [
    { to: '/stores', icon: Store, label: 'المتاجر' },
    { to: '/products', icon: Package, label: 'جميع المنتجات' },
  ]

  const accountLinks = [
    { to: '/orders', icon: Package, label: 'طلباتي' },
    { to: '/wishlist', icon: Heart, label: 'المفضلة', count: wishlistCount },
    { to: '/profile', icon: User, label: 'الملف الشخصي' },
    { to: '/settings', icon: Settings, label: 'الإعدادات' },
  ]

  const SheetLink = ({ to, icon: Icon, label, count, className = 'text-gray-800' }) => (
    <Link to={to} className={`flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 ${className}`}>
      <Icon size={20} className="opacity-70" />
      <span className="flex-1 font-medium">{label}</span>
      {count > 0 && (
        <span className="min-w-[22px] h-[22px] px-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-full flex items-center justify-center">{count}</span>
      )}
      <ChevronLeft size={18} className="text-gray-300" />
    </Link>
  )

  return (
    <>
      {/* قائمة حسابي */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl max-h-[85dvh] overflow-y-auto animate-slide-up pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <div className="sticky top-0 bg-white pt-3 pb-2 flex justify-center">
              <span className="w-10 h-1.5 rounded-full bg-gray-200" />
            </div>

            {/* معلومات المستخدم أو الدخول */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3 px-4 pb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-primary font-bold text-lg">
                    {user?.fullName?.charAt(0) || user?.phone?.charAt(0) || 'م'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{user?.fullName || 'المستخدم'}</p>
                  <p className="text-sm text-gray-500 truncate text-right" dir="ltr">{user?.phone || user?.email}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 px-4 pb-4">
                <Link to="/login" className="h-12 flex items-center justify-center bg-gray-900 text-white rounded-xl font-bold">
                  تسجيل الدخول
                </Link>
                <Link to="/register" className="h-12 flex items-center justify-center border border-gray-300 text-gray-800 rounded-xl font-bold">
                  إنشاء حساب
                </Link>
              </div>
            )}

            {/* الإدارة: لكل الأدوار عدا الزبون، تفتح لوحة الدور */}
            {dashboardLink && (
              <div className="px-4 pb-4">
                <Link to={dashboardLink.path}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-primary text-white shadow-md shadow-primary/25 active:scale-[0.98] transition-transform">
                  <span className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <dashboardLink.icon size={20} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold">الإدارة</span>
                    <span className="block text-xs text-white/80 truncate">{dashboardLink.label} · {dashboardLink.hint}</span>
                  </span>
                  <ChevronLeft size={20} className="text-white/80" />
                </Link>
              </div>
            )}

            <div className="border-t border-gray-100">
              {sheetLinks.map((l) => <SheetLink key={l.to} {...l} />)}
            </div>

            {isAuthenticated && (
              <>
                <div className="border-t border-gray-100">
                  {accountLinks.map((l) => <SheetLink key={l.to} {...l} />)}
                </div>
                <div className="border-t border-gray-100">
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3.5 text-red-600 active:bg-red-50">
                    <LogOut size={20} />
                    <span className="font-medium">تسجيل الخروج</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* شريط التبويبات — يُخفى في صفحة المنتج لأنها تعرض شريط "إضافة للسلة" بنفس الارتفاع */}
      {!isProductPage && <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch h-16">
          <TabItem to="/" icon={Home} label="الرئيسية" active={!sheetOpen && pathname === '/'} />
          <TabItem to="/categories" icon={LayoutGrid} label="الفئات" active={!sheetOpen && pathname.startsWith('/categories')} />
          <ReelsTab active={pathname === '/reels'} />
          <TabItem to="/cart" icon={ShoppingBag} label="السلة" badge={cartCount} active={!sheetOpen && pathname.startsWith('/cart')} />
          <TabItem onClick={() => setSheetOpen((o) => !o)} icon={User} label="حسابي" active={accountActive} />
        </div>
      </nav>}
    </>
  )
}

export default BottomNav
