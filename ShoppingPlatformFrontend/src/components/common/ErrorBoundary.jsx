import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Button from '../../components/common/Button';

/**
 * Error Boundary - لمعالجة الأخطاء غير المتوقعة في React
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // يمكنك إرسال الخطأ إلى خدمة تتبع الأخطاء هنا
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-lg w-full text-center">
            {/* الأيقونة */}
            <div className="flex justify-center">
              <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-12 h-12 text-yellow-600" />
              </div>
            </div>

            {/* النص */}
            <h1 className="mt-8 text-3xl font-bold text-gray-900">
              حدث خطأ غير متوقع
            </h1>
            <p className="mt-4 text-gray-600 leading-relaxed">
              نعتذر عن هذا الخطأ. فريقنا التقني تم إبلاغه وسيعمل على إصلاحه.
              <br />
              يمكنك تحديث الصفحة أو العودة للصفحة الرئيسية.
            </p>

            {/* الأزرار */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="primary" 
                size="lg"
                onClick={this.handleReload}
              >
                <RefreshCw className="w-5 h-5 ml-2" />
                تحديث الصفحة
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={this.handleGoHome}
              >
                <Home className="w-5 h-5 ml-2" />
                الصفحة الرئيسية
              </Button>
            </div>

            {/* تفاصيل الخطأ (للتطوير فقط) */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-8 p-4 bg-red-50 rounded-lg text-right">
                <p className="text-sm font-medium text-red-800 mb-2">
                  تفاصيل الخطأ (وضع التطوير):
                </p>
                <pre className="text-xs text-red-600 overflow-auto max-h-40 bg-red-100 p-2 rounded">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
