import { api } from './api';
import { API_ENDPOINTS } from './endpoints';

// ربط رمز FCM لهذا الجهاز بالحساب الحالي (الخادم ينقله إن كان مربوطاً بحساب آخر)
export const registerDevice = async (token: string, platform: 'android' | 'ios', app: 'customer' | 'driver'): Promise<void> => {
  await api.post(API_ENDPOINTS.PUSH.DEVICE, { token, platform, app });
};

// عند الخروج: حتى لا تصل إشعارات الحساب السابق إلى هذا الجهاز
export const removeDevice = async (token: string): Promise<void> => {
  await api.post(API_ENDPOINTS.PUSH.DEVICE_REMOVE, { token });
};

// وجهة الإشعار عند الضغط عليه: يرسل الخادم مساراً بصيغة الويب، ونحوّله إلى شاشة في التطبيق.
// «orders/ORD-…» يحتاج رقم الطلب إلى معرّفه (يتولاه المستدعي)
export type PushTarget = { kind: 'order'; orderNumber: string } | { kind: 'returns' } | { kind: 'notifications' };

export const pushTargetFromUrl = (url?: string | null): PushTarget => {
  const path = (url ?? '').split('?')[0];
  const order = /^\/orders\/([^/]+)$/.exec(path);
  if (order) return { kind: 'order', orderNumber: decodeURIComponent(order[1]) };
  if (path === '/returns') return { kind: 'returns' };
  return { kind: 'notifications' };
};
