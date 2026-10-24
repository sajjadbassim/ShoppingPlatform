import { normalizeIdentifier, validateLogin } from './validators';

describe('validateLogin', () => {
  it.each(['07701234567', '0770 123 4567', '+964 770 123 4567', '9647701234567', '7701234567', '0770-123-4567'])(
    'رقم صالح: %s',
    (phone) => {
      expect(validateLogin({ identifier: phone, password: 'secret1' })).toEqual({});
    },
  );

  it.each(['06701234567', '0770123456', 'abc'])('رقم غير صالح: %s', (phone) => {
    expect(validateLogin({ identifier: phone, password: 'secret1' }).identifier).toBeTruthy();
  });

  it('بريد صالح وغير صالح', () => {
    expect(validateLogin({ identifier: 'a@b.com', password: 'secret1' })).toEqual({});
    expect(validateLogin({ identifier: 'a@b', password: 'secret1' }).identifier).toBe('البريد الإلكتروني غير صحيح');
  });

  it('الحقول فارغة وكلمة المرور القصيرة', () => {
    const errors = validateLogin({ identifier: '  ', password: '' });
    expect(errors.identifier).toBe('أدخل رقم الهاتف أو البريد الإلكتروني');
    expect(errors.password).toBe('كلمة المرور مطلوبة');
    expect(validateLogin({ identifier: 'a@b.com', password: '123' }).password).toBe(
      'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    );
  });

  it('تنظيف المعرّف: الهاتف بلا مسافات، والبريد كما هو', () => {
    expect(normalizeIdentifier(' 0770 123-4567 ')).toBe('07701234567');
    expect(normalizeIdentifier(' a@b.com ')).toBe('a@b.com');
  });
});
