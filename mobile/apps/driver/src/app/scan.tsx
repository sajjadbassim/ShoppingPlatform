import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText, brand, colors, createStyles, fonts, useTheme } from '@wasit/ui';
import { findOrderByCode } from '@wasit/shared';
import { useDriverOrders } from '../api/useDriver';
import { ActionButton } from '../components/kit';
import { toast } from '../lib/toast';

// باركود الطلب = رقم الطلب. عند المسح يفتح تفاصيل الطلب مباشرة، وإن لم يكن للمندوب يُنبَّه ويستمر المسح
export default function ScanScreen() {
  useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const active = useDriverOrders(false);
  const history = useDriverOrders(true);
  const [code, setCode] = useState('');
  const [torch, setTorch] = useState(false);
  // يمنع فتح الشاشة مرتين عند التقاط الباركود نفسه عدة إطارات متتالية
  const busy = useRef(false);
  const lastMiss = useRef<{ code: string; at: number } | null>(null);

  const open = (raw: string, fromCamera: boolean) => {
    const value = raw.trim();
    if (!value || busy.current) return;
    const orders = [...(active.data ?? []), ...(history.data ?? [])];
    const order = findOrderByCode(orders, value);
    if (order) {
      busy.current = true;
      router.replace({ pathname: '/order/[id]', params: { id: order.orderId } });
      return;
    }
    // الكاميرا تلتقط الباركود نفسه باستمرار: لا نكرر الرسالة أكثر من مرة كل 3 ثوانٍ
    const now = Date.now();
    if (fromCamera && lastMiss.current?.code === value && now - lastMiss.current.at < 3000) return;
    lastMiss.current = { code: value, at: now };
    toast.error(active.isLoading || history.isLoading ? 'جاري تحميل الطلبات، حاول ثانية' : `لا يوجد طلب ${value} بين طلباتك`);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="رجوع">
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </Pressable>
        <AppText weight="extraBold" style={{ fontSize: 18, flex: 1 }}>مسح باركود الطلب</AppText>
      </View>

      {!permission ? (
        <View style={styles.center} />
      ) : !permission.granted ? (
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={44} color={colors.placeholder} />
          <AppText weight="bold" style={{ fontSize: 16, textAlign: 'center' }}>نحتاج إذن الكاميرا لمسح الباركود</AppText>
          <ActionButton title="السماح بالكاميرا" icon="camera-outline" onPress={requestPermission} />
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'itf14', 'codabar', 'datamatrix'] }}
            onBarcodeScanned={({ data }) => open(data, true)}
          />
          <View pointerEvents="none" style={styles.frameLayer}>
            <View style={styles.frame} />
            <AppText style={styles.hint}>وجّه الكاميرا نحو باركود الطلب</AppText>
          </View>
          <Pressable onPress={() => setTorch((t) => !t)} accessibilityLabel="الفلاش" style={styles.torch}>
            <Ionicons name={torch ? 'flash' : 'flash-outline'} size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      <View style={styles.manual}>
        <AppText muted style={{ fontSize: 12.5 }}>أو اكتب رقم الطلب يدوياً</AppText>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="رقم الطلب"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => open(code, false)}
            style={styles.input}
          />
          <Pressable onPress={() => open(code, false)} accessibilityLabel="بحث" style={styles.go}>
            <Ionicons name="search" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  cameraWrap: { flex: 1, marginHorizontal: 16, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000000' },
  frameLayer: { ...({ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 } as const), alignItems: 'center', justifyContent: 'center', gap: 18 },
  frame: { width: '72%', aspectRatio: 1.5, borderRadius: 20, borderWidth: 3, borderColor: colors.primary },
  hint: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 14, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, overflow: 'hidden' },
  torch: { position: 'absolute', top: 12, end: 12, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  manual: { padding: 16, gap: 8 },
  input: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: brand.surfaceMuted, paddingHorizontal: 14, color: colors.text, fontFamily: fonts.medium, fontSize: 16, textAlign: 'left', writingDirection: 'ltr' },
  go: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
}));
