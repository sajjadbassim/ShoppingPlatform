import axios from 'axios';

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

    // إذا كان الخطأ 401 ولم يتم إعادة المحاولة من قبل
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // محاولة تجديد التوكن
        const response = await axios.post(`${API_BASE_URL}/api/Auth/refresh-token`, {}, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        });

        const { token } = response.data;
        localStorage.setItem('accessToken', token);

        // إعادة الطلب الأصلي مع التوكن الجديد
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // فشل تجديد التوكن - تسجيل الخروج
        localStorage.removeItem('accessToken');
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
export const apiDelete = (url) => api.delete(url);

// للطلبات التي تحتوي على ملفات (FormData)
export const apiPostForm = (url, formData) => 
  api.post(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const apiPutForm = (url, formData) => 
  api.put(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

