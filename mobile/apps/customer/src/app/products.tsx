import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { resolveScope, SORT_OPTIONS, type ProductSummary, type SortKey } from '@wasit/shared';
import { AppText, Button, colors, radius, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { useAllCategories, useProductsPage, useVendor } from '../api/useCatalog';
import { useHomeSection } from '../api/useStores';
import { AppHeader } from '../components/AppHeader';
import { Pagination } from '../components/Pagination';
import { ProductFilterDrawer, type ProductFilters } from '../components/ProductFilterDrawer';
import { ConnectedProductCard } from '../components/ProductCard';

const PAGE_SIZE = 12;

const EMPTY_FILTERS: ProductFilters = { categoryId: undefined, minPrice: '', maxPrice: '', minRating: '', hasDiscount: false, inStock: false };

export default function ProductsScreen() {
  useTheme();
  const params = useLocalSearchParams<{ search?: string; categoryId?: string; offers?: string; scope?: string; section?: string; vendorId?: string; sort?: string }>();
  const grocery = params.scope === 'grocery';

  const [term, setTerm] = useState(params.search ?? '');
  const [filters, setFilters] = useState<ProductFilters>({ ...EMPTY_FILTERS, categoryId: params.categoryId, hasDiscount: !!params.offers });
  const [sort, setSort] = useState<SortKey>(SORT_OPTIONS.some((o) => o.key === params.sort) ? (params.sort as SortKey) : 'newest');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // عرض شبكي (عمودان) أو قائمة (بطاقة أفقية) كما في مفتاح العرض بالويب
  const [listView, setListView] = useState(false);
  const listRef = useRef<FlashListRef<ProductSummary>>(null);

  // فتح الصفحة من رابط جديد (بحث، فئة، عروض) يعيد ضبط الفلاتر
  useEffect(() => {
    setTerm(params.search ?? '');
    setFilters({ ...EMPTY_FILTERS, categoryId: params.categoryId, hasDiscount: !!params.offers });
    setPage(1);
  }, [params.search, params.categoryId, params.offers, params.scope, params.vendorId]);

  const vendorId = params.vendorId || undefined;
  const sortOption = SORT_OPTIONS.find((o) => o.key === sort) ?? SORT_OPTIONS[0];
  const query = useMemo(
    () => ({
      searchTerm: term || undefined,
      scope: resolveScope({ grocery, categoryId: filters.categoryId, vendorId }),
      categoryId: filters.categoryId,
      vendorId,
      minPrice: filters.minPrice || undefined,
      maxPrice: filters.maxPrice || undefined,
      minRating: filters.minRating || undefined,
      hasDiscount: filters.hasDiscount || undefined,
      isAvailable: filters.inStock || undefined,
      isActive: true,
      sortBy: sortOption.sortBy,
      sortOrder: sortOption.sortOrder,
      pageSize: PAGE_SIZE,
    }),
    [term, grocery, filters, vendorId, sortOption],
  );

  // قسم مختار يدوياً من الرئيسية («عروض اليوم»...): منتجاته نفسها بلا فلاتر (كما في الويب)
  const sectionId = params.section || undefined;
  const section = useHomeSection(sectionId);
  const { data: filterData, isLoading: filterLoading, isError: filterError, isRefetching: filterRefetching, isPlaceholderData, refetch: filterRefetch } = useProductsPage(query, page, !sectionId);
  const { data: allCategories } = useAllCategories();
  const { data: vendor } = useVendor(vendorId ?? '');

  const sectionProducts = (section.data?.data ?? []) as ProductSummary[];
  const products = sectionId ? sectionProducts : filterData?.items ?? [];
  const totalCount = sectionId ? sectionProducts.length : filterData?.pagination.totalCount ?? 0;
  const totalPages = sectionId ? 1 : filterData?.pagination.totalPages ?? 1;
  const isLoading = sectionId ? section.isLoading : filterLoading;
  const isError = sectionId ? section.isError : filterError;
  const refetch = sectionId ? section.refetch : filterRefetch;
  const isRefetching = sectionId ? section.isRefetching : filterRefetching;

  // قائمة الفئات من قسم واحد: قسم الصفحة، أو قسم الفئة المختارة
  const selectedCategory = filters.categoryId ? allCategories?.find((c) => c.id === filters.categoryId) : undefined;
  const sectionFilter = query.scope ?? selectedCategory?.section;
  const roots = useMemo(
    () => (allCategories ?? []).filter((c) => !c.parentId && (!sectionFilter || (c.section || 'general') === sectionFilter)),
    [allCategories, sectionFilter],
  );
  const childrenOf = useCallback((parentId: string) => (allCategories ?? []).filter((c) => c.parentId === parentId), [allCategories]);

  const title = sectionId
    ? section.data?.titleAr || section.data?.title || 'منتجات مختارة'
    : term
      ? grocery
        ? `نتائج السوبرماركت: "${term}"`
        : `نتائج: "${term}"`
      : selectedCategory
        ? selectedCategory.nameAr || selectedCategory.name
        : vendorId && vendor
          ? `منتجات ${vendor.nameAr || vendor.name}`
          : grocery
            ? filters.hasDiscount
              ? 'عروض السوبرماركت'
              : sort === 'sales'
                ? 'الأكثر مبيعاً في السوبرماركت'
                : 'السوبرماركت'
            : sort === 'sales'
              ? 'الأكثر مبيعاً'
              : 'جميع المنتجات';

  const hasPrice = !!(filters.minPrice || filters.maxPrice);
  const activeCount = (filters.categoryId ? 1 : 0) + (hasPrice ? 1 : 0) + (filters.inStock ? 1 : 0) + (filters.minRating ? 1 : 0) + (filters.hasDiscount ? 1 : 0) + (term ? 1 : 0);

  const patchFilters = (patch: Partial<ProductFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setTerm('');
    setPage(1);
  };
  const goToPage = (p: number) => {
    setPage(p);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const openProduct = (p: ProductSummary) => router.push({ pathname: '/product/[id]', params: { id: p.id } });

  const tags: { key: string; label: string; tone: 'blue' | 'primary' | 'yellow' | 'green'; onRemove: () => void }[] = [];
  if (term) tags.push({ key: 'term', label: `🔍 ${term}`, tone: 'blue', onRemove: () => { setTerm(''); setPage(1); } });
  if (selectedCategory) tags.push({ key: 'cat', label: selectedCategory.nameAr || selectedCategory.name, tone: 'primary', onRemove: () => patchFilters({ categoryId: undefined }) });
  if (hasPrice) tags.push({ key: 'price', label: `💰 ${filters.minPrice || '0'} - ${filters.maxPrice || '∞'}`, tone: 'primary', onRemove: () => patchFilters({ minPrice: '', maxPrice: '' }) });
  if (filters.minRating) tags.push({ key: 'rating', label: `⭐ ${filters.minRating}+`, tone: 'yellow', onRemove: () => patchFilters({ minRating: '' }) });
  if (filters.hasDiscount) tags.push({ key: 'discount', label: '🏷️ خصومات', tone: 'green', onRemove: () => patchFilters({ hasDiscount: false }) });

  const toneStyle = { blue: [tc('#DBEAFE'), tc('#1D4ED8')], primary: [tc('#EEF2FF'), colors.primary], yellow: [tc('#FEF9C3'), tc('#A16207')], green: [tc('#DCFCE7'), tc('#15803D')] } as const;

  return (
    <View style={styles.safe}>
      <AppHeader back />

      <FlashList
        key={listView ? 'list' : 'grid'}
        ref={listRef}
        data={products}
        numColumns={listView ? 1 : 2}
        keyExtractor={(p) => p.id}
        onRefresh={refetch}
        refreshing={isRefetching && !isPlaceholderData}
        contentContainerStyle={styles.grid}
        extraData={isPlaceholderData}
        ListHeaderComponent={
          <View style={styles.titleCard}>
            <AppText weight="bold" style={styles.pageTitle}>
              {title}
            </AppText>
            <AppText muted style={{ fontSize: 14 }}>
              {isLoading ? 'جاري التحميل...' : `${totalCount} منتج`}
            </AppText>

            {sectionId ? (
              <Pressable style={styles.clearSection} onPress={() => router.setParams({ section: '' })}>
                <Ionicons name="close" size={14} color={tc("#4B5563")} />
                <AppText style={styles.clearSectionText}>كل المنتجات</AppText>
              </Pressable>
            ) : (
              <View style={styles.controls}>
                <Pressable style={styles.control} onPress={() => setFiltersOpen(true)}>
                  <Ionicons name="options-outline" size={16} color={tc("#4B5563")} />
                  <AppText style={styles.controlText}>الفلاتر</AppText>
                  {activeCount > 0 && (
                    <View style={styles.badge}>
                      <AppText weight="bold" style={styles.badgeText}>
                        {activeCount}
                      </AppText>
                    </View>
                  )}
                </Pressable>
                <Pressable style={styles.control} onPress={() => setSortOpen(true)} accessibilityLabel="ترتيب المنتجات">
                  <AppText style={[styles.controlText, { flex: 1 }]}>{sortOption.label}</AppText>
                  <Ionicons name="chevron-down" size={16} color={tc("#6B7280")} />
                </Pressable>
                <View style={styles.viewToggle}>
                  <Pressable
                    style={[styles.viewBtn, !listView && styles.viewBtnOn]}
                    onPress={() => setListView(false)}
                    accessibilityLabel="عرض شبكي"
                    accessibilityState={{ selected: !listView }}
                  >
                    <Ionicons name="grid-outline" size={16} color={!listView ? colors.white : tc('#6B7280')} />
                  </Pressable>
                  <Pressable
                    style={[styles.viewBtn, listView && styles.viewBtnOn]}
                    onPress={() => setListView(true)}
                    accessibilityLabel="عرض قائمة"
                    accessibilityState={{ selected: listView }}
                  >
                    <Ionicons name="list-outline" size={18} color={listView ? colors.white : tc('#6B7280')} />
                  </Pressable>
                </View>
              </View>
            )}

            {!sectionId && tags.length > 0 && (
              <View style={styles.tags}>
                {tags.map((t) => (
                  <Pressable key={t.key} style={[styles.tag, { backgroundColor: toneStyle[t.tone][0] }]} onPress={t.onRemove}>
                    <AppText style={{ fontSize: 12, color: toneStyle[t.tone][1] }}>{t.label}</AppText>
                    <Ionicons name="close" size={12} color={toneStyle[t.tone][1]} />
                  </Pressable>
                ))}
                <Pressable onPress={clearAll} hitSlop={6} style={styles.clearAll}>
                  <AppText style={{ fontSize: 12, color: tc('#EF4444') }}>مسح الكل</AppText>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : isError ? (
            <View style={styles.center}>
              <AppText weight="bold">تعذّر تحميل المنتجات</AppText>
              <Button title="إعادة المحاولة" onPress={() => refetch()} style={{ marginTop: spacing.md }} />
            </View>
          ) : (
            <View style={styles.center}>
              <AppText weight="bold" style={{ fontSize: 16 }}>
                لا توجد منتجات
              </AppText>
              <AppText muted style={{ textAlign: 'center' }}>
                {term ? `لم نجد منتجات تطابق "${term}"` : 'لا توجد منتجات بهذه المعايير'}
              </AppText>
              {activeCount > 0 && <Button title="مسح الفلاتر" onPress={clearAll} style={{ marginTop: spacing.md }} />}
            </View>
          )
        }
        ListFooterComponent={products.length > 0 && !sectionId ? <Pagination page={page} totalPages={totalPages} onChange={goToPage} /> : null}
        renderItem={({ item }) => (
          <View style={[styles.cell, isPlaceholderData && { opacity: 0.5 }]}>
            <ConnectedProductCard product={item} width="100%" onPress={openProduct} layout={listView ? 'list' : 'grid'} />
          </View>
        )}
      />

      <ProductFilterDrawer
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={patchFilters}
        onClear={clearAll}
        activeCount={activeCount}
        resultCount={totalCount}
        roots={roots}
        children={childrenOf}
      />

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)} statusBarTranslucent>
        <Pressable style={styles.sortBackdrop} onPress={() => setSortOpen(false)}>
          <View style={styles.sortMenu}>
            {SORT_OPTIONS.map((o) => (
              <Pressable
                key={o.key}
                style={styles.sortItem}
                onPress={() => {
                  setSort(o.key);
                  setPage(1);
                  setSortOpen(false);
                }}
              >
                <AppText weight={o.key === sort ? 'bold' : 'regular'} style={{ fontSize: 15, color: o.key === sort ? colors.primary : colors.text }}>
                  {o.label}
                </AppText>
                {o.key === sort && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = createStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.background },
  titleCard: { margin: spacing.sm, marginBottom: spacing.sm, padding: spacing.md, gap: 2, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  pageTitle: { fontSize: 18 },
  controls: { flexDirection: 'row', gap: 8, marginTop: 10 },
  control: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, backgroundColor: colors.surface },
  controlText: { fontSize: 14, color: '#4B5563' },
  viewToggle: { flexDirection: 'row', height: 40, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface },
  viewBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  viewBtnOn: { backgroundColor: colors.primary },
  badge: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontSize: 11, lineHeight: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  clearAll: { paddingHorizontal: 8, paddingVertical: 4 },
  clearSection: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, paddingHorizontal: 12, marginTop: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: '#D1D5DB' },
  clearSectionText: { fontSize: 14, color: '#4B5563' },
  grid: { paddingHorizontal: spacing.sm },
  cell: { padding: spacing.xs },
  center: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: spacing.xl },
  sortBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 32 },
  sortMenu: { backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 8 },
  sortItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 48 },
}));
