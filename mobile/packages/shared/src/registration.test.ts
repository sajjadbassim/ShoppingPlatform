import { normalizeIraqiPhone } from './phone';
import { isValidOtp, validateNewPassword, validateRegisterInfo, validateResetPhone } from './validators';

describe('normalizeIraqiPhone', () => {
  it.each([
    ['07701234567', '07701234567'],
    ['0770 123 4567', '07701234567'],
    ['+964 770 123 4567', '07701234567'],
    ['009647701234567', '07701234567'],
    ['9647701234567', '07701234567'],
    ['7701234567', '07701234567'],
  ])('%s ← %s', (input, expected) => {
    expect(normalizeIraqiPhone(input)).toBe(expected);
  });

  it.each(['07201234567', '0770123456', 'abc', '', null, undefined])('غير صالح: %s', (input) => {
    expect(normalizeIraqiPhone(input as string)).toBeNull();
  });
});

describe('validateRegisterInfo', () => {
  const ok = { fullName: 'علي حسن', phone: '07701234567', email: 'a@b.com' };

  it('بيانات صحيحة', () => expect(validateRegisterInfo(ok)).toEqual({}));

  it('كل الحقول ناقصة', () => {
    expect(validateRegisterInfo({ fullName: 'ع', phone: '', email: '' })).toEqual({
      fullName: 'الاسم يجب أن يكون 3 أحرف على الأقل',
      phone: 'رقم الهاتف مطلوب',
      email: 'البريد الإلكتروني مطلوب',
    });
  });

  it('رقم وبريد غير صحيحين', () => {
    const errors = validateRegisterInfo({ ...ok, phone: '0770', email: 'x@y' });
    expect(errors.phone).toContain('غير صحيح');
    expect(errors.email).toBe('البريد الإلكتروني غير صحيح');
  });
});

describe('validateNewPassword', () => {
  it('قصيرة وغير متطابقة ولم يوافق على الشروط', () => {
    expect(validateNewPassword({ password: '123', confirmPassword: '124', requireTerms: true })).toEqual({
      password: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
      confirmPassword: 'كلمات المرور غير متطابقة',
      agreeTerms: 'يجب الموافقة على الشروط والأحكام',
    });
  });

  it('الشروط لا تُطلب في استعادة كلمة المرور', () => {
    expect(validateNewPassword({ password: 'secret1', confirmPassword: 'secret1' })).toEqual({});
  });

  it('صحيحة مع الموافقة', () => {
    expect(
      validateNewPassword({ password: 'secret1', confirmPassword: 'secret1', requireTerms: true, agreeTerms: true }),
    ).toEqual({});
  });
});

describe('رمز التحقق ورقم الاستعادة', () => {
  it('الرمز 6 أرقام فقط', () => {
    expect(isValidOtp('123456')).toBe(true);
    expect(isValidOtp('12345')).toBe(false);
    expect(isValidOtp('12345a')).toBe(false);
  });

  it('رقم الاستعادة', () => {
    expect(validateResetPhone('')).toBe('رقم الهاتف مطلوب');
    expect(validateResetPhone('123')).toBe('رقم الهاتف غير صحيح');
    expect(validateResetPhone('0770 123 4567')).toBeUndefined();
  });
});
