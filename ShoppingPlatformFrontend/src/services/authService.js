import { apiGet, apiPost } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';

/**
 * Auth Service - خدمة المصادقة
 */
export const authService = {
  /**
   * تسجيل الدخول
   * @param {Object} credentials - بيانات تسجيل الدخول
   * @param {string} credentials.phone - رقم الهاتف
   * @param {string} credentials.password - كلمة المرور
   */
login: async (credentials) => {
  const response = await apiPost(API_ENDPOINTS.AUTH.LOGIN, credentials);

  const data = response.data.data; // ✅ مثل باقي الخدمات

  if (data.token) {
    localStorage.setItem('accessToken', data.token);
  }

  localStorage.setItem('user', JSON.stringify(data));

  return data; // ✅ نرجع data فقط
},


  /**
   * تسجيل حساب جديد
   * @param {Object} userData - بيانات المستخدم
   * @param {string} userData.phone - رقم الهاتف
   * @param {string} userData.password - كلمة المرور
   * @param {string} userData.fullName - الاسم الكامل
   * @param {string} [userData.email] - البريد الإلكتروني (اختياري)
   */
register: async (userData) => {
  const response = await apiPost(API_ENDPOINTS.AUTH.REGISTER, userData);

  const data = response.data.data;

  if (data.token) {
    localStorage.setItem('accessToken', data.token);
  }

  localStorage.setItem('user', JSON.stringify(data));

  return data;
},


  /**
   * تغيير كلمة المرور
   * @param {Object} passwords - كلمات المرور
   * @param {string} passwords.currentPassword - كلمة المرور الحالية
   * @param {string} passwords.newPassword - كلمة المرور الجديدة
   */
changePassword: async (passwords) => {
  const response = await apiPost(
    API_ENDPOINTS.AUTH.CHANGE_PASSWORD,
    passwords
  );

  return response.data.data;
},


  /**
   * طلب رمز استعادة كلمة المرور
   * @param {string} phone
   */
  forgotPassword: async (phone) => {
    const response = await apiPost(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { phone });
    return response.data;
  },

  /**
   * التحقق من رمز الاستعادة
   * @param {string} phone
   * @param {string} code
   * @returns {Promise<string>} resetToken
   */
  verifyResetOtp: async (phone, code) => {
    const response = await apiPost(API_ENDPOINTS.AUTH.VERIFY_RESET_OTP, { phone, code });
    return response.data.data.resetToken;
  },

  /**
   * تعيين كلمة مرور جديدة عبر resetToken
   * @param {string} resetToken
   * @param {string} newPassword
   */
  resetPassword: async (resetToken, newPassword) => {
    const response = await apiPost(API_ENDPOINTS.AUTH.RESET_PASSWORD, { resetToken, newPassword });
    return response.data;
  },

  /**
   * تجديد التوكن
   */
refreshToken: async () => {
  const response = await apiPost(API_ENDPOINTS.AUTH.REFRESH_TOKEN);

  const data = response.data.data;

  if (data.token) {
    localStorage.setItem('accessToken', data.token);
  }

  return data;
},


  /**
   * الحصول على بيانات المستخدم الحالي
   */
getCurrentUser: async () => {
  const response = await apiGet(API_ENDPOINTS.AUTH.ME);
  return response.data.data;
},


  /**
   * تسجيل الخروج
   */
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },

  /**
   * التحقق من حالة تسجيل الدخول
   */
  isAuthenticated: () => {
    return !!localStorage.getItem('accessToken');
  },

  /**
   * الحصول على المستخدم من localStorage
   */
  getStoredUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  /**
   * الحصول على التوكن
   */
  getToken: () => {
    return localStorage.getItem('accessToken');
  },
};

export default authService;
