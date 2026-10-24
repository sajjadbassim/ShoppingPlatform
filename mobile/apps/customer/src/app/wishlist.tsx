import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  clearWishlist,
  fetchVariants,
  getImageUrl,
  IMG_SIZE,
  useSessionStore,
  wishlistToSummary,
  type WishlistItem,
} from '@wasit/shared';
import { AppText, Button, brand, colors, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { useCartActions } from '../api/useCart';
import { useWishlist } from '../api/useEngagement';
import { AppHeader } from '../components/AppHeader';
import { useProductActions } from '../components/ProductActions';
import { toast } from '../lib/toast';
import { confirmDialog } from '../lib/dialog';

const money = (n: number) => `${Math.round(n).toLocaleString('en-US')} د.ع`;
const isInStock = (item: WishlistItem) => item.product.isAvailable && item.product.stockQuantity > 0;

function WishlistRow({ item, onAdd, onRemove }: { item: WishlistItem; onAdd: () => void; onRemove: () => void }) {
  useTheme();
  const p = item.product;
  const image = getImageUrl(p.primaryImageUrl, IMG_SIZE.THUMB);
  const inStock = isInStock(item);
  const hasDiscount = !!p.originalPrice && p.originalPrice > p.price;
  const open = () => router.push({ pathname: '/product/[id]', params: { id: item.productId } });

  return (
    <View style={styles.row}>
      <Pressable onPress={open} style={styles.media}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="cart-outline" size={28} color={tc("#D1D5DB")} />
          </View>
        )}
        {!inStock && (
          <View style={styles.soldOut}>
            <AppText numberOfLines={1} style={styles.soldOutText}>
              غير متوفر
            </AppText>
          </View>
        )}
      </Pressable>

      <View style={styles.body}>
        {!!p.vendorName && (
          <View style={styles.vendor}>
            <Ionicons name="storefront-outline" size={11} color={colors.placeholder} />
            <AppText numberOfLines={1} style={styles.vendorText}>
              {p.vendorName}
            </AppText>
          </View>
        )}
        <Pressable onPress={open}>
          <AppText weight="medium" numberOfLines={2} style={styles.name}>
            {p.nameAr || p.name}
          </AppText>
        </Pressable>
        <View style={styles.priceRow}>
          <AppText weight="bold" style={styles.price}>
            {money(p.price || 0)}
          </AppText>
          {hasDiscount && <AppText style={styles.original}>{Math.round(p.originalPrice as number).toLocaleString('en-US')}</AppText>}
        </View>

        <View style={styles.actions}>
          <Pressable style={[styles.addButton, !inStock && styles.addOff]} disabled={!inStock} onPress={onAdd}>
            <Ionicons name="cart-outline" size={14} color={inStock ? colors.white : colors.placeholder} />
            <AppText weight="bold" numberOfLines={1} style={[styles.addText, !inStock && { color: colors.placeholder }]}>
              {inStock ? 'أضف للسلة' : 'غير متوفر'}
            </AppText>
          </Pressable>
          <Pressable style={styles.trash} onPress={onRemove} accessibilityLabel="إزالة من المفضلة">
            <Ionicons name="trash-outline" size={16} color={tc("#6B7280")} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function WishlistScreen() {
  useTheme();
  const signedIn = useSessionStore((s) => s.signedIn);
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useWishlist();
  const { quickAdd, toggle } = useProductActions();
  const { add } = useCartActions();
  const [addingAll, setAddingAll] = useState(false);
  const items = data ?? [];

  const inStockItems = items.filter(isInStock);
  const outOfStockCount = items.length - inStockItems.length;
  const totalPrice = items.reduce((sum, i) => sum + (i.product.price || 0), 0);

  const confirmClear = () =>
    confirmDialog({
      title: 'مسح المفضلة',
      message: 'هل أنت متأكد من مسح جميع المنتجات من قائمة المفضلة؟',
      confirmText: 'مسح الكل',
      tone: 'danger',
      icon: 'heart-dislike-outline',
      onConfirm: async () => {
        try {
          await clearWishlist();
          queryClient.setQueryData(['wishlist'], []);
        } catch {
          toast.error('فشل مسح المفضلة');
        }
      },
    });

  // رابط /wishlist خاص بكل حساب، فنشارك أسماء المنتجات فقط
  const share = () => {
    const lines = items.slice(0, 20).map((i) => `• ${i.product.nameAr || i.product.name}`);
    Share.share({ title: 'مفضلتي - منصة واسط', message: `مفضلتي في منصة واسط:\n${lines.join('\n')}` }).catch(() => {});
  };

  // كل منتج على حدة: فشل منتج لا يوقف البقية، وذو الخيارات يُترك ليختار الزبون مقاسه أو لونه
  const addAll = async () => {
    if (addingAll) return;
    if (inStockItems.length === 0) {
      toast.info('لا توجد منتجات متوفرة');
      return;
    }
    setAddingAll(true);
    let added = 0;
    let needOptions = 0;
    let failed = 0;
    for (const item of inStockItems) {
      try {
        const variants = await fetchVariants(item.productId).catch(() => []);
        if (variants.length > 0) {
          needOptions++;
          continue;
        }
        await add.mutateAsync({ productId: item.productId, quantity: 1 });
        added++;
      } catch {
        failed++;
      }
    }
    setAddingAll(false);
    const parts: string[] = [];
    if (added > 0) parts.push(`تمت إضافة ${added} منتج للسلة`);
    if (needOptions > 0) parts.push(`${needOptions} منتج يحتاج اختيار المقاس أو اللون، افتحه من القائمة وأضفه`);
    if (failed > 0) parts.push(`تعذّرت إضافة ${failed} منتج`);
    (failed > 0 || needOptions > 0 ? toast.warning : toast.success)(parts.join(' — '), { duration: 6000 });
  };

  const body = () => {
    if (!signedIn) {
      return (
        <View style={styles.center}>
          <AppText weight="bold">سجّل دخولك لعرض مفضلتك</AppText>
          <Button title="تسجيل الدخول" onPress={() => router.push('/login')} style={{ marginTop: spacing.md }} />
        </View>
      );
    }
    if (isLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      );
    }
    if (isError && items.length === 0) {
      // فشل التحميل ليس «فارغة»: لا نوهم الزبون أن مفضلته ضاعت
      return (
        <View style={styles.center}>
          <AppText weight="bold" style={{ color: colors.errorDark }}>
            تعذّر تحميل المفضلة
          </AppText>
          <Button title="إعادة المحاولة" variant="outline" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
        </View>
      );
    }
    if (items.length === 0) {
      return (
        <View style={styles.center}>
          <View style={styles.emptyCircle}>
            <Ionicons name="heart-outline" size={44} color={colors.placeholder} />
          </View>
          <AppText weight="bold" style={{ fontSize: 20, marginTop: spacing.md }}>
            قائمة المفضلة فارغة
          </AppText>
          <AppText muted style={{ textAlign: 'center', marginTop: 4 }}>
            لم تقم بإضافة أي منتجات إلى المفضلة بعد
          </AppText>
          <Button title="تصفح المنتجات" onPress={() => router.replace('/products')} style={{ marginTop: spacing.md }} />
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <View style={styles.headTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.titleRow}>
                <Ionicons name="heart" size={22} color={colors.error} />
                <AppText weight="bold" style={styles.title}>
                  المفضلة
                </AppText>
              </View>
              <AppText muted style={styles.sub}>
                {items.length} منتج • <AppText weight="bold" style={[styles.sub, { color: colors.primary }]}>{money(totalPrice)}</AppText>
                {outOfStockCount > 0 && <AppText style={[styles.sub, { color: colors.error }]}> • {outOfStockCount} غير متوفر</AppText>}
              </AppText>
            </View>
            <View style={styles.headActions}>
              <Pressable style={styles.circle} onPress={share} accessibilityLabel="مشاركة">
                <Ionicons name="share-social-outline" size={18} color={tc("#4B5563")} />
              </Pressable>
              <Pressable style={[styles.circle, styles.circleDanger]} onPress={confirmClear} accessibilityLabel="مسح الكل">
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          </View>
          {inStockItems.length > 0 && (
            <Pressable style={[styles.addAll, addingAll && { opacity: 0.6 }]} onPress={addAll} disabled={addingAll}>
              {addingAll ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="cart-outline" size={18} color={colors.white} />
                  <AppText weight="bold" style={styles.addAllText}>
                    إضافة الكل للسلة ({inStockItems.length})
                  </AppText>
                </>
              )}
            </Pressable>
          )}
        </View>

        {items.map((item) => (
          <WishlistRow key={item.id} item={item} onAdd={() => quickAdd(wishlistToSummary(item))} onRemove={() => toggle(item.productId)} />
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.page}>
      <AppHeader back />
      {body()}
    </View>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl },
  head: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  headTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22 },
  sub: { fontSize: 14, marginTop: 4 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  circle: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  circleDanger: { borderColor: '#FECACA' },
  addAll: { marginTop: 16, height: 44, borderRadius: 22, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addAllText: { color: colors.white, fontSize: 16 },
  row: { flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12 },
  media: { width: 96, height: 96, borderRadius: 12, overflow: 'hidden', backgroundColor: brand.surfaceMuted },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  soldOut: { position: 'absolute', start: 0, end: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 2, alignItems: 'center' },
  soldOutText: { color: colors.white, fontSize: 10, lineHeight: 15, flexShrink: 0 },
  body: { flex: 1, minWidth: 0 },
  vendor: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vendorText: { flexShrink: 1, fontSize: 11, color: colors.placeholder },
  name: { fontSize: 14, lineHeight: 21, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  price: { color: colors.primary, fontSize: 15 },
  original: { fontSize: 12, color: colors.placeholder, textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 8 },
  addButton: { flex: 1, height: 36, borderRadius: 18, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addOff: { backgroundColor: '#E5E7EB' },
  addText: { color: colors.white, fontSize: 12 },
  trash: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
}));
