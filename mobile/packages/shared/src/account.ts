import { api } from './api';
import { API_ENDPOINTS } from './endpoints';
import { clearSession, patchSession, saveSession, type SessionData } from './session';

// ===== الملف الشخصي وكلمة المرور =====

export const updateProfile = async (userId: string, input: { fullName: string; email: string }): Promise<void> => {
  await api.put(API_ENDPOINTS.USERS.BY_ID(userId), {
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
  });
  patchSession({ fullName: input.fullName.trim(), email: input.email.trim().toLowerCase() });
};

// الخادم ينهي جلسات الأجهزة الأخرى ويعيد جلسة جديدة لهذا الجهاز، فنحفظها
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const res = await api.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, { currentPassword, newPassword });
  saveSession(res.data?.data as SessionData);
};

// حذف الحساب بنفسه: الخادم يُخفي الهوية ويعطّل الحساب (ويرفض إن كانت هناك طلبات جارية)، ثم نُنهي الجلسة محلياً
export const deleteAccount = async (password: string): Promise<void> => {
  await api.delete(API_ENDPOINTS.ACCOUNT.DELETE, { data: { password } });
  clearSession();
};

export type ProfileErrors = Partial<Record<'fullName' | 'email', string>>;

export const validateProfile = (form: { fullName: string; email: string }): ProfileErrors => {
  const errors: ProfileErrors = {};
  if (form.fullName.trim().length < 3) errors.fullName = 'الاسم يجب أن يكون 3 أحرف على الأقل';
  const email = form.email.trim();
  if (!email) errors.email = 'البريد الإلكتروني مطلوب';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'البريد الإلكتروني غير صحيح';
  return errors;
};

export type ChangePasswordErrors = Partial<Record<'currentPassword' | 'password' | 'confirmPassword', string>>;

export const validateChangePassword = (form: {
  currentPassword: string;
  password: string;
  confirmPassword: string;
}): ChangePasswordErrors => {
  const errors: ChangePasswordErrors = {};
  if (!form.currentPassword) errors.currentPassword = 'كلمة المرور الحالية مطلوبة';
  if (form.password.length < 6) errors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
  else if (form.password === form.currentPassword) errors.password = 'اختر كلمة مرور مختلفة عن الحالية';
  if (form.password !== form.confirmPassword) errors.confirmPassword = 'كلمات المرور غير متطابقة';
  return errors;
};

// ===== الإشعارات =====

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  data?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResult {
  unreadCount: number;
  notifications: AppNotification[];
}

export const fetchNotifications = async (take = 30): Promise<NotificationsResult> =>
  (await api.get(API_ENDPOINTS.NOTIFICATIONS.BASE, { params: { take } })).data.data;

export const fetchUnreadCount = async (): Promise<number> =>
  (await api.get(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT)).data.data?.unreadCount ?? 0;

export const markNotificationRead = async (id: string): Promise<void> => {
  await api.patch(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await api.patch(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
};

export const deleteReadNotifications = async (): Promise<void> => {
  await api.delete(API_ENDPOINTS.NOTIFICATIONS.DELETE_READ);
};

// الوجهة داخل التطبيق من بيانات الإشعار: الطلب إن وُجد معرّفه
export const notificationTarget = (n: Pick<AppNotification, 'data'>): { orderId: string } | null => {
  const orderId = n.data?.orderId;
  return typeof orderId === 'string' && orderId ? { orderId } : null;
};
