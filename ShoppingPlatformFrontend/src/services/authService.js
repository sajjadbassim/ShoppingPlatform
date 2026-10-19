import { apiGet, apiPost } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';
import { clearSession, refreshSession, revokeSession, saveSession } from '../api/session';

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

  // الجلسة وبيانات المستخدم يحفظها authStore (saveSession + persist بمفتاح user)
  return response.data.data;
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

  return response.data.data;
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

  // الخادم ينهي جلسات الأجهزة الأخرى ويعيد جلسة جديدة لهذا الجهاز
  const data = response.data.data;
  saveSession(data);
  return data;
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
   * رمز تأكيد رقم الهاتف (إنشاء حساب / إضافة رقم) — يعيد devCode في بيئة التطوير فقط
   * @param {string} phone
   * @returns {Promise<string>}
   */
  sendPhoneCode: async (phone) => {
    const response = await apiPost(API_ENDPOINTS.AUTH.PHONE_SEND_CODE, { phone });
    return response.data?.data?.devCode || '';
  },

  /**
   * التحقق من رمز الهاتف ← verificationToken يُرسل مع التسجيل أو إضافة الرقم
   * @param {string} phone
   * @param {string} code
   * @returns {Promise<string>}
   */
  verifyPhoneCode: async (phone, code) => {
    const response = await apiPost(API_ENDPOINTS.AUTH.PHONE_VERIFY_CODE, { phone, code });
    return response.data.data.verificationToken;
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
refreshToken: () => refreshSession(),


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
    revokeSession();
    clearSession();
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
   * الحصول على التوكن
   */
  getToken: () => {
    return localStorage.getItem('accessToken');
  },
};

export default authService;
