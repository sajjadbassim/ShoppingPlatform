import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl, IMG_SIZE } from '@wasit/shared';
import { AppText, brand, colors, radius, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { useChildCategories, useProducts, useRootCategories } from '../../api/useCatalog';
import { ConnectedRailCard } from '../../components/RailProductCard';
import { useRailCardWidth } from '../../components/HomeSections';

const SIDEBAR_WIDTH = 104;

const openProducts = (categoryId: string) => router.push({ pathname: '/products', params: { categoryId } });

// تبويب الفئات: قائمة الأقسام الرئيسية جانباً، وتفاصيل القسم المختار (بانر، أقسام فرعية، منتجات)
export default function CategoriesScreen() {
  useTheme();
  const { data: roots, isLoading } = useRootCategories();
  const railWidth = useRailCardWidth();
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    if (!selectedId && roots?.length) setSelectedId(roots[0].id);
  }, [roots, selectedId]);

  const selected = roots?.find((c) => c.id === selectedId);
  const { data: children } = useChildCategories(selectedId);
  const query = useMemo(() => ({ categoryId: selectedId, pageSize: 10 }), [selectedId]);
  const { data: productsData } = useProducts(query);
  const products = productsData?.pages[0]?.items ?? [];

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.sidebar}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {roots?.map((c) => {
            const active = c.id === selectedId;
            const icon = getImageUrl(c.iconUrl, IMG_SIZE.THUMB);
            return (
              <Pressable key={c.id} onPress={() => setSelectedId(c.id)} style={[styles.sideItem, active && styles.sideItemActive]}>
                {active && <View style={styles.activeBar} />}
                <View style={[styles.sideIcon, active && { backgroundColor: colors.primaryLight }]}>
                  {icon ? <Image source={{ uri: icon }} style={styles.sideImage} contentFit="contain" /> : null}
                </View>
                <AppText weight={active ? 'bold' : 'regular'} style={[styles.sideLabel, active && { color: colors.primary }]} numberOfLines={2}>
                  {c.nameAr || c.name}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {selected && (
          <>
            <LinearGradient colors={[tc('#3B82F6'), tc('#2563EB')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
              <AppText weight="extraBold" style={styles.bannerTitle}>
                {selected.nameAr || selected.name}
              </AppText>
              <AppText style={styles.bannerSub}>تصفّح كل منتجات هذا القسم</AppText>
              <Pressable style={styles.bannerButton} onPress={() => openProducts(selected.id)}>
                <AppText weight="bold" style={styles.bannerButtonText}>
                  تسوق الكل
                </AppText>
                <Ionicons name="arrow-back" size={18} color={colors.text} />
              </Pressable>
            </LinearGradient>

            {!!children?.length && (
              <>
                <AppText weight="extraBold" style={styles.sectionTitle}>
                  الأقسام
                </AppText>
                <View style={styles.subGrid}>
                  {children.map((c) => {
                    const icon = getImageUrl(c.iconUrl, IMG_SIZE.THUMB);
                    return (
                      <Pressable key={c.id} style={styles.subItem} onPress={() => openProducts(c.id)}>
                        <View style={styles.subCircle}>
                          {icon ? <Image source={{ uri: icon }} style={styles.subImage} contentFit="contain" /> : null}
                        </View>
                        <AppText style={styles.subLabel} numberOfLines={2}>
                          {c.nameAr || c.name}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {products.length > 0 && (
              <>
                <View style={styles.sectionRow}>
                  <AppText weight="extraBold" style={styles.sectionTitle}>
                    منتجات {selected.nameAr || selected.name}
                  </AppText>
                  <Pressable onPress={() => openProducts(selected.id)} hitSlop={8}>
                    <AppText weight="medium" style={styles.viewAll}>
                      عرض الكل
                    </AppText>
                  </Pressable>
                </View>
                <FlatList
                  data={products}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(p) => p.id}
                  contentContainerStyle={{ gap: spacing.sm }}
                  renderItem={({ item }) => <ConnectedRailCard product={item} width={railWidth} />}
                />
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, flexDirection: 'row', backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sidebar: { width: SIDEBAR_WIDTH, backgroundColor: colors.background, borderEndWidth: 1, borderEndColor: colors.border },
  sideItem: { alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: 6, gap: 6 },
  sideItemActive: { backgroundColor: colors.surface },
  activeBar: { position: 'absolute', top: 8, bottom: 8, end: 0, width: 4, borderRadius: 2, backgroundColor: colors.primary },
  sideIcon: { width: 60, height: 60, borderRadius: radius.xl, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  sideImage: { width: 40, height: 40 },
  sideLabel: { fontSize: 13, textAlign: 'center', color: colors.textMuted },
  content: { flex: 1 },
  contentInner: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  banner: { borderRadius: 24, padding: spacing.md, gap: spacing.xs, alignItems: 'flex-start' },
  bannerTitle: { color: colors.white, fontSize: 26 },
  bannerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 14 },
  bannerButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.full, backgroundColor: colors.white },
  bannerButtonText: { fontSize: 15 },
  sectionTitle: { fontSize: 20 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewAll: { color: colors.primary, fontSize: 14 },
  subGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  subItem: { width: '33.33%', alignItems: 'center', gap: 6 },
  subCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: brand.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  subImage: { width: 44, height: 44 },
  subLabel: { fontSize: 13, textAlign: 'center' },
}));
