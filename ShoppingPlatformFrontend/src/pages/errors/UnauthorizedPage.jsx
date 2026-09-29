import { Link, useNavigate } from 'react-router-dom';
import { ShieldX, Home, ArrowRight, LogIn } from 'lucide-react';
import Button from '../../components/common/Button';
import { useAuthStore } from '../../stores';

const UnauthorizedPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuthStore();

  const handleLogin = () => {
    if (isAuthenticated) {
      logout();
    }
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* الأيقونة */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
            <ShieldX className="w-12 h-12 text-red-600" />
          </div>
        </div>

        {/* النص */}
        <h1 className="mt-8 text-3xl font-bold text-gray-900">
          غير مصرح لك
        </h1>
        <h2 className="mt-2 text-xl text-gray-600">
          403 - Access Denied
        </h2>
        <p className="mt-4 text-gray-600 leading-relaxed">
          عذراً، ليس لديك الصلاحية للوصول إلى هذه الصفحة.
          <br />
          إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع الدعم الفني.
        </p>

        {/* الأزرار */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/">
            <Button variant="primary" size="lg">
              <Home className="w-5 h-5 ml-2" />
              الصفحة الرئيسية
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => window.history.back()}
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            العودة للخلف
          </Button>
        </div>

        {/* تسجيل بحساب آخر */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">
            هل تريد تسجيل الدخول بحساب آخر؟
          </p>
          <Button 
            variant="ghost" 
            onClick={handleLogin}
          >
            <LogIn className="w-4 h-4 ml-2" />
            تسجيل الدخول
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
