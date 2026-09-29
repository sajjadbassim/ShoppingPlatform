import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores';

/**
 * ProtectedRoute - حماية المسارات التي تتطلب تسجيل دخول
 * @param {Object} props
 * @param {React.ReactNode} props.children - المحتوى المحمي
 * @param {string[]} [props.allowedRoles] - الأدوار المسموح لها (اختياري)
 * @param {string} [props.redirectTo] - مسار إعادة التوجيه (افتراضي: /login)
 */
const ProtectedRoute = ({ 
  children, 
  allowedRoles = [], 
  redirectTo = '/login' 
}) => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  // إذا لم يكن مسجل دخول
  if (!isAuthenticated) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // إذا كان هناك أدوار محددة ولم يكن المستخدم ضمنها
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

/**
 * GuestRoute - المسارات للزوار فقط (مثل صفحة تسجيل الدخول)
 * @param {Object} props
 * @param {React.ReactNode} props.children - المحتوى
 * @param {string} [props.redirectTo] - مسار إعادة التوجيه للمستخدمين المسجلين
 */
export const GuestRoute = ({ children, redirectTo = '/' }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (isAuthenticated) {
    // ✅ توجيه حسب دور المستخدم (حسب ما يرجعه API)
    const roleRedirects = {
      ADMIN: '/admin',
      VENDOR: '/vendor',
      OPS: '/operations',
      CUSTOMER: '/',
    };
    
    // إذا جاء من صفحة محمية، أعده إليها
    const from = location.state?.from;
    const defaultRedirect = roleRedirects[user?.role] || redirectTo;
    
    return <Navigate to={from || defaultRedirect} replace />;
  }

  return children;
};

/**
 * RoleRoute - مسار محدد لدور معين
 */
export const AdminRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={['ADMIN']}>{children}</ProtectedRoute>
);

export const VendorRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={['VENDOR']}>{children}</ProtectedRoute>
);

export const OpsRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={['OPS']}>{children}</ProtectedRoute>
);

export const CustomerRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={['CUSTOMER']}>{children}</ProtectedRoute>
);

export default ProtectedRoute;