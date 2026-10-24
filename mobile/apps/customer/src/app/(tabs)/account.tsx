import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { changePassword, removeAvatar, uploadAvatar, formatAddress, getImageUrl, IMG_SIZE, returnTone, updateProfile, useSessionStore, validateChangePassword, validateProfile, type Address, type ApiError, type AuthUser, type ChangePasswordErrors, type ProfileErrors, type ReturnRecord, formatDate, loyaltyTierName } from '@wasit/shared';
import { AppText, Button, ErrorBanner, Input, brand, colors, createStyles, createThemed, spacing, tc, useTheme } from '@wasit/ui';
import { useAddresses, useDeleteAddress, useZonesConfig } from '../../api/useCheckout';
import { useLoyaltyAccount, useWishlist } from '../../api/useEngagement';
import { useMyReturns } from '../../api/useFeedback';
import { useOrders } from '../../api/useOrders';
import { AddPhoneModal } from '../../components/AddPhoneModal';
import { pickImages } from '../../lib/pickImages';
import { toast } from '../../lib/toast';
import { actionSheet, confirmDialog } from '../../lib/dialog';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type TabKey = 'profile' | 'addresses' | 'returns' | 'security';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'profile', label: 'الملف الشخصي' },
  { key: 'addresses', label: 'العناوين' },
  { key: 'returns', label: 'الإرجاع' },
  { key: 'security', label: 'الأمان' },
];


export default function AccountScreen() {
  useTheme();
  const user = useSessionStore((s) => s.session) as AuthUser | null;
  const orders = useOrders();
  const wishlist = useWishlist();
  const loyalty = useLoyaltyAccount();
  const returns = useMyReturns();
  const pendingReturns = (returns.data ?? []).filter((r) => r.status?.toUpperCase() === 'PENDING').length;

  // فتح تبويب محدد من رابط (مثل الإعدادات: ?tab=addresses)
  const params = useLocalSearchParams<{ tab?: string }>();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : 'profile');
  useEffect(() => {
    if (TABS.some((t) => t.key === params.tab)) setTab(params.tab as TabKey);
  }, [params.tab]);

  if (!user) {
    return (
      <View style={styles.center}>
        <AppText weight="bold">سجّل دخولك لإدارة حسابك</AppText>
        <Button title="تسجيل الدخول" onPress={() => router.push('/login')} style={{ marginTop: spacing.md }} />
      </View>
    );
  }

  const avatar = getImageUrl(user.avatarUrl, IMG_SIZE.THUMB);

  const pickAvatar = async () => {
    const [image] = await pickImages(1);
    if (!image) return;
    setAvatarBusy(true);
    try {
      await uploadAvatar(image);
    } catch (e) {
      toast.error((e as ApiError).message || 'تعذّر رفع الصورة');
    } finally {
      setAvatarBusy(false);
    }
  };

  const deleteAvatar = async () => {
    setAvatarBusy(true);
    try {
      await removeAvatar();
    } catch (e) {
      toast.error((e as ApiError).message || 'تعذّر حذف الصورة');
    } finally {
      setAvatarBusy(false);
    }
  };

  const changeAvatar = () =>
    user.avatarUrl
      ? actionSheet({
          title: 'صورة الحساب',
          actions: [
            { label: 'اختيار صورة جديدة', icon: 'image-outline', onPress: pickAvatar },
            { label: 'حذف الصورة', icon: 'trash-outline', destructive: true, onPress: deleteAvatar },
          ],
        })
      : pickAvatar();

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View>
              <View style={styles.avatar}>
                {avatarBusy ? (
                  <ActivityIndicator color={colors.primary} />
                ) : avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <AppText weight="bold" style={styles.avatarText}>
                    {(user.fullName || '?').charAt(0)}
                  </AppText>
                )}
              </View>
              <Pressable style={styles.camera} onPress={changeAvatar} disabled={avatarBusy} accessibilityLabel="تغيير الصورة">
                <Ionicons name="camera-outline" size={15} color={colors.white} />
              </Pressable>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText weight="bold" style={styles.name} numberOfLines={1}>
                {user.fullName}
              </AppText>
              <AppText muted style={styles.email} numberOfLines={1}>
                {user.email || user.phone}
              </AppText>
            </View>
          </View>

          <View style={styles.statsRow}>
            <Pressable style={styles.stat} onPress={() => router.push('/orders')}>
              <AppText weight="bold" style={styles.statValue}>
                {orders.data?.length ?? 0}
              </AppText>
              <AppText muted style={styles.statLabel}>
                طلب
              </AppText>
            </Pressable>
            <Pressable style={styles.stat} onPress={() => router.push('/wishlist')}>
              <AppText weight="bold" style={styles.statValue}>
                {wishlist.data?.length ?? 0}
              </AppText>
              <AppText muted style={styles.statLabel}>
                مفضلة
              </AppText>
            </Pressable>
          </View>

          <Pressable style={styles.loyalty} onPress={() => router.push('/loyalty')}>
            <View style={styles.starCircle}>
              <Ionicons name="star" size={20} color={colors.white} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText weight="bold" style={styles.loyaltyTitle}>
                النقاط التشجيعية
              </AppText>
              <AppText numberOfLines={1} style={styles.loyaltyText}>
                رصيدك <AppText weight="bold" style={styles.loyaltyText}>{(loyalty.data?.balance ?? 0).toLocaleString('en-US')}</AppText> نقطة
                {loyalty.data?.tier ? ` • المستوى ${loyaltyTierName(loyalty.data.tier)}` : ''}
              </AppText>
            </View>
            <Ionicons name="chevron-back" size={18} color={tc("#D97706")} />
          </Pressable>
        </View>

        <View style={styles.tabsCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsBar} style={styles.tabsScroll}>
            {TABS.map((t) => {
              const active = t.key === tab;
              const label = t.key === 'returns' && pendingReturns > 0 ? `${t.label} (${pendingReturns})` : t.label;
              return (
                <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, active && styles.tabActive]}>
                  <AppText weight={active ? 'bold' : 'medium'} style={[styles.tabText, active && { color: colors.primary }]}>
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.tabBody}>
            {tab === 'profile' && <ProfileTab user={user} />}
            {tab === 'addresses' && <AddressesTab />}
            {tab === 'returns' && <ReturnsTab records={returns.data ?? []} loading={returns.isLoading} />}
            {tab === 'security' && <SecurityTab />}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  useTheme();
  return (
    <View style={styles.sectionHead}>
      <AppText weight="bold" style={styles.sectionTitle}>
        {title}
      </AppText>
      {action}
    </View>
  );
}

// ===== الملف الشخصي =====

function ProfileTab({ user }: { user: AuthUser }) {
  useTheme();
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startEdit = () => {
    setFullName(user.fullName ?? '');
    setEmail(user.email ?? '');
    setErrors({});
    setServerError(null);
    setEditing(true);
  };

  const save = async () => {
    const found = validateProfile({ fullName, email });
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await updateProfile(user.userId, { fullName, email });
      setEditing(false);
    } catch (e) {
      setServerError((e as ApiError).message || 'تعذّر حفظ التغييرات');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <AddPhoneModal visible={phoneOpen} onClose={() => setPhoneOpen(false)} />
      <SectionHead
        title="المعلومات الشخصية"
        action={
          !editing && (
            <Pressable style={styles.outlineButton} onPress={startEdit}>
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <AppText weight="medium" style={styles.outlineText}>
                تعديل
              </AppText>
            </Pressable>
          )
        }
      />
      {editing ? (
        <View style={{ gap: spacing.md }}>
          {serverError && <ErrorBanner title="تعذّر الحفظ" message={serverError} />}
          <Input
            label="الاسم الكامل"
            value={fullName}
            onChangeText={(t) => {
              setFullName(t);
              setErrors((p) => ({ ...p, fullName: undefined }));
            }}
            error={errors.fullName}
          />
          <Input
            label="البريد الإلكتروني"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setErrors((p) => ({ ...p, email: undefined }));
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            ltr
          />
          <Button title="حفظ التغييرات" loading={busy} onPress={save} />
          <Button title="إلغاء" variant="outline" onPress={() => setEditing(false)} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <InfoRow icon="person-outline" label="الاسم الكامل" value={user.fullName} />
          <InfoRow icon="mail-outline" label="البريد الإلكتروني" value={user.email} ltr />
          <InfoRow
            icon="call-outline"
            label="رقم الهاتف"
            value={user.phone}
            ltr
            action={!user.phone && <Button title="إضافة" variant="outline" onPress={() => setPhoneOpen(true)} />}
          />
          <Pressable style={styles.infoRow} onPress={() => router.push('/settings')}>
            <View style={styles.infoIcon}>
              <Ionicons name="notifications-outline" size={18} color={tc("#6B7280")} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText weight="medium" style={styles.infoValue}>
                إعدادات الإشعارات
              </AppText>
              <AppText muted style={styles.infoLabel}>
                تحديثات الطلبات والتذكيرات
              </AppText>
            </View>
            <Ionicons name="chevron-back" size={18} color={colors.placeholder} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value, ltr, action }: { icon: IconName; label: string; value?: string | null; ltr?: boolean; action?: React.ReactNode }) {
  useTheme();
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={tc("#6B7280")} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText muted style={styles.infoLabel}>
          {label}
        </AppText>
        <AppText weight="medium" numberOfLines={1} style={[styles.infoValue, ltr && { textAlign: 'right', writingDirection: 'ltr' }]}>
          {value || 'غير محدد'}
        </AppText>
      </View>
      {action}
    </View>
  );
}

// ===== العناوين =====

function AddressesTab() {
  useTheme();
  const { data: addresses, isLoading } = useAddresses();
  const { data: zones } = useZonesConfig();
  const remove = useDeleteAddress();

  const confirmDelete = (a: Address) =>
    confirmDialog({
      title: 'حذف العنوان',
      message: 'هل أنت متأكد من حذف هذا العنوان؟',
      confirmText: 'حذف',
      tone: 'danger',
      onConfirm: () =>
        remove.mutate(a.id, {
          onError: (e) => {
            const err = e as ApiError;
            toast.error(err.status === 400 ? 'لا يمكن حذف هذا العنوان لأنه مرتبط بطلبات سابقة' : err.message || 'فشل حذف العنوان');
          },
        }),
    });

  return (
    <View style={{ gap: 12 }}>
      <SectionHead
        title="عناويني"
        action={
          <Pressable style={styles.primaryButton} onPress={() => router.push('/address-new')}>
            <Ionicons name="add" size={18} color={colors.white} />
            <AppText weight="medium" style={styles.primaryButtonText}>
              إضافة عنوان
            </AppText>
          </Pressable>
        }
      />
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ margin: spacing.lg }} />
      ) : !addresses?.length ? (
        <View style={styles.empty}>
          <Ionicons name="location-outline" size={48} color={tc("#D1D5DB")} />
          <AppText muted>لا توجد عناوين محفوظة</AppText>
          <Button title="إضافة عنوان جديد" variant="outline" onPress={() => router.push('/address-new')} />
        </View>
      ) : (
        addresses.map((a) => (
          <View key={a.id} style={[styles.address, a.isDefault && styles.addressDefault]}>
            <View style={[styles.addressIcon, a.isDefault && { backgroundColor: colors.primary }]}>
              <Ionicons name="location-outline" size={18} color={a.isDefault ? colors.white : tc('#6B7280')} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.addressTitle}>
                <AppText weight="bold" numberOfLines={1} style={styles.addressLabel}>
                  {a.label || 'عنوان'}
                </AppText>
                {a.isDefault && (
                  <View style={styles.defaultChip}>
                    <AppText weight="medium" style={styles.defaultChipText}>
                      افتراضي
                    </AppText>
                  </View>
                )}
              </View>
              <AppText style={styles.addressText}>{formatAddress(a)}</AppText>
              {!!a.phone && <AppText muted style={styles.addressPhone}>{a.phone}</AppText>}
              {!!zones?.enabled && !!a.zoneName && (
                <View style={styles.zoneChip}>
                  <AppText style={styles.zoneChipText}>منطقة التوصيل: {a.zoneName}</AppText>
                </View>
              )}
            </View>
            <View style={styles.addressActions}>
              <Pressable style={styles.roundBtn} onPress={() => router.push({ pathname: '/address-new', params: { id: a.id } })} accessibilityLabel="تعديل">
                <Ionicons name="create-outline" size={16} color={tc("#4B5563")} />
              </Pressable>
              {!a.isDefault && (
                <Pressable style={[styles.roundBtn, { borderColor: tc('#FECACA') }]} onPress={() => confirmDelete(a)} accessibilityLabel="حذف">
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </Pressable>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ===== الإرجاع =====

const RETURN_TONES = createThemed(() => ({
  info: { bg: tc('#DBEAFE'), fg: tc('#1D4ED8') },
  warning: { bg: tc('#FEF9C3'), fg: tc('#A16207') },
  success: { bg: tc('#DCFCE7'), fg: tc('#15803D') },
  error: { bg: tc('#FEE2E2'), fg: tc('#DC2626') },
}));

function ReturnsTab({ records, loading }: { records: ReturnRecord[]; loading: boolean }) {
  useTheme();
  return (
    <View style={{ gap: 12 }}>
      <SectionHead
        title="طلبات الإرجاع"
        action={
          <Pressable style={styles.primaryButton} onPress={() => router.push('/return-new')}>
            <Ionicons name="add" size={18} color={colors.white} />
            <AppText weight="medium" style={styles.primaryButtonText}>
              طلب جديد
            </AppText>
          </Pressable>
        }
      />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ margin: spacing.lg }} />
      ) : records.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="return-down-back-outline" size={40} color={tc("#D1D5DB")} />
          <AppText muted>لا توجد طلبات إرجاع</AppText>
          <Button title="تقديم طلب إرجاع" variant="outline" onPress={() => router.push('/return-new')} />
        </View>
      ) : (
        <>
          {records.slice(0, 5).map((r) => {
            const tone = RETURN_TONES[returnTone(r.status)];
            return (
              <Pressable key={r.id} style={styles.returnRow} onPress={() => router.push('/returns')} accessibilityRole="button">
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText weight="medium" style={{ fontSize: 15 }}>
                    #{r.returnNumber || r.id.slice(0, 8)}
                  </AppText>
                  <AppText style={styles.returnDate}>{formatDate(r.createdAt)}</AppText>
                  <AppText muted style={{ fontSize: 14, marginTop: 2 }}>
                    {r.reasonAr}
                  </AppText>
                </View>
                <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                  <AppText weight="medium" style={{ color: tone.fg, fontSize: 12, lineHeight: 18 }}>
                    {r.statusAr}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
          {records.length > 5 && (
            <Pressable onPress={() => router.push('/returns')} style={{ paddingVertical: 8 }}>
              <AppText style={{ color: colors.primary, textAlign: 'center', fontSize: 14 }}>عرض كل الطلبات ({records.length})</AppText>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

// ===== الأمان =====

function SecurityTab() {
  useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clear = (key: keyof ChangePasswordErrors) => setErrors((p) => ({ ...p, [key]: undefined }));

  const submit = async () => {
    const found = validateChangePassword({ currentPassword, password, confirmPassword });
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await changePassword(currentPassword, password);
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
      toast.success('سُجّل خروجك من الأجهزة الأخرى لأمان حسابك', { title: 'تم تغيير كلمة المرور' });
    } catch (e) {
      setServerError((e as ApiError).message || 'تعذّر تغيير كلمة المرور');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <SectionHead title="الأمان وكلمة المرور" />
      <View style={styles.passwordBox}>
        <AppText weight="medium" style={{ fontSize: 15 }}>
          تغيير كلمة المرور
        </AppText>
        {serverError && <ErrorBanner title="تعذّر التغيير" message={serverError} />}
        <Input
          label="كلمة المرور الحالية"
          value={currentPassword}
          onChangeText={(t) => {
            setCurrentPassword(t);
            clear('currentPassword');
          }}
          error={errors.currentPassword}
          autoCapitalize="none"
          secure
          ltr
        />
        <Input
          label="كلمة المرور الجديدة"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            clear('password');
          }}
          error={errors.password}
          placeholder="6 أحرف على الأقل"
          autoCapitalize="none"
          secure
          ltr
        />
        <Input
          label="تأكيد كلمة المرور"
          value={confirmPassword}
          onChangeText={(t) => {
            setConfirmPassword(t);
            clear('confirmPassword');
          }}
          error={errors.confirmPassword}
          autoCapitalize="none"
          secure
          ltr
        />
        <Button
          title="تحديث كلمة المرور"
          loading={busy}
          disabled={!currentPassword || !password || !confirmPassword}
          onPress={submit}
        />
      </View>
    </View>
  );
}

const styles = createStyles(() => ({
  page: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: 16, paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 8 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.primary, fontSize: 26, lineHeight: 38 },
  camera: { position: 'absolute', bottom: 0, end: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18 },
  email: { fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: colors.background },
  statValue: { fontSize: 18, lineHeight: 26 },
  statLabel: { fontSize: 12 },
  loyalty: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: brand.goldLight, borderWidth: 1, borderColor: '#FDE68A' },
  starCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FBBF24', alignItems: 'center', justifyContent: 'center' },
  loyaltyTitle: { fontSize: 14, color: '#111827' },
  loyaltyText: { fontSize: 12, color: '#B45309' },
  tabsCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tabsScroll: { borderBottomWidth: 1, borderBottomColor: colors.border, flexGrow: 0 },
  tabsBar: { paddingHorizontal: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, color: colors.textMuted },
  tabBody: { padding: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  sectionTitle: { fontSize: 17 },
  outlineButton: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1.5, borderColor: colors.primary },
  outlineText: { color: colors.primary, fontSize: 14 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.primary },
  primaryButtonText: { color: colors.white, fontSize: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: colors.background },
  infoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 15, color: colors.text },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  address: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  addressDefault: { borderColor: colors.primary, backgroundColor: 'rgba(79,70,229,0.05)' },
  addressIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  addressTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressLabel: { fontSize: 15, flexShrink: 1 },
  defaultChip: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, flexShrink: 0 },
  defaultChipText: { color: colors.white, fontSize: 11, lineHeight: 16 },
  addressText: { fontSize: 14, color: '#4B5563', marginTop: 2 },
  addressPhone: { fontSize: 14, marginTop: 4, textAlign: 'right', writingDirection: 'ltr', alignSelf: 'flex-start' },
  zoneChip: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  zoneChipText: { fontSize: 11, color: '#4B5563' },
  addressActions: { flexDirection: 'row', gap: 6 },
  roundBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  returnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, backgroundColor: colors.background },
  returnDate: { fontSize: 12, color: colors.placeholder },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  passwordBox: { padding: 16, borderRadius: 8, backgroundColor: colors.background, gap: 16 },
}));

