import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { validateAddress, type AddressErrors, type ApiError, type AuthUser, useSessionStore } from '@wasit/shared';
import { AppText, ErrorBanner, Input, colors, radius, spacing, createStyles, useTheme } from '@wasit/ui';
import { AppHeader } from '../components/AppHeader';
import { toast } from '../lib/toast';
import { useAddresses, useCreateAddress, useUpdateAddress, useZonesConfig } from '../api/useCheckout';
import { PinPicker, type Pin } from '../components/PinPicker';
import { ZonePicker } from '../components/ZonePicker';

export default function NewAddressScreen() {
  useTheme();
  const user = useSessionStore((s) => s.session) as AuthUser | null;
  // id موجود = تعديل عنوان محفوظ
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: addresses } = useAddresses();
  const editing = id ? addresses?.find((a) => a.id === id) : undefined;
  const create = useCreateAddress();
  const update = useUpdateAddress();
  const { data: zones } = useZonesConfig();
  const saving = create.isPending || update.isPending;

  const [label, setLabel] = useState(editing?.label ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? user?.phone ?? '');
  const [city, setCity] = useState(editing?.city ?? '');
  const [area, setArea] = useState(editing?.area ?? '');
  const [streetAddress, setStreetAddress] = useState(editing?.streetAddress ?? '');
  const [buildingNumber, setBuildingNumber] = useState(editing?.buildingNumber ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [isDefault, setIsDefault] = useState(editing ? editing.isDefault : !addresses?.length);
  const [zoneId, setZoneId] = useState<string | null>(editing?.zoneId ?? null);
  const [pin, setPin] = useState<Pin | null>(
    editing && editing.latitude != null && editing.longitude != null ? { latitude: editing.latitude, longitude: editing.longitude } : null,
  );
  const [errors, setErrors] = useState<AddressErrors>({});
  const [scrollOn, setScrollOn] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const clear = (key: keyof AddressErrors) => setErrors((p) => ({ ...p, [key]: undefined }));

  const submit = async () => {
    const found = validateAddress({ label, phone, city, area, streetAddress }, pin);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) {
      toast.error(found.pin && Object.keys(found).length === 1 ? 'حدّد موقع العنوان على الخريطة' : 'تحقق من الحقول المطلوبة');
      return;
    }

    try {
      const input = {
        label,
        phone,
        city,
        area,
        streetAddress,
        buildingNumber,
        notes,
        isDefault,
        latitude: pin!.latitude,
        longitude: pin!.longitude,
        zoneId,
      };
      if (editing) await update.mutateAsync({ id: editing.id, input });
      else await create.mutateAsync(input);
      toast.success(editing ? 'تم تحديث العنوان بنجاح' : 'تم إضافة العنوان بنجاح');
      router.back();
    } catch (e) {
      setServerError((e as ApiError).message || 'تعذّر حفظ العنوان');
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEnabled={scrollOn}>
        <AppText weight="extraBold" style={{ fontSize: 22 }}>
          {editing ? 'تعديل العنوان' : 'إضافة عنوان جديد'}
        </AppText>
        {serverError && <ErrorBanner title="تعذّر حفظ العنوان" message={serverError} />}

        <View style={{ gap: 8 }}>
          <AppText weight="medium" style={{ fontSize: 14 }}>
            الموقع على الخريطة <AppText style={{ color: colors.error }}>*</AppText>
          </AppText>
          <PinPicker
            value={pin}
            error={errors.pin}
            onTouching={(t) => setScrollOn(!t)}
            onChange={(p) => {
              setPin(p);
              clear('pin');
            }}
          />
        </View>

        <Input
          label="عنوان مختصر"
          placeholder="مثال: المنزل، العمل"
          value={label}
          onChangeText={(t) => { setLabel(t); clear('label'); }}
          error={errors.label}
        />
        <Input
          label="رقم الهاتف"
          value={phone}
          onChangeText={(t) => { setPhone(t); clear('phone'); }}
          error={errors.phone}
          keyboardType="phone-pad"
          ltr
        />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input label="المدينة" placeholder="بغداد" value={city} onChangeText={(t) => { setCity(t); clear('city'); }} error={errors.city} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="المنطقة" placeholder="المنصور" value={area} onChangeText={(t) => { setArea(t); clear('area'); }} error={errors.area} />
          </View>
        </View>
        {!!zones?.enabled && !!zones.zones?.length && (
          <View style={{ gap: 8 }}>
            <AppText weight="medium" style={{ fontSize: 14 }}>
              منطقة التوصيل
            </AppText>
            <ZonePicker zones={zones.zones} value={zoneId} onChange={setZoneId} />
            <AppText muted style={{ fontSize: 12 }}>
              تحدد رسوم التوصيل — إن لم تجد منطقتك اتركها فارغة
            </AppText>
          </View>
        )}
        <Input
          label="الشارع"
          placeholder="شارع 14 رمضان"
          value={streetAddress}
          onChangeText={(t) => { setStreetAddress(t); clear('streetAddress'); }}
          error={errors.streetAddress}
        />
        <Input label="تفاصيل إضافية (اختياري)" placeholder="رقم البناية، الشقة..." value={buildingNumber} onChangeText={setBuildingNumber} />
        <Input label="ملاحظات للسائق (اختياري)" value={notes} onChangeText={setNotes} multiline />

        <Pressable onPress={() => setIsDefault(!isDefault)} style={styles.defaultRow} accessibilityRole="checkbox">
          <Ionicons name={isDefault ? 'checkbox' : 'square-outline'} size={22} color={isDefault ? colors.primary : colors.textMuted} />
          <AppText style={{ fontSize: 14 }}>تعيين كعنوان افتراضي</AppText>
        </Pressable>

        <View style={styles.row}>
          <Pressable onPress={() => router.back()} style={[styles.btn, styles.cancel]}>
            <AppText weight="bold" style={{ fontSize: 15 }}>
              إلغاء
            </AppText>
          </Pressable>
          <Pressable onPress={submit} disabled={saving} style={[styles.btn, styles.save, saving && { opacity: 0.6 }]}>
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <AppText weight="bold" style={{ fontSize: 15, color: colors.white }}>
                {editing ? 'حفظ التعديلات' : 'إضافة العنوان'}
              </AppText>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  row: { flexDirection: 'row', gap: 12 },
  defaultRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { flex: 1, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  cancel: { borderWidth: 1.5, borderColor: '#D1D5DB' },
  save: { backgroundColor: colors.primary },
}));
