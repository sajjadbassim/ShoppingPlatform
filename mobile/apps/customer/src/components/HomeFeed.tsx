import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { API_URL, getImageUrl, homeBarCategories, IMG_SIZE, visibleSections, type Category, type HomeSection, type HomePageKind } from '@wasit/shared';
import { AppText, Button, brand, colors, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { useBuyAgain, useHome } from '../api/useHome';
import { useAllCategories } from '../api/useCatalog';
import { HeroSlider } from '../components/HeroSlider';
import {
  BannerBlock,
  BuyAgainBlock,
  FeaturesStrip,
  FlashDealsBlock,
  HelpCard,
  openBanner,
  ProductSectionBlock,
  PromoTiles,
  VendorsBlock,
} from '../components/HomeSections';
import { SoftPing, Wiggle } from '../components/Motion';

const CIRCLE = 72;

const openCategory = (id: string) => router.push({ pathname: '/products', params: { categoryId: id } });

// شريط الفئات الدائري (كما في الويب): العروض (تهتز وتنبض)، السوبرماركت، الفئات الرئيسية، «عرض الكل»
function CategoryBar({ page }: { page: HomePageKind }) {
  useTheme();
  const grocery = page === 'grocery';
  const { data, isLoading } = useAllCategories();
  const categories = useMemo(() => {
    if (!grocery) return homeBarCategories(data ?? []);
    // السوبرماركت: الفئات الفرعية لأقسامه إن وُجدت، وإلا أقسامه الرئيسية (كما في HomePage.jsx)
    const isGroceryCat = (c: Category) => c.section === 'grocery' || !!c.isGrocery;
    const withProducts = (data ?? []).filter((c) => (c.productsCount ?? 0) > 0);
    const roots = withProducts.filter((c) => !c.parentId && isGroceryCat(c));
    const children = withProducts.filter((c) => roots.some((r) => r.id === c.parentId));
    return children.length > 0 ? children : roots;
  }, [data, grocery]);
  const scope = grocery ? { scope: 'grocery' } : {};

  const header = (
    <View style={styles.barHead}>
      <Pressable style={styles.barItem} onPress={() => router.push({ pathname: '/products', params: { offers: '1', ...scope } })}>
        <LinearGradient colors={[tc('#F43F5E'), tc('#EF4444'), tc('#FB923C')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.circle, styles.offerShadow]}>
          <View style={styles.circleDecor} />
          <View style={styles.offerInner}>
            <SoftPing style={styles.offerPing} />
            <Wiggle>
              <MaterialCommunityIcons name="brightness-percent" size={26} color={colors.white} />
            </Wiggle>
          </View>
        </LinearGradient>
        <AppText weight="bold" style={[styles.barLabel, { color: tc('#E11D48') }]}>
          العروض
        </AppText>
      </Pressable>
      {!grocery && (
      <Pressable style={styles.barItem} onPress={() => router.push('/supermarket')}>
        <LinearGradient colors={[tc('#34D399'), tc('#0D9488')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.circle, styles.groceryShadow]}>
          <View style={styles.circleDecor} />
          <MaterialCommunityIcons name="basket-outline" size={30} color={colors.white} />
        </LinearGradient>
        <AppText weight="bold" style={[styles.barLabel, { color: tc('#059669') }]}>
          السوبرماركت
        </AppText>
      </Pressable>
      )}
    </View>
  );

  const footer = (
    <Pressable style={styles.barItem} onPress={() => (grocery ? router.push({ pathname: '/products', params: { scope: 'grocery' } }) : router.navigate('/categories'))}>
      <View style={[styles.circle, { backgroundColor: 'rgba(79,70,229,0.1)' }]}>
        <Ionicons name="grid" size={26} color={colors.primary} />
      </View>
      <AppText weight="bold" style={[styles.barLabel, { color: colors.primary }]}>
        {grocery ? 'كل المنتجات' : 'عرض الكل'}
      </AppText>
    </Pressable>
  );

  return (
    <FlatList
      data={isLoading ? [] : categories}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.bar}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      renderItem={({ item }: { item: Category }) => {
        const icon = getImageUrl(item.iconUrl, IMG_SIZE.THUMB);
        return (
          <Pressable style={styles.barItem} onPress={() => openCategory(item.id)}>
            <View style={[styles.circle, { backgroundColor: brand.surfaceMuted }]}>
              {icon ? <Image source={{ uri: icon }} style={styles.categoryIcon} contentFit="contain" /> : null}
            </View>
            <AppText weight="medium" numberOfLines={2} style={styles.barLabel}>
              {item.nameAr || item.name}
            </AppText>
          </Pressable>
        );
      }}
    />
  );
}

function Section({ section }: { section: HomeSection }) {
  switch (section.type) {
    case 'top_vendors':
      return <VendorsBlock section={section} />;
    case 'banners':
      return <BannerBlock section={section} />;
    case 'flash_deals':
      return <FlashDealsBlock section={section} />;
    default:
      return <ProductSectionBlock section={section} />;
  }
}

// رأس السوبرماركت حين لا توجد بانرات له بعد
function GroceryHero() {
  useTheme();
  return (
    <LinearGradient colors={[tc('#10B981'), tc('#059669'), tc('#0F766E')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.groceryHero}>
      <MaterialCommunityIcons name="basket-outline" size={150} color="rgba(255,255,255,0.1)" style={styles.groceryArt} />
      <AppText weight="bold" style={styles.groceryTitle}>
        السوبرماركت
      </AppText>
      <AppText style={styles.grocerySub}>خضار وفواكه، ألبان، لحوم ومشروبات — في نفس سلتك مع باقي طلباتك</AppText>
      <Pressable style={styles.grocerySearch} onPress={() => router.push({ pathname: '/search', params: { scope: 'grocery' } })}>
        <Ionicons name="search-outline" size={18} color={tc("#6B7280")} />
        <AppText style={{ color: tc('#6B7280'), fontSize: 14 }}>ابحث في السوبرماركت...</AppText>
      </Pressable>
    </LinearGradient>
  );
}

// الرئيسية بنفس ترتيب HomePage.jsx: السلايدر، الفئات، اشترِ مجدداً، الأقسام، النقاط والمتاجر، المزايا، المساعدة
export function HomeFeed({ page }: { page: HomePageKind }) {
  useTheme();
  const grocery = page === 'grocery';
  const { data, isLoading, isError, isRefetching, refetch } = useHome(page);
  const buyAgain = useBuyAgain(page);

  const hero = useMemo(() => (data?.banners ?? []).filter((b) => !b.sectionId && b.imageUrl), [data]);
  const sections = useMemo(() => visibleSections(data?.sections ?? []), [data]);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: spacing.lg }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); buyAgain.refetch(); }} />}
    >
      {isLoading ? <View style={styles.heroSkeleton} /> : grocery && hero.length === 0 ? <GroceryHero /> : <HeroSlider banners={hero} onPress={openBanner} />}

      <CategoryBar page={page} />

      <BuyAgainBlock products={buyAgain.data ?? []} />

      {isLoading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: spacing.xl }} />
      ) : isError && !data ? (
        <View style={styles.errorBox}>
          <AppText weight="medium" style={{ color: tc('#B91C1C') }}>
            تعذّر تحميل المنتجات — تحقق من الاتصال
          </AppText>
          <Button title="إعادة المحاولة" variant="outline" onPress={() => refetch()} style={{ marginTop: spacing.sm }} />
          {__DEV__ && (
            <AppText muted style={{ fontSize: 12, marginTop: spacing.sm }}>
              الخادم: {API_URL}
            </AppText>
          )}
        </View>
      ) : (
        sections.map((section) => <Section key={section.id} section={section} />)
      )}

      {!grocery && <PromoTiles />}
      <FeaturesStrip />
      <HelpCard />
    </ScrollView>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, backgroundColor: colors.surface },
  groceryHero: { padding: 20, paddingVertical: 28, overflow: 'hidden' },
  groceryArt: { position: 'absolute', start: -20, bottom: -30, transform: [{ rotate: '-12deg' }] },
  groceryTitle: { color: colors.white, fontSize: 26 },
  grocerySub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4, lineHeight: 22 },
  grocerySearch: { height: 44, borderRadius: 999, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 16 },
  heroSkeleton: { aspectRatio: 1600 / 656, backgroundColor: colors.border },
  bar: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 4, gap: 12 },
  barHead: { flexDirection: 'row', gap: 12 },
  barItem: { width: 76, alignItems: 'center' },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  circleDecor: { position: 'absolute', top: -12, end: -12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  offerInner: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  offerPing: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.4)' },
  offerShadow: { elevation: 4, shadowColor: '#F43F5E', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  groceryShadow: { elevation: 4, shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  categoryIcon: { width: CIRCLE * 0.8, height: CIRCLE * 0.8 },
  barLabel: { marginTop: 8, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  errorBox: { margin: spacing.md, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', alignItems: 'center' },
}));
