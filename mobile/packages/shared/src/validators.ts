import { normalizeIraqiPhone } from './phone';

// قواعد التحقق منقولة من صفحات الدخول والتسجيل واستعادة كلمة المرور في الويب

export interface LoginForm {
  identifier: string;
  password: string;
}

export type LoginErrors = Partial<Record<keyof LoginForm, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IRAQ_PHONE = /^(\+964|00964|964|0)?7\d{9}$/;

// الدخول برقم الهاتف أو بالبريد: الهاتف بلا مسافات وشرطات، والبريد كما كُتب
export const normalizeIdentifier = (value: string): string => {
  const id = value.trim();
  return id.includes('@') ? id : id.replace(/[\s-]/g, '');
};

export const validateLogin = (form: LoginForm): LoginErrors => {
  const errors: LoginErrors = {};
  const id = form.identifier.trim();

  if (!id) errors.identifier = 'أدخل رقم الهاتف أو البريد الإلكتروني';
  else if (id.includes('@')) {
    if (!EMAIL.test(id)) errors.identifier = 'البريد الإلكتروني غير صحيح';
  } else if (!IRAQ_PHONE.test(id.replace(/[\s-]/g, ''))) {
    errors.identifier = 'رقم الهاتف غير صحيح (مثال: 07701234567)';
  }

  if (!form.password) errors.password = 'كلمة المرور مطلوبة';
  else if (form.password.length < 6) errors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';

  return errors;
};

// ===== التسجيل =====

export interface RegisterInfo {
  fullName: string;
  phone: string;
  email: string;
}

export type RegisterInfoErrors = Partial<Record<keyof RegisterInfo, string>>;

// الخطوة 1: الاسم والهاتف والبريد
export const validateRegisterInfo = (form: RegisterInfo): RegisterInfoErrors => {
  const errors: RegisterInfoErrors = {};
  if (form.fullName.trim().length < 3) errors.fullName = 'الاسم يجب أن يكون 3 أحرف على الأقل';
  if (!form.phone) errors.phone = 'رقم الهاتف مطلوب';
  else if (!normalizeIraqiPhone(form.phone)) errors.phone = 'رقم الهاتف غير صحيح (مثال: 07701234567)';
  const email = form.email.trim();
  if (!email) errors.email = 'البريد الإلكتروني مطلوب';
  else if (!EMAIL.test(email)) errors.email = 'البريد الإلكتروني غير صحيح';
  return errors;
};

export interface NewPasswordForm {
  password: string;
  confirmPassword: string;
  agreeTerms?: boolean;
  // الموافقة على الشروط مطلوبة في التسجيل فقط
  requireTerms?: boolean;
}

export type NewPasswordErrors = Partial<Record<'password' | 'confirmPassword' | 'agreeTerms', string>>;

// كلمة المرور الجديدة: التسجيل (مع الشروط) واستعادة كلمة المرور (بدونها)
export const validateNewPassword = (form: NewPasswordForm): NewPasswordErrors => {
  const errors: NewPasswordErrors = {};
  if (!form.password || form.password.length < 6) errors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
  if (form.password !== form.confirmPassword) errors.confirmPassword = 'كلمات المرور غير متطابقة';
  if (form.requireTerms && !form.agreeTerms) errors.agreeTerms = 'يجب الموافقة على الشروط والأحكام';
  return errors;
};

// رمز التحقق: 6 أرقام
export const isValidOtp = (code: string): boolean => /^\d{6}$/.test(code);

// رقم لاستعادة كلمة المرور
export const validateResetPhone = (phone: string): string | undefined => {
  if (!phone.trim()) return 'رقم الهاتف مطلوب';
  if (!normalizeIraqiPhone(phone)) return 'رقم الهاتف غير صحيح';
  return undefined;
};
