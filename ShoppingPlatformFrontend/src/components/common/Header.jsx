import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { 
  Search, 
  ShoppingCart, 
  User, 
  ChevronDown, 
  Menu, 
  X,
  Heart,
  Package,
  Settings,
  LogOut,
  LayoutDashboard,
  Store,
  Star
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useCartStore } from '../../stores/cartStore'
import { useWishlistStore } from '../../stores/wishlistStore'
import { useToast } from '../../components/common/Toast'
import { NotificationBell } from './Notifications'
import GlobalSearch from './GlobalSearch'
import { useCategories } from '../../hooks/useCategories'
import { getImageUrl } from '../../utils/imageHelper'

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)

  const cartItemsCount = getItemsCount()
  const wishlistCount = wishlistItems.length

  // تسجيل الخروج
  const handleLogout = () => {
    logout()
    success('تم تسجيل الخروج بنجاح')
    setUserMenuOpen(false)
    navigate('/')
  }

  // البحث
  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      setMobileMenuOpen(false)
    }
  }

  // الحصول على رابط لوحة التحكم حسب الدور
  const getDashboardLink = () => {
    switch (user?.role) {
      case 'Admin':
        return { path: '/admin', label: 'لوحة الإدارة', icon: LayoutDashboard }
      case 'Vendor':
        return { path: '/vendor', label: 'لوحة البائع', icon: Store }
      case 'Ops':
        return { path: '/operations', label: 'لوحة العمليات', icon: LayoutDashboard }
      default:
        return null
    }
  }

  const dashboardLink = getDashboardLink()

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
                    {category.iconUrl ? (
                      <img src={getImageUrl(category.iconUrl)} alt="" className="w-5 h-5 object-contain" />
                    ) : (
                      <Package size={16} className="text-gray-400" />
                    )}
                    <span>{category.nameAr}</span>
                  </Link>
                ))}
                <div className="border-t border-gray-200 my-1"></div>
                <Link to="/categories" className="dropdown-item text-primary">
                  <span>عرض جميع الفئات</span>
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
            className="hidden sm:flex p-2 hover:bg-gray-100 rounded-full transition-colors relative"
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
            className="p-2 hover:bg-gray-100 rounded-full transition-colors relative"
          >
            <ShoppingCart size={22} className="text-gray-600" />
            {cartItemsCount > 0 && (
              <span className="absolute -top-1 -left-1 w-5 h-5 bg-primary text-white text-xs font-medium rounded-full flex items-center justify-center">
                {cartItemsCount > 99 ? '99+' : cartItemsCount}
              </span>
            )}
          </Link>

          {/* User Menu */}
          {isAuthenticated ? (
            <div className="relative">
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
                    <p className="text-sm text-gray-500 truncate" dir="ltr">{user?.phone}</p>
                  </div>

                  {/* رابط لوحة التحكم (إذا كان له صلاحية) */}
                  {dashboardLink && (
                    <>
                      <Link to={dashboardLink.path} className="dropdown-item text-primary">
                        <dashboardLink.icon size={18} />
                        <span>{dashboardLink.label}</span>
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
                className="hidden sm:inline-flex btn-primary btn-md"
              >
                تسجيل الدخول
              </Link>
              <Link 
                to="/login" 
                className="sm:hidden p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <User size={22} className="text-gray-600" />
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden p-2 hover:bg-gray-100 rounded-full transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <>
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="lg:hidden fixed top-[70px] right-0 bottom-0 w-[280px] bg-white z-50 shadow-dropdown animate-slide-down overflow-y-auto">
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="p-4 border-b border-gray-200">
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث عن منتج..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pr-11 pl-4 bg-gray-50 border border-gray-200 rounded-lg"
                />
                <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Search className="text-gray-400" size={20} />
                </button>
              </div>
            </form>

            {/* Mobile User Info */}
            {isAuthenticated && (
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-primary font-semibold">{getInitial()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{user?.fullName || 'المستخدم'}</p>
                    <p className="text-sm text-gray-500 truncate" dir="ltr">{user?.phone}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Nav */}
            <nav className="p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">الفئات</p>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/products?category=${category.id}`}
                  className="flex items-center gap-3 px-3 py-3 text-gray-700 hover:bg-gray-50 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {category.iconUrl ? (
                    <img src={getImageUrl(category.iconUrl)} alt="" className="w-6 h-6 object-contain" />
                  ) : (
                    <Package size={20} className="text-gray-400" />
                  )}
                  <span>{category.nameAr}</span>
                </Link>
              ))}

              <div className="border-t border-gray-200 my-4"></div>

              <Link
                to="/stores"
                className="flex items-center gap-3 px-3 py-3 text-gray-700 hover:bg-gray-50 rounded-md"
                onClick={() => setMobileMenuOpen(false)}
              >
                المتاجر
              </Link>
              <Link
                to="/products"
                className="flex items-center gap-3 px-3 py-3 text-gray-700 hover:bg-gray-50 rounded-md"
                onClick={() => setMobileMenuOpen(false)}
              >
                جميع المنتجات
              </Link>

              {/* Auth Links for Mobile */}
              {!isAuthenticated && (
                <>
                  <div className="border-t border-gray-200 my-4"></div>
                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    تسجيل الدخول
                  </Link>
                  <Link
                    to="/register"
                    className="flex items-center justify-center gap-2 px-4 py-3 mt-2 border border-gray-300 text-gray-700 rounded-lg font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    إنشاء حساب
                  </Link>
                </>
              )}

              {/* Logout for Mobile */}
              {isAuthenticated && (
                <>
                  <div className="border-t border-gray-200 my-4"></div>
                  <button
                    onClick={() => {
                      handleLogout()
                      setMobileMenuOpen(false)
                    }}
                    className="flex items-center gap-3 px-3 py-3 text-red-600 hover:bg-red-50 rounded-md w-full"
                  >
                    <LogOut size={20} />
                    <span>تسجيل الخروج</span>
                  </button>
                </>
              )}
            </nav>
          </div>
        </>
      )}

      {/* Global Search Modal */}
      <GlobalSearch isOpen={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />
    </header>
  )
}

export default Header
