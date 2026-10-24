import axios from 'axios';
import { clearSession, refreshSession } from './session';

// Base URL للـ API
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5010';

// إنشاء instance من Axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 ثانية
});

// Request Interceptor - إضافة التوكن لكل طلب
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor - معالجة الأخطاء وتجديد التوكن
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 401: التوكن انتهى أو أُبطل — نجدّد الجلسة برمز التجديد ثم نعيد الطلب مرة واحدة
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const token = await refreshSession();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // انتهت الجلسة (أو أُنهيت: تعطيل الحساب، تغيير كلمة المرور) — تسجيل الخروج
        clearSession();
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // معالجة أخطاء أخرى
    const errorMessage = error.response?.data?.message || error.message || 'حدث خطأ غير متوقع';
    
    return Promise.reject({
      status: error.response?.status,
      message: errorMessage,
      errors: error.response?.data?.errors,
    });
  }
);

export default api;

// Helper functions للطلبات الشائعة
export const apiGet = (url, params = {}) => api.get(url, { params });
export const apiPost = (url, data = {}) => api.post(url, data);
export const apiPut = (url, data = {}) => api.put(url, data);
export const apiPatch = (url, data = {}) => api.patch(url, data);
export const apiDelete = (url, config) => api.delete(url, config);

// للطلبات التي تحتوي على ملفات (FormData)
export const apiPostForm = (url, formData) => 
  api.post(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const apiPutForm = (url, formData) => 
  api.put(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

