import { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { discountPercentOf, getImageUrl, IMG_SIZE, PRODUCT_SECTION_TYPES, useSessionStore, type ProductSummary } from '@wasit/shared';
import { AppText, brand, colors, radius, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { useWishlist } from '../api/useEngagement';
import { useHome } from '../api/useHome';
import { Bounce } from './Motion';

// منتجات مقترحة من نفس بيانات الرئيسية: مميزة بلا تكرار (حتى 10)
const useSuggestedProducts = (): ProductSummary[] => {
  const { data } = useHome('general');
  return useMemo(() => {
    const seen = new Set<string>();
    return (data?.sections ?? [])
      .filter((s) => s.isActive !== false && PRODUCT_SECTION_TYPES.includes(s.type))
      .flatMap((s) => (s.data ?? []) as ProductSummary[])
      .filter((p) => p?.id && p.price != null && !seen.has(p.id) && !!seen.add(p.id))
      .slice(0, 10);
  }, [data]);
};

function SuggestedTile({ product: p }: { product: ProductSummary }) {
  useTheme();
  const discount = discountPercentOf(p);
  return (
    <Pressable style={styles.tile} onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.id } })}>
      <View style={styles.tileMedia}>
        {!!p.primaryImageUrl && (
          <Image source={{ uri: getImageUrl(p.primaryImageUrl, IMG_SIZE.THUMB) ?? undefined }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        )}
        {discount > 0 && (
          <View style={styles.tileDiscount}>
            <AppText weight="bold" style={styles.tileDiscountText}>
              -{discount}%
            </AppText>
          </View>
        )}
      </View>
      <View style={{ padding: 10 }}>
        <AppText numberOfLines={2} style={styles.tileName}>
          {p.nameAr || p.name}
        </AppText>
        <AppText weight="bold" style={styles.tilePrice}>
          {p.price?.toLocaleString('en-US')} د.ع
        </AppText>
        {discount > 0 && <AppText style={styles.tileOriginal}>{p.originalPrice?.toLocaleString('en-US')} د.ع</AppText>}
      </View>
    </Pressable>
  );
}

// السلة الفارغة (EmptyCart في CartPage.jsx): الرسم بشارتين تقفزان، الرسالة، الأزرار، المفضلة، تلميح الدخول، «قد يعجبك»
export function EmptyCart() {
  useTheme();
  const signedIn = useSessionStore((s) => s.signedIn);
  const wishlistCount = useWishlist().data?.length ?? 0;
  const suggestions = useSuggestedProducts();

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.decorTop} />
        <View style={styles.decorBottom} />

        <View style={styles.art}>
          <View style={styles.ringOuter} />
          <View style={styles.ringInner}>
            <Ionicons name="cart-outline" size={46} color={colors.primary} />
          </View>
          <Bounce duration={2400} style={[styles.floatBadge, { top: -4, end: 0 }]}>
            <Ionicons name="pricetag-outline" size={16} color={tc("#F43F5E")} />
          </Bounce>
          <Bounce duration={3000} delay={400} style={[styles.floatBadge, { bottom: 4, start: -8 }]}>
            <Ionicons name="heart-outline" size={16} color={tc("#EC4899")} />
          </Bounce>
        </View>

        <AppText weight="bold" style={styles.title}>
          سلتك فارغة حالياً
        </AppText>
        <AppText muted style={styles.text}>
          أضف ما يعجبك من المنتجات وسيظهر هنا، ثم أكمل طلبك في أي وقت
        </AppText>

        <Pressable style={styles.shopButton} onPress={() => router.navigate('/products')}>
          <AppText weight="bold" style={styles.shopText}>
            ابدأ التسوق
          </AppText>
          <Ionicons name="bag-handle-outline" size={18} color={colors.white} />
        </Pressable>
        <Pressable style={styles.offersButton} onPress={() => router.navigate({ pathname: '/products', params: { offers: '1' } })}>
          <AppText weight="bold" style={styles.offersText}>
            تصفح العروض
          </AppText>
          <Ionicons name="pricetag-outline" size={18} color={tc("#E11D48")} />
        </Pressable>

        {wishlistCount > 0 && (
          <Pressable style={styles.wishPill} onPress={() => router.push('/wishlist')}>
            <Ionicons name="heart" size={15} color={tc("#BE185D")} />
            <AppText weight="medium" style={styles.wishText}>
              لديك {wishlistCount} {wishlistCount === 1 ? 'منتج' : 'منتجات'} في المفضلة
            </AppText>
            <Ionicons name="arrow-back" size={15} color={tc("#BE185D")} />
          </Pressable>
        )}
        {!signedIn && (
          <AppText muted style={styles.guest}>
            أضفت منتجات من قبل؟{' '}
            <AppText weight="bold" style={{ color: colors.primary }} onPress={() => router.push('/login')}>
              سجّل الدخول
            </AppText>{' '}
            لاسترجاع سلتك
          </AppText>
        )}
      </View>

      {suggestions.length > 0 && (
        <View>
          <View style={styles.sectionHead}>
            <AppText weight="bold" style={{ fontSize: 18 }}>
              قد يعجبك
            </AppText>
            <Pressable style={styles.inline} onPress={() => router.navigate('/products')} hitSlop={8}>
              <AppText weight="medium" style={{ color: colors.primary, fontSize: 14 }}>
                عرض الكل
              </AppText>
              <Ionicons name="arrow-back" size={15} color={colors.primary} />
            </Pressable>
          </View>
          <FlatList
            data={suggestions}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(p) => p.id}
            style={{ marginHorizontal: -spacing.md }}
            contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 12 }}
            renderItem={({ item }) => <SuggestedTile product={item} />}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: 32, paddingBottom: spacing.xl },
  card: { overflow: 'hidden', alignItems: 'center', backgroundColor: colors.white, borderRadius: 24, borderWidth: 1, borderColor: '#F3F4F6', paddingHorizontal: 24, paddingVertical: 40 },
  decorTop: { position: 'absolute', top: -64, start: -64, width: 192, height: 192, borderRadius: 96, backgroundColor: 'rgba(79,70,229,0.05)' },
  decorBottom: { position: 'absolute', bottom: -80, end: -40, width: 224, height: 224, borderRadius: 112, backgroundColor: 'rgba(244,63,94,0.05)' },
  art: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center' },
  ringOuter: { position: 'absolute', width: 128, height: 128, borderRadius: 64, backgroundColor: 'rgba(79,70,229,0.1)' },
  ringInner: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(79,70,229,0.15)', alignItems: 'center', justifyContent: 'center' },
  floatBadge: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  title: { fontSize: 22, marginTop: 24 },
  text: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24, maxWidth: 320 },
  shopButton: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 999, backgroundColor: colors.primary, elevation: 3, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 6 },
  shopText: { color: colors.white, fontSize: 16 },
  offersButton: { alignSelf: 'stretch', marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 999, borderWidth: 1, borderColor: '#FECDD3' },
  offersText: { color: '#E11D48', fontSize: 16 },
  wishPill: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FDF2F8' },
  wishText: { color: '#BE185D', fontSize: 14 },
  guest: { marginTop: 20, fontSize: 14, textAlign: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tile: { width: 160, backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' },
  tileMedia: { aspectRatio: 1, backgroundColor: brand.surfaceMuted },
  tileDiscount: { position: 'absolute', top: 8, start: 8, backgroundColor: '#F43F5E', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tileDiscountText: { color: colors.white, fontSize: 11, lineHeight: 15 },
  tileName: { fontSize: 14, color: '#1F2937', minHeight: 40 },
  tilePrice: { fontSize: 14, color: colors.primary, marginTop: 4 },
  tileOriginal: { fontSize: 11, color: colors.placeholder, textDecorationLine: 'line-through' },
}));
