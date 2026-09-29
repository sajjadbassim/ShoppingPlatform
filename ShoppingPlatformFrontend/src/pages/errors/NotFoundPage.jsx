import { Link } from 'react-router-dom';
import { Home, ArrowRight, Search } from 'lucide-react';
import Button from '../../components/common/Button';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* الرقم 404 */}
        <div className="relative">
          <h1 className="text-[150px] font-bold text-gray-200 leading-none select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center">
              <Search className="w-12 h-12 text-primary-600" />
            </div>
          </div>
        </div>

        {/* النص */}
        <h2 className="mt-8 text-2xl font-bold text-gray-900">
          الصفحة غير موجودة
        </h2>
        <p className="mt-4 text-gray-600 leading-relaxed">
          عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها أو حذفها.
          <br />
          تأكد من صحة الرابط أو عد إلى الصفحة الرئيسية.
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

        {/* روابط مفيدة */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">روابط قد تساعدك:</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/products" className="text-primary-600 hover:text-primary-700">
              تصفح المنتجات
            </Link>
            <Link to="/categories" className="text-primary-600 hover:text-primary-700">
              التصنيفات
            </Link>
            <Link to="/stores" className="text-primary-600 hover:text-primary-700">
              المتاجر
            </Link>
            <Link to="/contact" className="text-primary-600 hover:text-primary-700">
              تواصل معنا
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
