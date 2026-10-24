import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl, updateVendorProfile, type PickedImage } from '@wasit/shared';
import { AppText, colors, createStyles, Input, useTheme } from '@wasit/ui';
import { useProfile } from '../../api/useVendor';
import { ActionButton, Card, money, Screen } from '../../components/kit';
import { toast } from '../../lib/toast';
import { useVendorId } from '../../lib/vendor';

const pick = async (aspect: [number, number]): Promise<PickedImage | null> => {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.8 });
  if (res.canceled) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.fileName ?? `store-${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' };
};

// معلومات المتجر: الاسم والوصف والهاتف والعنوان والحد الأدنى ووقت التحضير، والشعار والغلاف
export default function StoreSettingsScreen() {
  useTheme();
  const vendorId = useVendorId();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const v = profile.data;
  const [form, setForm] = useState({ Name: '', NameAr: '', Description: '', Phone: '', Address: '', MinOrderAmount: '', EstimatedPrepTime: '' });
  const [logo, setLogo] = useState<PickedImage | null>(null);
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!v) return;
    setForm({
      Name: v.name || '',
      NameAr: v.nameAr || '',
      Description: v.description || '',
      Phone: v.phone || '',
      Address: v.address || '',
      MinOrderAmount: v.minOrderAmount ? String(v.minOrderAmount) : '',
      EstimatedPrepTime: v.estimatedPrepTime ? String(v.estimatedPrepTime) : '',
    });
  }, [v]);

  const save = async () => {
    setSaving(true);
    try {
      // الوصف والعنوان يُرسلان دائماً حتى يمكن مسحهما؛ البقية تُرسل إن كُتبت (الاسم والهاتف لا يُمسحان)
      const patch: Record<string, string> = {};
      for (const [k, val] of Object.entries(form)) if (val || k === 'Description' || k === 'Address') patch[k] = val;
      await updateVendorProfile(vendorId, patch, { logo: logo ?? undefined, cover: cover ?? undefined });
      setLogo(null);
      setCover(null);
      queryClient.invalidateQueries({ queryKey: ['v-profile'] });
      toast.success('تم تحديث معلومات المتجر');
    } catch (e) {
      toast.error((e as { message?: string }).message || 'فشل التحديث');
    } finally {
      setSaving(false);
    }
  };

  const coverUri = cover?.uri ?? (v?.coverImageUrl ? getImageUrl(v.coverImageUrl, 800) : null);
  const logoUri = logo?.uri ?? (v?.logoUrl ? getImageUrl(v.logoUrl, 200) : null);

  return (
    <Screen
      title="معلومات المتجر"
      back
      footer={<ActionButton title="حفظ" icon="save-outline" onPress={save} loading={saving} disabled={!v} />}
    >
      <Card pad={0}>
        <Pressable onPress={async () => setCover((await pick([16, 9])) ?? cover)} style={styles.cover} accessibilityLabel="تغيير صورة الغلاف">
          {coverUri ? <Image source={{ uri: coverUri }} style={{ flex: 1 }} contentFit="cover" /> : <AppText muted style={{ textAlign: 'center', marginTop: 34 }}>لا توجد صورة غلاف</AppText>}
          <View style={styles.coverBtn}><Ionicons name="camera-outline" size={14} color="#FFFFFF" /><AppText weight="bold" style={{ color: '#FFFFFF', fontSize: 12 }}>تغيير الغلاف</AppText></View>
        </Pressable>
        <View style={styles.logoRow}>
          <Pressable onPress={async () => setLogo((await pick([1, 1])) ?? logo)} style={styles.logo} accessibilityLabel="تغيير الشعار">
            {logoUri ? <Image source={{ uri: logoUri }} style={{ flex: 1 }} contentFit="cover" /> : <Ionicons name="storefront-outline" size={28} color={colors.primary} style={{ margin: 'auto' }} />}
          </Pressable>
          <AppText weight="bold" style={{ color: colors.primaryHover }} onPress={async () => setLogo((await pick([1, 1])) ?? logo)}>تغيير الشعار</AppText>
        </View>
      </Card>

      <Card>
        <Input label="اسم المتجر بالعربي" value={form.NameAr} onChangeText={(t) => set({ NameAr: t })} placeholder="اسم المتجر بالعربي" />
        <Input label="الاسم بالإنجليزية" value={form.Name} onChangeText={(t) => set({ Name: t })} placeholder="Store Name" ltr autoCapitalize="none" />
        <Input label="الوصف" value={form.Description} onChangeText={(t) => set({ Description: t })} placeholder="وصف مختصر للمتجر" multiline style={{ minHeight: 76, textAlignVertical: 'top' }} />
        <Input label="الهاتف" value={form.Phone} onChangeText={(t) => set({ Phone: t })} placeholder="+964..." keyboardType="phone-pad" ltr />
        <Input label="عنوان المتجر" value={form.Address} onChangeText={(t) => set({ Address: t })} placeholder="عنوان المتجر" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Input label="الحد الأدنى للطلب (د.ع)" value={form.MinOrderAmount} onChangeText={(t) => set({ MinOrderAmount: t })} placeholder="0 د.ع" keyboardType="number-pad" ltr /></View>
          <View style={{ flex: 1 }}><Input label="وقت التحضير (دقيقة)" value={form.EstimatedPrepTime} onChangeText={(t) => set({ EstimatedPrepTime: t })} placeholder="30" keyboardType="number-pad" ltr /></View>
        </View>
        <View style={styles.info}>
          <AppText muted style={{ fontSize: 13 }}>رسوم التوصيل</AppText>
          <AppText weight="bold" style={{ fontSize: 13 }}>{v ? `${money(v.deliveryFee)} · تحددها إدارة المنصة` : '—'}</AppText>
        </View>
      </Card>
    </Screen>
  );
}

const styles = createStyles(() => ({
  cover: { height: 130, backgroundColor: '#F8ECDA', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  coverBtn: { position: 'absolute', bottom: 8, start: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(42,26,14,0.7)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14, marginTop: -28 },
  logo: { width: 66, height: 66, borderRadius: 20, backgroundColor: '#FEF3E2', borderWidth: 3, borderColor: '#FFFFFF', overflow: 'hidden' },
  info: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8ECDA', borderRadius: 14, padding: 12 },
}));
