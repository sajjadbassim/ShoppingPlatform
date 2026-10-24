import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  discountPercentOf,
  formatPrice,
  getImageUrl,
  IMG_SIZE,
  isProductBuyable,
  pricePerKg,
  type ProductSummary,
} from '@wasit/shared';
import { AppText, brand, colors, radius, createStyles, tc, useTheme } from '@wasit/ui';
import { useProductActions } from './ProductActions';

interface Props {
  product: ProductSummary;
  width: number;
  // داخل صندوق ملوّن (العروض المحدودة): خلفية بيضاء حول البطاقة
  boxed?: boolean;
  wishlisted: boolean;
  onToggleWishlist: (id: string) => void;
  onAdd: (p: ProductSummary) => void;
  adding: boolean;
}

const openProduct = (id: string) => router.push({ pathname: '/product/[id]', params: { id } });

// بطاقة صفوف الرئيسية (MobileProductCard في الويب): صورة مربعة بزوايا دائرية، خصم، قلب، «+»، الاسم، السعر، التقييم
function RailCardBase({ product, width, boxed, wishlisted, onToggleWishlist, onAdd, adding }: Props) {
  useTheme();
  const image = getImageUrl(product.primaryImageUrl, IMG_SIZE.CARD);
  const discount = discountPercentOf(product);
  const hasOriginal = !!product.originalPrice && product.originalPrice > product.price;
  const storeClosed = product.vendorIsOpen === false;
  const inStock = isProductBuyable(product);
  const rating = product.averageRating ?? 0;

  return (
    <Pressable style={[{ width }, boxed && styles.boxed]} onPress={() => openProduct(product.id)} accessibilityRole="button">
      <View style={styles.media}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={150} recyclingKey={product.id} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="storefront-outline" size={32} color={colors.placeholder} />
          </View>
        )}
        {discount > 0 && (
          <View style={styles.discount}>
            <AppText weight="bold" style={styles.discountText}>
              -{discount}%
            </AppText>
          </View>
        )}
        <Pressable onPress={() => onToggleWishlist(product.id)} hitSlop={6} style={styles.heart} accessibilityLabel="المفضلة">
          <Ionicons name={wishlisted ? 'heart' : 'heart-outline'} size={16} color={wishlisted ? colors.error : tc('#374151')} />
        </Pressable>
        {storeClosed && (
          <View style={styles.closed}>
            <AppText weight="bold" numberOfLines={1} style={styles.closedText}>
              المتجر مغلق
            </AppText>
          </View>
        )}
        {inStock && !storeClosed && (
          <Pressable
            onPress={() => onAdd(product)}
            disabled={adding}
            hitSlop={6}
            style={[styles.plus, adding && { opacity: 0.6 }]}
            accessibilityLabel="إضافة للسلة"
          >
            <Ionicons name="add" size={18} color={colors.white} />
          </Pressable>
        )}
      </View>

      <AppText weight="medium" numberOfLines={2} style={styles.name}>
        {product.nameAr || product.name}
      </AppText>
      <View style={styles.priceRow}>
        <AppText weight="bold" style={styles.price}>
          {formatPrice(product.price, product.weightStepKg)}
        </AppText>
        {hasOriginal && (
          <AppText style={styles.original}>
            {Math.round(pricePerKg(product.originalPrice as number, product.weightStepKg)).toLocaleString('en-US')}
          </AppText>
        )}
      </View>
      {rating > 0 && (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color={colors.warning} />
          <AppText muted style={styles.rating}>
            {rating.toFixed(1)}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

export const RailProductCard = memo(RailCardBase);

// النسخة المتصلة بالمفضلة والسلة
export function ConnectedRailCard({ product, width, boxed }: { product: ProductSummary; width: number; boxed?: boolean }) {
  const { isWishlisted, toggle, quickAdd, addingId } = useProductActions();
  return (
    <RailProductCard
      product={product}
      width={width}
      boxed={boxed}
      wishlisted={isWishlisted(product.id)}
      onToggleWishlist={toggle}
      onAdd={quickAdd}
      adding={addingId === product.id}
    />
  );
}

const styles = createStyles(() => ({
  boxed: { backgroundColor: colors.white, borderRadius: radius.xl, padding: 8 },
  media: { aspectRatio: 1, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: brand.surfaceMuted },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discount: { position: 'absolute', top: 8, start: 8, backgroundColor: colors.error, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { color: colors.white, fontSize: 10, lineHeight: 14 },
  heart: {
    position: 'absolute',
    top: 8,
    end: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  plus: {
    position: 'absolute',
    bottom: 8,
    end: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  closed: { position: 'absolute', bottom: 8, start: 8, backgroundColor: 'rgba(17,24,39,0.8)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  closedText: { color: colors.white, fontSize: 10, lineHeight: 14 },
  name: { marginTop: 8, fontSize: 13, lineHeight: 19, minHeight: 38 },
  priceRow: { marginTop: 4, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6 },
  price: { fontSize: 14 },
  original: { fontSize: 11, color: colors.placeholder, textDecorationLine: 'line-through' },
  ratingRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: 12 },
}));
