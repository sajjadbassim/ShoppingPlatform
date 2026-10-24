import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getImageUrl, IMG_SIZE, type StoreListItem } from '@wasit/shared';
import { AppText, colors, createStyles, tc, useTheme } from '@wasit/ui';
import { useProducts } from '../api/useCatalog';

// بطاقات المتاجر منقولة من StoreCards.jsx (الويب): «متجر مميز» وبطاقة المتجر العادية

const STORE_ICONS = ['🏪', '🛍️', '📦', '🎁', '🛒', '💼'];
// تدرجات للأغلفة المفقودة
const COVER_GRADIENTS: [string, string][] = [
  ['#6366F1', '#9333EA'],
  ['#F43F5E', '#FB923C'],
  ['#10B981', '#0D9488'],
  ['#0EA5E9', '#2563EB'],
  ['#F59E0B', '#EA580C'],
];

const openStore = (id: string) => router.push({ pathname: '/store/[id]', params: { id } });

function StoreLogo({ store, index, size }: { store: StoreListItem; index: number; size: number }) {
  useTheme();
  const logo = getImageUrl(store.logoUrl, IMG_SIZE.THUMB);
  return (
    <View style={[styles.logo, { width: size, height: size }]}>
      {logo ? (
        <Image source={{ uri: logo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <AppText style={{ fontSize: 24 }}>{STORE_ICONS[index % STORE_ICONS.length]}</AppText>
      )}
    </View>
  );
}

// الغلاف وتدرّج داكن من الأسفل يحمل الشعار والاسم والعنوان
function StoreCover({ store, index, height, logoSize, titleSize, featured }: {
  store: StoreListItem;
  index: number;
  height: number;
  logoSize: number;
  titleSize: number;
  featured?: boolean;
}) {
  useTheme();
  const cover = getImageUrl(store.coverImageUrl, IMG_SIZE.CARD);
  return (
    <LinearGradient colors={COVER_GRADIENTS[index % COVER_GRADIENTS.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height }}>
      {cover && <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />}
      <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']} style={StyleSheet.absoluteFill} />
      {store.isOpenNow === false && (
        <View style={[styles.closed, { top: featured ? 12 : 8, end: featured ? 12 : 8 }]}>
          <AppText weight="bold" style={styles.closedText}>
            مغلق الآن
          </AppText>
        </View>
      )}
      {featured && (
        <View style={styles.featuredBadge}>
          <Ionicons name="sparkles" size={13} color={tc("#451A03")} />
          <AppText weight="bold" style={styles.featuredBadgeText}>
            متجر مميز
          </AppText>
        </View>
      )}
      <View style={[styles.coverFoot, { padding: featured ? 16 : 12 }]}>
        <StoreLogo store={store} index={index} size={logoSize} />
        <View style={{ flex: 1, paddingBottom: 2 }}>
          <AppText weight="bold" numberOfLines={1} style={[styles.coverTitle, { fontSize: titleSize }]}>
            {store.nameAr || store.name}
          </AppText>
          {!!store.address && (
            <View style={styles.inline}>
              <Ionicons name="location-outline" size={featured ? 12 : 11} color="rgba(255,255,255,0.85)" />
              <AppText numberOfLines={1} style={[styles.address, { fontSize: featured ? 12 : 11 }]}>
                {store.address}
              </AppText>
            </View>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

function Chip({ icon, text, tone = 'gray' }: { icon: React.ReactNode; text: string; tone?: 'gray' | 'yellow' | 'green' }) {
  useTheme();
  const palette = { gray: [tc('#F3F4F6'), tc('#374151')], yellow: [tc('#FEFCE8'), tc('#854D0E')], green: [tc('#DCFCE7'), tc('#15803D')] }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: palette[0] }]}>
      {icon}
      <AppText weight={tone === 'gray' ? 'regular' : 'bold'} style={[styles.chipText, { color: palette[1] }]}>
        {text}
      </AppText>
    </View>
  );
}

function StoreStats({ store }: { store: StoreListItem }) {
  useTheme();
  const free = !(store.deliveryFee && store.deliveryFee > 0);
  return (
    <View style={styles.stats}>
      {!!store.ratingsCount && store.ratingsCount > 0 && (
        <Chip
          tone="yellow"
          icon={<Ionicons name="star" size={12} color={tc("#EAB308")} />}
          text={`${Number(store.rating ?? 0).toFixed(1)} (${store.ratingsCount})`}
        />
      )}
      {store.productsCount != null && (
        <Chip icon={<Ionicons name="cube-outline" size={12} color={colors.primary} />} text={`${store.productsCount} منتج`} />
      )}
      {store.estimatedPrepTime != null && (
        <Chip icon={<Ionicons name="time-outline" size={12} color={colors.primary} />} text={`${store.estimatedPrepTime} د`} />
      )}
      <Chip
        tone={free ? 'green' : 'gray'}
        icon={<MaterialCommunityIcons name="truck-outline" size={12} color={free ? tc('#15803D') : colors.primary} />}
        text={free ? 'توصيل مجاني' : `${Number(store.deliveryFee).toLocaleString('en-US')} د.ع`}
      />
    </View>
  );
}

// معاينة 4 من منتجات المتجر، والأخيرة عليها عدد الباقي
function ProductsPreview({ storeId, size }: { storeId: string; size: number }) {
  useTheme();
  const query = useMemo(() => ({ vendorId: storeId, pageSize: 8 }), [storeId]);
  const { data, isLoading } = useProducts(query);
  const page = data?.pages[0];
  const withImages = (page?.items ?? []).filter((p) => p.primaryImageUrl);
  const shown = withImages.slice(0, 4);
  const more = Math.max(0, (page?.pagination.totalCount ?? withImages.length) - shown.length);

  if (isLoading) {
    return (
      <View style={styles.preview}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.previewTile, { height: size }]} />
        ))}
      </View>
    );
  }
  if (shown.length === 0) return null;

  return (
    <View style={styles.preview}>
      {shown.map((p, i) => (
        <View key={p.id} style={[styles.previewTile, { height: size }]}>
          <Image source={{ uri: getImageUrl(p.primaryImageUrl, IMG_SIZE.THUMB) ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
          {i === shown.length - 1 && more > 0 && (
            <View style={styles.moreOverlay}>
              <AppText weight="bold" style={styles.moreText}>
                +{more}
              </AppText>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// المتجر المميز (الأول في الترتيب الحالي)
export function FeaturedStore({ store }: { store: StoreListItem }) {
  useTheme();
  return (
    <Pressable style={styles.card} onPress={() => openStore(store.id)}>
      <StoreCover store={store} index={0} height={176} logoSize={64} titleSize={18} featured />
      <View style={{ padding: 16 }}>
        {!!store.description && (
          <AppText numberOfLines={2} style={styles.description}>
            {store.description}
          </AppText>
        )}
        <StoreStats store={store} />
        <AppText weight="bold" muted style={styles.previewLabel}>
          من منتجات المتجر
        </AppText>
        <ProductsPreview storeId={store.id} size={80} />
        <View style={styles.visitButton}>
          <AppText weight="bold" style={styles.visitButtonText}>
            زيارة المتجر
          </AppText>
          <Ionicons name="arrow-back" size={16} color={colors.white} />
        </View>
      </View>
    </Pressable>
  );
}

export function StoreCard({ store, index }: { store: StoreListItem; index: number }) {
  useTheme();
  return (
    <Pressable style={styles.card} onPress={() => openStore(store.id)}>
      <StoreCover store={store} index={index} height={128} logoSize={48} titleSize={16} />
      <View style={{ padding: 12, gap: 12 }}>
        <ProductsPreview storeId={store.id} size={64} />
        <StoreStats store={store} />
        <View style={styles.cardFoot}>
          {store.minOrderAmount && store.minOrderAmount > 0 ? (
            <AppText muted style={{ fontSize: 11 }}>
              أقل طلب {Number(store.minOrderAmount).toLocaleString('en-US')} د.ع
            </AppText>
          ) : (
            <View />
          )}
          <View style={styles.inline}>
            <AppText weight="bold" style={{ color: colors.primary, fontSize: 14 }}>
              زيارة المتجر
            </AppText>
            <Ionicons name="arrow-back" size={15} color={colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = createStyles(() => ({
  card: { backgroundColor: colors.white, borderRadius: 24, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  logo: {
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.white,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  coverFoot: { position: 'absolute', start: 0, end: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  coverTitle: { color: colors.white, lineHeight: 26, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4 },
  address: { color: 'rgba(255,255,255,0.85)', flexShrink: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closed: { position: 'absolute', backgroundColor: 'rgba(17,24,39,0.85)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  closedText: { color: colors.white, fontSize: 11 },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    start: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FBBF24',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    elevation: 2,
  },
  featuredBadgeText: { color: '#451A03', fontSize: 12 },
  description: { fontSize: 14, lineHeight: 22, color: '#4B5563', marginBottom: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12 },
  previewLabel: { fontSize: 12, marginTop: 16, marginBottom: 8 },
  preview: { flexDirection: 'row', gap: 6 },
  previewTile: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  moreOverlay: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  moreText: { color: colors.white, fontSize: 14 },
  visitButton: { marginTop: 16, height: 44, borderRadius: 999, backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  visitButtonText: { color: colors.white, fontSize: 14 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
}));
