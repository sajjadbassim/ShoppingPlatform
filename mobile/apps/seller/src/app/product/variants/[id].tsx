import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  addAttributeValue,
  combinationKey,
  createAttribute,
  createVariant,
  deleteAttribute,
  deleteAttributeValue,
  deleteVariant,
  fetchAttributes,
  fetchProductVariants,
  updateVariant,
  variantCombinations,
  variantLabel,
  type ProductAttribute,
  type VendorVariant,
} from '@wasit/shared';
import { AppText, colors, createStyles, fonts, Input, useTheme , tc } from '@wasit/ui';
import { ActionButton, Card, Chip, Empty, ltr, money, Screen, SectionTitle, ToggleRow } from '../../../components/kit';
import { Sheet } from '../../../components/Sheet';
import { confirmDialog } from '../../../lib/dialog';
import { toast } from '../../../lib/toast';

// المتغيرات: الصفات (اللون، المقاس) وقيمها، ثم المتغيرات الفعلية بسعرها ومخزونها
export default function VariantsScreen() {
  useTheme();
  const { id, price } = useLocalSearchParams<{ id: string; price?: string }>();
  const queryClient = useQueryClient();
  const attrs = useQuery({ queryKey: ['v-attrs', id], queryFn: () => fetchAttributes(id) });
  const variants = useQuery({ queryKey: ['v-variants', id], queryFn: () => fetchProductVariants(id) });
  const [attrSheet, setAttrSheet] = useState(false);
  const [editing, setEditing] = useState<VendorVariant | 'new' | null>(null);
  const [skuPrefix, setSkuPrefix] = useState('');
  const [stock, setStock] = useState('10');
  const [running, setRunning] = useState(false);

  const refresh = () => {
    attrs.refetch();
    variants.refetch();
    queryClient.invalidateQueries({ queryKey: ['v-products'] });
    queryClient.invalidateQueries({ queryKey: ['v-product', id] });
  };
  const fail = (e: unknown, fallback: string) => toast.error((e as { message?: string }).message || fallback);

  const attributes = attrs.data ?? [];
  const list = variants.data ?? [];
  const existingKeys = new Set(list.map((v) => combinationKey(v.attributes.map((a) => a.valueId))));
  const combos = variantCombinations(attributes);
  const fresh = combos.filter((c) => !existingKeys.has(combinationKey(c)));
  const tooMany = fresh.length > 100;

  const generate = async () => {
    setRunning(true);
    let done = 0;
    try {
      for (const [i, combo] of fresh.entries()) {
        const sku = skuPrefix.trim() ? `${skuPrefix.trim()}-${i + 1 + list.length}` : undefined;
        await createVariant(id, { sku, priceAdjustment: 0, stockQuantity: Number(stock) || 0, isAvailable: true, attributeValueIds: combo });
        done++;
      }
      toast.success(`أُنشئ ${done} متغير`);
    } catch (e) {
      fail(e, `توقف التوليد بعد ${done} متغير`);
    } finally {
      setRunning(false);
      refresh();
    }
  };

  const total = list.reduce((s, v) => s + (v.stockQuantity || 0), 0);

  return (
    <Screen title="إدارة المتغيرات" subtitle={price ? `السعر الأساسي ${money(Number(price))}` : undefined} back refreshing={variants.isRefetching} onRefresh={refresh}>
      <SectionTitle action={{ label: '+ صفة جديدة', onPress: () => setAttrSheet(true) }}>الصفات (اللون، المقاس...)</SectionTitle>
      {attributes.length === 0 ? (
        <Card><AppText muted style={{ fontSize: 13.5, lineHeight: 22 }}>لا توجد صفات بعد. أضف صفة مثل «اللون» بقيمها، ثم ولّد المتغيرات.</AppText></Card>
      ) : (
        attributes.map((a) => <AttributeCard key={a.id} attr={a} productId={id} onChanged={refresh} />)
      )}

      {attributes.length > 0 && (
        <>
          <SectionTitle>توليد المتغيرات تلقائياً</SectionTitle>
          <Card>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Input label="بادئة SKU (اختياري)" value={skuPrefix} onChangeText={setSkuPrefix} placeholder="SHIRT" ltr autoCapitalize="characters" /></View>
              <View style={{ flex: 1 }}><Input label="الكمية لكل متغير" value={stock} onChangeText={setStock} keyboardType="number-pad" ltr /></View>
            </View>
            <AppText muted style={{ fontSize: 13 }}>{fresh.length === 0 ? 'كل التوليفات موجودة.' : `سيُنشأ ${fresh.length} متغير جديد من ${combos.length} توليفة.`}{tooMany ? ' الحد الأقصى 100 دفعة واحدة، قلّل القيم.' : ''}</AppText>
            <View style={{ flexDirection: 'row' }}><ActionButton title={`توليد ${fresh.length}`} onPress={generate} disabled={fresh.length === 0 || tooMany} loading={running} /></View>
          </Card>
        </>
      )}

      <SectionTitle action={attributes.length > 0 ? { label: '+ متغير يدوي', onPress: () => setEditing('new') } : undefined}>{`المتغيرات${list.length ? ` (مجموع المخزون ${total})` : ''}`}</SectionTitle>
      {list.length === 0 ? (
        <Empty icon="color-palette-outline" text="لا توجد متغيرات بعد" />
      ) : (
        <Card pad={4}>
          {list.map((v, i) => (
            <Pressable key={v.id} onPress={() => setEditing(v)} style={[styles.variant, i > 0 && { borderTopWidth: 1, borderTopColor: tc('#F8ECDA') }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText weight="bold" style={{ fontSize: 14.5 }}>{variantLabel(v) || 'متغير'}</AppText>
                <AppText muted style={{ fontSize: 12.5 }}>{v.sku ? `${ltr(v.sku)} · ` : ''}{money(v.finalPrice)}{v.priceAdjustment ? ` (${v.priceAdjustment > 0 ? '+' : ''}${Math.round(v.priceAdjustment).toLocaleString('en-US')})` : ''}</AppText>
              </View>
              <Chip label={v.isAvailable ? `${v.stockQuantity} قطعة` : 'موقوف'} tone={!v.isAvailable ? 'muted' : v.stockQuantity === 0 ? 'bad' : v.stockQuantity < 10 ? 'warn' : 'ok'} />
              <Ionicons name="chevron-back" size={16} color={colors.placeholder} />
            </Pressable>
          ))}
        </Card>
      )}

      <NewAttributeSheet visible={attrSheet} productId={id} onClose={() => setAttrSheet(false)} onDone={refresh} />
      <VariantSheet variant={editing} attributes={attributes} productId={id} onClose={() => setEditing(null)} onDone={refresh} />
    </Screen>
  );
}

function AttributeCard({ attr, productId, onChanged }: { attr: ProductAttribute; productId: string; onChanged: () => void }) {
  useTheme();
  const [valueAr, setValueAr] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!valueAr.trim()) return;
    setBusy(true);
    try {
      await addAttributeValue(productId, attr.id, { value: valueAr.trim(), valueAr: valueAr.trim() });
      setValueAr('');
      onChanged();
    } catch (e) {
      toast.error((e as { message?: string }).message || 'فشل إضافة القيمة');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText weight="extraBold" style={{ flex: 1, fontSize: 15 }}>{attr.nameAr || attr.name}</AppText>
        <Pressable
          onPress={() => confirmDialog({ title: `حذف الصفة «${attr.nameAr || attr.name}»؟`, message: 'تُحذف معها قيمها والمتغيرات المبنية عليها.', confirmText: 'حذف', tone: 'danger', onConfirm: async () => { try { await deleteAttribute(productId, attr.id); onChanged(); } catch (e) { toast.error((e as { message?: string }).message || 'فشل الحذف'); } } })}
          hitSlop={10}
          accessibilityLabel="حذف الصفة"
        ><Ionicons name="trash-outline" size={19} color={colors.errorDark} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {attr.values.map((v) => (
          <Pressable key={v.id} onPress={() => confirmDialog({ title: `حذف القيمة «${v.valueAr || v.value}»؟`, confirmText: 'حذف', tone: 'danger', onConfirm: async () => { try { await deleteAttributeValue(productId, attr.id, v.id); onChanged(); } catch (e) { toast.error((e as { message?: string }).message || 'فشل الحذف'); } } })} style={styles.valueChip}>
            <AppText style={{ fontSize: 13.5 }}>{v.valueAr || v.value}</AppText>
            <Ionicons name="close" size={13} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={valueAr} onChangeText={setValueAr} placeholder="قيمة جديدة" placeholderTextColor={colors.placeholder} onSubmitEditing={add} style={styles.valueInput} textAlign="right" />
        <ActionButton title="إضافة" tone="soft" onPress={add} loading={busy} compact />
      </View>
    </Card>
  );
}

function NewAttributeSheet({ visible, productId, onClose, onDone }: { visible: boolean; productId: string; onClose: () => void; onDone: () => void }) {
  useTheme();
  const [nameAr, setNameAr] = useState('');
  const [name, setName] = useState('');
  const [values, setValues] = useState(['']);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!nameAr.trim()) return toast.error('أدخل اسم الصفة بالعربي');
    setBusy(true);
    try {
      await createAttribute(productId, { name: name.trim() || nameAr.trim(), nameAr: nameAr.trim(), values: values.filter((v) => v.trim()).map((v) => ({ value: v.trim(), valueAr: v.trim() })) });
      toast.success('تمت إضافة الصفة');
      setNameAr('');
      setName('');
      setValues(['']);
      onClose();
      onDone();
    } catch (e) {
      toast.error((e as { message?: string }).message || 'فشل إضافة الصفة');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} busy={busy} title="صفة جديدة" footer={<><ActionButton title="إلغاء" tone="ghost" onPress={onClose} disabled={busy} /><ActionButton title="حفظ الصفة" onPress={save} loading={busy} /></>}>
      <Input label="الاسم بالعربي *" value={nameAr} onChangeText={setNameAr} placeholder="مثال: اللون" />
      <Input label="الاسم بالإنجليزي" value={name} onChangeText={setName} placeholder="Color" ltr autoCapitalize="none" />
      <AppText weight="medium" style={{ fontSize: 14 }}>القيم</AppText>
      {values.map((v, i) => (
        <TextInput key={i} value={v} onChangeText={(t) => setValues((p) => p.map((x, j) => (j === i ? t : x)))} placeholder="قيمة بالعربي" placeholderTextColor={colors.placeholder} style={styles.valueInput} textAlign="right" />
      ))}
      <ActionButton title="+ قيمة أخرى" tone="soft" onPress={() => setValues((p) => [...p, ''])} compact />
    </Sheet>
  );
}

// تعديل متغير أو إضافة يدوية (اختيار قيمة من كل صفة)
function VariantSheet({ variant, attributes, productId, onClose, onDone }: { variant: VendorVariant | 'new' | null; attributes: ProductAttribute[]; productId: string; onClose: () => void; onDone: () => void }) {
  useTheme();
  const isNew = variant === 'new';
  const v = variant && variant !== 'new' ? variant : null;
  const [sku, setSku] = useState('');
  const [adj, setAdj] = useState('0');
  const [qty, setQty] = useState('0');
  const [available, setAvailable] = useState(true);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = variant ? (v ? v.id : 'new') : null;
  if (key !== lastKey) {
    setLastKey(key);
    setSku(v?.sku ?? '');
    setAdj(String(v?.priceAdjustment ?? 0));
    setQty(String(v?.stockQuantity ?? 0));
    setAvailable(v?.isAvailable ?? true);
    setPicked({});
  }
  const save = async () => {
    setBusy(true);
    try {
      if (v) {
        await updateVariant(productId, v.id, { sku: sku.trim() || undefined, priceAdjustment: Number(adj) || 0, stockQuantity: Math.max(0, Math.floor(Number(qty) || 0)), isAvailable: available });
        toast.success('تم تعديل المتغير');
      } else {
        const ids = Object.values(picked);
        if (ids.length !== attributes.filter((a) => a.values.length).length) return toast.error('اختر قيمة من كل صفة');
        await createVariant(productId, { sku: sku.trim() || undefined, priceAdjustment: Number(adj) || 0, stockQuantity: Math.max(0, Math.floor(Number(qty) || 0)), isAvailable: available, attributeValueIds: ids });
        toast.success('تمت إضافة المتغير');
      }
      onClose();
      onDone();
    } catch (e) {
      toast.error((e as { message?: string }).message || 'فشل الحفظ');
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    confirmDialog({ title: 'حذف هذا المتغير؟', confirmText: 'حذف', tone: 'danger', onConfirm: async () => { try { await deleteVariant(productId, v!.id); onClose(); onDone(); } catch (e) { toast.error((e as { message?: string }).message || 'فشل الحذف'); } } });
  return (
    <Sheet visible={!!variant} onClose={onClose} busy={busy} title={isNew ? 'متغير جديد' : v ? variantLabel(v) : ''} footer={<>{v && <ActionButton title="حذف" tone="bad" onPress={remove} disabled={busy} />}<ActionButton title="حفظ" onPress={save} loading={busy} /></>}>
      {isNew && attributes.filter((a) => a.values.length).map((a) => (
        <View key={a.id} style={{ gap: 6 }}>
          <AppText weight="medium" style={{ fontSize: 14 }}>{a.nameAr || a.name} *</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {a.values.map((val) => {
              const on = picked[a.id] === val.id;
              return (
                <Pressable key={val.id} onPress={() => setPicked((p) => ({ ...p, [a.id]: val.id }))} style={[styles.valueChip, on && { backgroundColor: colors.primaryHover }]}>
                  <AppText style={{ fontSize: 13.5, color: on ? '#FFFFFF' : colors.text }}>{val.valueAr || val.value}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Input label="SKU" value={sku} onChangeText={setSku} ltr autoCapitalize="characters" /></View>
        <View style={{ flex: 1 }}><Input label="فرق السعر (د.ع)" value={adj} onChangeText={setAdj} keyboardType="numbers-and-punctuation" ltr /></View>
      </View>
      <Input label="الكمية المتاحة" value={qty} onChangeText={setQty} keyboardType="number-pad" ltr />
      <ToggleRow title="متاح للبيع" value={available} onChange={setAvailable} />
    </Sheet>
  );
}

const styles = createStyles(() => ({
  variant: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  valueChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: tc('#F8ECDA'), borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  valueInput: { flex: 1, minHeight: 46, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
}));
