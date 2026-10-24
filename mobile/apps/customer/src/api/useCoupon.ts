import { useCallback, useEffect, useRef, useState } from 'react';
import { useCouponStore, validateCoupon, type ApiError, type CouponResult } from '@wasit/shared';

// كوبون الخصم (مشترك بين السلة وإتمام الطلب): يُستعاد من الرمز المحفوظ ويُعاد حسابه كلما تغيّر المجموع،
// فخصم النسبة يتغير مع الكمية وقد يسقط الكوبون إن نزل المجموع تحت حدّه الأدنى
export function useCoupon(subtotal: number) {
  const savedCode = useCouponStore((s) => s.code);
  const setSavedCode = useCouponStore((s) => s.setCode);
  const clearSaved = useCouponStore((s) => s.clear);
  const [applied, setApplied] = useState<CouponResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const validatedFor = useRef('');
  const subtotalRef = useRef(subtotal);
  subtotalRef.current = subtotal;

  const apply = useCallback(
    async (rawCode: string, silent = false) => {
      const code = rawCode.trim();
      if (!code) return;
      setError('');
      setBusy(true);
      try {
        const result = await validateCoupon(code, subtotalRef.current);
        validatedFor.current = `${code}|${subtotalRef.current}`;
        setApplied(result);
        setSavedCode(code);
      } catch (e) {
        setApplied(null);
        // كوبون محفوظ لم يعد صالحاً يُحذف بصمت، والمُدخل يدوياً يُظهر سبب الرفض
        if (silent) clearSaved();
        else setError((e as ApiError).message || 'كود الخصم غير صحيح');
      } finally {
        setBusy(false);
      }
    },
    [setSavedCode, clearSaved],
  );

  const remove = useCallback(() => {
    setApplied(null);
    setError('');
    clearSaved();
  }, [clearSaved]);

  useEffect(() => {
    if (savedCode && subtotal > 0 && validatedFor.current !== `${savedCode}|${subtotal}`) apply(savedCode, true);
  }, [savedCode, subtotal, apply]);

  return { applied, discount: applied?.discountAmount ?? 0, error, setError, busy, apply, remove };
}

export type CouponState = ReturnType<typeof useCoupon>;
