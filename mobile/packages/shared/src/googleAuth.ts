import axios from 'axios';
import { api, type ApiError } from './api';
import { API_URL } from './config';
import { API_ENDPOINTS } from './endpoints';
import { saveSession } from './session';
import type { AuthUser } from './auth';
import { UserRoles } from './auth';

// معرّف عميل الويب في Google Cloud (عام وليس سراً). الرمز الذي يصدره الهاتف يكون جمهوره هذا المعرّف،
// وهو نفسه `Google:ClientId` في الباك، فلا يحتاج الباك أي تعديل
export const GOOGLE_WEB_CLIENT_ID: string | undefined = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined;

export interface GoogleStatus {
  linked: boolean;
  googleEmail?: string | null;
  hasPassword: boolean;
  // للزبائن فقط
  canLink: boolean;
}

// الدخول بـ Google مخصص للزبائن: أول دخول ينشئ حساباً بلا هاتف (يُطلب عند أول إتمام طلب)
export const signInWithGoogle = async (credential: string, referralCode?: string): Promise<AuthUser> => {
  const response = await api.post(API_ENDPOINTS.AUTH.GOOGLE, { credential, referralCode: referralCode || undefined });
  const user = (response.data?.data?.login ?? response.data?.login) as AuthUser;

  if (user.role !== UserRoles.Customer) {
    if (user.refreshToken) axios.post(`${API_URL}/api/Auth/logout`, { refreshToken: user.refreshToken }).catch(() => {});
    const error: ApiError = { status: 403, message: 'هذا الحساب غير مخصص لهذا التطبيق' };
    throw error;
  }
  saveSession(user);
  return user;
};

export const fetchGoogleStatus = async (): Promise<GoogleStatus> => {
  const res = await api.get(API_ENDPOINTS.AUTH.GOOGLE_STATUS);
  return res.data?.data ?? res.data;
};

export const linkGoogle = async (credential: string): Promise<GoogleStatus> => {
  const res = await api.post(API_ENDPOINTS.AUTH.GOOGLE_LINK, { credential });
  return res.data?.data ?? res.data;
};

export const unlinkGoogle = async (): Promise<GoogleStatus> => {
  const res = await api.delete(API_ENDPOINTS.AUTH.GOOGLE_LINK);
  return res.data?.data ?? res.data;
};

// رسالة الرفض المحايدة للبريد المستعمل في حساب آخر (لا ربط تلقائي بالبريد)
export const isAccountExistsMessage = (message?: string | null): boolean => !!message && message.includes('إذا كان لديك حساب');
