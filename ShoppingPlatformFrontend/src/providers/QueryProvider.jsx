import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// إنشاء Query Client مع الإعدادات الافتراضية
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // إعادة المحاولة عند الفشل
      retry: 1,
      // وقت الاحتفاظ بالبيانات في الذاكرة المؤقتة
      staleTime: 5 * 60 * 1000, // 5 دقائق
      // وقت الاحتفاظ بالبيانات غير النشطة
      gcTime: 10 * 60 * 1000, // 10 دقائق
      // إعادة الجلب عند التركيز على النافذة
      refetchOnWindowFocus: false,
      // إعادة الجلب عند إعادة الاتصال
      refetchOnReconnect: true,
    },
    mutations: {
      // إعادة المحاولة عند الفشل
      retry: 0,
    },
  },
});

/**
 * Query Provider Component
 */
export const QueryProvider = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Devtools فقط في وضع التطوير */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};

export { queryClient };
export default QueryProvider;
