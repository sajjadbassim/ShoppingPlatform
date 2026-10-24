import { api } from './api';
import { API_ENDPOINTS } from './endpoints';

// تفضيلات الحساب المحفوظة في الخادم (GET/PUT /api/users/me/preferences): الزبون يستعمل مفتاحَي الإشعارات فقط
export interface UserPreferences {
  language?: string;
  theme?: string;
  currency?: string;
  notifyOrderUpdates?: boolean;
  notifyReminders?: boolean;
}

export type NotifyPreference = 'notifyOrderUpdates' | 'notifyReminders';

export const fetchMyPreferences = async (): Promise<UserPreferences> => {
  const res = await api.get(API_ENDPOINTS.USERS.MY_PREFERENCES);
  return res.data?.data ?? res.data ?? {};
};

// تحديث جزئي: الحقول غير المُرسلة لا تتغير
export const updateMyPreferences = async (patch: Partial<UserPreferences>): Promise<UserPreferences> => {
  const res = await api.put(API_ENDPOINTS.USERS.MY_PREFERENCES, patch);
  return res.data?.data ?? res.data ?? {};
};

// الخادم يعتبر الإشعارات مفعّلة افتراضياً لمن لا يملك سجلاً بعد (كما في الويب: ?? true)
export const isNotifyOn = (prefs: UserPreferences | null | undefined, key: NotifyPreference): boolean => prefs?.[key] ?? true;
