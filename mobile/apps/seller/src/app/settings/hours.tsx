import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DAY_NAMES, fetchVendorPrefs, formatTime, fullSchedule, toWorkingHoursJson, updateVendorPrefs, updateVendorProfile, type VendorNotifyPrefs } from '@wasit/shared';
import { AppText, colors, createStyles, fonts, useTheme } from '@wasit/ui';
import { useProfile } from '../../api/useVendor';
import { ActionButton, Card, Screen, SectionTitle, ToggleRow } from '../../components/kit';
import { toast } from '../../lib/toast';
import { useVendorId } from '../../lib/vendor';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const NOTIFY: { key: keyof VendorNotifyPrefs; title: string; desc: string }[] = [
  { key: 'notifyNewOrders', title: 'طلبات جديدة', desc: 'إشعار عند وصول طلب جديد لمتجرك' },
  { key: 'notifyOrderConfirmations', title: 'تأكيد الطلبات', desc: 'إشعار عند تأكيد أو إلغاء طلب لمتجرك' },
  { key: 'notifyReviews', title: 'تقييمات جديدة', desc: 'إشعار عند كتابة تقييم جديد على منتجاتك' },
  { key: 'notifyLowStock', title: 'مخزون منخفض', desc: 'تنبيه عند انخفاض أو نفاد مخزون منتج' },
];

// استقبال الطلبات وأوقات العمل والإشعارات
export default function HoursScreen() {
  useTheme();
  const vendorId = useVendorId();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const prefsQ = useQuery({ queryKey: ['v-prefs'], queryFn: fetchVendorPrefs });
  const v = profile.data;
  const [accepting, setAccepting] = useState(true);
  const [useSchedule, setUseSchedule] = useState(false);
  const [schedule, setSchedule] = useState(fullSchedule(null));
  const [prefs, setPrefs] = useState<VendorNotifyPrefs>({});
  const [busy, setBusy] = useState<'hours' | 'prefs' | null>(null);

  useEffect(() => {
    if (!v) return;
    setAccepting(v.isAcceptingOrders ?? true);
    setUseSchedule(!!v.workingHours?.length);
    setSchedule(fullSchedule(v.workingHours));
  }, [v]);
  useEffect(() => {
    if (prefsQ.data) setPrefs(prefsQ.data);
  }, [prefsQ.data]);

  const update = (day: number, patch: Partial<(typeof schedule)[number]>) => setSchedule((s) => s.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  const invalid = useSchedule && schedule.some((d) => !d.closed && (!TIME.test(d.open) || !TIME.test(d.close)));

  const saveHours = async () => {
    setBusy('hours');
    try {
      // بلا جدول = مفتوح دائماً (نص فارغ يمسح الجدول)
      await updateVendorProfile(vendorId, { IsAcceptingOrders: accepting, WorkingHours: useSchedule ? toWorkingHoursJson(schedule) : '' });
      queryClient.invalidateQueries({ queryKey: ['v-profile'] });
      queryClient.invalidateQueries({ queryKey: ['v-dashboard'] });
      toast.success('تم حفظ أوقات العمل');
    } catch (e) {
      toast.error((e as { message?: string }).message || 'فشل حفظ أوقات العمل');
    } finally {
      setBusy(null);
    }
  };

  const savePrefs = async () => {
    setBusy('prefs');
    try {
      await updateVendorPrefs(Object.fromEntries(NOTIFY.map((n) => [n.key, prefs[n.key] ?? true])) as VendorNotifyPrefs);
      toast.success('تم حفظ إعدادات الإشعارات');
    } catch (e) {
      toast.error((e as { message?: string }).message || 'فشل الحفظ');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title="الأوقات والإشعارات" back>
      <SectionTitle>استقبال الطلبات</SectionTitle>
      <Card>
        <ToggleRow title="يستقبل الطلبات" desc="أوقف الاستقبال مؤقتاً دون إغلاق المتجر" value={accepting} onChange={setAccepting} />
        <ToggleRow title="العمل بجدول أسبوعي" desc="بلا جدول يكون المتجر مفتوحاً دائماً" value={useSchedule} onChange={setUseSchedule} />
        {useSchedule && (
          <View style={{ gap: 8 }}>
            {schedule.map((d) => (
              <View key={d.day} style={styles.day}>
                <AppText weight="bold" style={{ width: 64, fontSize: 14 }}>{DAY_NAMES[d.day]}</AppText>
                {d.closed ? (
                  <AppText muted style={{ flex: 1, fontSize: 13 }}>مغلق طوال اليوم</AppText>
                ) : (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TimeBox value={d.open} onChange={(t) => update(d.day, { open: t })} />
                    <AppText muted>إلى</AppText>
                    <TimeBox value={d.close} onChange={(t) => update(d.day, { close: t })} />
                  </View>
                )}
                <AppText weight="bold" onPress={() => update(d.day, { closed: !d.closed })} style={{ color: colors.primaryHover, fontSize: 12.5 }}>{d.closed ? 'فتح' : 'إغلاق'}</AppText>
              </View>
            ))}
            {schedule.some((d) => !d.closed) && <AppText muted style={{ fontSize: 12 }}>الأوقات بصيغة 24 ساعة (مثل 09:00 و 22:00). مثال: {formatTime('21:30')}.</AppText>}
            {invalid && <AppText style={{ color: colors.errorDark, fontSize: 13 }}>اكتب الوقت بصيغة 09:00</AppText>}
          </View>
        )}
        <View style={{ flexDirection: 'row' }}><ActionButton title="حفظ أوقات العمل" onPress={saveHours} loading={busy === 'hours'} disabled={invalid || !v} /></View>
      </Card>

      <SectionTitle>الإشعارات</SectionTitle>
      <Card>
        {NOTIFY.map((n) => <ToggleRow key={n.key} title={n.title} desc={n.desc} value={prefs[n.key] ?? true} onChange={(val) => setPrefs((p) => ({ ...p, [n.key]: val }))} />)}
        <AppText muted style={{ fontSize: 12, lineHeight: 19 }}>تُحفظ تفضيلاتك في حسابك. وصول الإشعارات إلى هذا التطبيق نفسه يحتاج تفعيلاً من الخادم، وإلى ذلك تتحدث الطلبات تلقائياً كل دقيقة.</AppText>
        <View style={{ flexDirection: 'row' }}><ActionButton title="حفظ الإشعارات" tone="soft" onPress={savePrefs} loading={busy === 'prefs'} /></View>
      </Card>
    </Screen>
  );
}

function TimeBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  useTheme();
  return <TextInput value={value} onChangeText={onChange} maxLength={5} keyboardType="numbers-and-punctuation" style={[styles.time, !TIME.test(value) && { borderColor: colors.error }]} />;
}

const styles = createStyles(() => ({
  day: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  time: { flex: 1, minHeight: 42, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: colors.text, writingDirection: 'ltr' },
}));
