import { useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';
import {
  dayToIso,
  discountText,
  formatDate,
  isoToDay,
  marketingStatus,
  saveCoupon,
  savePromotion,
  type Coupon,
  type DiscountType,
  type Promotion,
} from '@wasit/shared';
import { AppText, colors, createStyles, fonts, Input, useTheme , tc } from '@wasit/ui';
import { useCoupons, useDeleteMarketing, useProducts, usePromotions } from '../api/useVendor';
import { ActionButton, Card, Chip, Empty, ltr, money, Screen, Segmented } from '../components/kit';
import { Sheet } from '../components/Sheet';
import { confirmDialog } from '../lib/dialog';
import { toast } from '../lib/toast';
import { useVendorId } from '../lib/vendor';

type Tab = 'coupons' | 'promotions';

// العروض (خصم على منتج أو على المتجر كله) والكوبونات (تُحسب على مشتريات المتجر فقط)
export default function PromotionsScreen() {
  useTheme();
  const [tab, setTab] = useState<Tab>('coupons');
  const [editCoupon, setEditCoupon] = useState<Coupon | 'new' | null>(null);
  const [editPromo, setEditPromo] = useState<Promotion | 'new' | null>(null);
  const coupons = useCoupons();
  const promos = usePromotions();
  const remove = useDeleteMarketing();

  const del = (kind: 'coupon' | 'promotion', id: string, label: string) =>
    confirmDialog({
      title: `حذف ${label}؟`,
      message: kind === 'coupon' ? 'إن كان الكوبون مستخدماً فسيُوقف بدل أن يُحذف.' : undefined,
      confirmText: 'حذف',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await remove.mutateAsync({ kind, id });
          toast.success(kind === 'coupon' ? 'تم حذف الكوبون (أو إيقافه إن كان مستخدماً)' : 'تم حذف العرض');
        } catch (e) {
          toast.error((e as { message?: string }).message || 'تعذّر الحذف');
        }
      },
    });

  return (
    <Screen
      title="العروض والكوبونات"
      subtitle="خصومات على منتجاتك وكوبونات لزبائنك"
      back
      footer={<ActionButton title={tab === 'coupons' ? 'كوبون جديد' : 'عرض جديد'} icon="add" onPress={() => (tab === 'coupons' ? setEditCoupon('new') : setEditPromo('new'))} />}
    >
      <Segmented value={tab} onChange={setTab} options={[{ key: 'coupons', label: 'الكوبونات', badge: coupons.data?.length }, { key: 'promotions', label: 'العروض', badge: promos.data?.length }]} />

      {tab === 'coupons' ? (
        (coupons.data ?? []).length === 0 ? (
          <Empty icon="pricetag-outline" text={coupons.isLoading ? 'جاري التحميل...' : 'لا توجد كوبونات بعد'} />
        ) : (
          coupons.data!.map((c) => {
            const st = marketingStatus(c);
            return (
              <Card key={c.id} tone={st.tone === 'ok' ? undefined : undefined}>
                <View style={styles.row}>
                  <Pressable onPress={() => { Clipboard.setStringAsync(c.code); toast.success('نُسخ الكود'); }} style={styles.code} accessibilityLabel="نسخ الكود">
                    <AppText weight="extraBold" style={{ fontSize: 17, letterSpacing: 1, writingDirection: 'ltr' }}>{c.code}</AppText>
                  </Pressable>
                  <View style={{ flex: 1 }} />
                  <Chip label={st.label} tone={st.tone} />
                </View>
                {!c.vendorId && <Chip label="من المنصة" tone="primary" />}
                <AppText style={{ fontSize: 14, lineHeight: 23 }}>
                  خصم {discountText(c)}
                  {c.minOrderAmount > 0 ? ` على مشترياتك فوق ${money(c.minOrderAmount)}` : ''}
                </AppText>
                {!!c.description && <AppText muted style={{ fontSize: 13 }}>{c.description}</AppText>}
                <AppText muted style={{ fontSize: 12.5 }}>
                  استُخدم {ltr(c.usageCount)}{c.usageLimit ? ` من ${ltr(c.usageLimit)}` : ''} · لكل زبون {c.userUsageLimit}
                  {c.expiresAt ? ` · ينتهي ${formatDate(c.expiresAt)}` : ''}
                </AppText>
                {c.vendorId && (
                  <View style={styles.row}>
                    <ActionButton title="تعديل" tone="soft" compact onPress={() => setEditCoupon(c)} />
                    <ActionButton title="حذف" tone="bad" compact onPress={() => del('coupon', c.id, c.code)} />
                  </View>
                )}
              </Card>
            );
          })
        )
      ) : (promos.data ?? []).length === 0 ? (
        <Empty icon="flash-outline" text={promos.isLoading ? 'جاري التحميل...' : 'لا توجد عروض بعد'} />
      ) : (
        promos.data!.map((p) => {
          const st = marketingStatus(p);
          return (
            <Card key={p.id}>
              <View style={styles.row}>
                <AppText weight="extraBold" style={{ flex: 1, fontSize: 16 }}>{p.name}</AppText>
                <Chip label={st.label} tone={st.tone} />
              </View>
              <AppText style={{ fontSize: 14 }}>خصم {discountText(p)} على {p.targetType === 'product' ? p.targetName || 'منتج محدد' : 'كل منتجات المتجر'}</AppText>
              <AppText muted style={{ fontSize: 12.5 }}>
                {p.startsAt ? `يبدأ ${formatDate(p.startsAt)}` : 'يبدأ فوراً'}{p.expiresAt ? ` · ينتهي ${formatDate(p.expiresAt)}` : ' · بلا تاريخ انتهاء'}
              </AppText>
              <View style={styles.row}>
                <ActionButton title="تعديل" tone="soft" compact onPress={() => setEditPromo(p)} />
                <ActionButton title="حذف" tone="bad" compact onPress={() => del('promotion', p.id, p.name)} />
              </View>
            </Card>
          );
        })
      )}

      <CouponSheet coupon={editCoupon} onClose={() => setEditCoupon(null)} />
      <PromotionSheet promotion={editPromo} onClose={() => setEditPromo(null)} />
    </Screen>
  );
}

function DiscountFields({ type, setType, value, setValue, max, setMax, locked }: { type: DiscountType; setType: (t: DiscountType) => void; value: string; setValue: (v: string) => void; max: string; setMax: (v: string) => void; locked?: boolean }) {
  useTheme();
  return (
    <>
      <View style={{ gap: 6 }}>
        <AppText weight="medium" style={{ fontSize: 14 }}>نوع الخصم{locked ? ' (لا يتغير بعد الإنشاء)' : ''}</AppText>
        <Segmented value={type} onChange={(t) => !locked && setType(t)} options={[{ key: 'percentage', label: 'نسبة %' }, { key: 'fixed', label: 'مبلغ ثابت' }]} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Input label={type === 'percentage' ? 'النسبة %' : 'المبلغ (د.ع)'} value={value} onChangeText={setValue} keyboardType="decimal-pad" ltr /></View>
        {type === 'percentage' && <View style={{ flex: 1 }}><Input label="سقف الخصم (اختياري)" value={max} onChangeText={setMax} keyboardType="number-pad" ltr /></View>}
      </View>
    </>
  );
}

function DateFields({ start, setStart, end, setEnd }: { start: string; setStart: (v: string) => void; end: string; setEnd: (v: string) => void }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1 }}><Input label="يبدأ (اختياري)" value={start} onChangeText={setStart} placeholder="2026-10-24" keyboardType="numbers-and-punctuation" maxLength={10} ltr /></View>
      <View style={{ flex: 1 }}><Input label="ينتهي (اختياري)" value={end} onChangeText={setEnd} placeholder="2026-10-30" keyboardType="numbers-and-punctuation" maxLength={10} ltr /></View>
    </View>
  );
}

function ActiveToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <AppText weight="bold" style={{ flex: 1, fontSize: 15 }}>{label}</AppText>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFFFFF" />
    </View>
  );
}

function CouponSheet({ coupon, onClose }: { coupon: Coupon | 'new' | null; onClose: () => void }) {
  useTheme();
  const vendorId = useVendorId();
  const queryClient = useQueryClient();
  const c = coupon && coupon !== 'new' ? coupon : null;
  const [key, setKey] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<DiscountType>('percentage');
  const [value, setValue] = useState('');
  const [max, setMax] = useState('');
  const [min, setMin] = useState('0');
  const [limit, setLimit] = useState('');
  const [perUser, setPerUser] = useState('1');
  const [active, setActive] = useState(true);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const k = coupon ? (c ? c.id : 'new') : null;
  if (k !== key) {
    setKey(k);
    setCode(c?.code ?? '');
    setDesc(c?.description ?? '');
    setType(c?.discountType ?? 'percentage');
    setValue(c ? String(c.discountValue) : '');
    setMax(c?.maxDiscountAmount ? String(c.maxDiscountAmount) : '');
    setMin(String(c?.minOrderAmount ?? 0));
    setLimit(c?.usageLimit ? String(c.usageLimit) : '');
    setPerUser(String(c?.userUsageLimit ?? 1));
    setActive(c?.isActive ?? true);
    setStart(isoToDay(c?.startsAt));
    setEnd(isoToDay(c?.expiresAt));
  }
  const valid = (c || code.trim().length >= 3) && Number(value) > 0;

  const save = async () => {
    setBusy(true);
    try {
      await saveCoupon(vendorId, c?.id ?? null, {
        ...(c ? {} : { code: code.trim().toUpperCase(), discountType: type }),
        description: desc.trim() || null,
        discountValue: Number(value) || 0,
        maxDiscountAmount: max ? Number(max) : null,
        minOrderAmount: Number(min) || 0,
        usageLimit: limit ? Number(limit) : null,
        userUsageLimit: Math.max(1, Number(perUser) || 1),
        isActive: active,
        startsAt: dayToIso(start),
        expiresAt: dayToIso(end, true),
      });
      toast.success('تم الحفظ');
      queryClient.invalidateQueries({ queryKey: ['v-coupons'] });
      onClose();
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={!!coupon} onClose={onClose} busy={busy} title={c ? `تعديل ${c.code}` : 'كوبون جديد'} subtitle="الخصم يُحسب على منتجات متجرك في السلة فقط، وتتحمله أنت." footer={<><ActionButton title="إلغاء" tone="ghost" onPress={onClose} disabled={busy} /><ActionButton title="حفظ" onPress={save} loading={busy} disabled={!valid} /></>}>
      {!c && <Input label="كود الكوبون (حروف إنجليزية وأرقام)" value={code} onChangeText={(t) => setCode(t.replace(/\s/g, '').toUpperCase())} placeholder="EID10" autoCapitalize="characters" ltr />}
      <Input label="وصف (اختياري)" value={desc} onChangeText={setDesc} />
      <DiscountFields type={type} setType={setType} value={value} setValue={setValue} max={max} setMax={setMax} locked={!!c} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Input label="حد أدنى لمشترياتك" value={min} onChangeText={setMin} keyboardType="number-pad" ltr /></View>
        <View style={{ flex: 1 }}><Input label="عدد الاستخدامات" value={limit} onChangeText={setLimit} placeholder="بلا حد" keyboardType="number-pad" ltr /></View>
        <View style={{ flex: 1 }}><Input label="لكل زبون" value={perUser} onChangeText={setPerUser} keyboardType="number-pad" ltr /></View>
      </View>
      <DateFields start={start} setStart={setStart} end={end} setEnd={setEnd} />
      <ActiveToggle label="الكوبون فعّال" value={active} onChange={setActive} />
    </Sheet>
  );
}

function PromotionSheet({ promotion, onClose }: { promotion: Promotion | 'new' | null; onClose: () => void }) {
  useTheme();
  const vendorId = useVendorId();
  const queryClient = useQueryClient();
  const products = useProducts();
  const p = promotion && promotion !== 'new' ? promotion : null;
  const [key, setKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState<'vendor' | 'product'>('vendor');
  const [productId, setProductId] = useState('');
  const [type, setType] = useState<DiscountType>('percentage');
  const [value, setValue] = useState('');
  const [max, setMax] = useState('');
  const [active, setActive] = useState(true);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const k = promotion ? (p ? p.id : 'new') : null;
  if (k !== key) {
    setKey(k);
    setName(p?.name ?? '');
    setTarget(p?.targetType === 'product' ? 'product' : 'vendor');
    setProductId(p?.targetType === 'product' ? p.targetId ?? '' : '');
    setType(p?.discountType ?? 'percentage');
    setValue(p ? String(p.discountValue) : '');
    setMax(p?.maxDiscountAmount ? String(p.maxDiscountAmount) : '');
    setActive(p?.isActive ?? true);
    setStart(isoToDay(p?.startsAt));
    setEnd(isoToDay(p?.expiresAt));
    setSearch('');
  }
  const valid = name.trim() && Number(value) > 0 && (target === 'vendor' || productId);
  const matches = (products.data ?? []).filter((x) => !search.trim() || (x.nameAr || x.name).includes(search.trim())).slice(0, 8);

  const save = async () => {
    setBusy(true);
    try {
      await savePromotion(vendorId, p?.id ?? null, {
        name: name.trim(),
        targetType: target,
        productId: target === 'product' ? productId : null,
        discountType: type,
        discountValue: Number(value) || 0,
        maxDiscountAmount: max ? Number(max) : null,
        isActive: active,
        startsAt: dayToIso(start),
        expiresAt: dayToIso(end, true),
      });
      toast.success('تم الحفظ');
      for (const k2 of ['v-promotions', 'v-products']) queryClient.invalidateQueries({ queryKey: [k2] });
      onClose();
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={!!promotion} onClose={onClose} busy={busy} title={p ? 'تعديل العرض' : 'عرض جديد'} subtitle="الخصم يظهر للزبون على سعر المنتج مباشرة، وتتحمله أنت." footer={<><ActionButton title="إلغاء" tone="ghost" onPress={onClose} disabled={busy} /><ActionButton title="حفظ" onPress={save} loading={busy} disabled={!valid} /></>}>
      <Input label="اسم العرض (يظهر لك فقط)" value={name} onChangeText={setName} placeholder="تخفيضات العيد" />
      <Segmented value={target} onChange={setTarget} options={[{ key: 'vendor', label: 'كل المتجر' }, { key: 'product', label: 'منتج محدد' }]} />
      {target === 'product' && (
        <View style={{ gap: 6 }}>
          <TextInput value={search} onChangeText={setSearch} placeholder="ابحث عن المنتج" placeholderTextColor={colors.placeholder} style={styles.search} textAlign="right" />
          {matches.map((x) => (
            <Pressable key={x.id} onPress={() => setProductId(x.id)} style={[styles.pick, productId === x.id && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <AppText weight={productId === x.id ? 'bold' : 'regular'} numberOfLines={1}>{x.nameAr || x.name}</AppText>
            </Pressable>
          ))}
        </View>
      )}
      <DiscountFields type={type} setType={setType} value={value} setValue={setValue} max={max} setMax={setMax} />
      <DateFields start={start} setStart={setStart} end={end} setEnd={setEnd} />
      <ActiveToggle label="العرض فعّال" value={active} onChange={setActive} />
    </Sheet>
  );
}

const styles = createStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { backgroundColor: tc('#FEF3E2'), borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#F4AE52', paddingHorizontal: 12, paddingVertical: 4 },
  search: { minHeight: 46, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  pick: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
}));
