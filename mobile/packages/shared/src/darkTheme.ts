import { DARK_HEX_MAP } from './darkMap';

const WHITE = '#FFFFFF';

// ألوان إضافية يسجّلها تطبيق له هوية لونية خاصة (البائع): تُقدَّم على جدول الويب
const EXTRA_DARK_HEX: Record<string, string> = {};

export function registerDarkHex(map: Record<string, string>): void {
  for (const [light, dark] of Object.entries(map)) EXTRA_DARK_HEX[light.toUpperCase()] = dark.toUpperCase();
}

// يحوّل لوناً سداسياً (#RGB أو #RRGGBB أو #RRGGBBAA) إلى مقابله الداكن، ويترك غير المعروف كما هو.
// forText: النص/الأيقونة البيضاء تبقى بيضاء (على أزرار ملوّنة)، أما الخلفية البيضاء فتصير سطحاً داكناً
export function darkHex(value: string, forText = false): string {
  let hex = value.toUpperCase();
  if (!/^#[0-9A-F]{3,8}$/.test(hex)) return value;
  if (hex.length === 4) hex = '#' + [...hex.slice(1)].map((c) => c + c).join('');
  const base = hex.slice(0, 7);
  const alpha = hex.slice(7);
  if (base === WHITE && forText) return value;
  const mapped = EXTRA_DARK_HEX[base] ?? DARK_HEX_MAP[base];
  return mapped ? mapped + alpha : value;
}
