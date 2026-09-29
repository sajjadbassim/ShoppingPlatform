import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Button from '../../components/common/Button';

const NetworkErrorPage = () => {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* الأيقونة */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
            <WifiOff className="w-12 h-12 text-gray-500" />
          </div>
        </div>

        {/* النص */}
        <h1 className="mt-8 text-3xl font-bold text-gray-900">
          لا يوجد اتصال بالإنترنت
        </h1>
        <p className="mt-4 text-gray-600 leading-relaxed">
          يبدو أنك غير متصل بالإنترنت.
          <br />
          تحقق من اتصالك بالشبكة وحاول مرة أخرى.
        </p>

        {/* الأزرار */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            variant="primary" 
            size="lg"
            onClick={handleRetry}
          >
            <RefreshCw className="w-5 h-5 ml-2" />
            إعادة المحاولة
          </Button>
        </div>

        {/* نصائح */}
        <div className="mt-12 p-6 bg-white rounded-xl shadow-sm text-right">
          <p className="text-sm font-medium text-gray-700 mb-3">
            نصائح لحل المشكلة:
          </p>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">•</span>
              تأكد من تشغيل Wi-Fi أو بيانات الجوال
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">•</span>
              أعد تشغيل الراوتر أو المودم
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">•</span>
              تحقق من وجود مشكلة في مزود الخدمة
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NetworkErrorPage;
