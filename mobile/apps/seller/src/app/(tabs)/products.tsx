import { useMemo, useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  deleteProduct,
  discountPercent,
  duplicateProduct,
  filterVendorProducts,
  getImageUrl,
  LOW_STOCK,
  bulkPriceFields,
  productCounts,
  productImageOf,
  setProductActive,
  updateProductFields,
  updateProductStock,
  VENDOR_PRODUCT_FILTERS,
  VENDOR_PRODUCT_SORTS,
  type BulkPriceMode,
  type VendorProduct,
  type VendorProductFilter,
  type VendorProductSort,
} from '@wasit/shared';
import { AppText, colors, createStyles, fonts, useTheme } from '@wasit/ui';
import { useProductSales, useProducts } from '../../api/useVendor';
import { ActionButton, Card, Chip, Empty, FilterPills, ltr, money, Screen } from '../../components/kit';
import { BulkPriceSheet } from '../../components/BulkPriceSheet';
import { actionSheet, confirmDialog } from '../../lib/dialog';
import { toast } from '../../lib/toast';
import { palette } from '../../lib/palette';
import { useVendorId } from '../../lib/vendor';

const PAGE = 20;

export default function ProductsScreen() {
  useTheme();
  const queryClient = useQueryClient();
  const vendorId = useVendorId();
  const products = useProducts();
  const sales = useProductSales();
  const [filter, setFilter] = useState<VendorProductFilter>('all');
  const [sort, setSort] = useState<VendorProductSort>('newest');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkPrice, setBulkPrice] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const all = useMemo(() => products.data ?? [], [products.data]);
  const counts = useMemo(() => productCounts(all), [all]);
  const list = useMemo(() => filterVendorProducts(all, { filter, search, sort, sold: sales.data }), [all, filter, search, sort, sales.data]);
  const shown = list.slice(0, limit);

  const patchLocal = (id: string, patch: Partial<VendorProduct>) =>
    queryClient.setQueryData<VendorProduct[]>(['v-products', vendorId], (old = []) => old.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const refetchAll = () => queryClient.invalidateQueries({ queryKey: ['v-products'] });

  const run = async (id: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(id);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر حفظ التغيير');
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = (p: VendorProduct) =>
    run(p.id, async () => { await setProductActive(p.id, !p.isActive); patchLocal(p.id, { isActive: !p.isActive }); }, p.isActive ? 'أُخفي المنتج عن الزبائن' : 'أصبح المنتج ظاهراً في المتجر');

  const saveStock = (p: VendorProduct, qty: number) =>
    run(p.id, async () => { await updateProductStock(p.id, qty); patchLocal(p.id, { stockQuantity: qty }); }, 'تم تحديث المخزون');

  const exitSelect = () => { setSelecting(false); setSelected([]); };
  const toggleSelect = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selectedProducts = all.filter((p) => selected.includes(p.id));

  const bulkVisibility = async (isActive: boolean) => {
    const targets = selectedProducts.filter((p) => p.isActive !== isActive);
    const res = await Promise.allSettled(targets.map((p) => setProductActive(p.id, isActive)));
    const failed = res.filter((r) => r.status === 'rejected').length;
    refetchAll();
    if (failed) toast.error(`تعذّر تحديث ${failed} منتج`);
    else toast.success(isActive ? `تم إظهار ${targets.length} منتج` : `تم إخفاء ${targets.length} منتج`);
    exitSelect();
  };

  const confirmDelete = (items: VendorProduct[]) =>
    confirmDialog({
      title: items.length > 1 ? `حذف ${items.length} منتجات؟` : 'حذف المنتج؟',
      message: 'لا يمكن التراجع. المنتجات المرتبطة بطلبات قد لا تُحذف.',
      confirmText: 'حذف',
      tone: 'danger',
      onConfirm: async () => {
        const res = await Promise.allSettled(items.map((p) => deleteProduct(p.id)));
        const failed = res.filter((r) => r.status === 'rejected').length;
        refetchAll();
        if (failed) toast.error(`تعذّر حذف ${failed} منتج`);
        else toast.success(items.length > 1 ? `تم حذف ${items.length} منتجات` : 'تم حذف المنتج');
        exitSelect();
      },
    });

  const applyBulkPrice = async (mode: BulkPriceMode, percent: number) => {
    setBusy('bulk');
    const jobs = selectedProducts.map((p) => ({ p, fields: bulkPriceFields(p, mode, percent) })).filter((j) => j.fields);
    const res = await Promise.allSettled(jobs.map((j) => updateProductFields(j.p.id, j.fields!)));
    const failed = res.filter((r) => r.status === 'rejected').length;
    setBusy(null);
    setBulkPrice(false);
    refetchAll();
    if (failed) toast.error(`تعذّر تعديل ${failed} منتج`);
    else toast.success(`تم تعديل أسعار ${jobs.length} منتج`);
    exitSelect();
  };

  const openMenu = (p: VendorProduct) =>
    actionSheet({
      title: p.nameAr || p.name,
      actions: [
        { label: 'تعديل', icon: 'create-outline', onPress: () => router.push({ pathname: '/product/[id]', params: { id: p.id } }) },
        {
          label: 'نسخ المنتج',
          icon: 'copy-outline',
          onPress: () =>
            run(p.id, async () => {
              const copy = await duplicateProduct(p.id);
              refetchAll();
              if (copy?.id) router.push({ pathname: '/product/[id]', params: { id: copy.id } });
            }, 'أُنشئت نسخة مخفية بمخزون صفر، عدّلها ثم أظهرها'),
        },
        { label: 'حذف', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete([p]) },
      ],
    });

  const openSort = () =>
    actionSheet({ title: 'ترتيب المنتجات', actions: VENDOR_PRODUCT_SORTS.map((s) => ({ label: (s.key === sort ? '✓ ' : '') + s.label, onPress: () => setSort(s.key) })) });

  const right = (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <IconBtn icon="swap-vertical" label="الترتيب" onPress={openSort} />
      <IconBtn icon={selecting ? 'close' : 'checkbox-outline'} label={selecting ? 'إلغاء التحديد' : 'تحديد'} onPress={() => (selecting ? exitSelect() : setSelecting(true))} />
    </View>
  );

  return (
    <Screen
      title="المنتجات"
      subtitle={`${counts.all} منتج${counts.out ? ` · ${counts.out} نفد مخزونها` : ''}`}
      right={right}
      tabs
      refreshing={products.isRefetching}
      onRefresh={() => products.refetch()}
    >
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.placeholder} />
        <TextInput value={search} onChangeText={(t) => { setSearch(t); setLimit(PAGE); }} placeholder="ابحث بالاسم أو الرمز SKU" placeholderTextColor={colors.placeholder} style={styles.searchInput} textAlign="right" />
      </View>
      <FilterPills
        value={filter}
        onChange={(f) => { setFilter(f); setLimit(PAGE); }}
        options={VENDOR_PRODUCT_FILTERS.map((f) => ({ key: f.key, label: f.label, count: counts[f.key], alert: (f.key === 'low' || f.key === 'out') && counts[f.key] > 0 }))}
      />

      {selecting && (
        <Card tone="warn">
          <AppText weight="bold" style={{ fontSize: 14 }}>{selected.length ? `${selected.length} محدد` : 'اضغط المنتجات لتحديدها'}</AppText>
          {selected.length > 0 && (
            // شبكة 2×2 بأيقونات: أربعة أزرار في صف واحد تكسر كلماتها في المنتصف على الشاشات الضيقة
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
              <View style={{ width: '48.5%', flexDirection: 'row' }}><ActionButton title="إظهار" icon="eye-outline" tone="soft" compact onPress={() => bulkVisibility(true)} /></View>
              <View style={{ width: '48.5%', flexDirection: 'row' }}><ActionButton title="إخفاء" icon="eye-off-outline" tone="soft" compact onPress={() => bulkVisibility(false)} /></View>
              <View style={{ width: '48.5%', flexDirection: 'row' }}><ActionButton title="الأسعار" icon="pricetag-outline" tone="soft" compact onPress={() => setBulkPrice(true)} /></View>
              <View style={{ width: '48.5%', flexDirection: 'row' }}><ActionButton title="حذف" icon="trash-outline" tone="bad" compact onPress={() => confirmDelete(selectedProducts)} /></View>
            </View>
          )}
          <Pressable onPress={() => setSelected(shown.map((p) => p.id))}><AppText weight="bold" style={{ color: colors.primaryHover, fontSize: 13 }}>تحديد الكل ({shown.length})</AppText></Pressable>
        </Card>
      )}

      {products.isLoading ? (
        <AppText muted style={{ textAlign: 'center', paddingVertical: 30 }}>جاري التحميل...</AppText>
      ) : all.length === 0 ? (
        <Empty icon="cube-outline" text="أضف أول منتج لمتجرك وابدأ البيع" action={{ label: 'إضافة منتج', onPress: () => router.push({ pathname: '/product/[id]', params: { id: 'new' } }) }} />
      ) : shown.length === 0 ? (
        <Empty icon="search-outline" text="لا توجد منتجات مطابقة" />
      ) : (
        shown.map((p) => (
          <ProductRow key={p.id} p={p} sold={sales.data?.[p.id]?.sold} selecting={selecting} selected={selected.includes(p.id)} busy={busy === p.id} onSelect={() => toggleSelect(p.id)} onToggle={() => toggleActive(p)} onStock={(q) => saveStock(p, q)} onMenu={() => openMenu(p)} />
        ))
      )}
      {list.length > limit && <ActionButton title="عرض المزيد" tone="ghost" onPress={() => setLimit((l) => l + PAGE)} />}

      <BulkPriceSheet products={selectedProducts} visible={bulkPrice} busy={busy === 'bulk'} onClose={() => setBulkPrice(false)} onApply={applyBulkPrice} />

    </Screen>
  );
}

function IconBtn({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.iconBtn}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

function ProductRow({ p, sold, selecting, selected, busy, onSelect, onToggle, onStock, onMenu }: { p: VendorProduct; sold?: number; selecting: boolean; selected: boolean; busy: boolean; onSelect: () => void; onToggle: () => void; onStock: (q: number) => void; onMenu: () => void }) {
  useTheme();
  const img = productImageOf(p);
  const disc = discountPercent(p.price, p.originalPrice);
  const qty = p.stockQuantity ?? 0;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(qty));
  const stockTone = qty === 0 ? 'bad' : qty < LOW_STOCK ? 'warn' : 'muted';
  const commit = () => {
    const n = Math.max(0, Math.floor(Number(value)));
    setEditing(false);
    if (Number.isFinite(n) && n !== qty) onStock(n);
  };
  return (
    <Card tone={selected ? 'warn' : undefined} onPress={selecting ? onSelect : () => router.push({ pathname: '/product/[id]', params: { id: p.id } })} pad={12}>
      <View style={styles.rowC}>
        {selecting && <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={24} color={selected ? colors.primary : colors.placeholder} />}
        <View style={styles.thumb}>{img ? <Image source={{ uri: getImageUrl(img, 200) ?? undefined }} style={{ flex: 1 }} contentFit="cover" /> : <Ionicons name="image-outline" size={22} color={colors.placeholder} style={{ margin: 'auto' }} />}</View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText weight="bold" style={{ fontSize: 15 }} numberOfLines={1}>{p.nameAr || p.name}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <AppText weight="extraBold" style={{ fontSize: 14 }}>{money(p.price)}</AppText>
            {disc > 0 && <Chip label={`خصم ${disc}%`} tone="bad" />}
            {p.hasPromotion && <Chip label="عرض" tone="warn" />}
          </View>
          <AppText muted style={{ fontSize: 12 }} numberOfLines={1}>
            {p.sku ? `${ltr(p.sku)} · ` : ''}{p.hasVariants ? 'بمتغيرات' : p.weightStepKg ? 'بالوزن' : 'بالقطعة'}{sold ? ` · بيع ${sold}` : ''}
          </AppText>
        </View>
        {!selecting && <Pressable onPress={onMenu} hitSlop={10} accessibilityLabel="المزيد"><Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} /></Pressable>}
      </View>
      {!selecting && (
        <View style={styles.rowC}>
          {p.hasVariants ? (
            <Chip label={qty === 0 ? 'نفد' : `${qty} قطعة (مجموع المتغيرات)`} tone={stockTone} />
          ) : editing ? (
            <View style={styles.rowC}>
              <Pressable onPress={() => setValue(String(Math.max(0, Number(value) - 1)))} style={styles.step}><AppText weight="bold" style={{ fontSize: 18 }}>−</AppText></Pressable>
              <TextInput value={value} onChangeText={setValue} keyboardType="number-pad" onSubmitEditing={commit} autoFocus selectTextOnFocus style={styles.stockInput} />
              <Pressable onPress={() => setValue(String(Number(value) + 1))} style={styles.step}><AppText weight="bold" style={{ fontSize: 18 }}>+</AppText></Pressable>
              <Pressable onPress={commit} style={[styles.step, { backgroundColor: colors.primaryHover }]}><Ionicons name="checkmark" size={18} color="#FFFFFF" /></Pressable>
              <Pressable onPress={() => setEditing(false)} style={styles.step}><Ionicons name="close" size={18} color={colors.textMuted} /></Pressable>
            </View>
          ) : (
            <Pressable onPress={() => { setValue(String(qty)); setEditing(true); }} disabled={busy} style={[styles.stockBtn, qty === 0 && { backgroundColor: palette.badSoft }, qty > 0 && qty < LOW_STOCK && { backgroundColor: palette.warnSoft }]}>
              <Ionicons name="create-outline" size={14} color={colors.textMuted} />
              <AppText weight="bold" style={{ fontSize: 13 }}>{busy ? '...' : qty === 0 ? 'نفد' : `${qty} قطعة`}</AppText>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <AppText muted style={{ fontSize: 12.5 }}>{p.isActive ? 'ظاهر' : 'مخفي'}</AppText>
          <Switch value={p.isActive} onValueChange={onToggle} disabled={busy} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFFFFF" />
        </View>
      )}
    </Card>
  );
}

const styles = createStyles(() => ({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text, paddingVertical: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  rowC: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#F8ECDA', overflow: 'hidden' },
  stockBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8ECDA', borderRadius: 12, paddingHorizontal: 12, minHeight: 38 },
  stockInput: { width: 60, minHeight: 38, textAlign: 'center', borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, fontFamily: fonts.bold, fontSize: 15, color: colors.text, paddingVertical: 4 },
  step: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F8ECDA', alignItems: 'center', justifyContent: 'center' },
}));
