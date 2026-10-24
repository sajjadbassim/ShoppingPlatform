import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  buildOptionGroups,
  findVariant,
  formatPrice,
  getImageUrl,
  IMG_SIZE,
  isOptionAvailable,
  maxQuantityFor,
  priceRange,
  stepLabel,
  useSessionStore,
  type ApiError,
  type VariantSelection,
} from '@wasit/shared';
import { AppText, Button, brand, colors, radius, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { useCartActions } from '../../api/useCart';
import { useStockAlert, useWishlistToggle } from '../../api/useEngagement';
import { useProduct, useProducts, useVariants } from '../../api/useCatalog';
import { AppHeader } from '../../components/AppHeader';
import { ConnectedRailCard } from '../../components/RailProductCard';
import { useRailCardWidth } from '../../components/HomeSections';
import { ProductReviews } from '../../components/ProductReviews';
import { QuantityStepper } from '../../components/QuantityStepper';
import { toast } from '../../lib/toast';

const DELIVERY_FACTS: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string }[] = [
  { icon: 'bus-outline', title: 'توصيل سريع', sub: 'خلال 24 ساعة' },
  { icon: 'shield-checkmark-outline', title: 'ضمان الجودة', sub: 'منتجات أصلية' },
  { icon: 'refresh-outline', title: 'إرجاع سهل', sub: 'خلال 14 يوم' },
];

// منتجات من نفس القسم (بلا المنتج الحالي)
function RelatedProducts({ categoryId, excludeId }: { categoryId: string; excludeId: string }) {
  useTheme();
  const query = useMemo(() => ({ categoryId, pageSize: 10 }), [categoryId]);
  const { data } = useProducts(query);
  const railWidth = useRailCardWidth();
  const items = (data?.pages[0]?.items ?? []).filter((p) => p.id !== excludeId);
  if (items.length === 0) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.relatedHead}>
        <AppText weight="extraBold" style={styles.sectionTitle}>
          منتجات من نفس القسم
        </AppText>
        <Pressable
          onPress={() => router.push({ pathname: '/products', params: { categoryId } })}
          style={styles.moreButton}
        >
          <AppText weight="medium" style={styles.moreText}>
            مشاهدة المزيد
          </AppText>
        </Pressable>
      </View>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: 12 }}
        renderItem={({ item }) => <ConnectedRailCard product={item} width={railWidth} />}
      />
    </View>
  );
}

export default function ProductScreen() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { data: product, isLoading, isError, refetch } = useProduct(id);
  const { data: variants = [] } = useVariants(id, !!product?.hasVariants);
  const [selection, setSelection] = useState<VariantSelection>({});
  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const signedIn = useSessionStore((s) => s.signedIn);
  const { add } = useCartActions();
  const { isWishlisted, toggle: toggleWishlist } = useWishlistToggle();

  const groups = useMemo(() => buildOptionGroups(variants), [variants]);
  const variant = useMemo(() => findVariant(variants, groups, selection), [variants, groups, selection]);

  const gallery = useMemo(() => {
    const images = [...(product?.images ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.displayOrder - b.displayOrder);
    const urls = images.map((i) => getImageUrl(i.imageUrl, IMG_SIZE.FULL)).filter((u): u is string => !!u);
    if (urls.length === 0) {
      const fallback = getImageUrl(product?.primaryImageUrl, IMG_SIZE.FULL);
      return fallback ? [fallback] : [];
    }
    return urls;
  }, [product]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !product) {
    return (
      <View style={styles.center}>
        <AppText weight="bold">تعذّر تحميل المنتج</AppText>
        <Button title="إعادة المحاولة" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
        <Button title="رجوع" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.sm }} />
      </View>
    );
  }

  const storeClosed = product.vendorIsOpen === false;
  const range = product.hasVariants ? priceRange(variants) : null;

  // سعر العرض: المتغيّر المختار، وإلا نطاق المتغيّرات، وإلا سعر المنتج
  let priceText = formatPrice(product.price, product.weightStepKg);
  if (variant) priceText = formatPrice(variant.finalPrice);
  else if (range && range.min !== range.max) priceText = `${formatPrice(range.min)} - ${formatPrice(range.max)}`;
  else if (range) priceText = formatPrice(range.min);

  const stock = variant ? variant.stockQuantity : product.stockQuantity;
  const buyable = product.isAvailable && !storeClosed && (product.hasVariants ? !!variant && variant.inStock : stock > 0);
  const needChoice = product.hasVariants && !variant;

  let stateText = '';
  if (storeClosed) stateText = 'المتجر مغلق الآن';
  else if (needChoice) stateText = 'اختر الخيارات لعرض التوفر';
  else if (!buyable) stateText = 'غير متوفر حالياً';
  else if (stock <= 5) stateText = `متبقي ${stock} فقط`;

  const maxQuantity = maxQuantityFor({ stockQuantity: stock });
  const quantityValue = Math.min(quantity, maxQuantity);

  const addToCartPressed = (buyNow = false) => {
    if (!signedIn) {
      router.push('/login');
      return;
    }
    if (needChoice) {
      toast.warning('حدّد كل الخيارات المطلوبة قبل الإضافة للسلة', { title: 'اختر الخيارات' });
      return;
    }
    add.mutate(
      { productId: product.id, variantId: variant?.id, quantity: quantityValue },
      {
        onSuccess: () =>
          buyNow
            ? router.push('/cart')
            : toast.success('تمت الإضافة للسلة'),
        onError: (e) => toast.error((e as ApiError).message || 'تعذّرت الإضافة'),
      },
    );
  };

  const wished = isWishlisted(product.id);
  const productName = product.nameAr || product.name;
  const unavailable = !buyable && !needChoice;
  const share = () => Share.share({ message: productName }).catch(() => {});

  return (
    <View style={styles.safe}>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content} style={{ flex: 1 }}>
        <View style={styles.card}>
          <View style={styles.imageBox}>
            {gallery.length > 0 ? (
              <FlatList
                data={gallery}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(u) => u}
                onMomentumScrollEnd={(e) => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / (width - 2 * spacing.md - 2 * spacing.md)))}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item }}
                    style={{ width: width - 4 * spacing.md, height: width - 4 * spacing.md }}
                    contentFit="contain"
                    transition={150}
                  />
                )}
              />
            ) : (
              <View style={{ height: width - 4 * spacing.md }} />
            )}
            {gallery.length > 1 && (
              <View style={styles.dots}>
                {gallery.map((u, i) => (
                  <View key={u} style={[styles.dot, i === imageIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>

          <View style={styles.titleRow}>
            <View style={{ flex: 1, gap: 4 }}>
              {!!product.vendorName && (
                <Pressable
                  style={styles.vendorRow}
                  onPress={() => router.push({ pathname: '/store/[id]', params: { id: product.vendorId } })}
                >
                  <Ionicons name="storefront-outline" size={16} color={colors.primary} />
                  <AppText style={styles.vendor}>{product.vendorName}</AppText>
                </Pressable>
              )}
              <AppText weight="extraBold" style={styles.name}>
                {productName}
              </AppText>
            </View>
            <View style={styles.roundButtons}>
              <Pressable style={styles.roundButton} onPress={() => toggleWishlist(product.id)} accessibilityLabel="المفضلة">
                <Ionicons name={wished ? 'heart' : 'heart-outline'} size={22} color={wished ? colors.error : colors.text} />
              </Pressable>
              <Pressable style={styles.roundButton} onPress={share} accessibilityLabel="مشاركة">
                <Ionicons name="share-social-outline" size={22} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {!!product.averageRating && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="star" size={16} color={tc("#F59E0B")} />
              <AppText weight="bold" style={{ fontSize: 14 }}>
                {product.averageRating.toFixed(1)}
              </AppText>
              <AppText muted style={{ fontSize: 14 }}>
                ({product.reviewCount ?? 0} تقييم)
              </AppText>
            </View>
          )}

          <View style={styles.priceRow}>
            <AppText weight="extraBold" style={styles.price}>
              {priceText}
            </AppText>
            {product.hasDiscount && !!product.originalPrice && !variant && !range && (
              <AppText muted style={styles.original}>
                {formatPrice(product.originalPrice, product.weightStepKg)}
              </AppText>
            )}
            {product.hasDiscount && !!product.discountPercentage && (
              <View style={styles.badge}>
                <AppText weight="bold" style={styles.badgeText}>
                  -{Math.round(product.discountPercentage)}%
                </AppText>
              </View>
            )}
          </View>
          {!!product.promotionNameAr && (
            <AppText style={{ color: colors.success, fontSize: 14 }}>{product.promotionNameAr}</AppText>
          )}
          {!!product.description && <AppText style={styles.description}>{product.description}</AppText>}

          {groups.map((group) => (
            <View key={group.attributeId} style={styles.group}>
              <AppText weight="bold" style={styles.groupTitle}>
                {group.name}
              </AppText>
              <View style={styles.options}>
                {group.values.map((value) => {
                  const selected = selection[group.attributeId] === value.valueId;
                  const available = isOptionAvailable(variants, selection, group.attributeId, value.valueId);
                  return (
                    <Pressable
                      key={value.valueId}
                      disabled={!available && !selected}
                      onPress={() =>
                        setSelection((s) => {
                          const next = { ...s };
                          if (selected) delete next[group.attributeId];
                          else next[group.attributeId] = value.valueId;
                          return next;
                        })
                      }
                      style={[styles.option, selected && styles.optionSelected, !available && !selected && styles.optionOff]}
                    >
                      <AppText
                        weight="medium"
                        style={[
                          styles.optionText,
                          selected && { color: colors.white },
                          !available && !selected && { textDecorationLine: 'line-through', color: colors.placeholder },
                        ]}
                      >
                        {value.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {!unavailable && (
            <View style={styles.qtyRow}>
              <AppText weight="medium" style={{ fontSize: 15 }}>
                الكمية
              </AppText>
              <QuantityStepper
                value={quantityValue}
                max={maxQuantity}
                weightStepKg={product.weightStepKg}
                disabled={!buyable}
                onChange={setQuantity}
              />
              {!!product.weightStepKg && (
                <AppText muted style={{ fontSize: 12, flexShrink: 1 }}>
                  كل ضغطة تضيف {stepLabel(product.weightStepKg)}
                </AppText>
              )}
            </View>
          )}

          {!!stateText && (
            <View style={styles.stateRow}>
              <View style={[styles.stateDot, { backgroundColor: buyable ? colors.warning : colors.error }]} />
              <AppText weight="medium" style={{ color: buyable ? colors.warning : colors.errorDark }}>
                {stateText}
              </AppText>
            </View>
          )}

          <View style={styles.facts}>
            {DELIVERY_FACTS.map((fact) => (
              <View key={fact.title} style={styles.fact}>
                <Ionicons name={fact.icon} size={24} color={colors.primary} />
                <AppText weight="bold" style={styles.factTitle}>
                  {fact.title}
                </AppText>
                <AppText muted style={styles.factSub}>
                  {fact.sub}
                </AppText>
              </View>
            ))}
          </View>

          {!!(variant?.sku || product.sku) && (
            <AppText muted style={styles.sku}>
              رمز المنتج: {variant?.sku || product.sku}
            </AppText>
          )}
        </View>

        <View style={styles.card}>
          <AppText weight="bold" style={styles.specsTitle}>
            المواصفات
          </AppText>
          {!!(variant?.sku || product.sku) && <SpecRow label="رمز المنتج" value={String(variant?.sku || product.sku)} mono />}
          <SpecRow label="التوفر" value={buyable ? 'متوفر' : 'غير متوفر'} danger={!buyable} />
          <SpecRow label="الكمية المتاحة" value={String(needChoice ? product.stockQuantity : stock)} last />
        </View>

        <View style={styles.card}>
          <ProductReviews productId={product.id} />
        </View>

        {!!product.categoryId && <RelatedProducts categoryId={product.categoryId} excludeId={product.id} />}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bar}>
        {unavailable ? (
          <StockAlertButton productId={product.id} variantId={variant?.id} />
        ) : (
          <View style={styles.barInner}>
            <Pressable
              style={[styles.addToCart, (!buyable || add.isPending) && { opacity: 0.6 }]}
              disabled={!buyable || add.isPending}
              onPress={() => addToCartPressed()}
              accessibilityRole="button"
            >
              {add.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="cart-outline" size={20} color={colors.white} />
                  <AppText weight="bold" style={styles.addToCartText}>
                    إضافة للسلة
                  </AppText>
                </>
              )}
            </Pressable>
            <Pressable style={[styles.buyNow, !buyable && { opacity: 0.5 }]} disabled={!buyable || add.isPending} onPress={() => addToCartPressed(true)} accessibilityRole="button">
              <AppText weight="bold" style={styles.buyNowText}>
                شراء الآن
              </AppText>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

// «أعلمني عند التوفر» (StockAlertButton في الويب): الزائر ← الدخول، والمشترك يرى زراً أخضر للإلغاء
function StockAlertButton({ productId, variantId }: { productId: string; variantId?: string | null }) {
  useTheme();
  const signedIn = useSessionStore((s) => s.signedIn);
  const { subscribed, toggle } = useStockAlert(productId, variantId);

  const press = () => {
    if (!signedIn) return router.push('/login');
    toggle.mutate(undefined, {
      onSuccess: (now) => (now ? toast.success('سيصلك إشعار مرة واحدة حين يعود للمخزون', { title: 'سنُعلمك فور توفره 🔔' }) : toast.info('تم إلغاء التنبيه')),
      onError: (e) => toast.error((e as ApiError).message || 'تعذّر حفظ التنبيه'),
    });
  };

  return (
    <Pressable
      style={[styles.notifyButton, subscribed && styles.notifyOn, toggle.isPending && { opacity: 0.6 }]}
      disabled={toggle.isPending}
      onPress={press}
      accessibilityState={{ selected: subscribed }}
    >
      <Ionicons name={subscribed ? 'notifications' : 'notifications-outline'} size={20} color={subscribed ? tc('#047857') : colors.white} />
      <AppText weight="bold" style={[styles.notifyText, subscribed && { color: tc('#047857') }]}>
        {subscribed ? 'سنُعلمك عند التوفر — إلغاء' : 'أعلمني عند التوفر'}
      </AppText>
    </Pressable>
  );
}

function SpecRow({ label, value, mono, danger, last }: { label: string; value: string; mono?: boolean; danger?: boolean; last?: boolean }) {
  useTheme();
  return (
    <View style={[styles.specRow, !last && styles.specBorder]}>
      <AppText muted style={{ fontSize: 14, flex: 1 }}>
        {label}
      </AppText>
      <AppText weight={danger ? 'bold' : 'medium'} numberOfLines={1} style={[{ fontSize: 13, flexShrink: 0 }, mono && { fontFamily: 'monospace' }, danger && { color: colors.errorDark }]}>
        {value}
      </AppText>
    </View>
  );
}

const styles = createStyles(() => ({
  card: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  imageBox: { backgroundColor: brand.surfaceMuted, borderRadius: radius.xl, overflow: 'hidden' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roundButtons: { flexDirection: 'row', gap: spacing.sm },
  roundButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  facts: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.background },
  fact: { flex: 1, alignItems: 'center', gap: 2 },
  factTitle: { fontSize: 14, textAlign: 'center' },
  factSub: { fontSize: 12, textAlign: 'center' },
  sku: { fontSize: 13 },
  specsTitle: { fontSize: 16, color: colors.primary, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  specBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionTitle: { fontSize: 20 },
  relatedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moreButton: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border },
  moreText: { color: colors.primary, fontSize: 13 },
  notifyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 54, margin: spacing.md, borderRadius: radius.full, backgroundColor: '#111827' },
  notifyOn: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  notifyText: { color: colors.white, fontSize: 16 },
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  dots: { position: 'absolute', bottom: spacing.sm, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.primary },
  backButton: {
    position: 'absolute',
    top: spacing.md,
    start: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 28, lineHeight: 30, color: colors.text },
  name: { fontSize: 22 },
  vendor: { fontSize: 14, color: colors.primary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
  price: { fontSize: 24, color: colors.primary },
  original: { fontSize: 15, textDecorationLine: 'line-through' },
  badge: { backgroundColor: colors.error, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.white, fontSize: 13 },
  group: { gap: spacing.sm, marginTop: spacing.sm },
  groupTitle: { fontSize: 16 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.surface },
  optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionOff: { backgroundColor: colors.background },
  optionText: { fontSize: 15 },
  description: { fontSize: 15, lineHeight: 24 },
  bar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  addToCart: { flex: 1, height: 48, borderRadius: radius.full, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addToCartText: { color: colors.white, fontSize: 16 },
  buyNow: { height: 48, paddingHorizontal: 22, borderRadius: radius.full, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  buyNowText: { fontSize: 15, color: '#1F2937' },
  barInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 8 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
}));
