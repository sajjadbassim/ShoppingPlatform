import { useEffect, useMemo, useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  buildProductFormData,
  deleteProductImage,
  EMPTY_PRODUCT_FORM,
  fetchVendorProduct,
  getImageUrl,
  MAX_PRODUCT_IMAGES,
  productToForm,
  saveProduct,
  setPrimaryProductImage,
  stepLabel,
  validateProductForm,
  WEIGHT_STEPS,
  type PickedImage,
  type ProductForm,
  type ProductFormErrors,
} from '@wasit/shared';
import { AppText, colors, createStyles, fonts, Input, useTheme } from '@wasit/ui';
import { useQuery } from '@tanstack/react-query';
import { useCategories } from '../../api/useVendor';
import { ActionButton, Card, Chip, ListRow, Screen, SectionTitle } from '../../components/kit';
import { Sheet } from '../../components/Sheet';
import { confirmDialog } from '../../lib/dialog';
import { toast } from '../../lib/toast';
import { useVendorId } from '../../lib/vendor';

const round2 = (n: number) => Math.round(n * 100) / 100;

interface NewImage extends PickedImage {
  key: string;
}

// إضافة وتعديل منتج: الصور، ثم الاسم والفئة، ثم السعر والكمية، والظهور. المتغيرات بعد الحفظ
export default function ProductFormScreen() {
  useTheme();
  const { id, new: justCreatedParam } = useLocalSearchParams<{ id: string; new?: string }>();
  const editing = id !== 'new';
  const vendorId = useVendorId();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const existing = useQuery({ queryKey: ['v-product', id], queryFn: () => fetchVendorProduct(id), enabled: editing });

  const [form, setForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [newImages, setNewImages] = useState<NewImage[]>([]);
  const [oldImages, setOldImages] = useState<{ id: string; imageUrl: string; isPrimary: boolean }[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [catSheet, setCatSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState<string | null>(null);
  const set = (patch: Partial<ProductForm>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    setForm(productToForm(p));
    setOldImages([...(p.images ?? [])].sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : (a.displayOrder ?? 0) - (b.displayOrder ?? 0))));
    if (p.name || p.sku) setShowMore(true);
  }, [existing.data]);

  const imageCount = oldImages.length + newImages.length;
  const price = Number(form.Price) || 0;
  const original = Number(form.OriginalPrice) || 0;
  const discount = original > price && price > 0 ? Math.round((1 - price / original) * 100) : 0;
  const weightStep = Number(form.WeightStep) || 0;
  const category = useMemo(() => (categories.data ?? []).find((c) => c.id === form.CategoryId), [categories.data, form.CategoryId]);

  const pickImages = async () => {
    const room = MAX_PRODUCT_IMAGES - imageCount;
    if (room <= 0) return toast.error(`الحد الأقصى ${MAX_PRODUCT_IMAGES} صور للمنتج`);
    let res: ImagePicker.ImagePickerResult;
    try {
      res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.7 });
    } catch {
      return toast.error('تعذّر فتح معرض الصور');
    }
    if (res.canceled) return;
    setNewImages((prev) => [
      ...prev,
      ...res.assets.slice(0, room).map((a, i) => ({ key: `${a.uri}-${i}`, uri: a.uri, name: a.fileName ?? `product-${Date.now()}-${i}.jpg`, type: a.mimeType ?? 'image/jpeg' })),
    ]);
    setErrors((e) => ({ ...e, images: undefined }));
  };

  const removeOld = (img: { id: string }) =>
    confirmDialog({
      title: 'حذف هذه الصورة؟',
      confirmText: 'حذف',
      tone: 'danger',
      onConfirm: async () => {
        setImageBusy(img.id);
        try {
          await deleteProductImage(img.id);
          setOldImages((p) => p.filter((i) => i.id !== img.id));
          queryClient.invalidateQueries({ queryKey: ['v-products'] });
        } catch (e) {
          toast.error((e as { message?: string }).message || 'تعذّر حذف الصورة');
        } finally {
          setImageBusy(null);
        }
      },
    });

  const makePrimary = async (img: { id: string; imageUrl: string }) => {
    setImageBusy(img.id);
    try {
      await setPrimaryProductImage(id, img.id);
      setOldImages((p) => [{ ...img, isPrimary: true }, ...p.filter((i) => i.id !== img.id).map((i) => ({ ...i, isPrimary: false }))]);
      queryClient.invalidateQueries({ queryKey: ['v-products'] });
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر تعيين الصورة الرئيسية');
    } finally {
      setImageBusy(null);
    }
  };

  const submit = async () => {
    const found = validateProductForm(form, imageCount, editing);
    setErrors(found);
    if (Object.keys(found).length) return toast.error(Object.values(found)[0] as string);
    setSaving(true);
    try {
      const saved = await saveProduct(editing ? id : null, buildProductFormData(form, { editing, vendorId, images: newImages }));
      queryClient.invalidateQueries({ queryKey: ['v-products'] });
      queryClient.invalidateQueries({ queryKey: ['v-product', id] });
      if (editing) {
        toast.success('تم حفظ التغييرات');
        setNewImages([]);
        if (saved?.images) setOldImages([...saved.images].sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0)));
      } else if (saved?.id) {
        // بعد الإنشاء ننتقل لوضع التعديل حتى لا ينشئ الحفظ التالي نسخة مكررة، وتظهر المتغيرات
        router.replace({ pathname: '/product/[id]', params: { id: saved.id, new: '1' } });
      } else {
        toast.success('تمت إضافة المنتج');
        router.back();
      }
    } catch (e) {
      toast.error((e as { message?: string }).message || 'فشل حفظ المنتج');
    } finally {
      setSaving(false);
    }
  };

  if (editing && existing.isLoading) {
    return (
      <Screen title="تعديل المنتج" back>
        <AppText muted style={{ textAlign: 'center', paddingVertical: 40 }}>جاري التحميل...</AppText>
      </Screen>
    );
  }

  return (
    <Screen
      title={editing ? form.NameAr || 'تعديل المنتج' : 'منتج جديد'}
      subtitle={editing ? 'عدّل ما تريد ثم احفظ' : 'المطلوب: صورة، اسم، سعر'}
      back
      footer={
        <>
          <ActionButton title="إلغاء" tone="ghost" onPress={() => router.back()} disabled={saving} />
          <ActionButton title={editing ? 'حفظ التغييرات' : 'إضافة المنتج'} icon="save-outline" onPress={submit} loading={saving} />
        </>
      }
    >
      {justCreatedParam === '1' && (
        <Card tone="ok">
          <AppText weight="extraBold" style={{ fontSize: 15, color: '#2D6B4B' }}>تمت إضافة المنتج وهو الآن في متجرك</AppText>
          <AppText muted style={{ fontSize: 13, lineHeight: 21 }}>إن كان له مقاسات أو ألوان فأضفها من «إدارة المتغيرات» بالأسفل.</AppText>
        </Card>
      )}

      <SectionTitle>الصور</SectionTitle>
      <Card>
        <View style={styles.images}>
          {oldImages.map((img) => (
            <View key={img.id} style={[styles.img, img.isPrimary && { borderColor: colors.primary, borderWidth: 2 }]}>
              <Image source={{ uri: getImageUrl(img.imageUrl, 400) ?? undefined }} style={{ flex: 1 }} contentFit="cover" />
              {img.isPrimary ? (
                <View style={styles.badge}><AppText weight="bold" style={{ fontSize: 10.5, color: '#FFFFFF' }}>الرئيسية</AppText></View>
              ) : (
                <Pressable onPress={() => makePrimary(img)} disabled={imageBusy === img.id} style={styles.imgBtnBottom} accessibilityLabel="اجعلها الرئيسية"><Ionicons name="star" size={14} color="#D97706" /></Pressable>
              )}
              <Pressable onPress={() => removeOld(img)} style={styles.imgBtnTop} accessibilityLabel="حذف الصورة"><Ionicons name="trash" size={13} color={colors.errorDark} /></Pressable>
            </View>
          ))}
          {newImages.map((img, i) => (
            <View key={img.key} style={[styles.img, oldImages.length === 0 && i === 0 && { borderColor: colors.primary, borderWidth: 2 }]}>
              <Image source={{ uri: img.uri }} style={{ flex: 1 }} contentFit="cover" />
              {oldImages.length === 0 && i === 0 && <View style={styles.badge}><AppText weight="bold" style={{ fontSize: 10.5, color: '#FFFFFF' }}>الرئيسية</AppText></View>}
              {editing && <View style={[styles.badge, { start: undefined, end: 4, backgroundColor: '#3B82F6' }]}><AppText weight="bold" style={{ fontSize: 10.5, color: '#FFFFFF' }}>جديدة</AppText></View>}
              <Pressable onPress={() => setNewImages((p) => p.filter((x) => x.key !== img.key))} style={styles.imgBtnTop} accessibilityLabel="إزالة"><Ionicons name="close" size={14} color={colors.text} /></Pressable>
            </View>
          ))}
          {imageCount < MAX_PRODUCT_IMAGES && (
            <Pressable onPress={pickImages} style={[styles.img, styles.add, !!errors.images && { borderColor: colors.error }]} accessibilityRole="button" accessibilityLabel="إضافة صور">
              <Ionicons name="image-outline" size={24} color={colors.primary} />
              <AppText weight="medium" style={{ fontSize: 12 }}>{imageCount === 0 ? 'أضف صور المنتج' : 'إضافة'}</AppText>
            </Pressable>
          )}
        </View>
        <AppText muted style={{ fontSize: 12.5 }}>حتى {MAX_PRODUCT_IMAGES} صور، والأولى هي التي تظهر في المتجر.</AppText>
        {!!errors.images && <AppText style={{ color: colors.errorDark, fontSize: 13 }}>{errors.images}</AppText>}
      </Card>

      <SectionTitle>المعلومات</SectionTitle>
      <Card>
        <Input label="اسم المنتج" value={form.NameAr} onChangeText={(t) => set({ NameAr: t })} error={errors.NameAr} placeholder="مثال: آيفون 15 برو 256GB" />
        <View style={{ gap: 4 }}>
          <AppText weight="medium" style={{ fontSize: 14 }}>الفئة</AppText>
          <Pressable onPress={() => setCatSheet(true)} style={styles.select} accessibilityRole="button">
            <AppText style={{ flex: 1, color: category ? colors.text : colors.placeholder }}>{category ? category.nameAr || category.name : 'اختر الفئة'}</AppText>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
          <AppText muted style={{ fontSize: 12 }}>تساعد الزبائن على إيجاد منتجك</AppText>
        </View>
        <Input label="الوصف" value={form.Description} onChangeText={(t) => set({ Description: t })} placeholder="المواصفات، المقاسات، الضمان، طريقة الاستخدام..." multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
      </Card>

      <SectionTitle>السعر والكمية</SectionTitle>
      <Card>
        <AppText weight="medium" style={{ fontSize: 14 }}>طريقة البيع</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[{ value: '', label: 'بالقطعة' }, ...WEIGHT_STEPS.map((s) => ({ ...s, label: `بالوزن · ${s.label}` }))].map((o) => {
            const on = form.WeightStep === o.value;
            return (
              <Pressable key={o.value || 'piece'} onPress={() => set({ WeightStep: o.value })} style={[styles.opt, on && styles.optOn]} accessibilityState={{ selected: on }}>
                <AppText weight={on ? 'bold' : 'regular'} style={{ fontSize: 13.5, color: on ? colors.primaryHover : colors.text }}>{o.label}</AppText>
              </Pressable>
            );
          })}
        </View>
        {weightStep > 0 && (
          <AppText muted style={{ fontSize: 12.5, lineHeight: 20 }}>
            اكتب السعر لكل كيلو والمخزون بالكيلو، ويطلب الزبون بخطوات {stepLabel(weightStep)}
            {price > 0 ? ` (سعر الخطوة ${round2(price * weightStep).toLocaleString('en-US')} د.ع)` : ''}
          </AppText>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label={weightStep ? 'السعر لكل كيلو (د.ع)' : 'سعر البيع (د.ع)'} value={form.Price} onChangeText={(t) => set({ Price: t })} error={errors.Price} keyboardType="number-pad" placeholder="0" ltr />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="السعر قبل الخصم" value={form.OriginalPrice} onChangeText={(t) => set({ OriginalPrice: t })} error={errors.OriginalPrice} keyboardType="number-pad" placeholder="اختياري" ltr />
          </View>
        </View>
        {discount > 0 && <Chip label={`خصم ${discount}% يظهر للزبون والسعر القديم مشطوب`} tone="ok" />}
        <AppText weight="medium" style={{ fontSize: 14 }}>{weightStep ? 'المتوفر (كيلو)' : 'الكمية المتوفرة'}</AppText>
        <View style={styles.stepRow}>
          <Pressable onPress={() => set({ StockQuantity: String(Math.max(0, (Number(form.StockQuantity) || 0) - 1)) })} style={styles.step} accessibilityLabel="إنقاص"><AppText weight="bold" style={{ fontSize: 22 }}>−</AppText></Pressable>
          <TextInput value={form.StockQuantity} onChangeText={(t) => set({ StockQuantity: t })} keyboardType="decimal-pad" style={styles.stock} />
          <Pressable onPress={() => set({ StockQuantity: String((Number(form.StockQuantity) || 0) + 1) })} style={styles.step} accessibilityLabel="زيادة"><AppText weight="bold" style={{ fontSize: 22 }}>+</AppText></Pressable>
        </View>
        <Pressable onPress={() => setShowMore((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AppText weight="bold" style={{ color: colors.primaryHover, fontSize: 14 }}>خيارات إضافية (الاسم بالإنجليزية، SKU)</AppText>
          <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primaryHover} />
        </Pressable>
        {showMore && (
          <>
            <Input label="الاسم بالإنجليزية" value={form.Name} onChangeText={(t) => set({ Name: t })} placeholder="iPhone 15 Pro" ltr autoCapitalize="none" />
            <Input label="رمز المنتج SKU" value={form.Sku} onChangeText={(t) => set({ Sku: t })} placeholder="IP15-256" ltr autoCapitalize="characters" />
          </>
        )}
      </Card>

      <SectionTitle>الظهور</SectionTitle>
      <Card>
        <ToggleLine title="ظاهر في المتجر" desc="عند الإيقاف يختفي عن الزبائن ويبقى محفوظاً" value={form.IsActive} onChange={(v) => set({ IsActive: v })} />
        <ToggleLine title="متاح للشراء" desc="عند الإيقاف يظهر بدون زر «أضف للسلة»" value={form.IsAvailable} onChange={(v) => set({ IsAvailable: v })} />
      </Card>

      {editing ? (
        <Card pad={4}>
          <ListRow icon="color-palette-outline" tone="primary" title="إدارة المتغيرات" subtitle="الألوان والمقاسات ومخزون كل خيار" onPress={() => router.push({ pathname: '/product/variants/[id]', params: { id, price: String(price) } })} last />
        </Card>
      ) : (
        <Card>
          <AppText muted style={{ fontSize: 13, lineHeight: 22 }}>للمقاسات أو الألوان: احفظ المنتج أولاً، ثم أضفها من «إدارة المتغيرات».</AppText>
        </Card>
      )}

      <Sheet visible={catSheet} onClose={() => setCatSheet(false)} title="اختر الفئة">
        <Pressable onPress={() => { set({ CategoryId: '' }); setCatSheet(false); }} style={styles.catRow}><AppText muted>بلا فئة</AppText></Pressable>
        {(categories.data ?? []).map((c) => (
          <Pressable key={c.id} onPress={() => { set({ CategoryId: c.id }); setCatSheet(false); }} style={[styles.catRow, form.CategoryId === c.id && { backgroundColor: colors.primaryLight }]}>
            <AppText weight={c.parentId ? 'regular' : 'bold'} style={{ paddingStart: c.parentId ? 16 : 0 }}>{c.parentId ? '— ' : ''}{c.nameAr || c.name}</AppText>
          </Pressable>
        ))}
      </Sheet>
    </Screen>
  );
}

function ToggleLine({ title, desc, value, onChange }: { title: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <AppText weight="bold" style={{ fontSize: 15 }}>{title}</AppText>
        <AppText muted style={{ fontSize: 12.5, lineHeight: 20 }}>{desc}</AppText>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFFFFF" />
    </View>
  );
}

const styles = createStyles(() => ({
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  img: { width: '31%', aspectRatio: 1, borderRadius: 16, backgroundColor: '#F8ECDA', overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  add: { borderStyle: 'dashed', borderColor: '#D9B98A', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 2 },
  badge: { position: 'absolute', bottom: 4, start: 4, backgroundColor: colors.primaryHover, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  imgBtnTop: { position: 'absolute', top: 4, end: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  imgBtnBottom: { position: 'absolute', bottom: 4, start: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  select: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 14, backgroundColor: colors.surface },
  opt: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 },
  optOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  step: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#F8ECDA', alignItems: 'center', justifyContent: 'center' },
  stock: { width: 96, height: 52, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, textAlign: 'center', fontFamily: fonts.extraBold, fontSize: 20, color: colors.text },
  catRow: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12 },
}));
