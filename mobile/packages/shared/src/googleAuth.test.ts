import { isAccountExistsMessage } from './googleAuth';

describe('isAccountExistsMessage', () => {
  it('يتعرّف على رسالة «لديك حساب» المحايدة من الخادم', () => {
    expect(isAccountExistsMessage('لا يمكن إنشاء حساب بهذا البريد — إذا كان لديك حساب به فادخل بكلمة المرور')).toBe(true);
  });
  it('لا يلتقط غيرها', () => {
    expect(isAccountExistsMessage('بريد حساب Google غير موثّق')).toBe(false);
    expect(isAccountExistsMessage(undefined)).toBe(false);
  });
});
