import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/common/Toast'
import ErrorBoundary from './components/common/ErrorBoundary'
import PWAPrompt from './components/common/PWAPrompt'
import ScrollToTop from './components/common/ScrollToTop'
import TopLoadingBar from './components/common/TopLoadingBar'
import { PageLoader } from './components/common/PageLoader'
import { ProtectedRoute, GuestRoute } from './components/auth'
import { useAuthStore } from './stores/authStore'
import { useNotificationsStore } from './stores/notificationsStore'
import { useNotificationsRealtime } from './hooks/useNotificationsRealtime'
import { syncPush } from './utils/push'
import { useThemeSync } from './hooks/usePreferences'
import MainLayout from './components/layouts/MainLayout'
import DashboardLayout from './components/layouts/DashboardLayout'
import { NotFoundPage, UnauthorizedPage } from './pages/errors'
// الصفحات تُحمَّل عند الحاجة فقط — الزائر لا ينزّل صفحات الإدارة والبائع والعمليات
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const HomePage = lazy(() => import('./pages/customer/HomePage'))
const ProductsPage = lazy(() => import('./pages/customer/ProductsPage'))
const ProductDetailsPage = lazy(() => import('./pages/customer/ProductDetailsPage'))
const CartPage = lazy(() => import('./pages/customer/CartPage'))
const CheckoutPage = lazy(() => import('./pages/customer/CheckoutPage'))
const OrdersPage = lazy(() => import('./pages/customer/OrdersPage'))
const OrderDetailsPage = lazy(() => import('./pages/customer/OrderDetailsPage'))
const StoresPage = lazy(() => import('./pages/customer/StoresPage'))
const StoreDetailsPage = lazy(() => import('./pages/customer/StoreDetailsPage'))
const ProfilePage = lazy(() => import('./pages/customer/ProfilePage'))
const WishlistPage = lazy(() => import('./pages/customer/WishlistPage'))
const SettingsPage = lazy(() => import('./pages/customer/SettingsPage'))
const CategoriesPage = lazy(() => import('./pages/customer/CategoriesPage'))
const ReelsPage = lazy(() => import('./pages/customer/ReelsPage'))
const DriverTrackPage = lazy(() => import('./pages/driver/DriverTrackPage'))
const DriverDashboard = lazy(() => import('./pages/driver/DriverDashboard'))
import { NotificationsPage } from './components/common/Notifications'
const LoyaltyPage = lazy(() => import('./pages/customer/LoyaltyPage'))
const ReturnsPage = lazy(() => import('./pages/customer/ReturnsPage'))
const LegalPage = lazy(() => import('./pages/legal/LegalPage'))
const AboutPage = lazy(() => import('./pages/company/AboutPage'))
const ContactPage = lazy(() => import('./pages/company/ContactPage'))
const CareersPage = lazy(() => import('./pages/company/CareersPage'))
const BlogPage = lazy(() => import('./pages/company/BlogPage'))
const BlogPostPage = lazy(() => import('./pages/company/BlogPostPage'))
const HelpCenterPage = lazy(() => import('./pages/support/HelpCenterPage'))
const SupportPage = lazy(() => import('./pages/support/SupportPage'))
const VendorDashboard = lazy(() => import('./pages/vendor/VendorDashboard'))
const VendorProducts = lazy(() => import('./pages/vendor/VendorProducts'))
const VendorProductForm = lazy(() => import('./pages/vendor/VendorProductForm'))
const VendorOrders = lazy(() => import('./pages/vendor/VendorOrders'))
const VendorReviews = lazy(() => import('./pages/vendor/VendorReviews'))
const VendorReports = lazy(() => import('./pages/vendor/VendorReports'))
const VendorEarnings = lazy(() => import('./pages/vendor/VendorEarnings'))
const VendorSettings = lazy(() => import('./pages/vendor/VendorSettings'))
const VendorSocialAccounts = lazy(() => import('./pages/vendor/VendorSocialAccounts'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminStores = lazy(() => import('./pages/admin/AdminStores'))
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'))
const AdminHomepage = lazy(() => import('./pages/admin/AdminHomepage'))
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'))
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'))
const AdminLoyalty = lazy(() => import('./pages/admin/AdminLoyalty'))
const AdminReturns = lazy(() => import('./pages/admin/AdminReturns'))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'))
const AdminOrderDetails = lazy(() => import('./pages/admin/AdminOrderDetails'))
const AdminReports = lazy(() => import('./pages/admin/AdminReports'))
const AdminFinance = lazy(() => import('./pages/admin/AdminFinance'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))
const OperationsDashboard = lazy(() => import('./pages/operations/OperationsDashboard'))
const OperationsDrivers = lazy(() => import('./pages/operations/OperationsDrivers'))
const OperationsOrders = lazy(() => import('./pages/operations/OperationsOrders'))
const OperationsTracking = lazy(() => import('./pages/operations/OperationsTracking'))
const OperationsReports = lazy(() => import('./pages/operations/OperationsReports'))
const OperationsSettings = lazy(() => import('./pages/operations/OperationsSettings'))

function App() {
  const { isAuthenticated } = useAuthStore()
  const fetchNotifications = useNotificationsStore((s) => s.fetchNotifications)

  useNotificationsRealtime()
  useThemeSync()

  useEffect(() => {
    if (isAuthenticated) fetchNotifications()
  }, [isAuthenticated])

  // الجهاز الذي فعّل الإشعارات سابقاً يُربط بالحساب الداخل حالياً
  const userId = useAuthStore((s) => s.user?.id)
  useEffect(() => {
    if (isAuthenticated && userId) syncPush()
  }, [isAuthenticated, userId])

  return (
    <ErrorBoundary>
      <ToastProvider position="bottom-left">
        <PWAPrompt />
        <Router>
          <ScrollToTop />
          <TopLoadingBar />
          <Suspense fallback={<PageLoader fullScreen />}>
          <Routes>
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            <Route path="/reels" element={<ReelsPage />} />
            {/* رابط مشاركة موقع السائق — بلا تسجيل دخول */}
            <Route path="/driver/track/:token" element={<DriverTrackPage />} />
            <Route path="/driver" element={<ProtectedRoute allowedRoles={['DRIVER']}><DriverDashboard /></ProtectedRoute>} />

            <Route path="/" element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/:id" element={<ProductDetailsPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="stores" element={<StoresPage />} />
              <Route path="stores/:id" element={<StoreDetailsPage />} />
              <Route path="loyalty" element={<ProtectedRoute><LoyaltyPage /></ProtectedRoute>} />
              <Route path="returns" element={<ProtectedRoute><ReturnsPage /></ProtectedRoute>} />
              <Route path="cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
              <Route path="checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
              <Route path="orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
              <Route path="orders/:id" element={<ProtectedRoute><OrderDetailsPage /></ProtectedRoute>} />
              <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
              <Route path="terms" element={<LegalPage key="terms" doc="terms" />} />
              <Route path="privacy" element={<LegalPage key="privacy" doc="privacy" />} />
              <Route path="usage-policy" element={<LegalPage key="usage" doc="usage" />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="careers" element={<CareersPage />} />
              <Route path="blog" element={<BlogPage />} />
              <Route path="blog/:slug" element={<BlogPostPage />} />
              <Route path="help" element={<HelpCenterPage />} />
              <Route path="shipping" element={<SupportPage key="shipping" doc="shipping" />} />
              <Route path="return-policy" element={<SupportPage key="returnPolicy" doc="returnPolicy" />} />
              <Route path="payment-methods" element={<SupportPage key="payment" doc="payment" />} />
            </Route>

            <Route path="/vendor" element={<ProtectedRoute allowedRoles={['VENDOR']}><DashboardLayout type="vendor" /></ProtectedRoute>}>
              <Route index element={<VendorDashboard />} />
              <Route path="products" element={<VendorProducts />} />
              <Route path="products/new" element={<VendorProductForm />} />
              <Route path="products/:id/edit" element={<VendorProductForm />} />
              <Route path="orders" element={<VendorOrders />} />
              <Route path="reviews" element={<VendorReviews />} />
              <Route path="reports" element={<VendorReports />} />
              <Route path="earnings" element={<VendorEarnings />} />
              <Route path="settings" element={<VendorSettings />} />
              <Route path="social" element={<VendorSocialAccounts />} />
            </Route>

            <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><DashboardLayout type="admin" /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="stores" element={<AdminStores />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="homepage" element={<AdminHomepage />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="coupons" element={<AdminCoupons />} />
              <Route path="loyalty" element={<AdminLoyalty />} />
              <Route path="returns" element={<AdminReturns />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="orders/:id" element={<AdminOrderDetails />} />
              <Route path="orders/:id" element={<AdminOrderDetails />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="finance" element={<AdminFinance />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route path="/operations" element={<ProtectedRoute allowedRoles={['OPS']}><DashboardLayout type="operations" /></ProtectedRoute>}>
              <Route index element={<OperationsDashboard />} />
              <Route path="drivers" element={<OperationsDrivers />} />
              <Route path="orders" element={<OperationsOrders />} />
              <Route path="tracking" element={<OperationsTracking />} />
              <Route path="reports" element={<OperationsReports />} />
              <Route path="settings" element={<OperationsSettings />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App