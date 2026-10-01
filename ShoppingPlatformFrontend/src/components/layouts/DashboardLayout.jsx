import { useState, useEffect, useRef, Suspense } from 'react'
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { NotificationBell } from '../common/Notifications'
import { PageLoader } from '../common/PageLoader'
import { useMobileTableLabels } from '../../hooks/useMobileTableLabels'
import PushPrompt from '../common/PushPrompt'
import { useOpsNotifications } from '../../hooks/useOpsNotifications'
import UserAvatar from '../common/UserAvatar'
import {
  LayoutDashboard, Package, ShoppingCart, Users, Store,
  BarChart3, Settings, LogOut, Menu, X, ChevronLeft, Wallet,
  Star, Tag, Zap, RotateCcw, Image,
  Link2, Home, MapPinned,
} from 'lucide-react'

const DashboardLayout = ({ type = 'vendor' }) => {
  // تحديث لحظي لشاشات العمليات والإدارة (الطلبات والسائقون) — اتصال واحد لكل اللوحة
  useOpsNotifications(type === 'operations' || type === 'admin')
  // القائمة مفتوحة افتراضياً على الشاشات الكبيرة فقط — على الهاتف كانت تغطي المحتوى عند فتح أي صفحة
  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop)
  const { pathname } = useLocation()
  useEffect(() => { if (!isDesktop()) setSidebarOpen(false) }, [pathname])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const navigate = useNavigate()
  const mainRef = useRef(null)
  useMobileTableLabels(mainRef)
  const { logout, user } = useAuthStore()

  const getMenuItems = () => {
    if (type === 'vendor') {
      return [
        { icon: LayoutDashboard, label: 'الرئيسية',  path: '/vendor' },
        { icon: Package,         label: 'المنتجات',  path: '/vendor/products' },
        { icon: ShoppingCart,    label: 'الطلبات',   path: '/vendor/orders' },
      
        { icon: Star, label: 'التقييمات', path: '/vendor/reviews' },
        { icon: BarChart3,       label: 'التقارير',  path: '/vendor/reports' },
        { icon: Wallet,          label: 'أرباحي',    path: '/vendor/earnings' },
        { icon: Link2,           label: 'ربط الحسابات', path: '/vendor/social' },
        { icon: Settings,        label: 'الإعدادات', path: '/vendor/settings' },
        ]
    } else if (type === 'admin') {
      return [
        { icon: LayoutDashboard, label: 'الرئيسية',    path: '/admin'            },
        { icon: Users,           label: 'المستخدمين',  path: '/admin/users'      },
        { icon: Store,           label: 'المتاجر',     path: '/admin/stores'     },
        { icon: Package,         label: 'الفئات',      path: '/admin/categories' },
        { icon: Image,           label: 'الصفحة الرئيسية', path: '/admin/homepage' },
        { icon: ShoppingCart,    label: 'الطلبات',     path: '/admin/orders'     },
        { icon: Star,            label: 'التقييمات',   path: '/admin/reviews'    },
        { icon: Tag,             label: 'الكوبونات',   path: '/admin/coupons'    },
        { icon: Zap,             label: 'النقاط التشجيعية', path: '/admin/loyalty'    },
        { icon: RotateCcw,       label: 'الإرجاع',     path: '/admin/returns'    },
        { icon: BarChart3,       label: 'التقارير',    path: '/admin/reports'    },
        { icon: Wallet,          label: 'المستحقات',   path: '/admin/finance'    },
        { icon: MapPinned,       label: 'مناطق التوصيل', path: '/admin/delivery-zones' },
        { icon: Settings,        label: 'الإعدادات',   path: '/admin/settings'   },
      ]
    } else if (type === 'operations') {
      return [
        { icon: LayoutDashboard, label: 'الرئيسية',       path: '/operations' },
        { icon: ShoppingCart,    label: 'الطلبات',        path: '/operations/orders' },
        { icon: Users,           label: 'عمال التوصيل',   path: '/operations/drivers' },
        { icon: Store,           label: 'التتبع المباشر', path: '/operations/tracking' },
        { icon: BarChart3,       label: 'التقارير',       path: '/operations/reports' },
        { icon: Settings,        label: 'الإعدادات',      path: '/operations/settings' },
      ]
    }
    return []
  }

  const menuItems = getMenuItems()

  const getTitle = () => {
    switch (type) {
      case 'vendor':     return 'لوحة تحكم البائع'
      case 'admin':      return 'لوحة تحكم الإدارة'
      case 'operations': return 'لوحة التشغيل'
      default:           return 'لوحة التحكم'
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed top-0 right-0 left-0 h-[70px] bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <button className="lg:hidden p-2 hover:bg-gray-100 rounded-md"
            onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex items-center gap-3">
            <Link to="/" title="الصفحة الرئيسية للتسوق" className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">و</span>
            </Link>
            <div className="hidden sm:block">
              <h1 className="font-display font-bold text-lg text-gray-900">{getTitle()}</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <div className="flex items-center gap-3 mr-2 pr-4 border-r border-gray-200">
            <UserAvatar user={user} className="w-9 h-9" fallback="أ" />
            <span className="hidden sm:block text-sm font-medium text-gray-700">
              {user?.fullName || 'المستخدم'}
            </span>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`
        fixed top-[70px] right-0 bottom-0 bg-white border-l border-gray-200 z-30
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        ${sidebarCollapsed ? 'w-[70px]' : 'w-[240px]'}
      `}>
        <button
          className="hidden lg:flex absolute -left-3 top-6 w-6 h-6 bg-white border border-gray-200 rounded-full items-center justify-center shadow-sm hover:bg-gray-50"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          <ChevronLeft size={14} className={`text-gray-500 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
        </button>

        {/* Nav items - scrollable */}
        <nav className="p-3 space-y-0.5 overflow-y-auto h-[calc(100%-112px)]">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/vendor' || item.path === '/admin' || item.path === '/operations'}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 text-sm
                ${isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }
                ${sidebarCollapsed ? 'justify-center px-2' : ''}
              `}
            >
              <item.icon size={19} className="flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* العودة للمتجر + تسجيل الخروج */}
        <div className="absolute bottom-0 right-0 left-0 p-3 border-t border-gray-100 space-y-0.5 bg-white">
          <Link to="/" title="الصفحة الرئيسية للتسوق"
            className={`
              flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium
              !text-primary hover:bg-primary/10 transition-colors duration-200
              ${sidebarCollapsed ? 'justify-center px-2' : ''}
            `}>
            <Home size={19} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>الصفحة الرئيسية للتسوق</span>}
          </Link>
          <button
            onClick={handleLogout}
            className={`
              flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm
              text-red-500 hover:bg-red-50 transition-colors duration-200
              ${sidebarCollapsed ? 'justify-center px-2' : ''}
            `}>
            <LogOut size={19} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-20"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <main ref={mainRef} className={`
        dashboard-main pt-[70px] min-h-screen transition-all duration-300
        ${sidebarCollapsed ? 'lg:pr-[70px]' : 'lg:pr-[240px]'}
      `}>
        <div className="p-4 lg:p-6">
          <PushPrompt className="mb-4" text="فعّل الإشعارات لتصلك الطلبات الجديدة فوراً حتى والتطبيق مغلق" />
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}

export default DashboardLayout