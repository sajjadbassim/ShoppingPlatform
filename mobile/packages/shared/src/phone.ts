// نفس قاعدة الخادم (PhoneNumber.Normalize): +964 / 00964 / 964 / بلا صفر ← 07XXXXXXXXX، وإلا null
// منقولة من ShoppingPlatformFrontend/src/utils/phone.js
export const normalizeIraqiPhone = (input: string | null | undefined): string | null => {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (digits.startsWith('00964')) digits = '0' + digits.slice(5);
  else if (digits.startsWith('964')) digits = '0' + digits.slice(3);
  else if (digits.length === 10 && digits.startsWith('7')) digits = '0' + digits;
  return /^07[3-9]\d{8}$/.test(digits) ? digits : null;
};
