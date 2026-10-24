import axios from 'axios';
import {
  forgotPassword,
  login,
  logout,
  onBeforeLogout,
  register,
  resetPassword,
  sendPhoneCode,
  verifyPhoneCode,
  verifyResetOtp,
} from './auth';
import { api } from './api';
import { getAccessToken, clearSession, useSessionStore } from './session';

jest.mock('axios', () => {
  const instance = { post: jest.fn(), get: jest.fn(), interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } } };
  return { __esModule: true, default: { post: jest.fn(), create: jest.fn(() => instance), isAxiosError: jest.fn() } };
});

const apiPost = api.post as jest.Mock;
const rawPost = axios.post as jest.Mock;

const response = (role: string) => ({
  data: { data: { userId: 'u1', phone: '07701234567', fullName: 'علي', role, token: 'tok', refreshToken: 'ref' } },
});

describe('login', () => {
  beforeEach(() => {
    clearSession();
    apiPost.mockReset();
    rawPost.mockReset().mockResolvedValue({});
  });

  it('يرسل المعرّف منظّفاً ويحفظ الجلسة', async () => {
    apiPost.mockResolvedValue(response('CUSTOMER'));

    const user = await login({ identifier: '0770 123 4567', password: 'secret1' }, ['CUSTOMER']);

    expect(apiPost.mock.calls[0][1]).toEqual({ identifier: '07701234567', password: 'secret1' });
    expect(user.fullName).toBe('علي');
    expect(getAccessToken()).toBe('tok');
    expect(useSessionStore.getState().signedIn).toBe(true);
  });

  it('دور غير مسموح ← يُرفض ولا تُحفظ الجلسة وتُبطل في الخادم', async () => {
    apiPost.mockResolvedValue(response('DRIVER'));

    await expect(login({ identifier: 'a@b.com', password: 'secret1' }, ['CUSTOMER'])).rejects.toMatchObject({
      status: 403,
    });

    expect(getAccessToken()).toBe(null);
    expect(rawPost).toHaveBeenCalledTimes(1);
    expect(rawPost.mock.calls[0][1]).toEqual({ refreshToken: 'ref' });
  });

  it('خطأ الخادم يمرّ كما هو', async () => {
    apiPost.mockRejectedValue({ status: 400, message: 'بيانات الدخول غير صحيحة' });
    await expect(login({ identifier: 'a@b.com', password: 'bad' })).rejects.toMatchObject({ status: 400 });
    expect(getAccessToken()).toBe(null);
  });

  it('الخروج يمسح الجلسة', async () => {
    apiPost.mockResolvedValue(response('CUSTOMER'));
    await login({ identifier: 'a@b.com', password: 'secret1' });

    logout();

    expect(getAccessToken()).toBe(null);
    expect(useSessionStore.getState().signedIn).toBe(false);
  });
});

describe('مهام ما قبل الخروج', () => {
  beforeEach(() => {
    clearSession();
    apiPost.mockReset();
  });

  it('تُنفَّذ والجلسة ما زالت صالحة، ثم تُمسح، وفشلها لا يمنع الخروج', async () => {
    apiPost.mockResolvedValue(response('CUSTOMER'));
    await login({ identifier: 'a@b.com', password: 'secret1' });
    const seen: Array<string | null> = [];
    const off1 = onBeforeLogout(async () => {
      seen.push(getAccessToken());
    });
    const off2 = onBeforeLogout(() => {
      throw new Error('فشل');
    });

    await logout();

    expect(seen).toEqual(['tok']);
    expect(getAccessToken()).toBe(null);
    expect(useSessionStore.getState().signedIn).toBe(false);
    off1();
    off2();
  });
});

describe('التسجيل واستعادة كلمة المرور', () => {
  beforeEach(() => {
    clearSession();
    apiPost.mockReset();
  });

  it('register ينظّف البريد والاسم ويحفظ الجلسة', async () => {
    apiPost.mockResolvedValue(response('CUSTOMER'));

    await register({
      phone: '07701234567',
      password: 'secret1',
      fullName: ' علي ',
      email: ' A@B.com ',
      referralCode: '  ',
      phoneVerificationToken: 'vt',
    });

    const body = apiPost.mock.calls[0][1];
    expect(body).toMatchObject({ email: 'a@b.com', fullName: 'علي', phoneVerificationToken: 'vt' });
    expect(body.referralCode).toBeUndefined();
    expect(getAccessToken()).toBe('tok');
  });

  it('رمز الهاتف: الإرسال يعيد devCode، والتحقق يعيد verificationToken', async () => {
    apiPost.mockResolvedValueOnce({ data: { data: { devCode: '123456' } } });
    await expect(sendPhoneCode('07701234567')).resolves.toBe('123456');

    apiPost.mockResolvedValueOnce({ data: { data: { verificationToken: 'vt' } } });
    await expect(verifyPhoneCode('07701234567', '123456')).resolves.toBe('vt');
  });

  it('استعادة كلمة المرور بثلاث خطوات ولا تُنشئ جلسة', async () => {
    apiPost.mockResolvedValueOnce({ data: { data: { devCode: '654321' } } });
    await expect(forgotPassword('07701234567')).resolves.toBe('654321');

    apiPost.mockResolvedValueOnce({ data: { data: { resetToken: 'rt' } } });
    await expect(verifyResetOtp('07701234567', '654321')).resolves.toBe('rt');

    apiPost.mockResolvedValueOnce({ data: { success: true } });
    await resetPassword('rt', 'newsecret');
    expect(apiPost.mock.calls[2][1]).toEqual({ resetToken: 'rt', newPassword: 'newsecret' });
    expect(getAccessToken()).toBe(null);
  });
});
