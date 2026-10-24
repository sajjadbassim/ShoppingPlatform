import { api } from './api';
import {
  changePassword,
  deleteReadNotifications,
  markAllNotificationsRead,
  notificationTarget,
  updateProfile,
  validateChangePassword,
  validateProfile,
} from './account';
import { clearSession, getAccessToken } from './session';

jest.mock('./api', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));

describe('الملف الشخصي', () => {
  it('التحقق', () => {
    expect(validateProfile({ fullName: 'علي حسن', email: 'a@b.com' })).toEqual({});
    expect(validateProfile({ fullName: 'ع', email: '' })).toEqual({
      fullName: 'الاسم يجب أن يكون 3 أحرف على الأقل',
      email: 'البريد الإلكتروني مطلوب',
    });
    expect(validateProfile({ fullName: 'علي حسن', email: 'x@y' }).email).toBe('البريد الإلكتروني غير صحيح');
  });

  it('التحديث ينظّف البريد والاسم', async () => {
    await updateProfile('u1', { fullName: ' علي ', email: ' A@B.com ' });
    const [url, body] = (api.put as jest.Mock).mock.calls[0];
    expect(url).toContain('u1');
    expect(body).toEqual({ fullName: 'علي', email: 'a@b.com' });
  });
});

describe('تغيير كلمة المرور', () => {
  beforeEach(() => clearSession());

  it('التحقق', () => {
    expect(validateChangePassword({ currentPassword: 'old123', password: 'new123', confirmPassword: 'new123' })).toEqual({});
    expect(validateChangePassword({ currentPassword: '', password: '123', confirmPassword: '124' })).toEqual({
      currentPassword: 'كلمة المرور الحالية مطلوبة',
      password: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
      confirmPassword: 'كلمات المرور غير متطابقة',
    });
    expect(validateChangePassword({ currentPassword: 'same12', password: 'same12', confirmPassword: 'same12' }).password).toBe(
      'اختر كلمة مرور مختلفة عن الحالية',
    );
  });

  it('الجلسة الجديدة من الخادم تُحفظ (الأجهزة الأخرى تُنهى)', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { data: { token: 'new-token', refreshToken: 'new-refresh' } } });
    await changePassword('old123', 'new123');
    expect((api.post as jest.Mock).mock.calls[0][1]).toEqual({ currentPassword: 'old123', newPassword: 'new123' });
    expect(getAccessToken()).toBe('new-token');
  });
});

describe('الإشعارات', () => {
  it('الوجهة: الطلب إن وُجد', () => {
    expect(notificationTarget({ data: { orderId: 'o1' } })).toEqual({ orderId: 'o1' });
    expect(notificationTarget({ data: { subOrderId: 's1' } })).toBeNull();
    expect(notificationTarget({ data: null })).toBeNull();
  });

  it('تعليم الكل مقروءاً وحذف المقروء', async () => {
    await markAllNotificationsRead();
    await deleteReadNotifications();
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.delete).toHaveBeenCalledTimes(1);
  });
});

import { restoreProfile } from './auth';
import { useSessionStore } from './session';

describe('استعادة الملف بعد إعادة فتح التطبيق', () => {
  beforeEach(() => {
    clearSession();
    (api.get as jest.Mock).mockReset();
  });

  it('تملأ الجلسة من /me فتعمل الشاشات المعتمدة على userId', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { data: { userId: 'u1', phone: '0770', name: 'علي', email: 'a@b.com', role: 'CUSTOMER' } },
    });
    await restoreProfile();
    expect(useSessionStore.getState().session).toMatchObject({ userId: 'u1', fullName: 'علي', role: 'CUSTOMER' });
  });

  it('فشل الطلب لا يرمي ولا يغيّر الجلسة', async () => {
    (api.get as jest.Mock).mockRejectedValue({ status: 500, message: 'x' });
    await expect(restoreProfile()).resolves.toBeUndefined();
    expect(useSessionStore.getState().session).toBeNull();
  });

  it('تحديث الملف يظهر في الجلسة المعروضة', async () => {
    await updateProfile('u1', { fullName: 'اسم جديد', email: 'n@b.com' });
    expect(useSessionStore.getState().session).toMatchObject({ fullName: 'اسم جديد', email: 'n@b.com' });
  });
});
