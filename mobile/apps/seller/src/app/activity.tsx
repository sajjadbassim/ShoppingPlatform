import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDateTime, type ActivityLog } from '@wasit/shared';
import { AppText, colors, createStyles, fonts, useTheme } from '@wasit/ui';
import { useActivity } from '../api/useVendor';
import { ActionButton, Card, Empty, FilterPills, Screen, ToggleRow } from '../components/kit';

const TYPE_AR: Record<string, string> = {
  Order: 'الطلب', SubOrder: 'جزء الطلب', SubOrderItem: 'قطعة في الطلب', Product: 'المنتج', ProductVariant: 'نسخة المنتج', ProductImage: 'صورة المنتج',
  Vendor: 'المتجر', User: 'المستخدم', Return: 'الإرجاع', ReturnItem: 'قطعة مرتجعة', Coupon: 'الكوبون', Promotion: 'العرض', Category: 'الفئة',
  VendorLedgerEntry: 'حساب المتجر', UserPreferences: 'الإعدادات', Review: 'التقييم', OrderStatusHistory: 'سجل حالة الطلب',
};
const FIELD_AR: Record<string, string> = {
  Status: 'الحالة', Price: 'السعر', DiscountPrice: 'سعر الخصم', StockQuantity: 'المخزون', IsActive: 'مفعّل', Name: 'الاسم', NameAr: 'الاسم العربي',
  FullName: 'الاسم', Phone: 'الهاتف', Email: 'البريد', DeliveryFee: 'أجرة التوصيل', Amount: 'المبلغ', Description: 'الوصف', CancellationReason: 'سبب الإلغاء',
  IsAcceptingOrders: 'يستقبل الطلبات', MinOrderAmount: 'الحد الأدنى', Reason: 'السبب', Value: 'القيمة', Code: 'الرمز', Quantity: 'الكمية', TotalAmount: 'الإجمالي',
  PaymentStatus: 'حالة الدفع', IsHidden: 'مخفي',
};

const KINDS = [
  { key: 'all', label: 'الكل' },
  { key: 'action', label: 'الإجراءات' },
  { key: 'auth', label: 'الدخول' },
  { key: 'failed', label: 'دخول فاشل' },
] as const;
const PERIODS = [
  { key: 'today', label: 'اليوم' },
  { key: '7', label: '7 أيام' },
  { key: '30', label: '30 يوماً' },
  { key: 'all', label: 'الكل' },
] as const;
const DAYS: Record<string, number | null> = { today: 0, '7': 7, '30': 30, all: null };

const shortDevice = (ua?: string | null) => {
  if (!ua) return null;
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return [br, os].filter(Boolean).join(' · ') || ua.slice(0, 40);
};

// سجل النشاط: ما فعله كل شخص في متجرك ومتى (الخادم يحدّد النطاق)
export default function ActivityScreen() {
  useTheme();
  const [kind, setKind] = useState<(typeof KINDS)[number]['key']>('all');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('7');
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const q = useActivity({ kind: kind === 'auth' ? 'AUTH' : kind === 'action' ? 'ACTION' : undefined, failedLoginsOnly: kind === 'failed', days: DAYS[period], mine, search: term });
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);

  return (
    <Screen title="سجل النشاط" subtitle="ما فعله كل شخص في متجرك، ومتى" back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.placeholder} />
        <TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => setTerm(search.trim())} onBlur={() => setTerm(search.trim())} returnKeyType="search" placeholder="رقم طلب، اسم منتج، اسم موظف" placeholderTextColor={colors.placeholder} style={styles.searchInput} textAlign="right" />
      </View>
      <FilterPills value={period} onChange={setPeriod} options={[...PERIODS]} />
      <FilterPills value={kind} onChange={setKind} options={[...KINDS]} />
      <Card><ToggleRow title="نشاطي أنا فقط" value={mine} onChange={setMine} /></Card>

      {q.isLoading ? (
        <AppText muted style={{ textAlign: 'center', paddingVertical: 30 }}>جاري التحميل...</AppText>
      ) : q.isError ? (
        <Empty icon="alert-circle-outline" text="تعذّر تحميل السجل" />
      ) : items.length === 0 ? (
        <Empty icon="pulse-outline" text="لا يوجد نشاط في هذه الفترة" />
      ) : (
        <Card pad={4}>{items.map((l, i) => <LogRow key={l.id} log={l} first={i === 0} />)}</Card>
      )}
      {q.hasNextPage && <ActionButton title={q.isFetchingNextPage ? 'جاري التحميل...' : 'عرض المزيد'} tone="ghost" onPress={() => q.fetchNextPage()} />}
    </Screen>
  );
}

function LogRow({ log, first }: { log: ActivityLog; first: boolean }) {
  useTheme();
  const [open, setOpen] = useState(false);
  const failed = log.action === 'auth.login_failed';
  const expandable = !!log.details?.length || !!log.ip || !!log.device;
  return (
    <View style={[styles.log, !first && { borderTopWidth: 1, borderTopColor: '#F8ECDA' }]}>
      <Pressable onPress={() => expandable && setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={[styles.dot, failed && { backgroundColor: colors.error }, log.kind === 'AUTH' && !failed && { backgroundColor: '#3B82F6' }]} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText weight="medium" style={{ fontSize: 14, lineHeight: 22, color: failed ? colors.errorDark : colors.text }}>{log.summary}</AppText>
          <AppText muted style={{ fontSize: 12 }}>{[log.actorName, formatDateTime(log.at)].filter(Boolean).join(' · ')}</AppText>
        </View>
        {expandable && <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.placeholder} />}
      </Pressable>
      {open && (
        <View style={{ gap: 8, marginStart: 18 }}>
          {(log.details ?? []).map((e, i) => (
            <View key={i} style={styles.change}>
              <AppText weight="bold" style={{ fontSize: 12.5 }}>{TYPE_AR[e.type] ?? e.type}{e.label ? ` · ${e.label}` : ''} — {e.state === 'Added' ? 'إضافة' : e.state === 'Deleted' ? 'حذف' : 'تعديل'}</AppText>
              {(e.changes ?? []).slice(0, 20).map((c, j) => (
                <AppText key={j} style={{ fontSize: 12.5 }}>
                  <AppText muted style={{ fontSize: 12.5 }}>{FIELD_AR[c.p] ?? c.p}: </AppText>
                  {e.state === 'Modified' && <AppText style={{ fontSize: 12.5, color: colors.errorDark, textDecorationLine: 'line-through' }}>{c.o ?? '—'} </AppText>}
                  <AppText weight="bold" style={{ fontSize: 12.5, color: '#2D6B4B' }}>{e.state === 'Modified' ? '← ' : ''}{c.n ?? '—'}</AppText>
                </AppText>
              ))}
            </View>
          ))}
          {(log.ip || log.device) && <AppText muted style={{ fontSize: 11.5 }}>{[shortDevice(log.device), log.ip].filter(Boolean).join(' · ')}</AppText>}
        </View>
      )}
    </View>
  );
}

const styles = createStyles(() => ({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text, paddingVertical: 8 },
  log: { padding: 12, gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D4621A', marginTop: 7 },
  change: { backgroundColor: '#F8ECDA', borderRadius: 12, padding: 10, gap: 3 },
}));
