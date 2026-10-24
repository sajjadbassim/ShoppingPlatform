import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  filterStores,
  splitFeaturedStore,
  STORE_SORTS,
  storesOfSection,
  totalProductsOf,
  type StoreSortKey,
} from '@wasit/shared';
import { AppText, colors, fonts, createStyles, tc, useTheme } from '@wasit/ui';
import { useHomeSection, useStores } from '../api/useStores';
import { AppHeader } from '../components/AppHeader';
import { FeaturedStore, StoreCard } from '../components/StoreCards';

// قائمة المتاجر (StoresPage.jsx). مع section: متاجر «متاجرنا المميزة» بنفس ترتيبها في الرئيسية
export default function StoresScreen() {
  useTheme();
  const { section: sectionId } = useLocalSearchParams<{ section?: string }>();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<StoreSortKey>('products');

  const stores = useStores();
  const section = useHomeSection(sectionId);
  const loading = stores.isLoading || (!!sectionId && section.isLoading);

  const base = useMemo(
    () => (sectionId ? storesOfSection(stores.data ?? [], section.data?.data as { id: string }[]) : stores.data ?? []),
    [sectionId, stores.data, section.data],
  );
  const matched = useMemo(() => filterStores(base, search, sectionId ? null : sortKey), [base, search, sectionId, sortKey]);
  const { featured, rest } = splitFeaturedStore(matched, !!search.trim());
  const totalProducts = totalProductsOf(base);

  const title = sectionId ? section.data?.titleAr || section.data?.title || 'المتاجر المميزة' : 'اكتشف متاجر واسط';
  const subtitle = loading
    ? 'جاري التحميل...'
    : sectionId
      ? `أكثر ${base.length} متاجر طلباً عند زبائننا • ${totalProducts.toLocaleString('en-US')} منتج`
      : `${base.length} متجر محلي • أكثر من ${totalProducts.toLocaleString('en-US')} منتج بانتظارك`;

  const header = (
    <View style={{ gap: 16, marginBottom: rest.length > 0 ? 16 : 0 }}>
      <LinearGradient colors={[colors.primary, tc('#4F46E5'), tc('#312E81')]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={styles.hero}>
        <View style={styles.heroCircle} />
        <View style={styles.heroGlow} />
        <AppText weight="bold" style={styles.heroTitle}>
          {title}
        </AppText>
        <AppText style={styles.heroSub}>{subtitle}</AppText>
        {!!sectionId && (
          <Pressable style={styles.allButton} onPress={() => router.setParams({ section: '' })}>
            <Ionicons name="storefront-outline" size={15} color={colors.white} />
            <AppText weight="medium" style={styles.allButtonText}>
              عرض كل المتاجر
            </AppText>
          </Pressable>
        )}
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.placeholder} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث عن متجر بالاسم أو المنطقة..."
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')} style={styles.clear} accessibilityLabel="مسح البحث">
              <Ionicons name="close" size={14} color={tc("#4B5563")} />
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {/* الترتيب لا ينطبق على المميزة (مرتبة بالأكثر طلبات) */}
      {!sectionId && (
        <FlatList
          data={STORE_SORTS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(o) => o.key}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          style={{ marginHorizontal: -16 }}
          renderItem={({ item }) => {
            const active = item.key === sortKey;
            return (
              <Pressable onPress={() => setSortKey(item.key)} style={[styles.sortChip, active && styles.sortChipActive]}>
                <AppText weight="medium" style={[styles.sortText, active && { color: colors.white }]}>
                  {item.icon} {item.label}
                </AppText>
              </Pressable>
            );
          }}
        />
      )}

      {stores.isError && (
        <View style={styles.error}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
          <AppText style={{ color: tc('#B91C1C'), fontSize: 14 }}>حدث خطأ في تحميل المتاجر</AppText>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 32 }} />
      ) : matched.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="storefront-outline" size={40} color={colors.placeholder} />
          <AppText weight="bold" style={{ fontSize: 16 }}>
            لا توجد متاجر
          </AppText>
          <AppText muted style={{ textAlign: 'center' }}>
            {search ? `لم نجد متاجر تطابق "${search}"` : 'لا توجد متاجر متاحة حالياً'}
          </AppText>
        </View>
      ) : (
        <>
          {featured && <FeaturedStore store={featured} />}
          {featured && rest.length > 0 && (
            <AppText weight="bold" style={styles.listTitle}>
              {sectionId ? 'متاجر مميزة أخرى' : 'كل المتاجر'}
            </AppText>
          )}
        </>
      )}
    </View>
  );

  return (
    <View style={styles.page}>
      <AppHeader back />
      <FlatList
        data={loading ? [] : rest}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        renderItem={({ item, index }) => <StoreCard store={item} index={index + 1} />}
        onRefresh={() => {
          stores.refetch();
          if (sectionId) section.refetch();
        }}
        refreshing={stores.isRefetching}
      />
    </View>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 0 },
  hero: { borderRadius: 24, padding: 20, overflow: 'hidden' },
  heroCircle: { position: 'absolute', top: -40, end: -40, width: 192, height: 192, borderRadius: 96, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroGlow: { position: 'absolute', bottom: -64, end: '33%', width: 224, height: 224, borderRadius: 112, backgroundColor: 'rgba(251,191,36,0.15)' },
  heroTitle: { color: colors.white, fontSize: 24, lineHeight: 34 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 6 },
  allButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 16, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 12 },
  allButtonText: { color: colors.white, fontSize: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, marginTop: 16, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.white, elevation: 6 },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text, textAlign: 'right' },
  clear: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  sortChip: { height: 36, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, justifyContent: 'center' },
  sortChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  sortText: { fontSize: 14, color: '#374151' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  empty: { alignItems: 'center', gap: 8, padding: 32, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  listTitle: { fontSize: 18, marginBottom: 0 },
}));
