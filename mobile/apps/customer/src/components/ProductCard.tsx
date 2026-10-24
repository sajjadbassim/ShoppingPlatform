import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  discountPercentOf,
  formatPrice,
  getImageUrl,
  IMG_SIZE,
  isProductBuyable,
  type ProductSummary,
} from '@wasit/shared';
import { AppText, brand, colors, radius, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { useProductActions } from './ProductActions';

export const PRODUCT_CARD_WIDTH = 176;

interface Props {
  product: ProductSummary;
  onPress?: (product: ProductSummary) => void;
  // العرض الثابت للصفوف الأفقية، و'100%' للشبكة
  width?: number | `${number}%`;
  wishlisted?: boolean;
  onToggleWishlist?: (productId: string) => void;
  onAddToCart?: (product: ProductSummary) => void;
  adding?: boolean;
  // الزر الدائري الصغير على الصورة (الافتراضي)، أو زر «إضافة للسلة» العريض أسفل البطاقة (صفحة المتجر)
  addButton?: 'round' | 'wide';
  // 'list' = بطاقة أفقية (صورة 128 ثم التفاصيل) كما في variant="horizontal" في الويب
  layout?: 'grid' | 'list';
}

// بطاقة المنتج كما في الويب: صورة على خلفية رمادية، شارة خصم حمراء، قلب أبيض، المتجر، الاسم، السعر، وزر «+» دائري صغير على الصورة
function ProductCardBase({ product, onPress, width = PRODUCT_CARD_WIDTH, wishlisted, onToggleWishlist, onAddToCart, adding, addButton = 'round', layout = 'grid' }: Props) {
  useTheme();
  const image = getImageUrl(product.primaryImageUrl, IMG_SIZE.CARD);
  const storeClosed = product.vendorIsOpen === false;
  const unavailable = !isProductBuyable(product) || storeClosed;
  const discount = discountPercentOf(product);

  if (layout === 'list') {
    const rating = product.averageRating ?? 0;
    return (
      <Pressable style={[styles.card, styles.listCard, { width }]} onPress={() => onPress?.(product)} accessibilityRole="button">
        <View style={styles.listImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={150} recyclingKey={product.id} />
          ) : (
            <View style={styles.image} />
          )}
          {unavailable && (
            <View style={styles.overlay}>
              <AppText weight="bold" numberOfLines={1} style={styles.listOverlayText}>
                {storeClosed ? 'المتجر مغلق' : 'غير متوفر'}
              </AppText>
            </View>
          )}
          {discount > 0 && (
            <View style={styles.discount}>
              <AppText weight="bold" style={styles.discountText}>
                {discount}%
              </AppText>
            </View>
          )}
          {!!onToggleWishlist && (
            <Pressable
              onPress={() => onToggleWishlist(product.id)}
              hitSlop={8}
              style={[styles.heart, styles.listHeart]}
              accessibilityLabel={wishlisted ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            >
              <Ionicons name={wishlisted ? 'heart' : 'heart-outline'} size={18} color={wishlisted ? colors.error : colors.text} />
            </Pressable>
          )}
        </View>
        <View style={styles.listBody}>
          <View style={{ gap: 2 }}>
            {!!product.vendorName && (
              <View style={styles.vendorRow}>
                <Ionicons name="storefront-outline" size={14} color={colors.textMuted} />
                <AppText muted numberOfLines={1} style={styles.vendor}>
                  {product.vendorName}
                </AppText>
              </View>
            )}
            <AppText weight="medium" numberOfLines={2} style={styles.listName}>
              {product.nameAr || product.name}
            </AppText>
            {rating > 0 && (
              <View style={styles.vendorRow}>
                <Ionicons name="star" size={14} color={tc("#F59E0B")} />
                <AppText muted style={{ fontSize: 14 }}>
                  {rating}
                </AppText>
              </View>
            )}
          </View>
          <View style={styles.listFooter}>
            <View style={[styles.priceRow, { flex: 1 }]}>
              <AppText weight="bold" style={styles.price}>
                {formatPrice(product.price, product.weightStepKg)}
              </AppText>
              {!!product.originalPrice && product.originalPrice > product.price && (
                <AppText muted style={styles.original}>
                  {formatPrice(product.originalPrice, product.weightStepKg)}
                </AppText>
              )}
            </View>
            {!!onAddToCart && !unavailable && (
              <Pressable
                style={[styles.listAdd, adding && { opacity: 0.6 }]}
                disabled={adding}
                hitSlop={6}
                onPress={() => onAddToCart(product)}
                accessibilityLabel="إضافة للسلة"
              >
                <Ionicons name="cart-outline" size={18} color={colors.white} />
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable style={[styles.card, { width }]} onPress={() => onPress?.(product)} accessibilityRole="button">
      <View style={styles.imageWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={150} recyclingKey={product.id} />
        ) : (
          <View style={styles.image} />
        )}
        {unavailable && (
          <View style={styles.overlay}>
            <View style={styles.overlayLabel}>
              <AppText weight="bold" numberOfLines={1} style={styles.overlayText}>
                {storeClosed ? 'المتجر مغلق' : 'غير متوفر'}
              </AppText>
            </View>
          </View>
        )}
        {discount > 0 && (
          <View style={styles.discount}>
            <AppText weight="bold" style={styles.discountText}>
              {discount}% خصم
            </AppText>
          </View>
        )}
        {!!onToggleWishlist && (
          <Pressable
            onPress={() => onToggleWishlist(product.id)}
            hitSlop={8}
            style={styles.heart}
            accessibilityLabel={wishlisted ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
          >
            <Ionicons name={wishlisted ? 'heart' : 'heart-outline'} size={22} color={wishlisted ? colors.error : colors.text} />
          </Pressable>
        )}
        {!!onAddToCart && !unavailable && addButton === 'round' && (
          <Pressable
            style={[styles.plus, adding && { opacity: 0.6 }]}
            disabled={adding}
            hitSlop={6}
            onPress={() => onAddToCart(product)}
            accessibilityLabel="إضافة للسلة"
          >
            <Ionicons name="add" size={20} color={colors.white} />
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        {!!product.vendorName && (
          <View style={styles.vendorRow}>
            <Ionicons name="storefront-outline" size={14} color={colors.textMuted} />
            <AppText muted numberOfLines={1} style={styles.vendor}>
              {product.vendorName}
            </AppText>
          </View>
        )}
        <AppText weight="medium" numberOfLines={2} style={styles.name}>
          {product.nameAr || product.name}
        </AppText>
        <View style={styles.priceRow}>
          <AppText weight="bold" style={styles.price}>
            {formatPrice(product.price, product.weightStepKg)}
          </AppText>
          {!!product.originalPrice && product.originalPrice > product.price && (
            <AppText muted style={styles.original}>
              {formatPrice(product.originalPrice, product.weightStepKg)}
            </AppText>
          )}
        </View>
        {!!onAddToCart && !unavailable && addButton === 'wide' && (
          <Pressable
            style={[styles.addButton, adding && { opacity: 0.6 }]}
            disabled={adding}
            onPress={() => onAddToCart(product)}
            accessibilityRole="button"
          >
            <AppText weight="bold" style={styles.addText}>
              إضافة للسلة
            </AppText>
            <Ionicons name="add" size={18} color={colors.white} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

export const ProductCard = memo(ProductCardBase);

const styles = createStyles(() => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageWrap: { aspectRatio: 1, backgroundColor: brand.surfaceMuted },
  listCard: { flexDirection: 'row' },
  listImage: { width: 128, height: 128, backgroundColor: brand.surfaceMuted },
  listBody: { flex: 1, padding: spacing.sm, justifyContent: 'space-between', minWidth: 0 },
  listName: { fontSize: 14 },
  listFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  listHeart: { width: 30, height: 30 },
  listOverlayText: { color: colors.white, fontSize: 13 },
  listAdd: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  discount: {
    position: 'absolute',
    top: spacing.sm,
    start: spacing.sm,
    backgroundColor: colors.error,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountText: { color: colors.white, fontSize: 12, lineHeight: 16 },
  heart: {
    position: 'absolute',
    top: spacing.sm,
    end: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  overlay: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  overlayLabel: { backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 8, minWidth: 112, alignItems: 'center' },
  overlayText: { color: colors.text, fontSize: 14, textAlign: 'center', flexShrink: 0 },
  body: { padding: spacing.sm, gap: 4 },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vendor: { fontSize: 12, flexShrink: 1 },
  name: { fontSize: 14, minHeight: 40 },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8 },
  price: { fontSize: 16, color: colors.primary },
  original: { fontSize: 12, textDecorationLine: 'line-through' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 40,
    marginTop: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  addText: { color: colors.white, fontSize: 13 },
  plus: {
    position: 'absolute',
    bottom: spacing.sm,
    end: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
}));

// بطاقة متصلة بالمفضلة والسلة عبر ProductActionsProvider (مراقب واحد لكل الشاشة)
export function ConnectedProductCard(props: Omit<Props, 'wishlisted' | 'onToggleWishlist' | 'onAddToCart' | 'adding'>) {
  const { isWishlisted, toggle, quickAdd, addingId } = useProductActions();
  return (
    <ProductCard
      {...props}
      wishlisted={isWishlisted(props.product.id)}
      onToggleWishlist={toggle}
      onAddToCart={quickAdd}
      adding={addingId === props.product.id}
    />
  );
}
