import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_ENDPOINTS, API_URL, fetchStoreFeed, getImageUrl, IMG_SIZE, refreshStoreFeed, type ProductSummary, type VendorDetails, formatMonthYear } from '@wasit/shared';
import { AppText, Button, colors, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { useProducts, useVendor } from '../../api/useCatalog';
import { AppHeader } from '../../components/AppHeader';
import { ConnectedProductCard } from '../../components/ProductCard';
import { StoreHours } from '../../components/StoreHours';
import { StoreSocialTab } from '../../components/StoreSocialTab';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const money = (n: number) => `${Math.round(n).toLocaleString('en-US')} د.ع`;

function Chip({ icon, text }: { icon: IconName | 'dollar'; text: string }) {
  useTheme();
  return (
    <View style={styles.chip}>
      {icon === 'dollar' ? (
        <MaterialCommunityIcons name="currency-usd" size={15} color={colors.primary} />
      ) : (
        <Ionicons name={icon} size={15} color={colors.primary} />
      )}
      <AppText style={styles.chipText}>{text}</AppText>
    </View>
  );
}

function InfoTile({ icon, label, value, ltr }: { icon: IconName; label: string; value: string; ltr?: boolean }) {
  useTheme();
  return (
    <View style={styles.infoTile}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <AppText style={styles.infoLabel}>{label}</AppText>
        <AppText weight="medium" style={[styles.infoValue, ltr && { textAlign: 'right', writingDirection: 'ltr' }]}>
          {value}
        </AppText>
      </View>
    </View>
  );
}

function StoreHeader({ vendor }: { vendor: VendorDetails }) {
  useTheme();
  const cover = getImageUrl(vendor.coverImageUrl, IMG_SIZE.FULL);
  const logo = getImageUrl(vendor.logoUrl, IMG_SIZE.THUMB);
  const closed = vendor.isOpenNow === false;
  const name = vendor.nameAr || vendor.name;
  const description = vendor.description && !vendor.description.includes('?') ? vendor.description : '';
  const rating = Number(vendor.rating ?? 0);
  const ratingsCount = vendor.ratingsCount ?? 0;

  return (
    <View>
      <View style={styles.cover}>
        {cover && <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
      </View>

      <View style={styles.card}>
        <View style={styles.logoBox}>
          {logo ? <Image source={{ uri: logo }} style={styles.logo} contentFit="cover" /> : <AppText style={{ fontSize: 44 }}>🏪</AppText>}
        </View>

        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText weight="bold" style={styles.name}>
              {name}
            </AppText>
            {closed && !!vendor.openStatus && (
              <View style={styles.closed}>
                <AppText weight="bold" style={styles.closedText}>
                  {vendor.openStatus}
                </AppText>
              </View>
            )}
            {ratingsCount > 0 ? (
              <View style={styles.ratingRow}>
                <View style={{ flexDirection: 'row' }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Ionicons key={i} name="star" size={16} color={i <= Math.round(rating) ? tc('#FACC15') : tc('#D1D5DB')} />
                  ))}
                </View>
                <AppText weight="bold" style={{ fontSize: 14 }}>
                  {rating.toFixed(1)}
                </AppText>
                <AppText muted style={{ fontSize: 14 }}>
                  ({ratingsCount} {ratingsCount === 1 ? 'تقييم' : 'تقييمات'})
                </AppText>
              </View>
            ) : (
              <View style={styles.ratingRow}>
                <Ionicons name="star-outline" size={14} color={colors.placeholder} />
                <AppText style={{ fontSize: 14, color: colors.placeholder }}>لا توجد تقييمات بعد</AppText>
              </View>
            )}
            {!!vendor.phone && <AppText muted style={styles.phone}>{vendor.phone}</AppText>}
          </View>
          <Pressable
            style={styles.share}
            onPress={() => Share.share({ title: name, message: `${name}\n${API_URL}${API_ENDPOINTS.SHARE.STORE(vendor.id)}` }).catch(() => {})}
            accessibilityLabel="مشاركة"
          >
            <Ionicons name="share-social-outline" size={15} color={tc("#4B5563")} />
            <AppText weight="medium" style={styles.shareText}>
              مشاركة
            </AppText>
          </Pressable>
        </View>

        <View style={styles.chips}>
          {!!vendor.address && <Chip icon="location-outline" text={vendor.address} />}
          {!!vendor.estimatedPrepTime && <Chip icon="time-outline" text={`${vendor.estimatedPrepTime} دقيقة تحضير`} />}
          {!!vendor.deliveryFee && vendor.deliveryFee > 0 && <Chip icon="dollar" text={`${money(vendor.deliveryFee)} توصيل`} />}
          {!!vendor.minOrderAmount && vendor.minOrderAmount > 0 && <Chip icon="cube-outline" text={`حد أدنى ${money(vendor.minOrderAmount)}`} />}
        </View>

        {!!description && <AppText style={styles.description}>{description}</AppText>}

        {!!vendor.workingHours?.length && (
          <View style={styles.hours}>
            <StoreHours hours={vendor.workingHours} />
          </View>
        )}

        <View style={styles.policies}>
          {[
            ['🚚', 'توصيل سريع'],
            ['↩️', 'إرجاع خلال 14 يوم'],
            ['🛡️', 'منتجات أصلية'],
          ].map(([icon, text]) => (
            <View key={text} style={styles.policy}>
              <AppText>{icon}</AppText>
              <AppText style={styles.policyText}>{text}</AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function AboutTab({ vendor }: { vendor: VendorDetails }) {
  useTheme();
  const description = vendor.description && !vendor.description.includes('?') ? vendor.description : '';
  return (
    <View style={{ gap: 20 }}>
      {!!description && (
        <View>
          <AppText weight="bold" style={styles.aboutTitle}>
            عن المتجر
          </AppText>
          <AppText style={styles.description}>{description}</AppText>
        </View>
      )}
      <View>
        <AppText weight="bold" style={[styles.aboutTitle, { marginBottom: 12 }]}>
          معلومات المتجر
        </AppText>
        <View style={{ gap: 12 }}>
          {!!vendor.phone && <InfoTile icon="call-outline" label="الهاتف" value={vendor.phone} ltr />}
          {!!vendor.address && <InfoTile icon="location-outline" label="العنوان" value={vendor.address} />}
          {!!vendor.deliveryFee && vendor.deliveryFee > 0 && <InfoTile icon="car-outline" label="رسوم التوصيل" value={money(vendor.deliveryFee)} />}
          {!!vendor.minOrderAmount && vendor.minOrderAmount > 0 && <InfoTile icon="cube-outline" label="الحد الأدنى للطلب" value={money(vendor.minOrderAmount)} />}
          {!!vendor.estimatedPrepTime && <InfoTile icon="time-outline" label="وقت التحضير" value={`${vendor.estimatedPrepTime} دقيقة`} />}
          {!!vendor.createdAt && (
            <InfoTile
              icon="calendar-outline"
              label="انضم للمنصة"
              value={formatMonthYear(vendor.createdAt)}
            />
          )}
        </View>
      </View>
    </View>
  );
}

export default function StoreScreen() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: vendor, isLoading, isError, refetch } = useVendor(id);
  const query = useMemo(() => ({ vendorId: id }), [id]);
  const { data, isLoading: productsLoading } = useProducts(query);
  const [tab, setTab] = useState<'products' | 'posts' | 'about'>('products');

  // منشورات حسابات التواصل: التبويب يظهر فقط إن وُجد محتوى. نحدّثها من المنصات عند فتح المتجر
  const queryClient = useQueryClient();
  const { data: feed } = useQuery({ queryKey: ['social-store-feed', id], queryFn: () => fetchStoreFeed(id), enabled: !!id, staleTime: 5 * 60 * 1000 });
  useEffect(() => {
    if (!id) return;
    refreshStoreFeed(id)
      .then((fresh) => queryClient.setQueryData(['social-store-feed', id], fresh))
      .catch(() => {});
  }, [id, queryClient]);
  const posts = feed?.items ?? [];
  const products = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const total = data?.pages[0]?.pagination.totalCount ?? products.length;

  if (isLoading) {
    return (
      <View style={styles.page}>
        <AppHeader back />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (isError || !vendor) {
    return (
      <View style={styles.page}>
        <AppHeader back />
        <View style={styles.center}>
          <AppText weight="bold" style={{ fontSize: 18 }}>
            المتجر غير موجود
          </AppText>
          <AppText muted style={{ marginTop: 4 }}>
            لم نتمكن من العثور على هذا المتجر
          </AppText>
          <Button title="إعادة المحاولة" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
          <Button title="تصفح المتاجر" variant="outline" onPress={() => router.replace('/stores')} style={{ marginTop: spacing.sm }} />
        </View>
      </View>
    );
  }

  const openProduct = (p: ProductSummary) => router.push({ pathname: '/product/[id]', params: { id: p.id } });
  const shown = products.slice(0, 8);

  return (
    <View style={styles.page}>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content}>
        <StoreHeader vendor={vendor} />

        <View style={styles.tabsCard}>
          <View style={styles.tabsBar}>
            {(
              [
                ['products', `المنتجات (${total})`],
                ...(posts.length > 0 ? ([['posts', `المنشورات (${posts.length})`]] as const) : []),
                ['about', 'عن المتجر'],
              ] as const
            ).map(([key, label]) => (
              <Pressable key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
                <AppText weight={tab === key ? 'bold' : 'medium'} style={[styles.tabText, tab === key && { color: colors.primary }]}>
                  {label}
                </AppText>
              </Pressable>
            ))}
          </View>

          <View style={styles.tabBody}>
            {tab === 'about' ? (
              <AboutTab vendor={vendor} />
            ) : tab === 'posts' ? (
              <StoreSocialTab items={posts} vendorId={id} />
            ) : productsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ margin: spacing.lg }} />
            ) : shown.length === 0 ? (
              <View style={styles.empty}>
                <AppText weight="bold" style={{ fontSize: 16 }}>
                  لا توجد منتجات
                </AppText>
                <AppText muted>هذا المتجر لم يضف منتجات بعد</AppText>
              </View>
            ) : (
              <>
                <View style={styles.grid}>
                  {shown.map((p) => (
                    <View key={p.id} style={styles.cell}>
                      <ConnectedProductCard product={p} width="100%" addButton="wide" onPress={openProduct} />
                    </View>
                  ))}
                </View>
                {total > 8 && (
                  <Pressable style={styles.all} onPress={() => router.push({ pathname: '/products', params: { vendorId: id } })}>
                    <Ionicons name="chevron-back" size={18} color={colors.primary} />
                    <AppText weight="medium" style={styles.allText}>
                      عرض جميع المنتجات ({total})
                    </AppText>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { paddingBottom: spacing.xl },
  cover: { height: 192, backgroundColor: '#A5B4FC' },
  card: { marginHorizontal: spacing.md, marginTop: -80, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 20 },
  logoBox: { width: 96, height: 96, borderRadius: 16, backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.surface, marginTop: -64, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  logo: { width: '100%', height: '100%' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 16 },
  name: { fontSize: 24, lineHeight: 34 },
  closed: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: '#FEF2F2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  closedText: { color: '#B91C1C', fontSize: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  phone: { fontSize: 14, marginTop: 4, textAlign: 'left', writingDirection: 'ltr', alignSelf: 'flex-start' },
  share: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 32 },
  shareText: { fontSize: 14, color: '#4B5563' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  hours: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  chipText: { fontSize: 14, color: '#4B5563', flexShrink: 1 },
  description: { color: '#4B5563', fontSize: 15, lineHeight: 24, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  policies: { gap: 12, marginTop: 16 },
  policy: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.background, borderRadius: 8, padding: 12 },
  policyText: { fontSize: 14, color: '#4B5563' },
  tabsCard: { marginHorizontal: spacing.md, marginTop: 24, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tabsBar: { flexDirection: 'row', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, color: colors.textMuted },
  tabBody: { padding: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  cell: { width: '50%', padding: 4 },
  empty: { alignItems: 'center', gap: 4, padding: spacing.lg },
  all: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 16, height: 44, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1.5, borderColor: colors.primary },
  allText: { color: colors.primary, fontSize: 15 },
  aboutTitle: { fontSize: 16 },
  infoTile: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.background, borderRadius: 8, padding: 12 },
  infoLabel: { fontSize: 12, color: colors.placeholder },
  infoValue: { fontSize: 15 },
}));
