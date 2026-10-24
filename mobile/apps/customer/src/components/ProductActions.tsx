import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { router } from 'expo-router';
import { fetchVariants, useSessionStore, type ApiError, type ProductSummary } from '@wasit/shared';
import { useCartActions } from '../api/useCart';
import { useWishlistToggle } from '../api/useEngagement';
import { toast } from '../lib/toast';

interface ProductActions {
  isWishlisted: (productId: string) => boolean;
  toggle: (productId: string) => void;
  quickAdd: (product: ProductSummary) => void;
  addingId?: string;
}

// إضافة سريعة من البطاقة (كما في الويب): الزائر ← الدخول، والمنتج ذو الخيارات (مقاس/لون) يُفتح لاختيارها
function useQuickAdd() {
  const signedIn = useSessionStore((s) => s.signedIn);
  const { add } = useCartActions();

  const quickAdd = async (product: ProductSummary) => {
    if (!signedIn) return router.push('/login');
    const variants = await fetchVariants(product.id).catch(() => []);
    if (variants.length > 0) return router.push({ pathname: '/product/[id]', params: { id: product.id } });
    add.mutate(
      { productId: product.id, quantity: product.weightStepKg ?? 1 },
      {
        onSuccess: () => toast.success('تمت الإضافة للسلة'),
        onError: (e) => toast.error((e as ApiError).message || 'تعذّرت الإضافة'),
      },
    );
  };

  const addingId = add.isPending ? add.variables?.productId : undefined;
  return { quickAdd, addingId };
}

const Context = createContext<ProductActions | null>(null);

// مراقب واحد للمفضلة والإضافة السريعة لكل البطاقات. كان كل بطاقة تنشئ مراقباتها (4 طلبات إضافة + استعلام المفضلة)،
// فيثقل التطبيق عند الضغط على «+» لأن مئات المراقبات تُحدَّث معاً.
export function ProductActionsProvider({ children }: { children: ReactNode }) {
  const wishlist = useWishlistToggle();
  const quick = useQuickAdd();

  // الدالتان ثابتتان حتى لا تُعاد رسم البطاقات بلا داعٍ
  const toggleRef = useRef(wishlist.toggle);
  toggleRef.current = wishlist.toggle;
  const quickAddRef = useRef(quick.quickAdd);
  quickAddRef.current = quick.quickAdd;
  const toggle = useCallback((id: string) => toggleRef.current(id), []);
  const quickAdd = useCallback((p: ProductSummary) => quickAddRef.current(p), []);

  const value = useMemo(
    () => ({ isWishlisted: wishlist.isWishlisted, toggle, quickAdd, addingId: quick.addingId }),
    [wishlist.isWishlisted, toggle, quickAdd, quick.addingId],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useProductActions = (): ProductActions => {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('ProductActionsProvider مفقود');
  return ctx;
};
