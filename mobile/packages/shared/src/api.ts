import axios from 'axios';
import { API_URL } from './config';
import { clearSession, getAccessToken, refreshSession } from './session';

// نفس شكل الرد الموحّد في الخادم (ApiResponse<T>)
export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T;
  traceId?: string | null;
}

// الخطأ كما يصل للشاشات بعد التطبيع
export interface ApiError {
  status?: number;
  message: string;
  errors?: unknown;
}

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // 401: التوكن انتهى أو أُبطل — نجدّد الجلسة برمز التجديد ثم نعيد الطلب مرة واحدة
    // (خطأ كلمة المرور يأتي 400 فلا يدخل هنا)
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        const token = await refreshSession();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshError) {
        // انتهت الجلسة (تعطيل الحساب، تغيير كلمة المرور): المخزن يتغيّر والتطبيق يعيد المستخدم للدخول
        clearSession();
        return Promise.reject(refreshError);
      }
    }

    const apiError: ApiError = {
      status: error.response?.status,
      message: error.response?.data?.message || error.message || 'حدث خطأ غير متوقع',
      errors: error.response?.data?.errors,
    };
    return Promise.reject(apiError);
  },
);

// فحص اتصال بسيط بنقطة عامة (قائمة الأقسام)
export async function pingApi(): Promise<{ ok: boolean; status?: number; message: string }> {
  try {
    const res = await api.get('/api/categories', { timeout: 8000 });
    return { ok: true, status: res.status, message: 'الاتصال بالخادم ناجح' };
  } catch (e) {
    const err = e as ApiError;
    return err.status
      ? { ok: false, status: err.status, message: `ردّ الخادم برمز ${err.status}` }
      : { ok: false, message: 'تعذّر الوصول إلى الخادم' };
  }
}
