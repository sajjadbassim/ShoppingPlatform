import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { fetchGoogleStatus, getImageUrl, IMG_SIZE, isNotifyOn, linkGoogle, logout, unlinkGoogle, useSessionStore, type ApiError, type AuthUser, type NotifyPreference } from '@wasit/shared';
import { AppText, colors, radius, spacing, createStyles, tc, useTheme } from '@wasit/ui';
import { queryClient } from '../api/queryClient';
import { AppHeader } from '../components/AppHeader';
import { useMyPreferences, useUpdatePreferences } from '../api/usePreferences';
import { useDevicePush } from '../lib/useDevicePush';
import { changeTheme } from '../lib/theme';
import { googleAvailable, googleErrorMessage, pickGoogleCredential } from '../lib/google';
import { comingSoonToast, toast } from '../lib/toast';
import { confirmDialog } from '../lib/dialog';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface RowProps {
  icon: IconName;
  tint: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
  // بدل السهم: مفتاح تبديل أو زر صغير
  right?: React.ReactNode;
}

function Row({ icon, tint, title, subtitle, onPress, danger, right }: RowProps) {
  useTheme();
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: tint + '1A' }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText weight="bold" style={[styles.rowTitle, danger && { color: colors.errorDark }]}>
          {title}
        </AppText>
        {!!subtitle && (
          <AppText muted style={styles.rowSub}>
            {subtitle}
          </AppText>
        )}
      </View>
      {right ?? (!danger && <Ionicons name="chevron-back" size={18} color={colors.placeholder} />)}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText weight="bold" muted style={styles.sectionTitle}>
        {title}
      </AppText>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

// شاشة الإعدادات كما في الويب. ما لا يدعمه التطبيق بعد (الوضع الداكن، إشعارات الجهاز، Google) غير معروض
// ميزات موجودة في الويب ولم تُبنَ في التطبيق بعد (موثّقة في سجل التقدّم): تظهر ويُبلَّغ المستخدم عند الضغط
const comingSoon = (_name: string) => comingSoonToast();

const SoonSwitch = ({ name }: { name: string }) => {
  useTheme();
  return (
  <Switch value={false} onValueChange={() => comingSoon(name)} trackColor={{ true: colors.primary, false: colors.border }} />
);
};

// «حساب Google»: ربط/فصل الدخول بـ Google (للزبائن فقط؛ يخفى إن لم يسمح الخادم)
function GoogleAccountRow() {
  useTheme();
  const { data: status, refetch } = useQuery({ queryKey: ['google-status'], queryFn: fetchGoogleStatus, staleTime: 60 * 1000 });
  const [busy, setBusy] = useState(false);
  if (!status?.canLink) return null;

  const link = async () => {
    if (!googleAvailable()) return toast.info('ربط حساب Google غير متاح في هذه النسخة');
    setBusy(true);
    try {
      const credential = await pickGoogleCredential();
      if (!credential) return;
      await linkGoogle(credential);
      toast.success('تم ربط حساب Google، يمكنك الدخول به من الآن');
      await refetch();
    } catch (e) {
      toast.error((e as ApiError).status ? (e as ApiError).message : googleErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const unlink = () => {
    if (!status.hasPassword) return toast.info('أضف كلمة مرور أولاً من «نسيت كلمة المرور»');
    confirmDialog({
      title: 'فصل حساب Google',
      message: 'ستدخل برقم هاتفك وكلمة المرور فقط.',
      confirmText: 'فصل',
      icon: 'logo-google',
      onConfirm: async () => {
        setBusy(true);
        try {
          await unlinkGoogle();
          toast.success('تم فصل حساب Google');
          await refetch();
        } catch (e) {
          toast.error((e as ApiError).message || 'تعذّر الفصل');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  return (
    <Row
      icon="logo-google"
      tint={tc("#EA4335")}
      title="حساب Google"
      subtitle={status.linked ? `مربوط: ${status.googleEmail ?? ''}` : 'اربطه لتدخل بضغطة واحدة'}
      onPress={busy ? () => {} : status.linked ? unlink : link}
      right={
        <View style={[styles.linkPill, status.linked && styles.unlinkPill, busy && { opacity: 0.5 }]}>
          <AppText weight="bold" style={[styles.linkText, status.linked && { color: tc('#374151') }]}>
            {status.linked ? 'فصل' : 'ربط'}
          </AppText>
        </View>
      }
    />
  );
}

// «الإشعارات» كما في الويب: إشعارات هذا الجهاز + تحديثات الطلبات + التذكيرات (الأخيران محفوظان في الحساب)
function NotificationSettings() {
  useTheme();
  const { status, busy, toggle } = useDevicePush();
  const { data: prefs } = useMyPreferences();
  const { mutate: update, isPending } = useUpdatePreferences();

  const setPref = (key: NotifyPreference, value: boolean, messages: [string, string]) =>
    update(
      { [key]: value },
      {
        onSuccess: () => toast.success(value ? messages[0] : messages[1]),
        onError: (e) => toast.error((e as ApiError).message || 'تعذّر حفظ الإعداد'),
      },
    );

  const deviceSubtitle = !status
    ? 'تصلك تنبيهات الطلبات على هذا الجهاز'
    : !status.supported
      ? 'غير متاحة في هذه النسخة'
      : status.blocked
        ? 'محجوبة من إعدادات النظام: اضغط للسماح'
        : 'تصلك تنبيهات الطلبات على هذا الجهاز';

  return (
    <Section title="الإشعارات">
      <Row
        icon="notifications-outline"
        tint={tc("#10B981")}
        title="إشعارات هذا الجهاز"
        subtitle={deviceSubtitle}
        onPress={() => toggle(!status?.enabled)}
        right={
          <Switch
            value={!!status?.enabled}
            disabled={busy || !status || !status.supported}
            onValueChange={toggle}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        }
      />
      <Row
        icon="notifications-outline"
        tint={tc("#EF4444")}
        title="تحديثات الطلبات"
        subtitle="عند تأكيد طلبك وتحضيره وخروجه للتوصيل"
        onPress={() => setPref('notifyOrderUpdates', !isNotifyOn(prefs, 'notifyOrderUpdates'), ['سنُعلمك بكل تحديث على طلباتك', 'تم إيقاف إشعارات الطلبات'])}
        right={
          <Switch
            value={isNotifyOn(prefs, 'notifyOrderUpdates')}
            disabled={isPending}
            onValueChange={(v) => setPref('notifyOrderUpdates', v, ['سنُعلمك بكل تحديث على طلباتك', 'تم إيقاف إشعارات الطلبات'])}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        }
      />
      <Row
        icon="notifications-outline"
        tint={tc("#F59E0B")}
        title="التذكيرات"
        subtitle="توفر منتج طلبت تنبيهه، ومنتجات تركتها في السلة"
        onPress={() => setPref('notifyReminders', !isNotifyOn(prefs, 'notifyReminders'), ['سنُذكّرك بالمنتجات التي تنتظرها', 'تم إيقاف التذكيرات'])}
        right={
          <Switch
            value={isNotifyOn(prefs, 'notifyReminders')}
            disabled={isPending}
            onValueChange={(v) => setPref('notifyReminders', v, ['سنُذكّرك بالمنتجات التي تنتظرها', 'تم إيقاف التذكيرات'])}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        }
      />
    </Section>
  );
}

// الوضع الداكن: يُطبَّق فوراً ويُحفظ على الجهاز وفي الحساب (كما في الويب)
function DarkModeRow() {
  const dark = useTheme() === 'dark';
  return (
    <Row
      icon="moon-outline"
      tint={tc('#6366F1')}
      title="الوضع الداكن"
      subtitle="مظهر مريح للعين ليلاً"
      onPress={() => changeTheme(dark ? 'light' : 'dark')}
      right={<Switch value={dark} onValueChange={(v) => changeTheme(v ? 'dark' : 'light')} trackColor={{ true: colors.primary, false: colors.border }} />}
    />
  );
}

export default function SettingsScreen() {
  useTheme();
  const user = useSessionStore((s) => s.session) as AuthUser | null;
  const signedIn = useSessionStore((s) => s.signedIn);
  const go = (href: Href) => router.push(href);

  const share = () => Share.share({ message: 'جرّب تطبيق وسيط للتسوق والتوصيل السريع' }).catch(() => {});
  const clearCache = () =>
    confirmDialog({
      title: 'مسح البيانات المؤقتة',
      message: 'ستُعاد قراءة البيانات من الخادم.',
      confirmText: 'مسح',
      icon: 'refresh-outline',
      onConfirm: () => queryClient.clear(),
    });

  return (
    <View style={styles.page}>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText weight="extraBold" style={styles.title}>
          الإعدادات
        </AppText>

        {signedIn && user ? (
          <LinearGradient colors={[tc('#6366F1'), tc('#8B5CF6')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profile}>
            <View style={styles.avatar}>
              {getImageUrl(user.avatarUrl, IMG_SIZE.THUMB) ? (
                <Image source={{ uri: getImageUrl(user.avatarUrl, IMG_SIZE.THUMB)! }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <AppText weight="extraBold" style={styles.avatarText}>
                  {(user.fullName || '?').charAt(0)}
                </AppText>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <AppText weight="extraBold" style={styles.profileName} numberOfLines={1}>
                {user.fullName}
              </AppText>
              <AppText style={styles.profileSub} numberOfLines={1}>
                {user.phone || user.email}
              </AppText>
            </View>
            <Pressable style={styles.editPill} onPress={() => go('/account')}>
              <AppText weight="bold" style={styles.editText}>
                تعديل
              </AppText>
            </Pressable>
          </LinearGradient>
        ) : (
          <Pressable style={styles.loginCard} onPress={() => go('/login')}>
            <AppText weight="bold" style={{ color: colors.primary }}>
              سجّل دخولك لإدارة حسابك
            </AppText>
          </Pressable>
        )}

        {signedIn && (
          <Section title="الحساب">
            <Row icon="person-outline" tint={tc("#4F46E5")} title="الملف الشخصي" subtitle="الاسم والبريد الإلكتروني" onPress={() => go('/account')} />
            <Row icon="location-outline" tint={tc("#10B981")} title="عناوين التوصيل" subtitle="إضافة وتعديل عناوينك" onPress={() => go('/addresses')} />
            <Row icon="lock-closed-outline" tint={tc("#F59E0B")} title="كلمة المرور والأمان" subtitle="تغيير كلمة المرور" onPress={() => go('/change-password')} />
            <GoogleAccountRow />
            <Row icon="star-outline" tint={tc("#F59E0B")} title="النقاط التشجيعية" subtitle="رصيدك وسجل النقاط" onPress={() => go('/loyalty')} />
            <Row icon="notifications-outline" tint={tc("#EF4444")} title="الإشعارات" subtitle="آخر التحديثات على طلباتك" onPress={() => go('/notifications')} />
          </Section>
        )}

        {signedIn && <NotificationSettings />}

        <Section title="التطبيق">
          <Row icon="download-outline" tint={tc("#6366F1")} title="تثبيت التطبيق" subtitle="وصول أسرع من الشاشة الرئيسية" onPress={() => comingSoon('تثبيت التطبيق')} />
          <Row icon="share-social-outline" tint={tc("#6366F1")} title="مشاركة التطبيق" subtitle="أرسل وسيط لأصدقائك" onPress={share} />
          <Row icon="refresh-outline" tint={tc("#10B981")} title="مسح البيانات المؤقتة" subtitle="إذا ظهرت نسخة قديمة أو لم تتحدث الصفحات" onPress={clearCache} />
        </Section>

        <Section title="اللغة والمظهر">
          <DarkModeRow />
          <Row icon="globe-outline" tint={tc("#0EA5E9")} title="اللغة والعملة" subtitle="العربية · دينار عراقي" onPress={() => {}} />
        </Section>

        <Section title="المساعدة والمعلومات">
          <Row icon="help-circle-outline" tint={tc("#8B5CF6")} title="مركز المساعدة" subtitle="الأسئلة الشائعة والأدلة" onPress={() => router.push('/help')} />
          <Row icon="chatbubble-ellipses-outline" tint={tc("#10B981")} title="تواصل معنا" subtitle="فريق الدعم جاهز لمساعدتك" onPress={() => router.push('/contact')} />
          <Row icon="refresh-circle-outline" tint={tc("#F97316")} title="سياسة الإرجاع" subtitle="" onPress={() => router.push({ pathname: '/info/[doc]', params: { doc: 'returnPolicy' } })} />
          <Row icon="bicycle-outline" tint={tc("#F59E0B")} title="الشحن والتوصيل" subtitle="" onPress={() => router.push({ pathname: '/info/[doc]', params: { doc: 'shipping' } })} />
          <Row icon="document-text-outline" tint={tc("#6B7280")} title="شروط الاستخدام" subtitle="" onPress={() => router.push({ pathname: '/info/[doc]', params: { doc: 'terms' } })} />
          <Row icon="shield-checkmark-outline" tint={tc("#6B7280")} title="سياسة الخصوصية" subtitle="" onPress={() => router.push({ pathname: '/info/[doc]', params: { doc: 'privacy' } })} />
          <Row icon="information-circle-outline" tint={tc("#6B7280")} title="من نحن" subtitle="" onPress={() => router.push('/about')} />
        </Section>

        {signedIn && (
          <View style={styles.group}>
            <Row icon="log-out-outline" tint={colors.errorDark} title="تسجيل الخروج" subtitle="" danger onPress={logout} />
            <Row icon="trash-outline" tint={colors.errorDark} title="حذف الحساب" subtitle="حذف حسابك وبياناتك نهائياً" danger onPress={() => router.push('/delete-account')} />
          </View>
        )}

        <View style={styles.footer}>
          <AppText weight="bold">منصة وسيط التجارية</AppText>
          <AppText muted style={styles.version}>
            الإصدار {Constants.expoConfig?.version ?? '1.0.0'}
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: 28 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 24 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.primary, fontSize: 24, lineHeight: 34 },
  profileName: { color: colors.white, fontSize: 18 },
  profileSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  editPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.25)' },
  editText: { color: colors.white, fontSize: 13 },
  loginCard: { padding: spacing.md, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: 'center' },
  linkPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.primary },
  unlinkPill: { backgroundColor: '#F3F4F6' },
  linkText: { color: colors.white, fontSize: 13 },
  sectionTitle: { fontSize: 13 },
  group: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15 },
  rowSub: { fontSize: 12 },
  footer: { alignItems: 'center', gap: 2, marginTop: spacing.md },
  version: { fontSize: 12 },
}));
