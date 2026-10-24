import axios from 'axios';
import { api, type ApiError } from './api';
import { API_URL } from './config';
import { API_ENDPOINTS } from './endpoints';
import { clearSession, patchSession, revokeSession, saveSession, type SessionData } from './session';
import { normalizeIdentifier } from './validators';

// ردّ الخادم عند الدخول والتسجيل (LoginResponseDto)
export interface AuthUser extends SessionData {
  userId: string;
  phone: string;
  fullName: string;
  email?: string | null;
  role: string;
  vendorId?: string | null;
  avatarUrl?: string | null;
  permissions?: string[] | null;
  isStoreStaff?: boolean;
}

export const UserRoles = {
  Customer: 'CUSTOMER',
  Vendor: 'VENDOR',
  Driver: 'DRIVER',
  Ops: 'OPS',
  Admin: 'ADMIN',
} as const;

// تسجيل الدخول. allowedRoles: الأدوار المقبولة في هذا التطبيق؛ غيرها يُرفض ولا تُحفظ جلسته
export const login = async (
  credentials: { identifier: string; password: string },
  allowedRoles?: readonly string[],
): Promise<AuthUser> => {
  const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, {
    identifier: normalizeIdentifier(credentials.identifier),
    password: credentials.password,
  });
  const user = response.data?.data as AuthUser;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // الخادم أنشأ جلسة لهذا الجهاز: نُبطلها ولا نحفظها
    if (user.refreshToken)
      axios.post(`${API_URL}/api/Auth/logout`, { refreshToken: user.refreshToken }).catch(() => {});
    const error: ApiError = { status: 403, message: 'هذا الحساب غير مخصص لهذا التطبيق' };
    throw error;
  }

  saveSession(user);
  return user;
};

// مهام تحتاج جلسة صالحة وتُنفَّذ قبل مسحها (مثل إزالة رمز الإشعارات من الخادم)
const beforeLogout: Array<() => Promise<void> | void> = [];
export const onBeforeLogout = (task: () => Promise<void> | void) => {
  beforeLogout.push(task);
  return () => {
    const i = beforeLogout.indexOf(task);
    if (i >= 0) beforeLogout.splice(i, 1);
  };
};

const BEFORE_LOGOUT_MAX_MS = 2500;

// الخروج: مهام ما قبل الخروج (بحدّ أقصى ثانيتين ونصف حتى لا يعلق الخروج دون إنترنت)،
// ثم إبطال الرمز في الخادم (دون انتظار) ومسح الجلسة المحلية
export const logout = async (): Promise<void> => {
  if (beforeLogout.length > 0) {
    await Promise.race([
      Promise.allSettled(beforeLogout.map((task) => Promise.resolve().then(task))),
      new Promise((resolve) => setTimeout(resolve, BEFORE_LOGOUT_MAX_MS)),
    ]);
  }
  revokeSession();
  clearSession();
};

// ===== التسجيل وتأكيد الهاتف =====

// يعيد devCode في بيئة التطوير فقط (مفتاح واتساب التجريبي لا يرسل رسالة حقيقية)
export const sendPhoneCode = async (phone: string): Promise<string> => {
  const res = await api.post(API_ENDPOINTS.AUTH.PHONE_SEND_CODE, { phone });
  return res.data?.data?.devCode || '';
};

// رمز صحيح: يعيد verificationToken يُرسل مع التسجيل
export const verifyPhoneCode = async (phone: string, code: string): Promise<string> => {
  const res = await api.post(API_ENDPOINTS.AUTH.PHONE_VERIFY_CODE, { phone, code });
  return res.data.data.verificationToken;
};

export interface RegisterInput {
  phone: string;
  password: string;
  fullName: string;
  email: string;
  referralCode?: string;
  phoneVerificationToken?: string;
}

// ينشئ حساب زبون ويحفظ جلسته مباشرة
export const register = async (input: RegisterInput): Promise<AuthUser> => {
  const res = await api.post(API_ENDPOINTS.AUTH.REGISTER, {
    ...input,
    email: input.email.trim().toLowerCase(),
    fullName: input.fullName.trim(),
    referralCode: input.referralCode?.trim() || undefined,
  });
  const user = res.data?.data as AuthUser;
  saveSession(user);
  return user;
};

// ===== استعادة كلمة المرور =====

export const forgotPassword = async (phone: string): Promise<string> => {
  const res = await api.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { phone });
  return res.data?.data?.devCode || '';
};

export const verifyResetOtp = async (phone: string, code: string): Promise<string> => {
  const res = await api.post(API_ENDPOINTS.AUTH.VERIFY_RESET_OTP, { phone, code });
  return res.data.data.resetToken;
};

export const resetPassword = async (resetToken: string, newPassword: string): Promise<void> => {
  await api.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, { resetToken, newPassword });
};

// بعد إعادة فتح التطبيق تُستعاد الرموز فقط من التخزين الآمن، فنجلب بيانات المستخدم (الاسم والمعرّف والدور)
// ليعمل ما يعتمد عليها. فشل الطلب لا يُسقط الجلسة؛ 401 يمر عبر التجديد في api.ts
export const restoreProfile = async (): Promise<void> => {
  try {
    const res = await api.get(API_ENDPOINTS.AUTH.ME);
    const me = res.data?.data;
    if (!me?.userId) return;
    patchSession({ userId: me.userId, phone: me.phone, fullName: me.name, email: me.email, role: me.role });
  } catch {
    // يبقى المستخدم داخلاً، وتُعاد المحاولة عند الفتح التالي
  }
};

// إضافة رقم هاتف لحساب بلا هاتف (حسابات Google) برمز إثبات من verifyPhoneCode
export const addPhone = async (phone: string, verificationToken: string): Promise<AuthUser> => {
  const res = await api.put(API_ENDPOINTS.AUTH.ADD_PHONE, { phone, verificationToken });
  const user = (res.data?.data ?? res.data) as AuthUser;
  saveSession(user);
  return user;
};
