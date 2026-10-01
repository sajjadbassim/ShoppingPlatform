import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { 
  Search, 
  ShoppingCart, 
  User, 
  ChevronDown, 
  Heart,
  Package,
  Settings,
  LogOut,
  LayoutDashboard,
  Store,
  Star,
  Clapperboard
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useCartStore } from '../../stores/cartStore'
import { useWishlistStore } from '../../stores/wishlistStore'
import { useToast } from '../../components/common/Toast'
import { NotificationBell } from './Notifications'
import GlobalSearch from './GlobalSearch'
import { getDashboardLink } from '../../utils/dashboardLink'
import { useCategories } from '../../hooks/useCategories'
import CategoryIcon from './CategoryIcon'

const Header = () => {
  const navigate = useNavigate()
  const { success } = useToast()
  
  // Stores
  const { isAuthenticated, user, logout } = useAuthStore()
  const { getItemsCount } = useCartStore()
  const { items: wishlistItems } = useWishlistStore()
    // ✅ جلب التصنيفات من الـ API
  const { data: categoriesData } = useCategories(true)
  const categories = categoriesData?.slice(0, 5) || []  // أول 5 تصنيفات فقط

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)

  // فتح البحث من أي مكان في الصفحة (مثل شريط البحث في الصفحة الرئيسية)
  useEffect(() => {
    const open = () => setGlobalSearchOpen(true)
    window.addEventListener('open-global-search', open)
    return () => window.removeEventListener('open-global-search', open)
  }, [])

  const cartItemsCount = getItemsCount()
  const wishlistCount = wishlistItems.length

  // تسجيل الخروج
  const handleLogout = () => {
    logout()
    success('تم تسجيل الخروج بنجاح')
    setUserMenuOpen(false)
    navigate('/')
  }

  // الحصول على رابط لوحة التحكم حسب الدور
  const dashboardLink = getDashboardLink(user?.role)

  // الحصول على الحرف الأول من الاسم
  const getInitial = () => {
    return user?.fullName?.charAt(0) || user?.phone?.charAt(0) || 'م'
  }

  // الحصول على اسم العرض
  const getDisplayName = () => {
    if (user?.fullName) {
      return user.fullName.split(' ')[0] // الاسم الأول فقط
    }
    return 'المستخدم'
  }

  return (
    <header className="fixed top-0 right-0 left-0 h-[70px] bg-white border-b border-gray-200 z-50">
      <div className="container-main h-full flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">و</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="font-display font-bold text-lg text-gray-900 leading-tight">واسط</h1>
            <p className="text-xs text-gray-500 -mt-1">التجارية</p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {/* Categories Dropdown */}
          <div className="relative">
            <button
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md transition-colors"
              onClick={() => setCategoriesOpen(!categoriesOpen)}
              onBlur={() => setTimeout(() => setCategoriesOpen(false), 200)}
            >
              <span>الفئات</span>
              <ChevronDown size={18} className={`transition-transform ${categoriesOpen ? 'rotate-180' : ''}`} />
            </button>

            {categoriesOpen && (
              <div className="dropdown-menu right-0 w-56">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    to={`/products?category=${category.id}`}
                    className="dropdown-item"
                  >
                    <span className="w-5 h-5 flex items-center justify-center">
                      <CategoryIcon category={category} className="w-5 h-5" emojiClassName="text-base" />
                    </span>
                    <span>{category.nameAr}</span>
                  </Link>
                ))}
                <div className="border-t border-gray-200 my-1"></div>
                <Link to="/categories" className="dropdown-item text-primary">
                  <span>جميع الفئات</span>
                </Link>
              </div>
            )}
          </div>

          <NavLink 
            to="/stores" 
            className={({ isActive }) => `
              px-4 py-2 rounded-md transition-colors
              ${isActive ? 'text-primary bg-primary/5' : 'text-gray-700 hover:text-primary hover:bg-gray-50'}
            `}
          >
            المتاجر
          </NavLink>

          <NavLink
            to="/products"
            className={({ isActive }) => `
              px-4 py-2 rounded-md transition-colors
              ${isActive ? 'text-primary bg-primary/5' : 'text-gray-700 hover:text-primary hover:bg-gray-50'}
            `}
          >
            المنتجات
          </NavLink>

          <NavLink
            to="/products?hasDiscount=true"
            className={({ isActive }) => `
              px-4 py-2 rounded-md transition-colors font-medium
              ${isActive ? 'text-error bg-error/5' : 'text-error hover:bg-error/5'}
            `}
          >
            العروض
          </NavLink>

          {/* ريلز — على الهاتف في منتصف الشريط السفلي */}
          <NavLink
            to="/reels"
            className="px-3 py-1.5 rounded-full transition-transform font-bold text-white text-sm bg-gradient-to-tr from-fuchsia-600 via-rose-500 to-amber-400 shadow-sm shadow-rose-500/30 hover:scale-105 flex items-center gap-1.5"
          >
            <Clapperboard size={16} />
            ريلز
          </NavLink>
        </nav>

        {/* Search Bar - Opens Global Search */}
        <div className="flex-1 max-w-md hidden md:block">
          <button
            onClick={() => setGlobalSearchOpen(true)}
            className="w-full h-11 pr-11 pl-4 bg-gray-50 border border-gray-200 rounded-full text-gray-400 text-right hover:border-primary hover:bg-white transition-all flex items-center"
          >
            <Search className="mr-3 text-gray-400" size={20} />
            <span>ابحث عن منتج، متجر...</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile Search Toggle */}
          <button 
            className="md:hidden p-2 hover:bg-gray-100 rounded-full transition-colors"
            onClick={() => setGlobalSearchOpen(true)}
          >
            <Search size={22} className="text-gray-600" />
          </button>

          {/* Notifications */}
          {isAuthenticated && <NotificationBell />}

          {/* Wishlist */}
          <Link 
            to="/wishlist" 
            className="hidden lg:flex p-2 hover:bg-gray-100 rounded-full transition-colors relative"
          >
            <Heart size={22} className="text-gray-600" />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                {wishlistCount > 99 ? '99+' : wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart */}
          <Link 
            to="/cart" 
            className="hidden lg:flex p-2 hover:bg-gray-100 rounded-full transition-colors relative"
          >
            <ShoppingCart size={22} className="text-gray-600" />
            {cartItemsCount > 0 && (
              <span className="absolute -top-1 -left-1 w-5 h-5 bg-primary text-white text-xs font-medium rounded-full flex items-center justify-center">
                {cartItemsCount > 99 ? '99+' : cartItemsCount}
              </span>
            )}
          </Link>

          {/* الإدارة: لكل الأدوار عدا الزبون، تفتح لوحة الدور (على الهاتف في قائمة "حسابي") */}
          {isAuthenticated && dashboardLink && (
            <Link to={dashboardLink.path} title={dashboardLink.label}
              className="hidden lg:inline-flex h-10 px-4 rounded-full bg-primary !text-white hover:!text-white hover:bg-primary-hover text-sm font-bold items-center gap-1.5 shadow-sm shadow-primary/25 transition-colors">
              <dashboardLink.icon size={17} />
              الإدارة
            </Link>
          )}

          {/* User Menu */}
          {isAuthenticated ? (
            <div className="relative hidden lg:block">
              <button
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-full transition-colors"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                onBlur={() => setTimeout(() => setUserMenuOpen(false), 200)}
              >
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-primary font-semibold text-sm">{getInitial()}</span>
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[100px] truncate">
                  {getDisplayName()}
                </span>
                <ChevronDown size={16} className="hidden sm:block text-gray-500" />
              </button>

              {userMenuOpen && (
                <div className="dropdown-menu left-0 min-w-[200px]">
                  {/* معلومات المستخدم */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="font-medium text-gray-900 truncate">{user?.fullName || 'المستخدم'}</p>
                    <p className="text-sm text-gray-500 truncate" dir="ltr">{user?.phone || user?.email}</p>
                  </div>

                  {/* رابط لوحة التحكم (إذا كان له صلاحية) */}
                  {dashboardLink && (
                    <>
                      <Link to={dashboardLink.path} className="dropdown-item text-primary">
                        <dashboardLink.icon size={18} />
                        <span className="flex-1">الإدارة</span>
                        <span className="text-[11px] text-gray-400">{dashboardLink.label}</span>
                      </Link>
                      <div className="border-t border-gray-100 my-1"></div>
                    </>
                  )}

                  <Link to="/profile" className="dropdown-item">
                    <User size={18} />
                    <span>الملف الشخصي</span>
                  </Link>
                  <Link to="/orders" className="dropdown-item">
                    <Package size={18} />
                    <span>طلباتي</span>
                  </Link>
                  <Link to="/wishlist" className="dropdown-item sm:hidden">
                    <Heart size={18} />
                    <span>المفضلة</span>
                    {wishlistCount > 0 && (
                      <span className="mr-auto bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                        {wishlistCount}
                      </span>
                    )}
                  </Link>
                  <Link to="/loyalty" className="dropdown-item">
                    <Star size={18} />
                    <span>النقاط التشجيعية</span>
                  </Link>

                  <Link to="/settings" className="dropdown-item">
                    <Settings size={18} />
                    <span>الإعدادات</span>
                  </Link>
                  
                  <div className="border-t border-gray-200 my-1"></div>
                  
                  <button 
                    onClick={handleLogout}
                    className="dropdown-item-danger w-full"
                  >
                    <LogOut size={18} />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link 
                to="/login" 
                className="hidden lg:inline-flex btn-primary btn-md"
              >
                تسجيل الدخول
              </Link>
            </div>
          )}

        </div>
      </div>

      {/* Global Search Modal */}
      <GlobalSearch isOpen={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />
    </header>
  )
}

export default Header
