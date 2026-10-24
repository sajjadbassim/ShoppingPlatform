import { useEffect, useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  formatCountdown,
  getImageUrl,
  IMG_SIZE,
  msUntil,
  sectionTarget,
  splitBannerBlock,
  type Banner,
  type HomeSection,
  type ProductSummary,
  type VendorSummary,
} from '@wasit/shared';
import { AppText, colors, radius, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { ConnectedRailCard } from './RailProductCard';
import { comingSoonToast } from '../lib/toast';

// أقسام الصفحة الرئيسية منقولة من HomePage.jsx (الويب) بنفس الترتيب والأشكال

export const comingSoon = (_name: string) => comingSoonToast();

const GUTTER = spacing.md;

// عرض بطاقة الصف: 38% من الشاشة وبحد أدنى 140 (كما في الويب)
export const useRailCardWidth = () => {
  const { width } = useWindowDimensions();
  return Math.max(140, Math.round(width * 0.38));
};

// وجهة البانر حسب نوع الرابط (منتج، قسم، متجر). الروابط الخارجية لا تُفتح بعد
export const openBanner = (b: Banner) => {
  const id = b.linkEntityId;
  if (b.linkType === 'product' && id) router.push({ pathname: '/product/[id]', params: { id } });
  else if (b.linkType === 'category' && id) router.push({ pathname: '/products', params: { categoryId: id } });
  else if (b.linkType === 'vendor' && id) router.push({ pathname: '/store/[id]', params: { id } });
  else router.push('/products');
};

const openSection = (section: HomeSection) => {
  const target = sectionTarget(section);
  if (target.kind === 'section') router.push({ pathname: '/products', params: { section: target.sectionId } });
  else if (target.kind === 'store') router.push({ pathname: '/store/[id]', params: { id: target.vendorId } });
  else router.push({ pathname: '/products', params: target.params });
};

const titleOf = (s: HomeSection) => s.titleAr || s.title;
const subtitleOf = (s: HomeSection) => s.subtitleAr || s.subtitle;

// ===== رؤوس الأقسام =====

function SectionHeader({ title, subtitle, onMore, moreLabel = 'عرض المزيد', icon }: {
  title: string;
  subtitle?: string | null;
  onMore?: () => void;
  moreLabel?: string;
  icon?: ReactNode;
}) {
  useTheme();
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <View style={styles.headerTitleRow}>
          {icon}
          <AppText weight="bold" style={styles.headerTitle}>
            {title}
          </AppText>
        </View>
        {!!subtitle && (
          <AppText muted style={styles.headerSub}>
            {subtitle}
          </AppText>
        )}
      </View>
      {!!onMore && (
        <Pressable
          onPress={onMore}
          hitSlop={8}
          style={({ pressed }) => [styles.moreButton, pressed && styles.morePressed]}
        >
          <AppText weight="medium" style={styles.more}>
            {moreLabel}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

// رأس بصورة بانر: العنوان والوصف وزر «عرض المزيد» فوق الصورة، والبطاقات تتداخل مع أسفلها
function BannerSectionHeader({ image, title, subtitle, onMore }: { image: string; title: string; subtitle?: string | null; onMore: () => void }) {
  useTheme();
  return (
    <View style={styles.bannerHeader}>
      <Image source={{ uri: getImageUrl(image, IMG_SIZE.FULL) ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      {/* تدرّج من جهة النص (البداية) ليبقى العنوان مقروءاً على أي صورة */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.15)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bannerHeaderText}>
        <AppText weight="bold" style={styles.bannerHeaderTitle}>
          {title}
        </AppText>
        {!!subtitle && (
          <AppText numberOfLines={2} style={styles.bannerHeaderSub}>
            {subtitle}
          </AppText>
        )}
        <Pressable
          onPress={onMore}
          style={({ pressed }) => [styles.bannerHeaderButton, pressed && { transform: [{ scale: 0.94 }], opacity: 0.85 }]}
        >
          <AppText weight="medium" style={styles.bannerHeaderButtonText}>
            عرض المزيد
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

// ===== صف المنتجات =====

export function ProductRail({ products, boxed, overlap }: { products: ProductSummary[]; boxed?: boolean; overlap?: boolean }) {
  useTheme();
  const cardWidth = useRailCardWidth();
  return (
    <FlatList
      data={products}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(p) => p.id}
      style={overlap ? styles.overlap : undefined}
      contentContainerStyle={{ paddingHorizontal: boxed ? 0 : GUTTER, gap: 12 }}
      renderItem={({ item }) => <ConnectedRailCard product={item} width={cardWidth} boxed={boxed} />}
    />
  );
}

export function ProductSectionBlock({ section }: { section: HomeSection }) {
  useTheme();
  const products = (section.data ?? []) as ProductSummary[];
  if (products.length === 0) return null;
  const more = () => openSection(section);

  return (
    <View style={styles.section}>
      {section.bannerImageUrl ? (
        <BannerSectionHeader image={section.bannerImageUrl} title={titleOf(section)} subtitle={subtitleOf(section)} onMore={more} />
      ) : (
        <SectionHeader title={titleOf(section)} subtitle={subtitleOf(section)} onMore={more} />
      )}
      <ProductRail products={products} overlap={!!section.bannerImageUrl} />
    </View>
  );
}

// ===== العروض المحدودة: صندوق أحمر بعدّاد تنازلي، ويختفي عند انتهاء الوقت =====

export function FlashDealsBlock({ section }: { section: HomeSection }) {
  useTheme();
  const [left, setLeft] = useState(() => msUntil(section.endsAt));
  useEffect(() => {
    if (!section.endsAt) return;
    const t = setInterval(() => setLeft(msUntil(section.endsAt)), 1000);
    return () => clearInterval(t);
  }, [section.endsAt]);

  const products = (section.data ?? []) as ProductSummary[];
  if (products.length === 0 || left <= 0) return null;

  return (
    <View style={[styles.section, { paddingHorizontal: GUTTER }]}>
      <LinearGradient colors={[tc('#E11D48'), tc('#EF4444'), tc('#F97316')]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={styles.flash}>
        <View style={styles.flashHead}>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="flash" size={20} color={colors.white} />
              <AppText weight="bold" style={[styles.headerTitle, { color: colors.white }]}>
                {titleOf(section)}
              </AppText>
            </View>
            {!!subtitleOf(section) && (
              <AppText numberOfLines={1} style={styles.flashSub}>
                {subtitleOf(section)}
              </AppText>
            )}
          </View>
          <View style={styles.flashTimer}>
            <AppText style={styles.flashTimerLabel}>ينتهي خلال</AppText>
            <AppText weight="bold" style={styles.flashTimerValue}>
              {formatCountdown(left)}
            </AppText>
          </View>
        </View>
        <ProductRail products={products} boxed />
      </LinearGradient>
    </View>
  );
}

// ===== بلوك البانرات: عريض ثم شبكة عمودين =====

export function BannerBlock({ section }: { section: HomeSection }) {
  useTheme();
  const banners = ((section.data ?? []) as Banner[]).filter((b) => b.imageUrl);
  if (banners.length === 0) return null;
  const { wide, grid } = splitBannerBlock(banners);

  const tile = (b: Banner, isWide: boolean) => (
    <Pressable key={b.id} onPress={() => openBanner(b)} style={[styles.tile, isWide ? styles.tileWide : styles.tileSquare]}>
      <Image source={{ uri: getImageUrl(b.imageUrl, isWide ? IMG_SIZE.FULL : IMG_SIZE.CARD) ?? undefined }} style={styles.tileImage} contentFit="cover" transition={150} />
    </Pressable>
  );

  return (
    <View style={[styles.section, { paddingHorizontal: GUTTER, gap: 12 }]}>
      {wide && tile(wide, true)}
      {grid.length > 0 && <View style={styles.tileGrid}>{grid.map((b) => tile(b, false))}</View>}
    </View>
  );
}

// ===== المتاجر المميزة =====

function StoreCardMini({ vendor, width }: { vendor: VendorSummary; width: number }) {
  useTheme();
  const logo = getImageUrl(vendor.logoUrl, IMG_SIZE.THUMB);
  const cover = getImageUrl(vendor.coverImageUrl, IMG_SIZE.CARD);
  const rating = vendor.rating ? Number(vendor.rating).toFixed(1) : null;

  return (
    <Pressable style={[styles.store, { width }]} onPress={() => router.push({ pathname: '/store/[id]', params: { id: vendor.id } })}>
      <LinearGradient colors={['rgba(79,70,229,0.2)', 'rgba(79,70,229,0.4)']} style={styles.storeCover}>
        {cover && <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />}
        <View style={styles.storeLogo}>
          {logo ? (
            <Image source={{ uri: logo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <Ionicons name="storefront-outline" size={22} color={colors.placeholder} />
          )}
        </View>
      </LinearGradient>
      <View style={styles.storeBody}>
        <AppText weight="bold" numberOfLines={1} style={{ fontSize: 14 }}>
          {vendor.nameAr || vendor.name}
        </AppText>
        <View style={styles.storeMeta}>
          {rating && (
            <View style={styles.inline}>
              <Ionicons name="star" size={12} color={colors.warning} />
              <AppText weight="medium" style={styles.metaStrong}>
                {rating}
              </AppText>
              {!!vendor.ratingsCount && <AppText style={styles.metaFaint}>({vendor.ratingsCount})</AppText>}
            </View>
          )}
          {vendor.estimatedPrepTime != null && (
            <View style={styles.inline}>
              <Ionicons name="time-outline" size={12} color={colors.textMuted} />
              <AppText muted style={styles.meta}>
                {vendor.estimatedPrepTime} د
              </AppText>
            </View>
          )}
        </View>
        <View style={[styles.inline, { marginTop: 4 }]}>
          <MaterialCommunityIcons name="truck-outline" size={13} color={colors.textMuted} />
          <AppText muted style={styles.meta}>
            {vendor.deliveryFee && vendor.deliveryFee > 0
              ? `توصيل ${Number(vendor.deliveryFee).toLocaleString('en-US')} د.ع`
              : 'توصيل مجاني'}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

export function VendorsBlock({ section }: { section: HomeSection }) {
  useTheme();
  const { width } = useWindowDimensions();
  const vendors = (section.data ?? []) as VendorSummary[];
  if (vendors.length === 0) return null;
  const cardWidth = Math.min(260, Math.max(210, Math.round(width * 0.62)));

  return (
    <View style={styles.section}>
      <SectionHeader title={titleOf(section)} subtitle={subtitleOf(section)} onMore={() => router.push({ pathname: '/stores', params: { section: section.id } })} />
      <FlatList
        data={vendors}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 12, paddingBottom: 4 }}
        renderItem={({ item }) => <StoreCardMini vendor={item} width={cardWidth} />}
      />
    </View>
  );
}

// ===== اشترِ مجدداً =====

export function BuyAgainBlock({ products }: { products: ProductSummary[] }) {
  useTheme();
  if (products.length < 2) return null;
  return (
    <View style={styles.section}>
      <SectionHeader
        title="اشترِ مجدداً"
        subtitle="منتجات طلبتها سابقاً — أضفها بضغطة"
        icon={<Ionicons name="refresh" size={18} color={colors.primary} />}
        moreLabel="طلباتي"
        onMore={() => router.push('/orders')}
      />
      <ProductRail products={products} />
    </View>
  );
}

// ===== نهاية الصفحة: بطاقتا النقاط والمتاجر، المزايا، المساعدة =====

export function PromoTiles() {
  useTheme();
  return (
    <View style={styles.promoRow}>
      <Pressable style={styles.promoTile} onPress={() => router.push('/loyalty')}>
        <LinearGradient colors={[tc('#FCD34D'), tc('#F59E0B')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.promoFill}>
          <Ionicons name="star" size={80} color="rgba(255,255,255,0.4)" style={styles.promoIcon} />
          <AppText weight="bold" style={{ color: tc('#451A03'), fontSize: 15 }}>
            اكسب نقاط تشجيعية
          </AppText>
          <AppText style={styles.promoSubAmber}>مع كل طلب وكل تقييم، واستبدلها بخصومات</AppText>
        </LinearGradient>
      </Pressable>
      <Pressable style={styles.promoTile} onPress={() => router.push('/stores')}>
        <LinearGradient colors={[tc('#34D399'), tc('#0D9488')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.promoFill}>
          <Ionicons name="storefront-outline" size={80} color="rgba(255,255,255,0.25)" style={[styles.promoIcon, { transform: [{ rotate: '-12deg' }] }]} />
          <AppText weight="bold" style={{ color: colors.white, fontSize: 15 }}>
            تسوّق محلياً
          </AppText>
          <AppText style={styles.promoSubWhite}>متاجر من مدينتك بتوصيل سريع</AppText>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const FEATURES = [
  { icon: 'truck-outline', title: 'توصيل سريع', desc: 'خلال 24 ساعة' },
  { icon: 'shield-outline', title: 'ضمان الجودة', desc: 'منتجات أصلية' },
  { icon: 'headphones', title: 'دعم متواصل', desc: 'خدمة 24/7' },
] as const;

export function FeaturesStrip() {
  useTheme();
  return (
    <View style={styles.features}>
      {FEATURES.map((f) => (
        <View key={f.title} style={styles.feature}>
          <MaterialCommunityIcons name={f.icon} size={20} color={colors.primary} />
          <View style={{ flexShrink: 1 }}>
            <AppText weight="bold" numberOfLines={1} style={{ fontSize: 11 }}>
              {f.title}
            </AppText>
            <AppText muted numberOfLines={1} style={{ fontSize: 10 }}>
              {f.desc}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

export function HelpCard() {
  useTheme();
  const item = (icon: React.ComponentProps<typeof Ionicons>['name'], title: string, sub: string) => (
    <Pressable style={styles.helpItem} onPress={() => comingSoon(title)}>
      <View style={styles.helpIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText weight="bold" style={{ fontSize: 14 }}>
          {title}
        </AppText>
        <AppText muted numberOfLines={1} style={{ fontSize: 12 }}>
          {sub}
        </AppText>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.help}>
      <AppText weight="bold" style={{ fontSize: 16, marginBottom: 12 }}>
        تحتاج مساعدة؟
      </AppText>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {item('help-circle-outline', 'مركز المساعدة', 'الأسئلة الشائعة')}
        {item('chatbubble-outline', 'تواصل معنا', 'فريق الدعم')}
      </View>
    </View>
  );
}

const styles = createStyles(() => ({
  section: { paddingVertical: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, marginBottom: 12, gap: spacing.sm },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, lineHeight: 26 },
  headerSub: { fontSize: 12, marginTop: 2 },
  more: { color: colors.primary, fontSize: 14 },
  moreButton: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  morePressed: { backgroundColor: colors.primaryLight, transform: [{ scale: 0.94 }] },
  bannerHeader: { aspectRatio: 2.3, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  bannerHeaderText: { position: 'absolute', top: 0, bottom: 0, start: 0, width: '60%', justifyContent: 'center', gap: 6, padding: GUTTER, paddingBottom: 56 },
  bannerHeaderTitle: { color: colors.white, fontSize: 18, lineHeight: 26 },
  bannerHeaderSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  bannerHeaderButton: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  bannerHeaderButtonText: { color: colors.white, fontSize: 14 },
  overlap: { marginTop: -40 },
  flash: { borderRadius: radius.xl, padding: 12 },
  flashHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  flashSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  flashTimer: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 6 },
  flashTimerLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10 },
  flashTimerValue: { color: colors.white, fontSize: 16, fontVariant: ['tabular-nums'] },
  tile: { overflow: 'hidden', borderRadius: radius.xl, backgroundColor: '#F3F4F6' },
  tileWide: { aspectRatio: 2.15 },
  tileSquare: { flexBasis: '47%', flexGrow: 1, aspectRatio: 1 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileImage: { width: '100%', height: '100%' },
  store: { borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden', elevation: 1 },
  storeCover: { height: 96 },
  storeLogo: {
    position: 'absolute',
    bottom: -24,
    start: 12,
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.white,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  storeBody: { paddingTop: 32, paddingHorizontal: 12, paddingBottom: 12 },
  storeMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaStrong: { fontSize: 12, color: '#1F2937' },
  metaFaint: { fontSize: 12, color: colors.placeholder },
  meta: { fontSize: 12 },
  promoRow: { flexDirection: 'row', gap: 12, paddingHorizontal: GUTTER, paddingTop: 20 },
  promoTile: { flex: 1, borderRadius: radius.xl, overflow: 'hidden' },
  promoFill: { padding: GUTTER, minHeight: 110 },
  promoIcon: { position: 'absolute', bottom: -12, end: -12, transform: [{ rotate: '12deg' }] },
  promoSubAmber: { color: 'rgba(120,53,15,0.8)', fontSize: 12, marginTop: 4, maxWidth: '75%' },
  promoSubWhite: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4, maxWidth: '75%' },
  features: { flexDirection: 'row', gap: 8, marginTop: 8, paddingHorizontal: GUTTER, paddingVertical: 12, backgroundColor: colors.white, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  feature: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  help: { margin: GUTTER, marginTop: 24, padding: GUTTER, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  helpItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.xl, backgroundColor: colors.background },
  helpIcon: { width: 40, height: 40, borderRadius: radius.lg, backgroundColor: 'rgba(79,70,229,0.1)', alignItems: 'center', justifyContent: 'center' },
}));
