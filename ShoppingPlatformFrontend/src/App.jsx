import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/common/Toast'
import ErrorBoundary from './components/common/ErrorBoundary'
import { ProtectedRoute, GuestRoute } from './components/auth'
import { useAuthStore } from './stores/authStore'
import { useNotificationsStore } from './stores/notificationsStore'
import { useNotificationsRealtime } from './hooks/useNotificationsRealtime'
import MainLayout from './components/layouts/MainLayout'
import DashboardLayout from './components/layouts/DashboardLayout'
import { NotFoundPage, UnauthorizedPage } from './pages/errors'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import HomePage from './pages/customer/HomePage'
import ProductsPage from './pages/customer/ProductsPage'
import ProductDetailsPage from './pages/customer/ProductDetailsPage'
import CartPage from './pages/customer/CartPage'
import CheckoutPage from './pages/customer/CheckoutPage'
import OrdersPage from './pages/customer/OrdersPage'
import OrderDetailsPage from './pages/customer/OrderDetailsPage'
import StoresPage from './pages/customer/StoresPage'
import StoreDetailsPage from './pages/customer/StoreDetailsPage'
import ProfilePage from './pages/customer/ProfilePage'
import WishlistPage from './pages/customer/WishlistPage'
import SettingsPage from './pages/customer/SettingsPage'
import CategoriesPage from './pages/customer/CategoriesPage'
import { NotificationsPage } from './components/common/Notifications'
import LoyaltyPage from './pages/customer/LoyaltyPage'
import ReturnsPage from './pages/customer/ReturnsPage'
import VendorDashboard from './pages/vendor/VendorDashboard'
import VendorProducts from './pages/vendor/VendorProducts'
import VendorProductForm from './pages/vendor/VendorProductForm'
import VendorOrders from './pages/vendor/VendorOrders'
import VendorReviews from './pages/vendor/VendorReviews'
import VendorReports from './pages/vendor/VendorReports'
import VendorSettings from './pages/vendor/VendorSettings'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminStores from './pages/admin/AdminStores'
import AdminCategories from './pages/admin/AdminCategories'
import AdminHomepage from './pages/admin/AdminHomepage'
import AdminReviews from './pages/admin/AdminReviews'
import AdminCoupons from './pages/admin/AdminCoupons'
import AdminLoyalty from './pages/admin/AdminLoyalty'
import AdminReturns from './pages/admin/AdminReturns'
import AdminOrders from './pages/admin/AdminOrders'
import AdminOrderDetails from './pages/admin/AdminOrderDetails'
import AdminReports from './pages/admin/AdminReports'
import AdminSettings from './pages/admin/AdminSettings'
import OperationsDashboard from './pages/operations/OperationsDashboard'
import OperationsDrivers from './pages/operations/OperationsDrivers'
import OperationsOrders from './pages/operations/OperationsOrders'
import OperationsTracking from './pages/operations/OperationsTracking'
import OperationsReports from './pages/operations/OperationsReports'

function App() {
  const { isAuthenticated } = useAuthStore()
  const fetchNotifications = useNotificationsStore((s) => s.fetchNotifications)

  useNotificationsRealtime()

  useEffect(() => {
    if (isAuthenticated) fetchNotifications()
  }, [isAuthenticated])

  return (
    <ErrorBoundary>
      <ToastProvider position="bottom-left">
        <Router>
          <Routes>
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

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
            </Route>

            <Route path="/vendor" element={<ProtectedRoute allowedRoles={['VENDOR']}><DashboardLayout type="vendor" /></ProtectedRoute>}>
              <Route index element={<VendorDashboard />} />
              <Route path="products" element={<VendorProducts />} />
              <Route path="products/new" element={<VendorProductForm />} />
              <Route path="products/:id/edit" element={<VendorProductForm />} />
              <Route path="orders" element={<VendorOrders />} />
              <Route path="reviews" element={<VendorReviews />} />
              <Route path="reports" element={<VendorReports />} />
              <Route path="settings" element={<VendorSettings />} />
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
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route path="/operations" element={<ProtectedRoute allowedRoles={['OPS']}><DashboardLayout type="operations" /></ProtectedRoute>}>
              <Route index element={<OperationsDashboard />} />
              <Route path="drivers" element={<OperationsDrivers />} />
              <Route path="orders" element={<OperationsOrders />} />
              <Route path="tracking" element={<OperationsTracking />} />
              <Route path="reports" element={<OperationsReports />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App