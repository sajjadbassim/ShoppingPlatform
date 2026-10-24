import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { deleteAccount, type ApiError } from '@wasit/shared';
import { AppText, Button, Input, colors, radius, spacing, createStyles, useTheme } from '@wasit/ui';
import { queryClient } from '../api/queryClient';
import { AppHeader } from '../components/AppHeader';
import { confirmDialog } from '../lib/dialog';
import { toast } from '../lib/toast';

const POINTS = [
  'يُحذف اسمك ورقمك وبريدك وعناوينك ومفضلتك نهائياً ولا يمكن التراجع.',
  'تبقى سجلات طلباتك السابقة دون بيانات شخصية.',
  'لا يتم الحذف ما دام لديك طلب جارٍ أو طلب إرجاع قيد المعالجة.',
];

export default function DeleteAccountScreen() {
  useTheme();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = () =>
    confirmDialog({
      title: 'حذف الحساب نهائياً؟',
      message: 'لن تتمكن من استرجاع حسابك أو بياناتك بعد الحذف.',
      confirmText: 'نعم، احذف حسابي',
      tone: 'danger',
      icon: 'trash-outline',
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteAccount(password);
          queryClient.clear();
          router.replace('/');
          toast.success('تم حذف حسابك');
        } catch (e) {
          toast.error((e as ApiError).message || 'تعذّر حذف الحساب');
        } finally {
          setBusy(false);
        }
      },
    });

  return (
    <View style={styles.screen}>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.icon}>
          <Ionicons name="warning-outline" size={34} color={colors.errorDark} />
        </View>
        <AppText weight="extraBold" style={{ fontSize: 24, textAlign: 'center' }}>
          حذف الحساب
        </AppText>

        <View style={styles.card}>
          {POINTS.map((p) => (
            <View key={p} style={styles.point}>
              <Ionicons name="remove-circle-outline" size={18} color={colors.errorDark} style={{ marginTop: 3 }} />
              <AppText style={{ flex: 1, fontSize: 14, lineHeight: 24 }}>{p}</AppText>
            </View>
          ))}
        </View>

        <Input label="كلمة المرور للتأكيد" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" ltr />
        <AppText muted style={{ fontSize: 12, marginTop: -8 }}>
          إن كان حسابك مسجّلاً بـ Google بلا كلمة مرور فاتركه فارغاً.
        </AppText>

        <Button title="حذف حسابي" variant="danger" loading={busy} onPress={submit} />
        <Button title="إلغاء" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  icon: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: colors.errorLight, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 10 },
  point: { flexDirection: 'row', gap: 8 },
}));
