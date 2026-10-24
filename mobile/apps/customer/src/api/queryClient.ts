import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

// عودة التطبيق من الخلفية تُعدّ «تركيزاً»، فتُحدَّث الاستعلامات القديمة (في RN لا يحدث تلقائياً كالمتصفح)
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
  // حالة الاتصال الفعلية: عند انقطاعه تتوقف الطلبات وتُعرض آخر بيانات محفوظة، وعند عودته تُستأنف
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false)),
  );
}

// أخطاء الشبكة تُعاد مرة واحدة فقط، وأخطاء الخادم (4xx) لا تُعاد
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      // لازم لحفظ البيانات على الجهاز: لا تُحذف قبل 24 ساعة
      gcTime: 24 * 60 * 60 * 1000,
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    },
  },
});

// العمل دون اتصال: نحفظ على الجهاز بيانات التصفح العامة فقط (الرئيسية والفئات والمنتجات والمتاجر).
// بيانات المستخدم (السلة والطلبات والعناوين) لا تُحفظ أبداً
const PERSISTED_KEYS = ['home', 'home-section', 'categories', 'products', 'product', 'variants', 'vendor', 'stores', 'reviews', 'review-summary'];

export const persistOptions = {
  persister: createAsyncStoragePersister({ storage: AsyncStorage, key: 'wasit-query-cache', throttleTime: 2000 }),
  maxAge: 24 * 60 * 60 * 1000,
  buster: '1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { state: { status: string }; queryKey: readonly unknown[] }) =>
      query.state.status === 'success' && PERSISTED_KEYS.includes(String(query.queryKey[0])),
  },
};
