import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { formatDateTime, removeStaff, saveStaff, toggleStaff, validateStaff, VENDOR_PERMISSIONS, type StaffMember } from '@wasit/shared';
import { AppText, colors, createStyles, Input, useTheme , tc } from '@wasit/ui';
import { useStaff } from '../api/useVendor';
import { ActionButton, Card, Chip, Empty, ltr, Screen } from '../components/kit';
import { Sheet } from '../components/Sheet';
import { confirmDialog } from '../lib/dialog';
import { toast } from '../lib/toast';
import { useVendorSession } from '../lib/vendor';

const labelOf = Object.fromEntries(VENDOR_PERMISSIONS.map((p) => [p.key, p.label]));

// موظفو المتجر (لصاحبه فقط): كل موظف يدخل برقمه وكلمة مروره ويرى الأقسام المسموحة، وما يفعله يظهر باسمه في سجل النشاط
export default function StaffScreen() {
  useTheme();
  const { session, isStaff } = useVendorSession();
  const queryClient = useQueryClient();
  const q = useStaff();
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['v-staff'] });

  if (isStaff) {
    return (
      <Screen title="الموظفون" back>
        <Empty icon="lock-closed-outline" text="هذه الصفحة لصاحب المتجر فقط" />
      </Screen>
    );
  }

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر تنفيذ العملية');
    }
  };

  const list = q.data ?? [];
  return (
    <Screen
      title="الموظفون"
      subtitle="كل موظف يرى الأقسام التي تسمح بها فقط"
      back
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      footer={<ActionButton title="إضافة موظف" icon="person-add-outline" onPress={() => setEditing('new')} />}
    >
      {q.isLoading ? (
        <AppText muted style={{ textAlign: 'center', paddingVertical: 30 }}>جاري التحميل...</AppText>
      ) : list.length === 0 ? (
        <Empty icon="people-outline" text="لا يوجد موظفون بعد" />
      ) : (
        list.map((s) => {
          const self = s.id === session?.userId;
          return (
            <Card key={s.id}>
              <View style={styles.row}>
                <View style={[styles.avatar, !s.isActive && { backgroundColor: tc('#E5E7EB') }]}><AppText weight="extraBold" style={{ color: '#FFFFFF', fontSize: 18 }}>{(s.fullName || '؟').slice(0, 1)}</AppText></View>
                <View style={{ flex: 1 }}>
                  <AppText weight="extraBold" style={{ fontSize: 15.5 }}>{s.fullName}{self ? ' (أنت)' : ''}</AppText>
                  <AppText muted style={{ fontSize: 12.5 }}>{ltr(s.phone ?? '')}{s.email ? ` · ${s.email}` : ''}</AppText>
                </View>
                {!s.isActive && <Chip label="موقوف" tone="muted" />}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {s.fullAccess ? <Chip label="صلاحيات كاملة" tone="warn" /> : s.permissions.map((p) => <Chip key={p} label={labelOf[p] ?? p} />)}
              </View>
              <AppText muted style={{ fontSize: 11.5 }}>آخر دخول: {s.lastLogin ? formatDateTime(s.lastLogin) : 'لم يدخل بعد'}</AppText>
              {!self && (
                <View style={styles.row}>
                  <ActionButton title="تعديل" tone="soft" compact onPress={() => setEditing(s)} />
                  <ActionButton title={s.isActive ? 'إيقاف' : 'تفعيل'} tone="ghost" compact onPress={() => act(() => toggleStaff(s.id), s.isActive ? 'أُوقف الحساب' : 'فُعّل الحساب')} />
                  <ActionButton title="إزالة" tone="bad" compact onPress={() => confirmDialog({ title: 'إزالة الموظف؟', message: `سيُوقف حساب ${s.fullName} ويُفصل عن متجرك فوراً. يبقى ما فعله ظاهراً في سجل النشاط.`, confirmText: 'إزالة', tone: 'danger', onConfirm: () => act(() => removeStaff(s.id), 'أُزيل الموظف') })} />
                </View>
              )}
            </Card>
          );
        })
      )}
      <StaffSheet staff={editing} onClose={() => setEditing(null)} onDone={refresh} />
    </Screen>
  );
}

function StaffSheet({ staff, onClose, onDone }: { staff: StaffMember | 'new' | null; onClose: () => void; onDone: () => void }) {
  useTheme();
  const s = staff && staff !== 'new' ? staff : null;
  const [key, setKey] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [fullAccess, setFullAccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const k = staff ? (s ? s.id : 'new') : null;
  if (k !== key) {
    setKey(k);
    setFullName(s?.fullName ?? '');
    setPhone(s?.phone ?? '');
    setEmail(s?.email ?? '');
    setPassword('');
    setPermissions(s?.permissions ?? []);
    setFullAccess(s?.fullAccess ?? false);
  }
  const toggle = (p: string) => setPermissions((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const valid = validateStaff({ fullName, phone, password, permissions, fullAccess }, !!s);

  const save = async () => {
    setBusy(true);
    try {
      await saveStaff(s?.id ?? null, { fullName, phone, email: email || null, password: password || null, permissions, fullAccess });
      toast.success('تم الحفظ');
      onClose();
      onDone();
    } catch (e) {
      toast.error((e as { message?: string }).message || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={!!staff} onClose={onClose} busy={busy} title={s ? `تعديل ${s.fullName}` : 'إضافة موظف'} footer={<><ActionButton title="إلغاء" tone="ghost" onPress={onClose} disabled={busy} /><ActionButton title="حفظ" onPress={save} loading={busy} disabled={!valid} /></>}>
      <Input label="الاسم" value={fullName} onChangeText={setFullName} maxLength={100} />
      {!s && (
        <>
          <Input label="رقم الهاتف (للدخول)" value={phone} onChangeText={setPhone} placeholder="07XX XXX XXXX" keyboardType="phone-pad" ltr />
          <Input label="البريد (اختياري)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" ltr />
        </>
      )}
      <Input label={s ? 'كلمة مرور جديدة (اتركها فارغة بلا تغيير)' : 'كلمة المرور'} value={password} onChangeText={setPassword} placeholder="6 أحرف على الأقل" secure autoCapitalize="none" ltr />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <AppText weight="bold" style={{ fontSize: 15 }}>صلاحيات كاملة</AppText>
          <AppText muted style={{ fontSize: 12.5 }}>كل أقسام المتجر عدا إدارة الموظفين</AppText>
        </View>
        <Switch value={fullAccess} onValueChange={setFullAccess} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFFFFF" />
      </View>
      {!fullAccess && (
        <View style={{ gap: 8 }}>
          <AppText weight="bold" style={{ fontSize: 14 }}>الصلاحيات</AppText>
          {VENDOR_PERMISSIONS.map((p) => {
            const on = permissions.includes(p.key);
            return (
              <Pressable key={p.key} onPress={() => toggle(p.key)} style={[styles.perm, on && styles.permOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.placeholder} />
                <View style={{ flex: 1 }}>
                  <AppText weight={on ? 'bold' : 'medium'} style={{ fontSize: 14.5 }}>{p.label}</AppText>
                  <AppText muted style={{ fontSize: 12 }}>{p.desc}</AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

const styles = createStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#D4621A', alignItems: 'center', justifyContent: 'center' },
  perm: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border },
  permOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
}));
